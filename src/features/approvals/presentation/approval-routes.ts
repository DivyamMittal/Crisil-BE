import Joi from "joi";
import { Router } from "express";

import { ApprovalStatus, ApprovalType, TaskStatus, UserRole } from "../../../shared/index.js";
import { AppError } from "../../../common/errors/app-error.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireAuth, requireRole } from "../../../common/middleware/auth.js";
import { validate } from "../../../common/middleware/validate.js";
import { ApprovalRequestModel, TaskModel, TimeEntryModel, UserModel } from "../../../database/models.js";
import { toPlainList, toPlain } from "../../../database/serializers.js";

const reviewSchema = {
  params: Joi.object({
    approvalId: Joi.string().required(),
  }),
  body: Joi.object({
    status: Joi.string()
      .valid(ApprovalStatus.APPROVED, ApprovalStatus.REJECTED)
      .required(),
    managerComment: Joi.string().allow("").default(""),
  }),
};

export const approvalsRouter = Router();

approvalsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (request, response) => {
    if (request.user?.role === UserRole.EMPLOYEE) {
      const approvals = await ApprovalRequestModel.find({ requestedBy: request.user.id }).sort({
        createdAt: -1,
      });

      return response.json(toPlainList(approvals));
    }

    if (request.user?.role === UserRole.ADMIN) {
      const approvals = await ApprovalRequestModel.find({}).sort({ createdAt: -1 });
      return response.json(toPlainList(approvals));
    }

    const team = await UserModel.find({ managerId: request.user!.id }).select("_id");
    const approvals = await ApprovalRequestModel.find({
      requestedBy: { $in: team.map((member) => member.id) },
    }).sort({ createdAt: -1 });

    return response.json(toPlainList(approvals));
  }),
);

approvalsRouter.post(
  "/:approvalId/review",
  requireAuth,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(reviewSchema),
  asyncHandler(async (request, response) => {
    const approval = await ApprovalRequestModel.findById(request.params.approvalId);

    if (!approval) {
      throw new AppError(404, "Approval request not found");
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new AppError(409, "Approval request has already been reviewed");
    }

    if (
      request.body.status === ApprovalStatus.REJECTED &&
      String(request.body.managerComment ?? "").trim().length === 0
    ) {
      throw new AppError(400, "Manager comment is required when rejecting a request");
    }

    approval.status = request.body.status;
    approval.managerComment = request.body.managerComment;
    approval.reviewedBy = request.user!.id;
    approval.reviewedAtUtc = new Date();
    await approval.save();

    if (approval.type === ApprovalType.TASK_COMPLETION) {
      const task = await TaskModel.findById(approval.taskId);
      if (task) {
        task.status =
          approval.status === ApprovalStatus.APPROVED ? TaskStatus.COMPLETED : TaskStatus.REJECTED;
        task.completedAtUtc = approval.status === ApprovalStatus.APPROVED ? new Date() : null;
        if (approval.status === ApprovalStatus.REJECTED) {
          task.rejectionReason = request.body.managerComment || "Rejected by manager";
        }
        await task.save();
      }
    }

    if (approval.type === ApprovalType.MANUAL_LOG && approval.timeEntryId) {
      const entry = await TimeEntryModel.findById(approval.timeEntryId);
      if (entry) {
        entry.isSubmittedForApproval = approval.status !== ApprovalStatus.REJECTED;
        await entry.save();
      }
    }

    if (approval.type === ApprovalType.DUE_DATE_CHANGE) {
      const task = await TaskModel.findById(approval.taskId);
      if (task && approval.status === ApprovalStatus.APPROVED) {
        const requestedDueDateUtc = approval.payload?.requestedDueDateUtc;

        if (typeof requestedDueDateUtc === "string") {
          task.dueDateUtc = new Date(requestedDueDateUtc);
          await task.save();
        }
      }
    }

    response.json(toPlain(approval));
  }),
);
