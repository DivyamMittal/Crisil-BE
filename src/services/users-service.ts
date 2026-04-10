import bcrypt from "bcryptjs";

import { UserRepository } from "../repositories/user-repository.js";
import { CompanyRole, UserRole } from "../types/enums.js";
import { AppError } from "../utils/app-error.js";
import { toPlain, toPlainList } from "../utils/serializers.js";

export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async listUsers(actor: { id: string; role: UserRole }, query: { role?: string; scope?: string }) {
    const filter: Record<string, unknown> = {};

    if (query.scope === "available") {
      filter.userRole = UserRole.EMPLOYEE;
      filter.isActive = true;
      filter.managerId = { $ne: actor.id };
    } else if (actor.role === UserRole.MANAGER || query.scope === "team") {
      filter.managerId = actor.id;
    }

    if (query.role) {
      filter.userRole = query.role;
    }

    const users = await this.userRepository.findByQuery(filter);
    return toPlainList(users).map((user) => this.sanitizeUser(user));
  }

  async createUser(
    actor: { id: string; role: UserRole },
    input: {
      email: string;
      password: string;
      fullName: string;
      userRole: UserRole;
      companyRole?: CompanyRole;
      managerId?: string | null;
      timezone: string;
    },
  ) {
    if (actor.role === UserRole.MANAGER && input.userRole !== UserRole.EMPLOYEE) {
      throw new AppError(403, "Managers can only create employees");
    }

    const existing = await this.userRepository.findByEmail(input.email);

    if (existing) {
      throw new AppError(409, "Email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const managerId =
      actor.role === UserRole.MANAGER
        ? actor.id
        : input.userRole === UserRole.EMPLOYEE
          ? input.managerId ?? null
          : null;

    const created = await this.userRepository.create({
      email: input.email.toLowerCase(),
      passwordHash,
      fullName: input.fullName,
      userRole: input.userRole,
      companyRole: input.companyRole ?? CompanyRole.OTHER,
      managerId,
      teamMemberIds: [],
      isActive: true,
      timezone: input.timezone,
    });

    return this.sanitizeUser(toPlain(created));
  }

  async updateStatus(actor: { id: string; role: UserRole }, userId: string, isActive: boolean) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (actor.role === UserRole.MANAGER && user.managerId !== actor.id) {
      throw new AppError(403, "Managers can only update their own team");
    }

    user.isActive = isActive;
    await user.save();

    return this.sanitizeUser(toPlain(user));
  }

  async assignManager(
    actor: { id: string; role: UserRole },
    userId: string,
    managerId?: string | null,
  ) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (user.userRole !== UserRole.EMPLOYEE) {
      throw new AppError(400, "Only employees can be assigned to a manager");
    }

    if (!user.isActive) {
      throw new AppError(400, "Blocked employees cannot be assigned to a manager");
    }

    user.managerId = actor.role === UserRole.MANAGER ? actor.id : managerId ?? null;
    await user.save();

    return this.sanitizeUser(toPlain(user));
  }

  private sanitizeUser(user: Record<string, unknown> | null) {
    if (!user) {
      return null;
    }

    delete user.passwordHash;
    return user;
  }
}
