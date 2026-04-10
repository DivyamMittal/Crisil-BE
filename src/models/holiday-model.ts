import mongoose, { Schema, type Model } from "mongoose";

import { timestamps } from "./common.js";

export interface HolidayRecord {
  title: string;
  dateUtc: Date;
  createdByManagerId: string;
  appliesTo: string[];
  createdAt: Date;
  updatedAt: Date;
}

const holidaySchema = new Schema<HolidayRecord>(
  {
    title: { type: String, required: true },
    dateUtc: { type: Date, required: true, unique: true, index: true },
    createdByManagerId: { type: String, required: true },
    appliesTo: { type: [String], default: [] },
  },
  { timestamps },
);

export const HolidayModel: Model<HolidayRecord> =
  (mongoose.models.Holiday as Model<HolidayRecord>) ||
  mongoose.model<HolidayRecord>("Holiday", holidaySchema);
