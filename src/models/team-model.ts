import mongoose, { Schema, type Model } from "mongoose";

import { timestamps } from "./common.js";

export interface TeamRecord {
  managerId: string;
  name: string;
  memberIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<TeamRecord>(
  {
    managerId: { type: String, required: true },
    name: { type: String, required: true },
    memberIds: { type: [String], default: [] },
  },
  { timestamps },
);

export const TeamModel: Model<TeamRecord> =
  (mongoose.models.Team as Model<TeamRecord>) || mongoose.model<TeamRecord>("Team", teamSchema);
