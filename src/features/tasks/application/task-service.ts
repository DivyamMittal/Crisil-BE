import { nanoid } from "nanoid";

import {
  ApprovalStatus,
  ApprovalType,
  TaskStatus,
  TimeEntryType,
  TimerState,
  nextStatusForTimerState,
} from "../../../shared/index.js";
import { AppError } from "../../../common/errors/app-error.js";
import { ApprovalRequestModel, TaskModel, TimeEntryModel } from "../../../database/models.js";
import { toPlain } from "../../../database/serializers.js";
import { calculateElapsedWholeMinutes, calculateElapsedWholeSeconds } from "../domain/elapsed-time.js";

export class TaskService {
  async startTimer(taskId: string, employeeId: string) {
    const [task, runningEntry] = await Promise.all([
      TaskModel.findById(taskId),
      TimeEntryModel.findOne({ employeeId, timerState: TimerState.RUNNING }),
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

    const entry = await TimeEntryModel.create({
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
    const task = await TaskModel.findById(taskId);

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    if (task.assigneeId !== employeeId) {
      throw new AppError(403, "Task is not assigned to you");
    }

    const entry = await TimeEntryModel.findOne({
      taskId,
      employeeId,
      timerState: TimerState.RUNNING,
    }).sort({ createdAt: -1 });

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
    const task = await TaskModel.findById(taskId);

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    if (task.assigneeId !== employeeId) {
      throw new AppError(403, "Task is not assigned to you");
    }

    task.status = TaskStatus.APPROVAL_PENDING;
    task.approvalPendingSinceUtc = new Date();
    await task.save();

    const approval = await ApprovalRequestModel.create({
      type: ApprovalType.TASK_COMPLETION,
      taskId: task.id,
      timeEntryId: task.lastTimerEntryId,
      requestedBy: employeeId,
      reviewedBy: null,
      status: ApprovalStatus.PENDING,
      reason: "Completion request",
      managerComment: null,
      payload: {
        requestedStatus: TaskStatus.COMPLETED,
      },
      requestedAtUtc: new Date(),
      reviewedAtUtc: null,
    });

    return toPlain(approval);
  }

  async requestDueDateChange(
    taskId: string,
    employeeId: string,
    dueDateUtc: string,
    reason: string,
  ) {
    const task = await TaskModel.findById(taskId);

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

    const approval = await ApprovalRequestModel.create({
      type: ApprovalType.DUE_DATE_CHANGE,
      taskId: task.id,
      timeEntryId: null,
      requestedBy: employeeId,
      reviewedBy: null,
      status: ApprovalStatus.PENDING,
      reason,
      managerComment: null,
      payload: {
        previousDueDateUtc: task.dueDateUtc,
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
    const task = await TaskModel.findById(taskId);

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    if (task.assigneeId !== employeeId) {
      throw new AppError(403, "Task is not assigned to you");
    }

    const durationSeconds = calculateElapsedWholeSeconds(startTimeUtc, endTimeUtc);
    const minutes = calculateElapsedWholeMinutes(startTimeUtc, endTimeUtc);

    const entry = await TimeEntryModel.create({
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

    const approval = await ApprovalRequestModel.create({
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
}

export const taskService = new TaskService();
