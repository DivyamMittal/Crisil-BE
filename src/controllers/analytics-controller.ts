import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { dashboardQuerySchema } from "../types/request-schemas.js";
import { analyticsService } from "./dependencies.js";

export const analyticsRouter = Router();

analyticsRouter.get(
  "/dashboard",
  requireAuth,
  validate(dashboardQuerySchema),
  asyncHandler(async (request, response) => {
    response.json(
      await analyticsService.getDashboard(request.user!, {
        period: String(request.query.period ?? "week") as "today" | "week" | "month",
        offset: Number(request.query.offset ?? 0),
      }),
    );
  }),
);
