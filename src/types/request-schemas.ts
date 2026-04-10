import Joi from "joi";

import {
  ApprovalStatus,
  CommentVisibility,
  CompanyRole,
  Priority,
  ProjectStatus,
  TaskStatus,
  TimerState,
  UserRole,
} from "./enums.js";
import { supportedTimezones } from "./timezones.js";

export const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
  }),
};

export const userQuerySchema = {
  query: Joi.object({
    role: Joi.string()
      .valid(...Object.values(UserRole))
      .optional(),
    scope: Joi.string().valid("team", "available").optional(),
  }),
};

export const createUserSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    fullName: Joi.string().min(2).required(),
    userRole: Joi.string()
      .valid(UserRole.MANAGER, UserRole.EMPLOYEE)
      .required(),
    companyRole: Joi.string()
      .valid(...Object.values(CompanyRole))
      .required(),
    managerId: Joi.string().allow(null).optional(),
    timezone: Joi.string()
      .valid(...supportedTimezones)
      .default("Asia/Kolkata"),
  }),
};

export const statusUpdateSchema = {
  params: Joi.object({
    userId: Joi.string().required(),
  }),
  body: Joi.object({
    isActive: Joi.boolean().required(),
  }),
};

export const assignManagerSchema = {
  params: Joi.object({
    userId: Joi.string().required(),
  }),
  body: Joi.object({
    managerId: Joi.string().allow(null).optional(),
  }),
};

export const createProjectSchema = {
  body: Joi.object({
    code: Joi.string().trim().uppercase().required(),
    name: Joi.string().trim().required(),
    description: Joi.string().trim().required(),
    status: Joi.string()
      .valid(...Object.values(ProjectStatus))
      .default(ProjectStatus.ACTIVE),
    startDateUtc: Joi.string().isoDate().required(),
    targetEndDateUtc: Joi.string().isoDate().required(),
  }),
};

export const createActivitySchema = {
  body: Joi.object({
    projectId: Joi.string().required(),
    name: Joi.string().required(),
    description: Joi.string().required(),
    status: Joi.string()
      .valid(...Object.values(ProjectStatus))
      .default(ProjectStatus.ACTIVE),
  }),
};

export const taskIdParamsSchema = {
  params: Joi.object({
    taskId: Joi.string().required(),
  }),
};

export const taskListQuerySchema = {
  query: Joi.object({
    status: Joi.string()
      .valid(...Object.values(TaskStatus))
      .optional(),
    today: Joi.boolean().optional(),
    search: Joi.string().allow("").trim().optional(),
    projectId: Joi.string().allow("").trim().optional(),
    priority: Joi.string()
      .valid(...Object.values(Priority))
      .optional(),
    page: Joi.number().integer().min(1).optional(),
    pageSize: Joi.number().integer().min(1).max(100).optional(),
    paginated: Joi.boolean().optional(),
    excludeCompleted: Joi.boolean().optional(),
  }),
};

export const timerTransitionSchema = {
  params: taskIdParamsSchema.params,
  body: Joi.object({
    timerState: Joi.string()
      .valid(...Object.values(TimerState))
      .required(),
  }),
};

export const createTaskSchema = {
  body: Joi.object({
    projectId: Joi.string().required(),
    activityId: Joi.string().required(),
    title: Joi.string().required(),
    description: Joi.string().required(),
    assigneeId: Joi.string().required(),
    priority: Joi.string()
      .valid(...Object.values(Priority))
      .required(),
    estimatedHours: Joi.number().min(0.25).required(),
    dueDateUtc: Joi.string().isoDate().required(),
  }),
};

export const manualLogSchema = {
  params: taskIdParamsSchema.params,
  body: Joi.object({
    startTimeUtc: Joi.string().isoDate().required(),
    endTimeUtc: Joi.string().isoDate().required(),
    description: Joi.string().allow("").default(""),
    reason: Joi.string().required(),
  }),
};

export const dueDateChangeRequestSchema = {
  params: taskIdParamsSchema.params,
  body: Joi.object({
    dueDateUtc: Joi.string().isoDate().required(),
    reason: Joi.string().trim().required(),
  }),
};

export const commentSchema = {
  body: Joi.object({
    body: Joi.string().required(),
    visibility: Joi.string()
      .valid(...Object.values(CommentVisibility))
      .default(CommentVisibility.SHARED),
  }),
};

export const commentUpdateSchema = {
  params: Joi.object({
    commentId: Joi.string().required(),
  }),
  body: Joi.object({
    body: Joi.string().trim().required(),
  }),
};

export const holidaySchema = {
  body: Joi.object({
    title: Joi.string().required(),
    dateUtc: Joi.string().isoDate().required(),
  }),
};

export const holidayIdParamsSchema = {
  params: Joi.object({
    holidayId: Joi.string().required(),
  }),
};

export const dashboardQuerySchema = {
  query: Joi.object({
    weekOffset: Joi.number().integer().min(-52).max(0).default(0),
  }),
};

export const reviewSchema = {
  params: Joi.object({
    approvalId: Joi.string().required(),
  }),
  body: Joi.object({
    status: Joi.string()
      .valid(ApprovalStatus.APPROVED, ApprovalStatus.REJECTED)
      .required(),
    managerComment: Joi.string().allow("").default(""),
  }),
};
