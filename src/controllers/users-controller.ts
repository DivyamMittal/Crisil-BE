import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { UserRole } from "../types/enums.js";
import {
  assignManagerSchema,
  createUserSchema,
  statusUpdateSchema,
  userQuerySchema,
} from "../types/request-schemas.js";
import { usersService } from "./dependencies.js";

export const usersRouter = Router();

usersRouter.get(
  "/",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(userQuerySchema),
  asyncHandler(async (request, response) => {
    response.json(
      await usersService.listUsers(request.user!, {
        role: request.query.role ? String(request.query.role) : undefined,
        scope: request.query.scope ? String(request.query.scope) : undefined,
      }),
    );
  }),
);

usersRouter.post(
  "/",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(createUserSchema),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await usersService.createUser(request.user!, {
        email: request.body.email,
        password: request.body.password,
        fullName: request.body.fullName,
        userRole: request.body.userRole,
        companyRole: request.body.companyRole,
        managerId: request.body.managerId,
        timezone: request.body.timezone,
      }),
    );
  }),
);

usersRouter.patch(
  "/:userId/status",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(statusUpdateSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await usersService.updateStatus(
        request.user!,
        String(request.params.userId),
        Boolean(request.body.isActive),
      ),
    );
  }),
);

usersRouter.post(
  "/:userId/assign-manager",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(assignManagerSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await usersService.assignManager(
        request.user!,
        String(request.params.userId),
        request.body.managerId ?? null,
      ),
    );
  }),
);
