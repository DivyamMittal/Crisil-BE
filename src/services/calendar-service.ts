import { HolidayRepository } from "../repositories/holiday-repository.js";
import { AppError } from "../utils/app-error.js";
import { toPlain, toPlainList } from "../utils/serializers.js";

export class CalendarService {
  constructor(private readonly holidayRepository: HolidayRepository) {}

  async listHolidays() {
    const holidays = await this.holidayRepository.findAll();
    return toPlainList(holidays);
  }

  async createHoliday(actorId: string, input: { title: string; dateUtc: string }) {
    const holiday = await this.holidayRepository.create({
      title: input.title,
      dateUtc: input.dateUtc,
      createdByManagerId: actorId,
      appliesTo: [],
    });

    return toPlain(holiday);
  }

  async updateHoliday(holidayId: string, input: { title: string; dateUtc: string }) {
    const holiday = await this.holidayRepository.findById(holidayId);

    if (!holiday) {
      throw new AppError(404, "Holiday not found");
    }

    holiday.title = input.title;
    holiday.dateUtc = new Date(input.dateUtc);
    await holiday.save();

    return toPlain(holiday);
  }
}
