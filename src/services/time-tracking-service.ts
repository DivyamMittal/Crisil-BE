import { TimeEntryRepository } from "../repositories/time-entry-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { UserRole } from "../types/enums.js";
import { toPlainList } from "../utils/serializers.js";

export class TimeTrackingService {
  constructor(
    private readonly timeEntryRepository: TimeEntryRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async listEntries(actor: { id: string; role: UserRole }) {
    if (actor.role === UserRole.EMPLOYEE) {
      const entries = await this.timeEntryRepository.findByEmployeeId(actor.id);
      return toPlainList(entries);
    }

    if (actor.role === UserRole.MANAGER) {
      const team = await this.userRepository.findIdsByManagerId(actor.id);
      const entries = await this.timeEntryRepository.findByEmployeeIds(
        team.map((member) => member.id),
      );
      return toPlainList(entries);
    }

    const entries = await this.timeEntryRepository.findAll();
    return toPlainList(entries);
  }
}
