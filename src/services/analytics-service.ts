import {
  ActivityRepository,
  ApprovalRepository,
  ProjectRepository,
  TaskRepository,
  TimeEntryRepository,
  UserRepository,
} from "../repositories/index.js";
import { ApprovalStatus, TaskStatus, UserRole } from "../types/enums.js";

type AnalyticsPeriod = "today" | "week" | "month";

const getPeriodRange = (period: AnalyticsPeriod, offset = 0) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "today") {
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() + offset);
    end.setTime(start.getTime());
    end.setUTCHours(23, 59, 59, 999);
  } else if (period === "week") {
    const dayOfWeek = start.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() + mondayOffset + offset * 7);
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
  } else {
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() + offset);
    end.setTime(start.getTime());
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
    end.setUTCHours(23, 59, 59, 999);
  }

  return { start, end: offset === 0 && now < end ? now : end };
};

const formatPeriodLabel = (period: AnalyticsPeriod, start: Date, end: Date) => {
  if (period === "today") {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(start);
  }

  if (period === "week") {
    const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
    const dayFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit" });
    const yearFormatter = new Intl.DateTimeFormat("en-US", { year: "numeric" });

    return `${monthFormatter.format(start).toUpperCase()} ${dayFormatter.format(start)} - ${monthFormatter
      .format(end)
      .toUpperCase()} ${dayFormatter.format(end)}, ${yearFormatter.format(end)}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(start);
};

const getTargetSeconds = (period: AnalyticsPeriod) => {
  if (period === "today") {
    return 8 * 3600;
  }

  if (period === "week") {
    return 40 * 3600;
  }

  return 160 * 3600;
};

const getPeriodHeadline = (period: AnalyticsPeriod) => {
  if (period === "today") {
    return "Today";
  }

  if (period === "week") {
    return "This Week";
  }

  return "This Month";
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
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" ") : "0s";
};

const getTaskAssigneeIds = (task: { assigneeId?: string; assigneeIds?: string[] }) => {
  if (Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0) {
    return task.assigneeIds;
  }

  return task.assigneeId ? [task.assigneeId] : [];
};

export class AnalyticsService {
  constructor(
    private readonly timeEntryRepository: TimeEntryRepository,
    private readonly approvalRepository: ApprovalRepository,
    private readonly userRepository: UserRepository,
    private readonly taskRepository: TaskRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly activityRepository: ActivityRepository,
  ) {}

  async getDashboard(
    actor: { id: string; role: UserRole },
    options: { period: AnalyticsPeriod; offset: number },
  ) {
    const { period, offset } = options;
    const { start, end } = getPeriodRange(period, offset);
    const periodLabel = formatPeriodLabel(period, start, end);
    const targetSeconds = getTargetSeconds(period);

    if (actor.role === UserRole.EMPLOYEE) {
      const [periodEntries, pending] = await Promise.all([
        this.timeEntryRepository.findByEmployeeIdAndRange(actor.id, start, end),
        this.approvalRepository.countPendingByRequester(actor.id),
      ]);

      const periodSeconds = periodEntries.reduce(
        (sum, entry) => sum + (entry.durationSeconds ?? entry.durationMinutes * 60),
        0,
      );

      return {
        period: {
          type: period,
          label: periodLabel,
          offset,
          start: start.toISOString(),
          end: end.toISOString(),
        },
        utilizationCards: [
          {
            label: getPeriodHeadline(period),
            value: `${Math.min(100, Math.round((periodSeconds / Math.max(targetSeconds, 1)) * 100))}%`,
            helper: `${formatLoggedDuration(periodSeconds)} logged of ${formatLoggedDuration(targetSeconds)}`,
          },
          {
            label: "Logged Time",
            value: formatLoggedDuration(periodSeconds),
            helper: `Captured for ${periodLabel}`,
          },
          {
            label: "Pending",
            value: String(pending),
            helper: "Requests awaiting approval",
          },
        ],
      };
    }

    const teamMembers =
      actor.role === UserRole.MANAGER ? await this.userRepository.findByManagerId(actor.id) : [];
    const teamIds = teamMembers.map((member) => member.id);
    const [tasks, approvals, weekEntries, projects, activities] = await Promise.all([
      actor.role === UserRole.MANAGER
        ? this.taskRepository.findByManagerScope(actor.id, teamIds)
        : this.taskRepository.findByQuery({}),
      actor.role === UserRole.MANAGER
        ? this.approvalRepository.findByRequestedByIds(teamIds, {
            requestedAtUtc: { $gte: start, $lte: end },
          })
        : this.approvalRepository.findAll(),
      this.timeEntryRepository.findByEmployeeIdsAndRange(teamIds, start, end),
      this.projectRepository.findByQuery({}),
      this.activityRepository.findAll(),
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
      .filter((task) => getTaskAssigneeIds(task).some((assigneeId) => teamIds.includes(assigneeId)))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .forEach((task) => {
        getTaskAssigneeIds(task).forEach((assigneeId) => {
          if (!recentTaskByEmployee.has(assigneeId)) {
            recentTaskByEmployee.set(assigneeId, task);
          }
        });
      });

    const totalTeamSeconds = [...secondsByEmployee.values()].reduce((sum, seconds) => sum + seconds, 0);
    const completedTasks = tasks.filter((task) => {
      if (!task.completedAtUtc) {
        return false;
      }

      const completedAt = new Date(task.completedAtUtc);
      return completedAt >= start && completedAt <= end;
    });
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
            typeof approval.payload.requestedDueDateUtc === "string"
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

    return {
      period: {
        type: period,
        label: periodLabel,
        offset,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      headlineStats: [
        {
          label: "Avg. Team Utilization",
          value: `${Math.min(100, Math.round((totalTeamSeconds / Math.max(teamIds.length * targetSeconds, 1)) * 100))}%`,
          helper: `${formatLoggedDuration(totalTeamSeconds)} logged for ${periodLabel}`,
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
          helper: `Completed during ${periodLabel}`,
        },
      ],
      liveActivity,
      pendingApprovals,
    };
  }
}
