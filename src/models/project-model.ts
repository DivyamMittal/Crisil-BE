import mongoose, { Schema, type Model } from "mongoose";

import { ProjectStatus } from "../types/enums.js";
import { timestamps } from "./common.js";

export interface ProjectRecord {
  code: string;
  name: string;
  description: string;
  managerId: string;
  status: ProjectStatus;
  startDateUtc: Date;
  targetEndDateUtc: Date;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectRecord>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    managerId: { type: String, required: true },
    status: { type: String, enum: Object.values(ProjectStatus), required: true },
    startDateUtc: { type: Date, required: true },
    targetEndDateUtc: { type: Date, required: true },
  },
  { timestamps },
);

export const ProjectModel: Model<ProjectRecord> =
  (mongoose.models.Project as Model<ProjectRecord>) ||
  mongoose.model<ProjectRecord>("Project", projectSchema);
