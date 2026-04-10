import { describe, expect, it } from "vitest";

import { TaskStatus, TimerState, nextStatusForTimerState } from "../../../shared/index.js";

import { countWorkingDaysUntil } from "./working-day";

describe("task rules", () => {
  it("moves a task into WIP when timer starts", () => {
    expect(nextStatusForTimerState(TaskStatus.PENDING, TimerState.RUNNING)).toBe(TaskStatus.WIP);
  });

  it("moves a WIP task to ON_HOLD when timer stops", () => {
    expect(nextStatusForTimerState(TaskStatus.WIP, TimerState.STOPPED)).toBe(TaskStatus.ON_HOLD);
  });

  it("counts working days excluding weekends and holidays", () => {
    const result = countWorkingDaysUntil(
      new Date("2026-04-06T00:00:00.000Z"),
      new Date("2026-04-10T00:00:00.000Z"),
      ["2026-04-08T00:00:00.000Z"],
    );

    expect(result).toBe(4);
  });
});
