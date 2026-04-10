import { UserModel } from "../models/index.js";
import type { UserRole } from "../types/enums.js";

export class UserRepository {
  findById(userId: string) {
    return UserModel.findById(userId);
  }

  findActiveById(userId: string) {
    return UserModel.findById(userId).select("_id email userRole isActive");
  }

  findByEmail(email: string) {
    return UserModel.findOne({ email: email.toLowerCase() });
  }

  findByManagerId(managerId: string) {
    return UserModel.find({ managerId }).sort({ fullName: 1 });
  }

  findIdsByManagerId(managerId: string) {
    return UserModel.find({ managerId }).select("_id");
  }

  findByQuery(query: Record<string, unknown>) {
    return UserModel.find(query).sort({ createdAt: -1 });
  }

  create(input: {
    email: string;
    passwordHash: string;
    fullName: string;
    userRole: UserRole;
    companyRole: string;
    managerId: string | null;
    teamMemberIds: string[];
    isActive: boolean;
    timezone: string;
  }) {
    return UserModel.create(input);
  }
}
