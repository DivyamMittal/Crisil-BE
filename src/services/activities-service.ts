import { ActivityRepository } from "../repositories/activity-repository.js";
import { ProjectRepository } from "../repositories/project-repository.js";
import { TaskRepository } from "../repositories/task-repository.js";
import { UserRole } from "../types/enums.js";
import { AppError } from "../utils/app-error.js";
import { toPlain, toPlainList } from "../utils/serializers.js";

export class ActivitiesService {
  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly taskRepository: TaskRepository,
  ) {}

  async listActivities(actor: { id: string; role: UserRole }, projectId?: string) {
    if (projectId) {
      const activities = await this.activityRepository.findByProjectId(projectId);
      return toPlainList(activities);
    }

    if (actor.role === UserRole.EMPLOYEE) {
      const tasks = await this.taskRepository.findByAssignee(actor.id);
      const activityIds = [...new Set(tasks.map((task) => task.activityId))];
      const activities = await this.activityRepository.findByIds(activityIds);
      return toPlainList(activities);
    }

    const activities = await this.activityRepository.findAll();
    return toPlainList(activities);
  }

  async createActivity(
    actor: { id: string; role: UserRole },
    input: {
      projectId: string;
      name: string;
      description: string;
      status: string;
    },
  ) {
    const project = await this.projectRepository.findById(input.projectId);

    if (!project) {
      throw new AppError(404, "Project not found");
    }

    if (actor.role === UserRole.MANAGER && project.managerId !== actor.id) {
      throw new AppError(403, "Project is outside your scope");
    }

    const activity = await this.activityRepository.create({
      ...input,
      createdBy: actor.id,
    });

    return toPlain(activity);
  }
}
