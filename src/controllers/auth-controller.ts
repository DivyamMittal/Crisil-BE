import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { loginSchema } from "../types/request-schemas.js";
import { authService } from "./dependencies.js";

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
