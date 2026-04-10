import { Router } from "express";

import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireAuth } from "../../../common/middleware/auth.js";
import { validate } from "../../../common/middleware/validate.js";
import { authService } from "../application/auth-service.js";
import { loginSchema } from "./auth-validation.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (request, response) => {
    response.json(await authService.login(request.body.email, request.body.password));
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json(await authService.me(request.user!.id));
  }),
);

authRouter.post("/logout", (_request, response) => {
  response.status(204).send();
});
