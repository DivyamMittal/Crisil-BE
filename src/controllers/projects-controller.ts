import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { UserRole } from "../types/enums.js";
import { createProjectSchema } from "../types/request-schemas.js";
import { projectsService } from "./dependencies.js";

export const projectsRouter = Router();

projectsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json(await projectsService.listProjects(request.user!));
  }),
);

projectsRouter.post(
  "/",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(createProjectSchema),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await projectsService.createProject(request.user!, {
        code: request.body.code,
        name: request.body.name,
        description: request.body.description,
        status: request.body.status,
        startDateUtc: request.body.startDateUtc,
        targetEndDateUtc: request.body.targetEndDateUtc,
      }),
    );
  }),
);

projectsRouter.get(
  "/summary",
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json(await projectsService.getSummary(request.user!));
  }),
);
