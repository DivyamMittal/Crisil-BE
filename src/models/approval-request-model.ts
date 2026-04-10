import mongoose, { Schema, type Model } from "mongoose";

import { ApprovalStatus, ApprovalType } from "../types/enums.js";
import { timestamps } from "./common.js";

export interface ApprovalRequestRecord {
  type: ApprovalType;
  taskId: string;
  timeEntryId: string | null;
  requestedBy: string;
  reviewedBy: string | null;
  status: ApprovalStatus;
  reason: string;
  managerComment: string | null;
  payload: Record<string, unknown>;
  requestedAtUtc: Date;
  reviewedAtUtc: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const approvalRequestSchema = new Schema<ApprovalRequestRecord>(
  {
    type: { type: String, enum: Object.values(ApprovalType), required: true },
    taskId: { type: String, required: true },
    timeEntryId: { type: String, default: null },
    requestedBy: { type: String, required: true },
    reviewedBy: { type: String, default: null },
    status: { type: String, enum: Object.values(ApprovalStatus), required: true, index: true },
    reason: { type: String, required: true },
    managerComment: { type: String, default: null },
    payload: { type: Schema.Types.Mixed, required: true },
    requestedAtUtc: { type: Date, required: true, index: true },
    reviewedAtUtc: { type: Date, default: null },
  },
  { timestamps },
);

approvalRequestSchema.index({ status: 1, requestedAtUtc: 1 });

export const ApprovalRequestModel: Model<ApprovalRequestRecord> =
  (mongoose.models.ApprovalRequest as Model<ApprovalRequestRecord>) ||
  mongoose.model<ApprovalRequestRecord>("ApprovalRequest", approvalRequestSchema);
