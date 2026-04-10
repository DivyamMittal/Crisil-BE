import Joi from "joi";

import { ProjectStatus } from "../../../shared/index.js";

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
