import { TeamRepository, UserRepository } from "../repositories/index.js";
import { UserRole } from "../types/enums.js";
import { AppError } from "../utils/app-error.js";
import { toPlain } from "../utils/serializers.js";

export class TeamsService {
  constructor(
    private readonly teamRepository: TeamRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async listTeams(actor: { id: string; role: UserRole }, query?: { scope?: string }) {
    if (actor.role === UserRole.ADMIN) {
      return this.enrichTeams(await this.teamRepository.findAll());
    }

    if (actor.role === UserRole.MANAGER) {
      if (query?.scope === "all") {
        return this.enrichTeams(await this.teamRepository.findAll());
      }

      return this.enrichTeams(await this.teamRepository.findByManagerId(actor.id));
    }

    return this.enrichTeams(await this.teamRepository.findByMemberId(actor.id));
  }

  async createTeam(
    actor: { id: string; role: UserRole },
    input: { name: string; managerIds: string[]; memberIds: string[] },
  ) {
    if (actor.role !== UserRole.ADMIN) {
      throw new AppError(403, "Only admins can create teams");
    }

    await this.validateUsers(input.managerIds, UserRole.MANAGER, "manager");
    await this.validateUsers(input.memberIds, UserRole.EMPLOYEE, "member");

    const team = await this.teamRepository.create({
      name: input.name,
      managerIds: [...new Set(input.managerIds)],
      memberIds: [...new Set(input.memberIds)],
      createdByAdminId: actor.id,
    });

    return this.enrichTeam(team);
  }

  async updateTeam(
    actor: { id: string; role: UserRole },
    teamId: string,
    input: { name: string; managerIds: string[]; memberIds: string[] },
  ) {
    if (actor.role !== UserRole.ADMIN) {
      throw new AppError(403, "Only admins can update teams");
    }

    const team = await this.teamRepository.findById(teamId);
    if (!team) {
      throw new AppError(404, "Team not found");
    }

    await this.validateUsers(input.managerIds, UserRole.MANAGER, "manager");
    await this.validateUsers(input.memberIds, UserRole.EMPLOYEE, "member");

    team.name = input.name;
    team.managerIds = [...new Set(input.managerIds)];
    team.memberIds = [...new Set(input.memberIds)];
    await team.save();

    return this.enrichTeam(team);
  }

  async deleteTeam(actor: { id: string; role: UserRole }, teamId: string) {
    if (actor.role !== UserRole.ADMIN) {
      throw new AppError(403, "Only admins can delete teams");
    }

    const deleted = await this.teamRepository.deleteById(teamId);
    if (!deleted) {
      throw new AppError(404, "Team not found");
    }

    return { success: true };
  }

  async getTeamsManagedBy(managerId: string) {
    return this.teamRepository.findByManagerId(managerId);
  }

  async getTeamsByIds(teamIds: string[]) {
    return this.teamRepository.findByIds(teamIds);
  }

  private async validateUsers(userIds: string[], role: UserRole, label: string) {
    const uniqueIds = [...new Set(userIds)];
    const users = await Promise.all(uniqueIds.map((userId) => this.userRepository.findById(userId)));

    if (users.some((user) => !user || user.userRole !== role)) {
      throw new AppError(400, `All selected ${label}s must be valid ${role.toLowerCase()}s`);
    }
  }

  private async enrichTeams(teams: Array<{ _id: { toString(): string } }>) {
    return Promise.all(teams.map((team) => this.enrichTeam(team)));
  }

  private async enrichTeam(team: { _id: { toString(): string } } | null) {
    const plainTeam = toPlain(team);
    const managerIds = Array.isArray(plainTeam?.managerIds) ? (plainTeam.managerIds as string[]) : [];
    const memberIds = Array.isArray(plainTeam?.memberIds) ? (plainTeam.memberIds as string[]) : [];
    const [managers, members] = await Promise.all([
      Promise.all(managerIds.map((managerId) => this.userRepository.findById(managerId))),
      Promise.all(memberIds.map((memberId) => this.userRepository.findById(memberId))),
    ]);

    return {
      ...plainTeam,
      managers: managers.map((manager) => this.sanitizeUser(toPlain(manager))).filter(Boolean),
      members: members.map((member) => this.sanitizeUser(toPlain(member))).filter(Boolean),
    };
  }

  private sanitizeUser(user: Record<string, unknown> | null) {
    if (!user) {
      return null;
    }

    delete user.passwordHash;
    return user;
  }
}
