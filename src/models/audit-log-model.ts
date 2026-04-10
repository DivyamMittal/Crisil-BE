import mongoose, { Schema, type Model } from "mongoose";

import { timestamps } from "./common.js";

export interface AuditLogRecord {
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<AuditLogRecord>(
  {
    actorId: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    action: { type: String, required: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps },
);

export const AuditLogModel: Model<AuditLogRecord> =
  (mongoose.models.AuditLog as Model<AuditLogRecord>) ||
  mongoose.model<AuditLogRecord>("AuditLog", auditLogSchema);
