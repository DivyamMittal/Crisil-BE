import mongoose, { Schema, type Model } from "mongoose";

import { TimeEntryType, TimerState } from "../types/enums.js";
import { timestamps } from "./common.js";

export interface TimeEntryRecord {
  clientEntryId: string | null;
  taskId: string;
  employeeId: string;
  projectId: string;
  activityId: string;
  entryType: TimeEntryType;
  timerState: TimerState;
  startTimeUtc: Date;
  endTimeUtc: Date | null;
  durationSeconds: number;
  durationMinutes: number;
  countCompleted: number | null;
  description: string;
  isSubmittedForApproval: boolean;
  approvalRequestId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const timeEntrySchema = new Schema<TimeEntryRecord>(
  {
    clientEntryId: { type: String, default: null },
    taskId: { type: String, required: true },
    employeeId: { type: String, required: true, index: true },
    projectId: { type: String, required: true },
    activityId: { type: String, required: true },
    entryType: { type: String, enum: Object.values(TimeEntryType), required: true },
    timerState: { type: String, enum: Object.values(TimerState), required: true },
    startTimeUtc: { type: Date, required: true, index: true },
    endTimeUtc: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    durationMinutes: { type: Number, default: 0 },
    countCompleted: { type: Number, default: null },
    description: { type: String, default: "" },
    isSubmittedForApproval: { type: Boolean, default: false },
    approvalRequestId: { type: String, default: null },
  },
  { timestamps },
);

export const TimeEntryModel: Model<TimeEntryRecord> =
  (mongoose.models.TimeEntry as Model<TimeEntryRecord>) ||
  mongoose.model<TimeEntryRecord>("TimeEntry", timeEntrySchema);
