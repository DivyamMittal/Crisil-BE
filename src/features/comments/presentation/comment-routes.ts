import Joi from "joi";
import { Router } from "express";

import { CommentVisibility } from "../../../shared/index.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireAuth } from "../../../common/middleware/auth.js";
import { validate } from "../../../common/middleware/validate.js";
import { CommentModel } from "../../../database/models.js";
import { toPlainList, toPlain } from "../../../database/serializers.js";

const commentSchema = {
  body: Joi.object({
    body: Joi.string().required(),
    visibility: Joi.string()
      .valid(...Object.values(CommentVisibility))
      .default(CommentVisibility.SHARED),
  }),
};

export const commentsRouter = Router();

commentsRouter.get(
  "/:taskId",
  requireAuth,
  asyncHandler(async (request, response) => {
    const comments = await CommentModel.find({ taskId: request.params.taskId }).sort({ createdAt: -1 });
    response.json(toPlainList(comments));
  }),
);

commentsRouter.post(
  "/:taskId",
  requireAuth,
  validate(commentSchema),
  asyncHandler(async (request, response) => {
    const comment = await CommentModel.create({
      taskId: request.params.taskId,
      authorId: request.user!.id,
      body: request.body.body,
      visibility: request.body.visibility,
    });

    response.status(201).json(toPlain(comment));
  }),
);
