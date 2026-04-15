import cors from "cors";
import express from "express";
import morgan from "morgan";

import {
  activitiesRouter,
  analyticsRouter,
  approvalsRouter,
  authRouter,
  calendarRouter,
  commentsRouter,
  projectsRouter,
  tasksRouter,
  teamsRouter,
  timeTrackingRouter,
  usersRouter,
} from "./controllers/index.js";
import { errorHandler } from "./middleware/error-handler.js";

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(morgan("dev"));
  app.use(express.json());

  app.get("/api/v1/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/projects", projectsRouter);
  app.use("/api/v1/activities", activitiesRouter);
  app.use("/api/v1/tasks", tasksRouter);
  app.use("/api/v1/teams", teamsRouter);
  app.use("/api/v1/time-tracking", timeTrackingRouter);
  app.use("/api/v1/approvals", approvalsRouter);
  app.use("/api/v1/comments", commentsRouter);
  app.use("/api/v1/calendar", calendarRouter);
  app.use("/api/v1/analytics", analyticsRouter);

  app.use(errorHandler);

  return app;
};
