import { Router } from "express";

import { UserRole } from "../../../shared/index.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireAuth } from "../../../common/middleware/auth.js";
import { TimeEntryModel, UserModel } from "../../../database/models.js";
import { toPlainList } from "../../../database/serializers.js";

export const timeTrackingRouter = Router();

timeTrackingRouter.get(
  "/entries",
  requireAuth,
  asyncHandler(async (request, response) => {
    if (request.user?.role === UserRole.EMPLOYEE) {
      const entries = await TimeEntryModel.find({ employeeId: request.user.id }).sort({ createdAt: -1 });
      return response.json(toPlainList(entries));
    }

    if (request.user?.role === UserRole.MANAGER) {
      const team = await UserModel.find({ managerId: request.user.id }).select("_id");
      const entries = await TimeEntryModel.find({
        employeeId: { $in: team.map((member) => member.id) },
      }).sort({ createdAt: -1 });
      return response.json(toPlainList(entries));
    }

    const entries = await TimeEntryModel.find({}).sort({ createdAt: -1 });
    return response.json(toPlainList(entries));
  }),
);
