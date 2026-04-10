import mongoose, { Schema, type Model } from "mongoose";

import { ProjectStatus } from "../types/enums.js";
import { timestamps } from "./common.js";

export interface ActivityRecord {
  projectId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<ActivityRecord>(
  {
    projectId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: Object.values(ProjectStatus), required: true },
    createdBy: { type: String, required: true },
  },
  { timestamps },
);

export const ActivityModel: Model<ActivityRecord> =
  (mongoose.models.Activity as Model<ActivityRecord>) ||
  mongoose.model<ActivityRecord>("Activity", activitySchema);
