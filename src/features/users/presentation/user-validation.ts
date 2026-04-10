import Joi from "joi";

import { CompanyRole, UserRole } from "../../../shared/index.js";
import { supportedTimezones } from "../../../shared/timezones.js";

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
