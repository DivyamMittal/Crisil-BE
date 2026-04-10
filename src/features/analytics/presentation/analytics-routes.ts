import Joi from "joi";
import { Router } from "express";

import { ApprovalStatus, TaskStatus, TimerState, UserRole } from "../../../shared/index.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { requireAuth } from "../../../common/middleware/auth.js";
import { validate } from "../../../common/middleware/validate.js";
import {
  ActivityModel,
  ApprovalRequestModel,
  ProjectModel,
  TaskModel,
  TimeEntryModel,
  UserModel,
} from "../../../database/models.js";
import { toPlainList } from "../../../database/serializers.js";

const dashboardQuerySchema = {
  query: Joi.object({
    weekOffset: Joi.number().integer().min(-52).max(0).default(0),
  }),
};

const weekRange = (weekOffset = 0) => {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay() + 1);
  start.setUTCDate(start.getUTCDate() + weekOffset * 7);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  const currentEnd = weekOffset === 0 && now < end ? now : end;

  return { start, end: currentEnd };
};

const formatLoggedDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  const parts = [
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
    remainingSeconds > 0 ? `${remainingSeconds}s` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : "0s";
};

export const analyticsRouter = Router();

analyticsRouter.get(
  "/dashboard",
  requireAuth,
  validate(dashboardQuerySchema),
  asyncHandler(async (request, response) => {
    const weekOffset = Number(request.query.weekOffset ?? 0);

    if (request.user?.role === UserRole.EMPLOYEE) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { start, end } = weekRange(weekOffset);

      const [todayEntries, weekEntries, pending] = await Promise.all([
        TimeEntryModel.find({ employeeId: request.user.id, startTimeUtc: { $gte: todayStart } }),
        TimeEntryModel.find({ employeeId: request.user.id, startTimeUtc: { $gte: start, $lte: end } }),
        ApprovalRequestModel.countDocuments({
          requestedBy: request.user.id,
          status: ApprovalStatus.PENDING,
        }),
      ]);

      const todaySeconds = todayEntries.reduce(
        (sum, entry) => sum + (entry.durationSeconds ?? entry.durationMinutes * 60),
        0,
      );
      const weekSeconds = weekEntries.reduce(
        (sum, entry) => sum + (entry.durationSeconds ?? entry.durationMinutes * 60),
        0,
      );
      const todayMinutes = todaySeconds / 60;
      const weekMinutes = weekSeconds / 60;

      return response.json({
        utilizationCards: [
          {
            label: "Today",
            value: `${Math.min(100, Math.round((todayMinutes / 480) * 100))}%`,
            helper: `${formatLoggedDuration(todaySeconds)} logged of 8h`,
          },
          {
            label: "This Week",
            value: `${Math.min(100, Math.round((weekMinutes / 2400) * 100))}%`,
            helper: `${formatLoggedDuration(weekSeconds)} logged of 40h`,
          },
          {
            label: "Pending",
            value: String(pending),
            helper: "Requests awaiting approval",
          },
        ],
      });
    }

    const teamMembers =
      request.user?.role === UserRole.MANAGER
        ? await UserModel.find({ managerId: request.user.id }).sort({ fullName: 1 })
        : [];
    const teamIds = teamMembers.map((user) => user.id);
    const { start, end } = weekRange(weekOffset);

    const managerScopedTaskQuery =
      request.user?.role === UserRole.MANAGER
        ? { $or: [{ createdByManagerId: request.user.id }, { assigneeId: { $in: teamIds } }] }
        : {};

    const [tasks, approvals, weekEntries, projects, activities] = await Promise.all([
      TaskModel.find(managerScopedTaskQuery).sort({ createdAt: -1 }),
      ApprovalRequestModel.find(
        request.user?.role === UserRole.MANAGER
          ? {
              requestedBy: { $in: teamIds },
              requestedAtUtc: { $gte: start, $lte: end },
            }
          : {},
      ).sort({ createdAt: -1 }),
      TimeEntryModel.find({
        employeeId: { $in: teamIds },
        startTimeUtc: { $gte: start, $lte: end },
      }).sort({ createdAt: -1 }),
      ProjectModel.find({}),
      ActivityModel.find({}),
    ]);

    const projectMap = new Map(projects.map((project) => [project.id, project.name]));
    const activityMap = new Map(activities.map((activity) => [activity.id, activity.name]));
    const taskMap = new Map(tasks.map((task) => [task.id, task]));

    const secondsByEmployee = new Map<string, number>();
    weekEntries.forEach((entry) => {
      const seconds = entry.durationSeconds ?? entry.durationMinutes * 60;
      secondsByEmployee.set(entry.employeeId, (secondsByEmployee.get(entry.employeeId) ?? 0) + seconds);
    });

    const recentTaskByEmployee = new Map<string, (typeof tasks)[number]>();
    tasks
      .filter((task) => teamIds.includes(task.assigneeId))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .forEach((task) => {
        if (!recentTaskByEmployee.has(task.assigneeId)) {
          recentTaskByEmployee.set(task.assigneeId, task);
        }
      });

    const totalTeamSeconds = [...secondsByEmployee.values()].reduce((sum, seconds) => sum + seconds, 0);
    const completedTasks = tasks.filter((task) => task.status === TaskStatus.COMPLETED);
    const productivityValue =
      totalTeamSeconds > 0 ? (completedTasks.length / (totalTeamSeconds / 3600)).toFixed(1) : "0.0";

    const liveActivity = teamMembers.map((member) => {
      const recentTask = recentTaskByEmployee.get(member.id);
      const loggedSeconds = secondsByEmployee.get(member.id) ?? 0;

      return {
        memberId: member.id,
        memberName: member.fullName,
        project: recentTask ? projectMap.get(recentTask.projectId) ?? "Not specified" : "Not specified",
        activity: recentTask ? activityMap.get(recentTask.activityId) ?? "Inactive" : "Inactive",
        task: recentTask?.title ?? "No task selected",
        status: recentTask?.status ?? null,
        timeLogged: formatLoggedDuration(loggedSeconds),
      };
    });

    const pendingApprovals = approvals
      .filter((approval) => approval.status === ApprovalStatus.PENDING)
      .map((approval) => {
        const task = taskMap.get(approval.taskId);
        const member = teamMembers.find((user) => user.id === approval.requestedBy);
        const projectName = task ? projectMap.get(task.projectId) ?? "Project" : "Project";
        const activityName = task ? activityMap.get(task.activityId) ?? "Activity" : "Activity";

        let details = `${projectName} / ${activityName}`;

        if (approval.type === "TASK_COMPLETION" && task) {
          details = `${projectName} / ${activityName} / ${task.title}`;
        }

        if (approval.type === "DUE_DATE_CHANGE" && task) {
          const requestedDueDate =
            typeof approval.payload?.requestedDueDateUtc === "string"
              ? new Date(approval.payload.requestedDueDateUtc).toLocaleDateString("en-GB")
              : "Requested date";
          details = `${projectName} / ${activityName} / ${task.title} -> ${requestedDueDate}`;
        }

        return {
          id: approval.id,
          memberName: member?.fullName ?? "Team member",
          type: approval.type,
          details,
          reason: approval.reason,
          requestedAtUtc: approval.requestedAtUtc,
          status: approval.status,
        };
      });

    response.json({
      week: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      headlineStats: [
        {
          label: "Avg. Team Utilization",
          value: `${Math.min(100, Math.round((totalTeamSeconds / Math.max(teamIds.length * 40 * 3600, 1)) * 100))}%`,
          helper: `${formatLoggedDuration(totalTeamSeconds)} logged this week`,
        },
        {
          label: "Pending Approvals",
          value: String(pendingApprovals.length),
          helper: "Awaiting manager review",
        },
        {
          label: "Avg. Productivity",
          value: productivityValue,
          helper: "Tasks completed per logged hour",
        },
        {
          label: "Tasks Completed",
          value: String(completedTasks.length),
          helper: `Out of ${tasks.length} tasks`,
        },
      ],
      liveActivity,
      pendingApprovals,
    });
  }),
);
