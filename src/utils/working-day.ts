export const isWeekend = (date: Date) => {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
};

export const countWorkingDaysUntil = (startDate: Date, endDate: Date, holidayDates: string[]) => {
  const holidays = new Set(holidayDates.map((date) => new Date(date).toISOString().slice(0, 10)));
  let count = 0;
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const key = cursor.toISOString().slice(0, 10);
    if (!isWeekend(cursor) && !holidays.has(key)) {
      count += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
};

