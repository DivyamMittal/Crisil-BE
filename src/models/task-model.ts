import mongoose, { Schema, type Model } from "mongoose";

import { Priority, TaskStatus } from "../types/enums.js";
import { timestamps } from "./common.js";

export interface TaskRecord {
  projectId: string;
  activityId: string;
  title: string;
  description: string;
  assigneeId: string;
  createdByManagerId: string;
  priority: Priority;
  status: TaskStatus;
  estimatedHours: number;
  loggedMinutes: number;
  dueDateUtc: Date;
  startedAtUtc: Date | null;
  completedAtUtc: Date | null;
  approvalPendingSinceUtc: Date | null;
  rejectionReason: string | null;
  lastTimerEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<TaskRecord>(
  {
    projectId: { type: String, required: true, index: true },
    activityId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    assigneeId: { type: String, required: true, index: true },
    createdByManagerId: { type: String, required: true },
    priority: { type: String, enum: Object.values(Priority), required: true },
    status: { type: String, enum: Object.values(TaskStatus), required: true, index: true },
    estimatedHours: { type: Number, required: true },
    loggedMinutes: { type: Number, default: 0 },
    dueDateUtc: { type: Date, required: true, index: true },
    startedAtUtc: { type: Date, default: null },
    completedAtUtc: { type: Date, default: null },
    approvalPendingSinceUtc: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    lastTimerEntryId: { type: String, default: null },
  },
  { timestamps },
);

taskSchema.index({ assigneeId: 1, status: 1, dueDateUtc: 1 });
taskSchema.index({ projectId: 1, activityId: 1 });

export const TaskModel: Model<TaskRecord> =
  (mongoose.models.Task as Model<TaskRecord>) || mongoose.model<TaskRecord>("Task", taskSchema);
