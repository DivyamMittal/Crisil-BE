import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { commentSchema, commentUpdateSchema } from "../types/request-schemas.js";
import { commentsService } from "./dependencies.js";

export const commentsRouter = Router();

commentsRouter.get(
  "/:taskId",
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json(await commentsService.listComments(String(request.params.taskId)));
  }),
);

commentsRouter.post(
  "/:taskId",
  requireAuth,
  validate(commentSchema),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await commentsService.createComment(String(request.params.taskId), request.user!.id, {
        body: request.body.body,
        visibility: request.body.visibility,
      }),
    );
  }),
);

commentsRouter.patch(
  "/:commentId",
  requireAuth,
  validate(commentUpdateSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await commentsService.updateComment(String(request.params.commentId), request.user!.id, {
        body: request.body.body,
      }),
    );
  }),
);
