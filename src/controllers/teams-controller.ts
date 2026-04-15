import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { UserRole } from "../types/enums.js";
import {
  createTeamSchema,
  teamIdParamsSchema,
  teamListQuerySchema,
  updateTeamSchema,
} from "../types/request-schemas.js";
import { teamsService } from "./dependencies.js";

export const teamsRouter = Router();

teamsRouter.get(
  "/",
  requireAuth,
  validate(teamListQuerySchema),
  asyncHandler(async (request, response) => {
    response.json(
      await teamsService.listTeams(request.user!, {
        scope: request.query.scope ? String(request.query.scope) : undefined,
      }),
    );
  }),
);

teamsRouter.post(
  "/",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(createTeamSchema),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await teamsService.createTeam(request.user!, {
        name: request.body.name,
        managerIds: request.body.managerIds,
        memberIds: request.body.memberIds,
      }),
    );
  }),
);

teamsRouter.patch(
  "/:teamId",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(updateTeamSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await teamsService.updateTeam(request.user!, String(request.params.teamId), {
        name: request.body.name,
        managerIds: request.body.managerIds,
        memberIds: request.body.memberIds,
      }),
    );
  }),
);

teamsRouter.delete(
  "/:teamId",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(teamIdParamsSchema),
  asyncHandler(async (request, response) => {
    response.json(await teamsService.deleteTeam(request.user!, String(request.params.teamId)));
  }),
);
