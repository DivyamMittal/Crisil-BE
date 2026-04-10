import { ProjectModel } from "../models/index.js";

export class ProjectRepository {
  findById(projectId: string) {
    return ProjectModel.findById(projectId);
  }

  findByCode(code: string) {
    return ProjectModel.findOne({ code });
  }

  findByIds(projectIds: string[]) {
    return ProjectModel.find({ _id: { $in: projectIds } });
  }

  findByQuery(query: Record<string, unknown>) {
    return ProjectModel.find(query).sort({ createdAt: -1 });
  }

  countByQuery(query: Record<string, unknown>) {
    return ProjectModel.countDocuments(query);
  }

  create(input: {
    code: string;
    name: string;
    description: string;
    managerId: string;
    status: string;
    startDateUtc: string;
    targetEndDateUtc: string;
  }) {
    return ProjectModel.create(input);
  }
}
