import { Router } from "express";

import { UserRole } from "../../../shared/index.js";
import { AppError } from "../../../common/errors/app-error.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireAuth, requireRole } from "../../../common/middleware/auth.js";
import { validate } from "../../../common/middleware/validate.js";
import { ActivityModel, ProjectModel, TaskModel } from "../../../database/models.js";
import { toPlain, toPlainList } from "../../../database/serializers.js";
import { createActivitySchema } from "./activity-validation.js";

export const activitiesRouter = Router();

activitiesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (request, response) => {
    if (request.query.projectId) {
      const activities = await ActivityModel.find({ projectId: String(request.query.projectId) }).sort({
        createdAt: -1,
      });
      return response.json(toPlainList(activities));
    }

    if (request.user?.role === UserRole.EMPLOYEE) {
      const tasks = await TaskModel.find({ assigneeId: request.user.id });
      const activityIds = [...new Set(tasks.map((task) => task.activityId))];
      const activities = await ActivityModel.find({ _id: { $in: activityIds } });
      return response.json(toPlainList(activities));
    }

    const activities = await ActivityModel.find({}).sort({ createdAt: -1 });
    return response.json(toPlainList(activities));
  }),
);

activitiesRouter.post(
  "/",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(createActivitySchema),
  asyncHandler(async (request, response) => {
    const project = await ProjectModel.findById(request.body.projectId);
    if (!project) {
      throw new AppError(404, "Project not found");
    }

    if (request.user?.role === UserRole.MANAGER && project.managerId !== request.user.id) {
      throw new AppError(403, "Project is outside your scope");
    }

    const activity = await ActivityModel.create({
      projectId: request.body.projectId,
      name: request.body.name,
      description: request.body.description,
      status: request.body.status,
      createdBy: request.user!.id,
    });

    response.status(201).json(toPlain(activity));
  }),
);
