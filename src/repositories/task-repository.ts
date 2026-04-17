import { TaskModel } from "../models/index.js";

export class TaskRepository {
  findById(taskId: string) {
    return TaskModel.findById(taskId);
  }

  findByQuery(query: Record<string, unknown>) {
    return TaskModel.find(query).sort({ createdAt: -1 });
  }

  paginate(query: Record<string, unknown>, page: number, pageSize: number) {
    return Promise.all([
      TaskModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      TaskModel.countDocuments(query),
    ]);
  }

  findByAssignee(assigneeId: string) {
    return TaskModel.find({ $or: [{ assigneeId }, { assigneeIds: assigneeId }] }).sort({ createdAt: -1 });
  }

  findByManagerScope(managerId: string, teamIds: string[]) {
    return TaskModel.find({
      $or: [
        { createdByManagerId: managerId },
        { assigneeId: { $in: teamIds } },
        { assigneeIds: { $in: teamIds } },
      ],
    }).sort({ createdAt: -1 });
  }

  findRecentRunningEntryTask(taskId: string, employeeId: string) {
    return TaskModel.findOne({
      _id: taskId,
      $or: [{ assigneeId: employeeId }, { assigneeIds: employeeId }],
    });
  }

  countByQuery(query: Record<string, unknown>) {
    return TaskModel.countDocuments(query);
  }

  create(input: {
    projectId: string;
    activityId: string | null;
    title: string;
    description: string;
    assigneeId: string;
    assigneeIds: string[];
    assignedTeamIds: string[];
    createdByManagerId: string;
    priority: string;
    status: string;
    estimatedHours: number;
    loggedMinutes: number;
    hasCountTracking: boolean;
    countNumber: number | null;
    benchmarkMinutesPerCount: number | null;
    totalCountCompleted: number;
    dueDateUtc: string;
    startedAtUtc: null;
    completedAtUtc: null;
    approvalPendingSinceUtc: null;
    rejectionReason: null;
    lastTimerEntryId: null;
  }) {
    return TaskModel.create(input);
  }

  applyCountTimerTransition(input: {
    taskId: string;
    countCompleted: number;
    loggedMinutes: number;
    status: string;
  }) {
    return TaskModel.findOneAndUpdate(
      {
        _id: input.taskId,
        countNumber: { $ne: null },
        $expr: {
          $lte: [{ $add: ["$totalCountCompleted", input.countCompleted] }, "$countNumber"],
        },
      },
      {
        $inc: {
          totalCountCompleted: input.countCompleted,
          loggedMinutes: input.loggedMinutes,
        },
        $set: {
          status: input.status,
        },
      },
      { new: true },
    );
  }
}
