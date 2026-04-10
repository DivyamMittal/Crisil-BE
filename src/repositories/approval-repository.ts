import { ApprovalRequestModel } from "../models/index.js";

export class ApprovalRepository {
  findById(approvalId: string) {
    return ApprovalRequestModel.findById(approvalId);
  }

  findByTaskId(taskId: string) {
    return ApprovalRequestModel.find({ taskId }).sort({ requestedAtUtc: -1 });
  }

  findByRequestedBy(userId: string) {
    return ApprovalRequestModel.find({ requestedBy: userId }).sort({ createdAt: -1 });
  }

  findByRequestedByIds(userIds: string[], query: Record<string, unknown> = {}) {
    return ApprovalRequestModel.find({
      requestedBy: { $in: userIds },
      ...query,
    }).sort({ createdAt: -1 });
  }

  findAll() {
    return ApprovalRequestModel.find({}).sort({ createdAt: -1 });
  }

  countPendingByRequester(userId: string) {
    return ApprovalRequestModel.countDocuments({ requestedBy: userId, status: "PENDING" });
  }

  create(input: {
    type: string;
    taskId: string;
    timeEntryId: string | null;
    requestedBy: string;
    reviewedBy: string | null;
    status: string;
    reason: string;
    managerComment: string | null;
    payload: Record<string, unknown>;
    requestedAtUtc: Date;
    reviewedAtUtc: Date | null;
  }) {
    return ApprovalRequestModel.create(input);
  }
}
