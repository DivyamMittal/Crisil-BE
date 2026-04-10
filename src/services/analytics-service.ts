import {
  ActivityRepository,
  ApprovalRepository,
  ProjectRepository,
  TaskRepository,
  TimeEntryRepository,
  UserRepository,
} from "../repositories/index.js";
import { ApprovalStatus, TaskStatus, UserRole } from "../types/enums.js";

const weekRange = (weekOffset = 0) => {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay() + 1);
  start.setUTCDate(start.getUTCDate() + weekOffset * 7);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end: weekOffset === 0 && now < end ? now : end };
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

export class AnalyticsService {
  constructor(
    private readonly timeEntryRepository: TimeEntryRepository,
    private readonly approvalRepository: ApprovalRepository,
    private readonly userRepository: UserRepository,
    private readonly taskRepository: TaskRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly activityRepository: ActivityRepository,
  ) {}

  async getDashboard(actor: { id: string; role: UserRole }, weekOffset: number) {
    if (actor.role === UserRole.EMPLOYEE) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { start, end } = weekRange(weekOffset);

      const [todayEntries, weekEntries, pending] = await Promise.all([
        this.timeEntryRepository.findByEmployeeIdAndRange(actor.id, todayStart),
        this.timeEntryRepository.findByEmployeeIdAndRange(actor.id, start, end),
        this.approvalRepository.countPendingByRequester(actor.id),
      ]);

      const todaySeconds = todayEntries.reduce(
        (sum, entry) => sum + (entry.durationSeconds ?? entry.durationMinutes * 60),
        0,
      );
      const weekSeconds = weekEntries.reduce(
        (sum, entry) => sum + (entry.durationSeconds ?? entry.durationMinutes * 60),
        0,
      );

      return {
        utilizationCards: [
          {
            label: "Today",
            value: `${Math.min(100, Math.round((todaySeconds / 60 / 480) * 100))}%`,
            helper: `${formatLoggedDuration(todaySeconds)} logged of 8h`,
          },
          {
            label: "This Week",
            value: `${Math.min(100, Math.round((weekSeconds / 60 / 2400) * 100))}%`,
            helper: `${formatLoggedDuration(weekSeconds)} logged of 40h`,
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
    const { start, end } = weekRange(weekOffset);
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
      week: { start: start.toISOString(), end: end.toISOString() },
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
    };
  }
}
