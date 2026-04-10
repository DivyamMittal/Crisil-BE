import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { timeTrackingService } from "./dependencies.js";

export const timeTrackingRouter = Router();

timeTrackingRouter.get(
  "/entries",
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json(await timeTrackingService.listEntries(request.user!));
  }),
);
