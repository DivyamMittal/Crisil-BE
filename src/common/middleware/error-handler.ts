import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/app-error.js";

export const errorHandler = (
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction,
) => {
  if (error instanceof AppError) {
    return response.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    });
  }

  return response.status(500).json({
    message: error.message || "Internal server error",
  });
};
