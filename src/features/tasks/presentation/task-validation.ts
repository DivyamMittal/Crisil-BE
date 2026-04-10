import Joi from "joi";

import { Priority, TaskStatus, TimerState } from "../../../shared/index.js";

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

export const taskUpdateSchema = {
  params: taskIdParamsSchema.params,
  body: Joi.object({
    status: Joi.string()
      .valid(...Object.values(TaskStatus))
      .optional(),
    dueDateUtc: Joi.string().isoDate().optional(),
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
