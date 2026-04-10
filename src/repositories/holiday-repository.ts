import { HolidayModel } from "../models/index.js";

export class HolidayRepository {
  findAll() {
    return HolidayModel.find({}).sort({ dateUtc: 1 });
  }

  findById(holidayId: string) {
    return HolidayModel.findById(holidayId);
  }

  create(input: {
    title: string;
    dateUtc: string;
    createdByManagerId: string;
    appliesTo: string[];
  }) {
    return HolidayModel.create(input);
  }
}
