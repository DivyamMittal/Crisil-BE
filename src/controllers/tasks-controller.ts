import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { TimerState, UserRole } from "../types/enums.js";
import {
  createTaskSchema,
  dueDateChangeRequestSchema,
  manualLogSchema,
  taskIdParamsSchema,
  taskListQuerySchema,
  timerTransitionSchema,
} from "../types/request-schemas.js";
import { tasksService } from "./dependencies.js";

export const tasksRouter = Router();

tasksRouter.get(
  "/",
  requireAuth,
  validate(taskListQuerySchema),
  asyncHandler(async (request, response) => {
    response.json(
      await tasksService.listTasks(request.user!, {
        status: request.query.status ? String(request.query.status) : undefined,
        today: request.query.today ? String(request.query.today) : undefined,
        search: request.query.search ? String(request.query.search) : undefined,
        projectId: request.query.projectId ? String(request.query.projectId) : undefined,
        priority: request.query.priority ? String(request.query.priority) : undefined,
        page: request.query.page ? Number(request.query.page) : undefined,
        pageSize: request.query.pageSize ? Number(request.query.pageSize) : undefined,
        paginated: request.query.paginated ? String(request.query.paginated) : undefined,
        excludeCompleted: request.query.excludeCompleted
          ? String(request.query.excludeCompleted)
          : undefined,
        teamId: request.query.teamId ? String(request.query.teamId) : undefined,
      }),
    );
  }),
);

tasksRouter.get(
  "/:taskId",
  requireAuth,
  validate(taskIdParamsSchema),
  asyncHandler(async (request, response) => {
    response.json(await tasksService.getTaskDetails(request.user!, String(request.params.taskId)));
  }),
);

tasksRouter.post(
  "/",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(createTaskSchema),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await tasksService.createTask(request.user!, {
        projectId: request.body.projectId,
        activityId: request.body.activityId,
        title: request.body.title,
        description: request.body.description,
        assignmentType: request.body.assignmentType,
        assigneeIds: request.body.assigneeIds,
        assignedTeamIds: request.body.assignedTeamIds,
        priority: request.body.priority,
        estimatedHours: Number(request.body.estimatedHours),
        hasCountTracking: Boolean(request.body.hasCountTracking),
        countNumber:
          request.body.countNumber === null || typeof request.body.countNumber === "undefined"
            ? null
            : Number(request.body.countNumber),
        benchmarkMinutesPerCount:
          request.body.benchmarkMinutesPerCount === null ||
          typeof request.body.benchmarkMinutesPerCount === "undefined"
            ? null
            : Number(request.body.benchmarkMinutesPerCount),
        dueDateUtc: request.body.dueDateUtc,
      }),
    );
  }),
);

tasksRouter.post(
  "/:taskId/start-timer",
  requireAuth,
  requireRole([UserRole.EMPLOYEE]),
  validate(taskIdParamsSchema),
  asyncHandler(async (request, response) => {
    response.json(await tasksService.startTimer(String(request.params.taskId), request.user!.id));
  }),
);

tasksRouter.post(
  "/:taskId/timer-transition",
  requireAuth,
  requireRole([UserRole.EMPLOYEE]),
  validate(timerTransitionSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await tasksService.transitionTimer(
        String(request.params.taskId),
        request.body.timerState as TimerState,
        request.user!.id,
        typeof request.body.countCompleted === "number"
          ? Number(request.body.countCompleted)
          : undefined,
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
    response.json(await tasksService.requestCompletion(String(request.params.taskId), request.user!.id));
  }),
);

tasksRouter.post(
  "/:taskId/request-due-date-change",
  requireAuth,
  requireRole([UserRole.EMPLOYEE]),
  validate(dueDateChangeRequestSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await tasksService.requestDueDateChange(
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
      await tasksService.createManualLog(
        String(request.params.taskId),
        request.user!.id,
        Number(request.body.durationMinutes),
        request.body.description,
        request.body.reason,
        request.body.countCompleted != null ? Number(request.body.countCompleted) : undefined,
      ),
    );
  }),
);
