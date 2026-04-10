import type { NextFunction, Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";
import { UserRepository } from "../repositories/user-repository.js";
import type { AuthenticatedUser } from "../types/auth.js";
import { UserRole } from "../types/enums.js";
import { AppError } from "../utils/app-error.js";

const userRepository = new UserRepository();

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export const requireAuth = async (request: Request, _response: Response, next: NextFunction) => {
  const token = request.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return next(new AppError(401, "Authentication required"));
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AuthenticatedUser;
    const user = await userRepository.findActiveById(decoded.id);

    if (!user || !user.isActive) {
      return next(new AppError(401, "Account is blocked"));
    }

    request.user = {
      id: user.id,
      email: user.email,
      role: user.userRole,
    };
    next();
  } catch {
    next(new AppError(401, "Invalid token"));
  }
};

export const requireRole =
  (roles: UserRole[]) => (request: Request, _response: Response, next: NextFunction) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return next(new AppError(403, "Forbidden"));
    }

    next();
  };

export const signAccessToken = (payload: AuthenticatedUser) =>
  jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });
