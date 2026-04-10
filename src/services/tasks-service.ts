import { nanoid } from "nanoid";

import { ApprovalStatus, ApprovalType, TaskStatus, TimeEntryType, TimerState, UserRole } from "../types/index.js";
import {
  ActivityRepository,
  ApprovalRepository,
  CommentRepository,
  ProjectRepository,
  TaskRepository,
  TimeEntryRepository,
  UserRepository,
} from "../repositories/index.js";
import type { PaginationResult } from "../types/auth.js";
import { AppError } from "../utils/app-error.js";
import { calculateElapsedWholeMinutes, calculateElapsedWholeSeconds } from "../utils/elapsed-time.js";
import { toPlain, toPlainList } from "../utils/serializers.js";
import { nextStatusForTimerState } from "../utils/task-rules.js";

export class TasksService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly userRepository: UserRepository,
    private readonly timeEntryRepository: TimeEntryRepository,
    private readonly commentRepository: CommentRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly activityRepository: ActivityRepository,
    private readonly approvalRepository: ApprovalRepository,
  ) {}

  async listTasks(
    actor: { id: string; role: UserRole },
    query: Record<string, string | number | boolean | undefined>,
  ) {
    const filters: Record<string, unknown> = {};
    const andConditions: Array<Record<string, unknown>> = [];

    if (actor.role === UserRole.EMPLOYEE) {
      filters.assigneeId = actor.id;
    } else if (actor.role === UserRole.MANAGER) {
      const team = await this.userRepository.findIdsByManagerId(actor.id);
      andConditions.push({
        $or: [
          { createdByManagerId: actor.id },
          { assigneeId: { $in: team.map((member) => member.id) } },
        ],
      });
    }

    if (query.status) {
      filters.status = String(query.status);
    }

    if (query.projectId) {
      filters.projectId = String(query.projectId);
    }

    if (query.priority) {
      filters.priority = String(query.priority);
    }

    if (String(query.excludeCompleted) === "true") {
      filters.status = { $ne: TaskStatus.COMPLETED };
    }

    if (query.search) {
      const pattern = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      andConditions.push({ $or: [{ title: pattern }, { description: pattern }] });
    }

    if (String(query.today) === "true") {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      filters.dueDateUtc = { $gte: start, $lt: end };
    }

    const mongoQuery = andConditions.length > 0 ? { ...filters, $and: andConditions } : filters;
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 8);
    const paginated = String(query.paginated) === "true" || typeof query.page !== "undefined";

    if (!paginated) {
      const tasks = await this.taskRepository.findByQuery(mongoQuery);
      return toPlainList(tasks);
    }

    const [items, total] = await this.taskRepository.paginate(mongoQuery, page, pageSize);
    const response: PaginationResult<Record<string, unknown> | null> = {
      items: toPlainList(items),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };

    return response;
  }

  async getTaskDetails(actor: { id: string; role: UserRole }, taskId: string) {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    await this.ensureTaskAccess(actor, task);

    const [entries, comments, project, activity, assignee, createdBy, approvals] = await Promise.all([
      this.timeEntryRepository.findByTaskId(task.id),
      this.commentRepository.findByTaskId(task.id),
      this.projectRepository.findById(task.projectId),
      this.activityRepository.findById(task.activityId),
      this.userRepository.findById(task.assigneeId),
      this.userRepository.findById(task.createdByManagerId),
      this.approvalRepository.findByTaskId(task.id),
    ]);

    const authorIds = [...new Set(comments.map((comment) => comment.authorId))];
    const commentAuthors = await Promise.all(authorIds.map((authorId) => this.userRepository.findById(authorId)));

    return {
      task: toPlain(task),
      entries: toPlainList(entries),
      comments: toPlainList(comments),
      approvals: toPlainList(approvals),
      project: toPlain(project),
      activity: toPlain(activity),
      assignee: this.sanitizeUser(toPlain(assignee)),
      createdBy: this.sanitizeUser(toPlain(createdBy)),
      commentAuthors: commentAuthors
        .map((author) => this.sanitizeUser(toPlain(author)))
        .filter((author) => author !== null),
    };
  }

  async createTask(
    actor: { id: string; role: UserRole },
    input: {
      projectId: string;
      activityId: string;
      title: string;
      description: string;
      assigneeId: string;
      priority: string;
      estimatedHours: number;
      dueDateUtc: string;
    },
  ) {
    const assignee = await this.userRepository.findById(input.assigneeId);

    if (!assignee || assignee.userRole !== UserRole.EMPLOYEE) {
      throw new AppError(400, "Assignee must be a valid employee");
    }

    if (!assignee.isActive) {
      throw new AppError(400, "Blocked employees cannot be assigned to tasks");
    }

    if (actor.role === UserRole.MANAGER && assignee.managerId !== actor.id) {
      throw new AppError(403, "Employee is outside your team");
    }

    const task = await this.taskRepository.create({
      ...input,
      createdByManagerId: actor.id,
      status: TaskStatus.PENDING,
      loggedMinutes: 0,
      startedAtUtc: null,
      completedAtUtc: null,
      approvalPendingSinceUtc: null,
      rejectionReason: null,
      lastTimerEntryId: null,
    });

    return toPlain(task);
  }

  async startTimer(taskId: string, employeeId: string) {
    const [task, runningEntry] = await Promise.all([
      this.taskRepository.findById(taskId),
      this.timeEntryRepository.findRunningEntryByEmployeeId(employeeId),
    ]);

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    if (task.assigneeId !== employeeId) {
      throw new AppError(403, "Task is not assigned to you");
    }

    if (runningEntry) {
      throw new AppError(409, "You already have an active timer");
    }

    task.status = nextStatusForTimerState(task.status, TimerState.RUNNING);
    task.startedAtUtc = new Date();

    const entry = await this.timeEntryRepository.create({
      taskId: task.id,
      employeeId,
      projectId: task.projectId,
      activityId: task.activityId,
      entryType: TimeEntryType.TIMER,
      timerState: TimerState.RUNNING,
      startTimeUtc: new Date(),
      endTimeUtc: null,
      durationSeconds: 0,
      durationMinutes: 0,
      description: "Timer started",
      isSubmittedForApproval: false,
      approvalRequestId: null,
      clientEntryId: nanoid(),
    });

    task.lastTimerEntryId = entry.id;
    await task.save();

    return {
      task: toPlain(task),
      entry: toPlain(entry),
    };
  }

  async transitionTimer(taskId: string, timerState: TimerState, employeeId: string) {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    if (task.assigneeId !== employeeId) {
      throw new AppError(403, "Task is not assigned to you");
    }

    const entry = await this.timeEntryRepository.findLatestRunningEntry(taskId, employeeId);

    if (!entry) {
      throw new AppError(404, "Running timer not found");
    }

    const endTime = new Date();
    const durationSeconds = calculateElapsedWholeSeconds(entry.startTimeUtc, endTime);
    const minutes = calculateElapsedWholeMinutes(entry.startTimeUtc, endTime);

    entry.endTimeUtc = endTime;
    entry.durationSeconds = durationSeconds;
    entry.durationMinutes = minutes;
    entry.timerState = timerState;
    await entry.save();

    task.loggedMinutes += minutes;
    task.status = nextStatusForTimerState(task.status, timerState);
    await task.save();

    return {
      task: toPlain(task),
      entry: toPlain(entry),
    };
  }

  async requestCompletion(taskId: string, employeeId: string) {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    if (task.assigneeId !== employeeId) {
      throw new AppError(403, "Task is not assigned to you");
    }

    task.status = TaskStatus.COMPLETED;
    task.completedAtUtc = new Date();
    task.approvalPendingSinceUtc = null;
    task.rejectionReason = null;
    await task.save();

    return toPlain(task);
  }

  async requestDueDateChange(taskId: string, employeeId: string, dueDateUtc: string, reason: string) {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    if (task.assigneeId !== employeeId) {
      throw new AppError(403, "Task is not assigned to you");
    }

    const requestedDate = new Date(dueDateUtc);

    if (Number.isNaN(requestedDate.getTime())) {
      throw new AppError(400, "Invalid due date");
    }

    const approval = await this.approvalRepository.create({
      type: ApprovalType.DUE_DATE_CHANGE,
      taskId: task.id,
      timeEntryId: null,
      requestedBy: employeeId,
      reviewedBy: null,
      status: ApprovalStatus.PENDING,
      reason,
      managerComment: null,
      payload: {
        previousDueDateUtc: task.dueDateUtc.toISOString(),
        requestedDueDateUtc: requestedDate.toISOString(),
      },
      requestedAtUtc: new Date(),
      reviewedAtUtc: null,
    });

    return toPlain(approval);
  }

  async createManualLog(
    taskId: string,
    employeeId: string,
    startTimeUtc: string,
    endTimeUtc: string,
    description: string,
    reason: string,
  ) {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    if (task.assigneeId !== employeeId) {
      throw new AppError(403, "Task is not assigned to you");
    }

    const durationSeconds = calculateElapsedWholeSeconds(startTimeUtc, endTimeUtc);
    const minutes = calculateElapsedWholeMinutes(startTimeUtc, endTimeUtc);

    const entry = await this.timeEntryRepository.create({
      taskId: task.id,
      employeeId,
      projectId: task.projectId,
      activityId: task.activityId,
      entryType: TimeEntryType.MANUAL,
      timerState: TimerState.STOPPED,
      startTimeUtc,
      endTimeUtc,
      durationSeconds,
      durationMinutes: minutes,
      description,
      isSubmittedForApproval: true,
      approvalRequestId: null,
      clientEntryId: nanoid(),
    });

    const approval = await this.approvalRepository.create({
      type: ApprovalType.MANUAL_LOG,
      taskId: task.id,
      timeEntryId: entry.id,
      requestedBy: employeeId,
      reviewedBy: null,
      status: ApprovalStatus.PENDING,
      reason,
      managerComment: null,
      payload: {
        durationSeconds,
        durationMinutes: minutes,
      },
      requestedAtUtc: new Date(),
      reviewedAtUtc: null,
    });

    entry.approvalRequestId = approval.id;
    await entry.save();

    return {
      entry: toPlain(entry),
      approval: toPlain(approval),
    };
  }

  private async ensureTaskAccess(
    actor: { id: string; role: UserRole },
    task: { assigneeId: string; createdByManagerId: string },
  ) {
    if (actor.role === UserRole.EMPLOYEE && task.assigneeId !== actor.id) {
      throw new AppError(403, "You do not have access to this task");
    }

    if (actor.role === UserRole.MANAGER) {
      const team = await this.userRepository.findIdsByManagerId(actor.id);
      const teamIds = team.map((member) => member.id);

      if (task.createdByManagerId !== actor.id && !teamIds.includes(task.assigneeId)) {
        throw new AppError(403, "You do not have access to this task");
      }
    }
  }

  private sanitizeUser(user: Record<string, unknown> | null) {
    if (!user) {
      return null;
    }

    delete user.passwordHash;
    return user;
  }
}
