import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ApprovalStatus, UserRole } from "../types/enums.js";
import { reviewSchema } from "../types/request-schemas.js";
import { approvalsService } from "./dependencies.js";

export const approvalsRouter = Router();

approvalsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json(await approvalsService.listApprovals(request.user!));
  }),
);

approvalsRouter.post(
  "/:approvalId/review",
  requireAuth,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(reviewSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await approvalsService.reviewApproval(request.user!.id, String(request.params.approvalId), {
        status: request.body.status as ApprovalStatus,
        managerComment: String(request.body.managerComment ?? ""),
      }),
    );
  }),
);
