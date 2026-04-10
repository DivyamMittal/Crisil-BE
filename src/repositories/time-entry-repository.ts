import { TimeEntryModel } from "../models/index.js";
import { TimerState } from "../types/enums.js";

export class TimeEntryRepository {
  findAll() {
    return TimeEntryModel.find({}).sort({ createdAt: -1 });
  }

  findByTaskId(taskId: string) {
    return TimeEntryModel.find({ taskId }).sort({ createdAt: -1 });
  }

  findByEmployeeId(employeeId: string) {
    return TimeEntryModel.find({ employeeId }).sort({ createdAt: -1 });
  }

  findByEmployeeIds(employeeIds: string[]) {
    return TimeEntryModel.find({ employeeId: { $in: employeeIds } }).sort({ createdAt: -1 });
  }

  findByEmployeeIdAndRange(employeeId: string, start: Date, end?: Date) {
    return TimeEntryModel.find({
      employeeId,
      startTimeUtc: end ? { $gte: start, $lte: end } : { $gte: start },
    });
  }

  findByEmployeeIdsAndRange(employeeIds: string[], start: Date, end: Date) {
    return TimeEntryModel.find({
      employeeId: { $in: employeeIds },
      startTimeUtc: { $gte: start, $lte: end },
    }).sort({ createdAt: -1 });
  }

  findRunningEntryByEmployeeId(employeeId: string) {
    return TimeEntryModel.findOne({ employeeId, timerState: TimerState.RUNNING });
  }

  findLatestRunningEntry(taskId: string, employeeId: string) {
    return TimeEntryModel.findOne({
      taskId,
      employeeId,
      timerState: TimerState.RUNNING,
    }).sort({ createdAt: -1 });
  }

  findById(entryId: string) {
    return TimeEntryModel.findById(entryId);
  }

  create(input: {
    taskId: string;
    employeeId: string;
    projectId: string;
    activityId: string;
    entryType: string;
    timerState: string;
    startTimeUtc: Date | string;
    endTimeUtc: Date | string | null;
    durationSeconds: number;
    durationMinutes: number;
    description: string;
    isSubmittedForApproval: boolean;
    approvalRequestId: string | null;
    clientEntryId: string;
  }) {
    return TimeEntryModel.create(input);
  }
}
