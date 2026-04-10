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
    return TaskModel.find({ assigneeId }).sort({ createdAt: -1 });
  }

  findByManagerScope(managerId: string, teamIds: string[]) {
    return TaskModel.find({
      $or: [{ createdByManagerId: managerId }, { assigneeId: { $in: teamIds } }],
    }).sort({ createdAt: -1 });
  }

  findRecentRunningEntryTask(taskId: string, employeeId: string) {
    return TaskModel.findOne({ _id: taskId, assigneeId: employeeId });
  }

  countByQuery(query: Record<string, unknown>) {
    return TaskModel.countDocuments(query);
  }

  create(input: {
    projectId: string;
    activityId: string;
    title: string;
    description: string;
    assigneeId: string;
    createdByManagerId: string;
    priority: string;
    status: string;
    estimatedHours: number;
    loggedMinutes: number;
    dueDateUtc: string;
    startedAtUtc: null;
    completedAtUtc: null;
    approvalPendingSinceUtc: null;
    rejectionReason: null;
    lastTimerEntryId: null;
  }) {
    return TaskModel.create(input);
  }
}
