import Joi from "joi";

import { ProjectStatus } from "../../../shared/index.js";

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
