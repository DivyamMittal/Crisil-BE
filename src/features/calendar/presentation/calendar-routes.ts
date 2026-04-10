import Joi from "joi";
import { Router } from "express";

import { UserRole } from "../../../shared/index.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireAuth, requireRole } from "../../../common/middleware/auth.js";
import { validate } from "../../../common/middleware/validate.js";
import { HolidayModel } from "../../../database/models.js";
import { toPlain, toPlainList } from "../../../database/serializers.js";

const holidaySchema = {
  body: Joi.object({
    title: Joi.string().required(),
    dateUtc: Joi.string().isoDate().required(),
  }),
};

const holidayIdParamsSchema = {
  params: Joi.object({
    holidayId: Joi.string().required(),
  }),
};

export const calendarRouter = Router();

calendarRouter.get(
  "/holidays",
  requireAuth,
  asyncHandler(async (_request, response) => {
    const holidays = await HolidayModel.find({}).sort({ dateUtc: 1 });
    response.json(toPlainList(holidays));
  }),
);

calendarRouter.post(
  "/holidays",
  requireAuth,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(holidaySchema),
  asyncHandler(async (request, response) => {
    const holiday = await HolidayModel.create({
      title: request.body.title,
      dateUtc: request.body.dateUtc,
      createdByManagerId: request.user!.id,
      appliesTo: [],
    });

    response.status(201).json(toPlain(holiday));
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
    const holiday = await HolidayModel.findById(request.params.holidayId);

    if (!holiday) {
      return response.status(404).json({ message: "Holiday not found" });
    }

    holiday.title = request.body.title;
    holiday.dateUtc = request.body.dateUtc;
    await holiday.save();

    response.json(toPlain(holiday));
  }),
);
