import mongoose, { Schema, type Model } from "mongoose";

import { CompanyRole, UserRole } from "../types/enums.js";
import { timestamps } from "./common.js";

export interface UserRecord {
  email: string;
  passwordHash: string;
  fullName: string;
  userRole: UserRole;
  companyRole: CompanyRole;
  managerId: string | null;
  teamMemberIds: string[];
  isActive: boolean;
  timezone: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserRecord>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    userRole: { type: String, enum: Object.values(UserRole), required: true },
    companyRole: { type: String, enum: Object.values(CompanyRole), required: true },
    managerId: { type: String, default: null },
    teamMemberIds: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    timezone: { type: String, default: "UTC" },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps },
);

export const UserModel: Model<UserRecord> =
  (mongoose.models.User as Model<UserRecord>) || mongoose.model<UserRecord>("User", userSchema);
