import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { UserRole } from "../types/enums.js";
import { holidayIdParamsSchema, holidaySchema } from "../types/request-schemas.js";
import { calendarService } from "./dependencies.js";

export const calendarRouter = Router();

calendarRouter.get(
  "/holidays",
  requireAuth,
  asyncHandler(async (_request, response) => {
    response.json(await calendarService.listHolidays());
  }),
);

calendarRouter.post(
  "/holidays",
  requireAuth,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(holidaySchema),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await calendarService.createHoliday(request.user!.id, {
        title: request.body.title,
        dateUtc: request.body.dateUtc,
      }),
    );
  }),
);

calendarRouter.put(
  "/holidays/:holidayId",
  requireAuth,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate({
    ...holidayIdParamsSchema,
    ...holidaySchema,
  }),
  asyncHandler(async (request, response) => {
    response.json(
      await calendarService.updateHoliday(String(request.params.holidayId), {
        title: request.body.title,
        dateUtc: request.body.dateUtc,
      }),
    );
  }),
);
