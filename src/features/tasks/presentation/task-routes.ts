import { Router } from "express";

import { TaskStatus, TimerState, UserRole } from "../../../shared/index.js";
import { AppError } from "../../../common/errors/app-error.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireAuth, requireRole } from "../../../common/middleware/auth.js";
import { validate } from "../../../common/middleware/validate.js";
import {
  ActivityModel,
  ApprovalRequestModel,
  CommentModel,
  ProjectModel,
  TaskModel,
  TimeEntryModel,
  UserModel,
} from "../../../database/models.js";
import { toPlain, toPlainList } from "../../../database/serializers.js";
import { taskService } from "../application/task-service.js";
import {
  createTaskSchema,
  dueDateChangeRequestSchema,
  manualLogSchema,
  taskListQuerySchema,
  taskIdParamsSchema,
  timerTransitionSchema,
} from "./task-validation.js";

export const tasksRouter = Router();

tasksRouter.get(
  "/",
  requireAuth,
  validate(taskListQuerySchema),
  asyncHandler(async (request, response) => {
    const filters: Record<string, unknown> = {};
    const andConditions: Array<Record<string, unknown>> = [];

    if (request.user?.role === UserRole.EMPLOYEE) {
      filters.assigneeId = request.user.id;
    } else if (request.user?.role === UserRole.MANAGER) {
      const team = await UserModel.find({ managerId: request.user.id }).select("_id");
      andConditions.push({
        $or: [
        { createdByManagerId: request.user.id },
        { assigneeId: { $in: team.map((member) => member.id) } },
        ],
      });
    }

    if (request.query.status) {
      filters.status = String(request.query.status);
    }

    if (request.query.projectId) {
      filters.projectId = String(request.query.projectId);
    }

    if (request.query.priority) {
      filters.priority = String(request.query.priority);
    }

    if (request.query.search) {
      const pattern = new RegExp(String(request.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      andConditions.push({
        $or: [{ title: pattern }, { description: pattern }],
      });
    }

    if (String(request.query.today) === "true") {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      filters.dueDateUtc = { $gte: start, $lt: end };
    }

    const query = andConditions.length > 0 ? { ...filters, $and: andConditions } : filters;

    const page = Number(request.query.page ?? 1);
    const pageSize = Number(request.query.pageSize ?? 8);
    const paginated = String(request.query.paginated) === "true" || typeof request.query.page !== "undefined";

    if (!paginated) {
      const tasks = await TaskModel.find(query).sort({ createdAt: -1 });
      return response.json(toPlainList(tasks));
    }

    const [items, total] = await Promise.all([
      TaskModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      TaskModel.countDocuments(query),
    ]);

    return response.json({
      items: toPlainList(items),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  }),
);

tasksRouter.get(
  "/:taskId",
  requireAuth,
  validate(taskIdParamsSchema),
  asyncHandler(async (request, response) => {
    const task = await TaskModel.findById(String(request.params.taskId));
    if (!task) {
      throw new AppError(404, "Task not found");
    }

    if (request.user?.role === UserRole.EMPLOYEE && task.assigneeId !== request.user.id) {
      throw new AppError(403, "You do not have access to this task");
    }

    if (request.user?.role === UserRole.MANAGER) {
      const team = await UserModel.find({ managerId: request.user.id }).select("_id");
      const teamIds = team.map((member) => member.id);

      if (task.createdByManagerId !== request.user.id && !teamIds.includes(task.assigneeId)) {
        throw new AppError(403, "You do not have access to this task");
      }
    }

    const [entries, comments, project, activity, assignee, createdBy, approvals] = await Promise.all([
      TimeEntryModel.find({ taskId: task.id }).sort({ createdAt: -1 }),
      CommentModel.find({ taskId: task.id }).sort({ createdAt: -1 }),
      ProjectModel.findById(task.projectId),
      ActivityModel.findById(task.activityId),
      UserModel.findById(task.assigneeId),
      UserModel.findById(task.createdByManagerId),
      ApprovalRequestModel.find({ taskId: task.id }).sort({ requestedAtUtc: -1 }),
    ]);

    const authorIds = [...new Set(comments.map((comment: { authorId: string }) => comment.authorId))];
    const commentAuthors = await UserModel.find({ _id: { $in: authorIds } });

    response.json({
      task: toPlain(task),
      entries: toPlainList(entries),
      comments: toPlainList(comments),
      approvals: toPlainList(approvals),
      project: toPlain(project),
      activity: toPlain(activity),
      assignee: assignee ? { ...(toPlain(assignee) as object), passwordHash: undefined } : null,
      createdBy: createdBy ? { ...(toPlain(createdBy) as object), passwordHash: undefined } : null,
      commentAuthors: toPlainList(commentAuthors).map((user) =>
        Object.fromEntries(Object.entries(user as Record<string, unknown>).filter(([key]) => key !== "passwordHash")),
      ),
    });
  }),
);

tasksRouter.post(
  "/",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(createTaskSchema),
  asyncHandler(async (request, response) => {
    const assignee = await UserModel.findById(request.body.assigneeId);
    if (!assignee || assignee.userRole !== UserRole.EMPLOYEE) {
      throw new AppError(400, "Assignee must be a valid employee");
    }

    if (!assignee.isActive) {
      throw new AppError(400, "Blocked employees cannot be assigned to tasks");
    }

    if (request.user?.role === UserRole.MANAGER && assignee.managerId !== request.user.id) {
      throw new AppError(403, "Employee is outside your team");
    }

    const task = await TaskModel.create({
      projectId: request.body.projectId,
      activityId: request.body.activityId,
      title: request.body.title,
      description: request.body.description,
      assigneeId: request.body.assigneeId,
      createdByManagerId: request.user!.id,
      priority: request.body.priority,
      status: TaskStatus.PENDING,
      estimatedHours: request.body.estimatedHours,
      loggedMinutes: 0,
      dueDateUtc: request.body.dueDateUtc,
      startedAtUtc: null,
      completedAtUtc: null,
      approvalPendingSinceUtc: null,
      rejectionReason: null,
      lastTimerEntryId: null,
    });

    response.status(201).json(toPlain(task));
  }),
);

tasksRouter.post(
  "/:taskId/start-timer",
  requireAuth,
  requireRole([UserRole.EMPLOYEE]),
  validate(taskIdParamsSchema),
  asyncHandler(async (request, response) => {
    response.json(await taskService.startTimer(String(request.params.taskId), request.user!.id));
  }),
);

tasksRouter.post(
  "/:taskId/timer-transition",
  requireAuth,
  requireRole([UserRole.EMPLOYEE]),
  validate(timerTransitionSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await taskService.transitionTimer(
        String(request.params.taskId),
        request.body.timerState as TimerState,
        request.user!.id,
      ),
    );
  }),
);

tasksRouter.post(
  "/:taskId/request-completion",
  requireAuth,
  requireRole([UserRole.EMPLOYEE]),
  validate(taskIdParamsSchema),
  asyncHandler(async (request, response) => {
    response.json(await taskService.requestCompletion(String(request.params.taskId), request.user!.id));
  }),
);

tasksRouter.post(
  "/:taskId/request-due-date-change",
  requireAuth,
  requireRole([UserRole.EMPLOYEE]),
  validate(dueDateChangeRequestSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await taskService.requestDueDateChange(
        String(request.params.taskId),
        request.user!.id,
        request.body.dueDateUtc,
        request.body.reason,
      ),
    );
  }),
);

tasksRouter.post(
  "/:taskId/manual-log",
  requireAuth,
  requireRole([UserRole.EMPLOYEE]),
  validate(manualLogSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await taskService.createManualLog(
        String(request.params.taskId),
        request.user!.id,
        request.body.startTimeUtc,
        request.body.endTimeUtc,
        request.body.description,
        request.body.reason,
      ),
    );
  }),
);
