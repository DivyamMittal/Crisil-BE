import type { NextFunction, Request, Response } from "express";
import type { ObjectSchema } from "joi";

import { AppError } from "../errors/app-error.js";

type SchemaMap = {
  body?: ObjectSchema;
  params?: ObjectSchema;
  query?: ObjectSchema;
};

export const validate =
  (schemas: SchemaMap) => (request: Request, _response: Response, next: NextFunction) => {
    for (const key of Object.keys(schemas) as Array<keyof SchemaMap>) {
      const schema = schemas[key];

      if (!schema) {
        continue;
      }

      const { error, value } = schema.validate(request[key], {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return next(
          new AppError(400, "Validation failed", {
            source: key,
            issues: error.details.map((detail) => ({
              path: detail.path.join("."),
              message: detail.message,
              code: detail.type,
            })),
          }),
        );
      }

      Object.assign(request[key], value);
    }

    next();
  };
