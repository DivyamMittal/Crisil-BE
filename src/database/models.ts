import mongoose, { Schema, type Model } from "mongoose";

import {
  ApprovalStatus,
  ApprovalType,
  CommentVisibility,
  CompanyRole,
  Priority,
  ProjectStatus,
  TaskStatus,
  TimeEntryType,
  TimerState,
  UserRole,
} from "../shared/index.js";

const timestamps = {
  createdAt: "createdAt",
  updatedAt: "updatedAt",
};

export const userSchema = new Schema(
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

export const teamSchema = new Schema(
  {
    managerId: { type: String, required: true },
    name: { type: String, required: true },
    memberIds: { type: [String], default: [] },
  },
  { timestamps },
);

export const projectSchema = new Schema(
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

export const activitySchema = new Schema(
  {
    projectId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: Object.values(ProjectStatus), required: true },
    createdBy: { type: String, required: true },
  },
  { timestamps },
);

export const taskSchema = new Schema(
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

export const timeEntrySchema = new Schema(
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
    description: { type: String, default: "" },
    isSubmittedForApproval: { type: Boolean, default: false },
    approvalRequestId: { type: String, default: null },
  },
  { timestamps },
);

export const approvalRequestSchema = new Schema(
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

export const commentSchema = new Schema(
  {
    taskId: { type: String, required: true, index: true },
    authorId: { type: String, required: true },
    body: { type: String, required: true },
    visibility: { type: String, enum: Object.values(CommentVisibility), required: true },
  },
  { timestamps },
);

export const holidaySchema = new Schema(
  {
    title: { type: String, required: true },
    dateUtc: { type: Date, required: true, unique: true, index: true },
    createdByManagerId: { type: String, required: true },
    appliesTo: { type: [String], default: [] },
  },
  { timestamps },
);

export const auditLogSchema = new Schema(
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

taskSchema.index({ assigneeId: 1, status: 1, dueDateUtc: 1 });
taskSchema.index({ projectId: 1, activityId: 1 });
approvalRequestSchema.index({ status: 1, requestedAtUtc: 1 });

export const UserModel: Model<any> =
  (mongoose.models.User as Model<any>) || mongoose.model("User", userSchema);
export const TeamModel: Model<any> =
  (mongoose.models.Team as Model<any>) || mongoose.model("Team", teamSchema);
export const ProjectModel: Model<any> =
  (mongoose.models.Project as Model<any>) || mongoose.model("Project", projectSchema);
export const ActivityModel: Model<any> =
  (mongoose.models.Activity as Model<any>) || mongoose.model("Activity", activitySchema);
export const TaskModel: Model<any> =
  (mongoose.models.Task as Model<any>) || mongoose.model("Task", taskSchema);
export const TimeEntryModel: Model<any> =
  (mongoose.models.TimeEntry as Model<any>) || mongoose.model("TimeEntry", timeEntrySchema);
export const ApprovalRequestModel: Model<any> =
  (mongoose.models.ApprovalRequest as Model<any>) ||
  mongoose.model("ApprovalRequest", approvalRequestSchema);
export const CommentModel: Model<any> =
  (mongoose.models.Comment as Model<any>) || mongoose.model("Comment", commentSchema);
export const HolidayModel: Model<any> =
  (mongoose.models.Holiday as Model<any>) || mongoose.model("Holiday", holidaySchema);
export const AuditLogModel: Model<any> =
  (mongoose.models.AuditLog as Model<any>) || mongoose.model("AuditLog", auditLogSchema);
