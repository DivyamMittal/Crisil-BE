import { nanoid } from "nanoid";

import {
  ApprovalStatus,
  ApprovalType,
  TaskStatus,
  TimeEntryType,
  TimerState,
  UserRole,
} from "../types/index.js";
import {
  ActivityRepository,
  ApprovalRepository,
  CommentRepository,
  ProjectRepository,
  TaskRepository,
  TeamRepository,
  TimeEntryRepository,
  UserRepository,
} from "../repositories/index.js";
import type { PaginationResult } from "../types/auth.js";
import { AppError } from "../utils/app-error.js";
import {
  calculateElapsedWholeMinutes,
  calculateElapsedWholeSeconds,
} from "../utils/elapsed-time.js";
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
    private readonly teamRepository: TeamRepository,
  ) {}

  async listTasks(
    actor: { id: string; role: UserRole },
    query: Record<string, string | number | boolean | undefined>,
  ) {
    const filters: Record<string, unknown> = {};
    const andConditions: Array<Record<string, unknown>> = [];

    if (actor.role === UserRole.EMPLOYEE) {
      andConditions.push({
        $or: [{ assigneeId: actor.id }, { assigneeIds: actor.id }],
      });
    } else if (actor.role === UserRole.MANAGER) {
      const teamIds = await this.getManagerEmployeeIds(actor.id);
      const managedTeams = await this.teamRepository.findByManagerId(actor.id);
      const managedTeamIds = managedTeams.map((currentTeam) =>
        String(currentTeam.id),
      );
      andConditions.push({
        $or: [
          { createdByManagerId: actor.id },
          { assigneeId: { $in: teamIds } },
          { assigneeIds: { $in: teamIds } },
          { assignedTeamIds: { $in: managedTeamIds } },
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
      const pattern = new RegExp(
        String(query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );

      const [matchingProjects, matchingActivities] = await Promise.all([
        this.projectRepository.findByQuery({ name: pattern }),
        this.activityRepository.findByQuery({ name: pattern }),
      ]);

      const projectIds = matchingProjects.map((p) => String(p._id));
      const activityIds = matchingActivities.map((a) => String(a._id));

      andConditions.push({
        $or: [
          { title: pattern },
          { description: pattern },
          { projectId: { $in: projectIds } },
          { activityId: { $in: activityIds } },
        ],
      });
    }

    if (String(query.today) === "true") {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      andConditions.push({
        $or: [
          { status: TaskStatus.WIP },
          { status: TaskStatus.ON_HOLD },
          { createdAt: { $gte: start, $lt: end } },
          { startedAtUtc: { $gte: start, $lt: end } },
          { completedAtUtc: { $gte: start, $lt: end } },
          { dueDateUtc: { $gte: start, $lt: end } },
        ],
      });
    }

    const mongoQuery =
      andConditions.length > 0 ? { ...filters, $and: andConditions } : filters;
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 8);
    const paginated =
      String(query.paginated) === "true" || typeof query.page !== "undefined";

    if (!paginated) {
      const tasks = await this.taskRepository.findByQuery(mongoQuery);
      return this.enrichTasksWithNames(tasks);
    }

    const [items, total] = await this.taskRepository.paginate(
      mongoQuery,
      page,
      pageSize,
    );
    const response: PaginationResult<Record<string, unknown> | null> = {
      items: (await this.enrichTasksWithNames(items)) as any,
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

    const assignedTeamIds = Array.isArray(task.assignedTeamIds)
      ? task.assignedTeamIds
      : [];
    const [
      entries,
      comments,
      project,
      activity,
      assignee,
      createdBy,
      approvals,
      assignedTeams,
    ] = await Promise.all([
      this.timeEntryRepository.findByTaskId(task.id),
      this.commentRepository.findByTaskId(task.id),
      this.projectRepository.findById(task.projectId),
      this.activityRepository.findById(task.activityId),
      this.userRepository.findById(task.assigneeId),
      this.userRepository.findById(task.createdByManagerId),
      this.approvalRepository.findByTaskId(task.id),
      this.teamRepository.findByIds(assignedTeamIds),
    ]);

    const assigneeIds = this.getTaskAssigneeIds(task);
    const assignees = await Promise.all(
      assigneeIds.map((assigneeId) => this.userRepository.findById(assigneeId)),
    );
    const authorIds = [...new Set(comments.map((comment) => comment.authorId))];
    const commentAuthors = await Promise.all(
      authorIds.map((authorId) => this.userRepository.findById(authorId)),
    );

    return {
      task: toPlain(task),
      entries: toPlainList(entries),
      comments: toPlainList(comments),
      approvals: toPlainList(approvals),
      project: toPlain(project),
      activity: toPlain(activity),
      assignee: this.sanitizeUser(toPlain(assignee)),
      assignees: assignees
        .map((currentAssignee) => this.sanitizeUser(toPlain(currentAssignee)))
        .filter((currentAssignee) => currentAssignee !== null),
      assignedTeams: toPlainList(assignedTeams),
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
      assignmentType: "EMPLOYEE" | "TEAM";
      assigneeIds: string[];
      assignedTeamIds: string[];
      priority: string;
      estimatedHours: number;
      hasCountTracking: boolean;
      countNumber: number | null;
      benchmarkMinutesPerCount: number | null;
      dueDateUtc: string;
    },
  ) {
    const uniqueTeamIds = [...new Set(input.assignedTeamIds ?? [])];
    const selectedTeams =
      input.assignmentType === "TEAM"
        ? await this.teamRepository.findByIds(uniqueTeamIds)
        : [];
    const resolvedAssigneeIds =
      input.assignmentType === "TEAM"
        ? [...new Set(selectedTeams.flatMap((team) => team.memberIds ?? []))]
        : [...new Set(input.assigneeIds)];
    const assignees = await Promise.all(
      resolvedAssigneeIds.map((assigneeId) =>
        this.userRepository.findById(assigneeId),
      ),
    );

    if (
      assignees.some(
        (assignee) => !assignee || assignee.userRole !== UserRole.EMPLOYEE,
      )
    ) {
      throw new AppError(400, "All assignees must be valid employees");
    }

    if (resolvedAssigneeIds.length === 0) {
      throw new AppError(400, "At least one employee assignee is required");
    }

    if (assignees.some((assignee) => !assignee?.isActive)) {
      throw new AppError(400, "Blocked employees cannot be assigned to tasks");
    }

    if (actor.role === UserRole.MANAGER) {
      const managerEmployeeIds = await this.getManagerEmployeeIds(actor.id);

      if (
        input.assignmentType === "EMPLOYEE" &&
        resolvedAssigneeIds.some(
          (assigneeId) => !managerEmployeeIds.includes(assigneeId),
        )
      ) {
        throw new AppError(403, "One or more employees are outside your team");
      }
    }

    if (
      !input.hasCountTracking &&
      input.assignmentType !== "TEAM" &&
      resolvedAssigneeIds.length !== 1
    ) {
      throw new AppError(400, "Non-count tasks must have exactly one assignee");
    }

    if (input.assignmentType === "TEAM" && selectedTeams.length === 0) {
      throw new AppError(400, "At least one valid team is required");
    }

    if (
      input.hasCountTracking &&
      (!input.countNumber || input.countNumber < 1)
    ) {
      throw new AppError(400, "Count number is required for count-based tasks");
    }

    const estimatedHours = input.hasCountTracking
      ? ((input.benchmarkMinutesPerCount ?? 0) * (input.countNumber ?? 0)) / 60
      : input.estimatedHours;

    const task = await this.taskRepository.create({
      ...input,
      estimatedHours,
      assigneeId: resolvedAssigneeIds[0],
      assigneeIds: resolvedAssigneeIds,
      assignedTeamIds: input.assignmentType === "TEAM" ? uniqueTeamIds : [],
      createdByManagerId: actor.id,
      status: TaskStatus.PENDING,
      loggedMinutes: 0,
      hasCountTracking: input.hasCountTracking,
      countNumber: input.hasCountTracking ? input.countNumber : null,
      benchmarkMinutesPerCount: input.hasCountTracking
        ? input.benchmarkMinutesPerCount
        : null,
      totalCountCompleted: 0,
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

    if (!this.getTaskAssigneeIds(task).includes(employeeId)) {
      throw new AppError(403, "Task is not assigned to you");
    }

    const taskRunningEntries =
      await this.timeEntryRepository.findRunningEntriesByTaskId(taskId);

    if (runningEntry) {
      throw new AppError(409, "You already have an active timer");
    }

    if (
      !task.hasCountTracking &&
      taskRunningEntries.some(
        (entry: { employeeId: string }) => entry.employeeId !== employeeId,
      )
    ) {
      throw new AppError(
        409,
        "Another assignee is already working on this task",
      );
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
      countCompleted: null,
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

  async transitionTimer(
    taskId: string,
    timerState: TimerState,
    employeeId: string,
    countCompleted?: number,
  ) {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    if (!this.getTaskAssigneeIds(task).includes(employeeId)) {
      throw new AppError(403, "Task is not assigned to you");
    }

    const entry = await this.timeEntryRepository.findLatestRunningEntry(
      taskId,
      employeeId,
    );

    if (!entry) {
      throw new AppError(404, "Running timer not found");
    }

    const endTime = new Date();
    const durationSeconds = calculateElapsedWholeSeconds(
      entry.startTimeUtc,
      endTime,
    );
    const minutes = calculateElapsedWholeMinutes(entry.startTimeUtc, endTime);
    const nextStatus = nextStatusForTimerState(task.status, timerState);

    entry.endTimeUtc = endTime;
    entry.durationSeconds = durationSeconds;
    entry.durationMinutes = minutes;
    entry.timerState = timerState;

    if (task.hasCountTracking && timerState !== TimerState.RUNNING) {
      if (
        typeof countCompleted !== "number" ||
        Number.isNaN(countCompleted) ||
        !Number.isInteger(countCompleted) ||
        countCompleted < 0
      ) {
        throw new AppError(400, "Count is required for count-based tasks");
      }

      const remainingCount = Math.max(
        0,
        (task.countNumber ?? 0) - task.totalCountCompleted,
      );

      if (countCompleted > remainingCount) {
        throw new AppError(
          400,
          `Completed count cannot exceed remaining count (${remainingCount})`,
        );
      }

      const updatedTask = await this.taskRepository.applyCountTimerTransition({
        taskId: task.id,
        countCompleted,
        loggedMinutes: minutes,
        status: nextStatus,
      });

      if (!updatedTask) {
        throw new AppError(
          400,
          "Completed count exceeds the remaining count for this task",
        );
      }

      entry.countCompleted = countCompleted;
      await entry.save();

      return {
        task: toPlain(updatedTask),
        entry: toPlain(entry),
      };
    }

    await entry.save();

    task.loggedMinutes += minutes;
    task.status = nextStatus;
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

    if (!this.getTaskAssigneeIds(task).includes(employeeId)) {
      throw new AppError(403, "Task is not assigned to you");
    }

    task.status = TaskStatus.COMPLETED;
    task.completedAtUtc = new Date();
    task.approvalPendingSinceUtc = null;
    task.rejectionReason = null;
    await task.save();

    return toPlain(task);
  }

  async requestDueDateChange(
    taskId: string,
    employeeId: string,
    dueDateUtc: string,
    reason: string,
  ) {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    if (!this.getTaskAssigneeIds(task).includes(employeeId)) {
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

    if (!this.getTaskAssigneeIds(task).includes(employeeId)) {
      throw new AppError(403, "Task is not assigned to you");
    }

    const durationSeconds = calculateElapsedWholeSeconds(
      startTimeUtc,
      endTimeUtc,
    );
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
      countCompleted: null,
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

  private async enrichTasksWithNames(tasks: any[]) {
    const plainTasks = toPlainList(tasks);
    if (plainTasks.length === 0) return [];

    const allAssigneeIds = [
      ...new Set(
        plainTasks
          .filter((task) => (task.assignedTeamIds?.length ?? 0) === 0)
          .flatMap((task) => this.getTaskAssigneeIds(task)),
      ),
    ];
    const allTeamIds = [
      ...new Set(plainTasks.flatMap((task) => task.assignedTeamIds ?? [])),
    ];

    const [users, teams] = await Promise.all([
      this.userRepository.findByIds(allAssigneeIds),
      this.teamRepository.findByIds(allTeamIds),
    ]);

    const userMap = new Map(users.map((u) => [String(u._id), u.fullName]));
    const teamMap = new Map(teams.map((t) => [String(t._id), t.name]));

    return plainTasks.map((task) => {
      const hasTeams = (task.assignedTeamIds?.length ?? 0) > 0;
      return {
        ...task,
        assigneeNames: hasTeams
          ? []
          : this.getTaskAssigneeIds(task).map(
              (id) => userMap.get(id) || "Unknown",
            ),
        teamNames: (task.assignedTeamIds ?? []).map(
          (id) => teamMap.get(id) || "Unknown",
        ),
      };
    });
  }

  private async ensureTaskAccess(
    actor: { id: string; role: UserRole },
    task: {
      assigneeId: string;
      assigneeIds?: string[];
      assignedTeamIds?: string[];
      createdByManagerId: string;
    },
  ) {
    const assigneeIds = this.getTaskAssigneeIds(task);

    if (actor.role === UserRole.EMPLOYEE && !assigneeIds.includes(actor.id)) {
      throw new AppError(403, "You do not have access to this task");
    }

    if (actor.role === UserRole.MANAGER) {
      const teamIds = await this.getManagerEmployeeIds(actor.id);
      const managedTeams = await this.teamRepository.findByManagerId(actor.id);
      const managedTeamIds = managedTeams.map((currentTeam) =>
        String(currentTeam.id),
      );

      if (
        task.createdByManagerId !== actor.id &&
        !assigneeIds.some((assigneeId) => teamIds.includes(assigneeId)) &&
        !(task.assignedTeamIds ?? []).some((teamId) =>
          managedTeamIds.includes(teamId),
        )
      ) {
        throw new AppError(403, "You do not have access to this task");
      }
    }
  }

  private getTaskAssigneeIds(task: {
    assigneeId?: string;
    assigneeIds?: string[];
  }) {
    if (Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0) {
      return task.assigneeIds;
    }

    return task.assigneeId ? [task.assigneeId] : [];
  }

  private async getManagerEmployeeIds(managerId: string) {
    const [directReports, managedTeams] = await Promise.all([
      this.userRepository.findIdsByManagerId(managerId),
      this.teamRepository.findByManagerId(managerId),
    ]);

    return [
      ...new Set([
        ...directReports.map((member) => member.id),
        ...managedTeams.flatMap((team) => team.memberIds ?? []),
      ]),
    ];
  }

  private sanitizeUser(user: Record<string, unknown> | null) {
    if (!user) {
      return null;
    }

    delete user.passwordHash;
    return user;
  }
}
