import { TeamModel } from "../models/index.js";

export class TeamRepository {
  findAll() {
    return TeamModel.find({}).sort({ createdAt: -1 });
  }

  findById(teamId: string) {
    return TeamModel.findById(teamId);
  }

  findByIds(teamIds: string[]) {
    return TeamModel.find({ _id: { $in: teamIds } }).sort({ name: 1 });
  }

  findByManagerId(managerId: string) {
    return TeamModel.find({ managerIds: managerId }).sort({ name: 1 });
  }

  findByMemberId(memberId: string) {
    return TeamModel.find({ memberIds: memberId }).sort({ name: 1 });
  }

  create(input: {
    name: string;
    managerIds: string[];
    memberIds: string[];
    createdByAdminId: string;
  }) {
    return TeamModel.create(input);
  }

  deleteById(teamId: string) {
    return TeamModel.findByIdAndDelete(teamId);
  }
}
