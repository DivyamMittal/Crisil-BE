import { ActivityModel } from "../models/index.js";

export class ActivityRepository {
  findById(activityId: string) {
    return ActivityModel.findById(activityId);
  }

  findByProjectId(projectId: string) {
    return ActivityModel.find({ projectId }).sort({ createdAt: -1 });
  }

  findAll() {
    return ActivityModel.find({}).sort({ createdAt: -1 });
  }

  findByIds(activityIds: string[]) {
    return ActivityModel.find({ _id: { $in: activityIds } });
  }

  countAll() {
    return ActivityModel.countDocuments({});
  }

  findByQuery(query: Record<string, unknown>) {
    return ActivityModel.find(query).sort({ createdAt: -1 });
  }

  create(input: {
    projectId: string;
    name: string;
    description: string;
    status: string;
    createdBy: string;
  }) {
    return ActivityModel.create(input);
  }
}
