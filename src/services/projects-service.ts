import { ActivityRepository } from "../repositories/activity-repository.js";
import { ProjectRepository } from "../repositories/project-repository.js";
import { TaskRepository } from "../repositories/task-repository.js";
import { UserRole } from "../types/enums.js";
import { AppError } from "../utils/app-error.js";
import { toPlain, toPlainList } from "../utils/serializers.js";

export class ProjectsService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly activityRepository: ActivityRepository,
    private readonly taskRepository: TaskRepository,
  ) {}

  async listProjects(actor: { id: string; role: UserRole }) {
    if (actor.role === UserRole.EMPLOYEE) {
      const tasks = await this.taskRepository.findByAssignee(actor.id);
      const projectIds = [...new Set(tasks.map((task) => task.projectId))];
      const projects = await this.projectRepository.findByIds(projectIds);
      return toPlainList(projects);
    }

    const query = actor.role === UserRole.MANAGER ? { managerId: actor.id } : {};
    const projects = await this.projectRepository.findByQuery(query);
    return toPlainList(projects);
  }

  async createProject(
    actor: { id: string },
    input: {
      code: string;
      name: string;
      description: string;
      status: string;
      startDateUtc: string;
      targetEndDateUtc: string;
    },
  ) {
    const existing = await this.projectRepository.findByCode(input.code);

    if (existing) {
      throw new AppError(409, "Project code already exists");
    }

    const project = await this.projectRepository.create({
      ...input,
      managerId: actor.id,
    });

    return toPlain(project);
  }

  async getSummary(actor: { id: string; role: UserRole }) {
    const projectQuery = actor.role === UserRole.MANAGER ? { managerId: actor.id } : {};
    const [projects, activities, tasks] = await Promise.all([
      this.projectRepository.countByQuery(projectQuery),
      this.activityRepository.countAll(),
      this.taskRepository.countByQuery({}),
    ]);

    return { projects, activities, tasks };
  }
}
