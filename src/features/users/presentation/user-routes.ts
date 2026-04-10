import bcrypt from "bcryptjs";
import { Router } from "express";

import { CompanyRole, UserRole } from "../../../shared/index.js";
import { AppError } from "../../../common/errors/app-error.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireAuth, requireRole } from "../../../common/middleware/auth.js";
import { validate } from "../../../common/middleware/validate.js";
import { UserModel } from "../../../database/models.js";
import { toPlain, toPlainList } from "../../../database/serializers.js";
import {
  assignManagerSchema,
  createUserSchema,
  statusUpdateSchema,
  userQuerySchema,
} from "./user-validation.js";

export const usersRouter = Router();

const sanitizeUser = (user: Record<string, unknown>) => {
  delete user.passwordHash;
  return user;
};

usersRouter.get(
  "/",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(userQuerySchema),
  asyncHandler(async (request, response) => {
    const query: Record<string, unknown> = {};

    if (request.query.scope === "available") {
      query.userRole = UserRole.EMPLOYEE;
      query.isActive = true;
      query.managerId = { $ne: request.user!.id };
    } else if (request.user?.role === UserRole.MANAGER || request.query.scope === "team") {
      query.managerId = request.user!.id;
    }

    if (request.query.role) {
      query.userRole = request.query.role;
    }

    const users = await UserModel.find(query).sort({ createdAt: -1 });
    response.json(toPlainList(users).map((user) => sanitizeUser(user as Record<string, unknown>)));
  }),
);

usersRouter.post(
  "/",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(createUserSchema),
  asyncHandler(async (request, response) => {
    const requestedRole = request.body.userRole as UserRole;

    if (request.user?.role === UserRole.MANAGER && requestedRole !== UserRole.EMPLOYEE) {
      throw new AppError(403, "Managers can only create employees");
    }

    const existing = await UserModel.findOne({ email: request.body.email.toLowerCase() });
    if (existing) {
      throw new AppError(409, "Email already exists");
    }

    const passwordHash = await bcrypt.hash(request.body.password, 10);

    const managerId =
      request.user?.role === UserRole.MANAGER
        ? request.user.id
        : requestedRole === UserRole.EMPLOYEE
          ? request.body.managerId ?? null
          : null;

    const created = await UserModel.create({
      email: request.body.email.toLowerCase(),
      passwordHash,
      fullName: request.body.fullName,
      userRole: requestedRole,
      companyRole: request.body.companyRole ?? CompanyRole.OTHER,
      managerId,
      teamMemberIds: [],
      isActive: true,
      timezone: request.body.timezone,
    });

    const plain = toPlain(created) as Record<string, unknown>;
    response.status(201).json(sanitizeUser(plain));
  }),
);

usersRouter.patch(
  "/:userId/status",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(statusUpdateSchema),
  asyncHandler(async (request, response) => {
    const user = await UserModel.findById(request.params.userId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (request.user?.role === UserRole.MANAGER && user.managerId !== request.user.id) {
      throw new AppError(403, "Managers can only update their own team");
    }

    user.isActive = request.body.isActive;
    await user.save();

    const plain = toPlain(user) as Record<string, unknown>;
    response.json(sanitizeUser(plain));
  }),
);

usersRouter.post(
  "/:userId/assign-manager",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(assignManagerSchema),
  asyncHandler(async (request, response) => {
    const user = await UserModel.findById(request.params.userId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (user.userRole !== UserRole.EMPLOYEE) {
      throw new AppError(400, "Only employees can be assigned to a manager");
    }

    if (!user.isActive) {
      throw new AppError(400, "Blocked employees cannot be assigned to a manager");
    }

    user.managerId =
      request.user?.role === UserRole.MANAGER
        ? request.user.id
        : request.body.managerId ?? null;

    await user.save();

    const plain = toPlain(user) as Record<string, unknown>;
    response.json(sanitizeUser(plain));
  }),
);
