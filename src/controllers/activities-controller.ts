import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { UserRole } from "../types/enums.js";
import { createActivitySchema } from "../types/request-schemas.js";
import { activitiesService } from "./dependencies.js";

export const activitiesRouter = Router();

activitiesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (request, response) => {
    const projectId = request.query.projectId ? String(request.query.projectId) : undefined;
    response.json(await activitiesService.listActivities(request.user!, projectId));
  }),
);

activitiesRouter.post(
  "/",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(createActivitySchema),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await activitiesService.createActivity(request.user!, {
        projectId: request.body.projectId,
        name: request.body.name,
        description: request.body.description,
        status: request.body.status,
      }),
    );
  }),
);
