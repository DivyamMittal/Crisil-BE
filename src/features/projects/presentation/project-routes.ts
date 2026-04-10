import { Router } from "express";

import { UserRole } from "../../../shared/index.js";
import { AppError } from "../../../common/errors/app-error.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireAuth, requireRole } from "../../../common/middleware/auth.js";
import { validate } from "../../../common/middleware/validate.js";
import { ActivityModel, ProjectModel, TaskModel } from "../../../database/models.js";
import { toPlain, toPlainList } from "../../../database/serializers.js";
import { createProjectSchema } from "./project-validation.js";

export const projectsRouter = Router();

projectsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (request, response) => {
    if (request.user?.role === UserRole.EMPLOYEE) {
      const tasks = await TaskModel.find({ assigneeId: request.user.id });
      const projectIds = [...new Set(tasks.map((task) => task.projectId))];
      const projects = await ProjectModel.find({ _id: { $in: projectIds } });
      return response.json(toPlainList(projects));
    }

    const query =
      request.user?.role === UserRole.MANAGER ? { managerId: request.user.id } : {};
    const projects = await ProjectModel.find(query).sort({ createdAt: -1 });
    return response.json(toPlainList(projects));
  }),
);

projectsRouter.post(
  "/",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(createProjectSchema),
  asyncHandler(async (request, response) => {
    const existing = await ProjectModel.findOne({ code: request.body.code });
    if (existing) {
      throw new AppError(409, "Project code already exists");
    }

    const project = await ProjectModel.create({
      code: request.body.code,
      name: request.body.name,
      description: request.body.description,
      managerId: request.user!.id,
      status: request.body.status,
      startDateUtc: request.body.startDateUtc,
      targetEndDateUtc: request.body.targetEndDateUtc,
    });

    response.status(201).json(toPlain(project));
  }),
);

projectsRouter.get(
  "/summary",
  requireAuth,
  asyncHandler(async (request, response) => {
    const query =
      request.user?.role === UserRole.MANAGER ? { managerId: request.user.id } : {};
    const [projects, activities, tasks] = await Promise.all([
      ProjectModel.countDocuments(query),
      ActivityModel.countDocuments({}),
      TaskModel.countDocuments({}),
    ]);

    response.json({ projects, activities, tasks });
  }),
);
