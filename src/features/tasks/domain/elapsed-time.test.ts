import { describe, expect, it } from "vitest";

import { calculateElapsedWholeMinutes, calculateElapsedWholeSeconds } from "./elapsed-time";

describe("calculateElapsedWholeMinutes", () => {
  it("returns zero for durations below one minute", () => {
    expect(
      calculateElapsedWholeMinutes("2026-04-06T09:00:00.000Z", "2026-04-06T09:00:04.000Z"),
    ).toBe(0);
  });

  it("floors partial minutes instead of rounding up", () => {
    expect(
      calculateElapsedWholeMinutes("2026-04-06T09:00:00.000Z", "2026-04-06T09:01:59.000Z"),
    ).toBe(1);
  });

  it("returns zero when the end time is not after the start time", () => {
    expect(
      calculateElapsedWholeMinutes("2026-04-06T09:00:00.000Z", "2026-04-06T09:00:00.000Z"),
    ).toBe(0);
  });
});

describe("calculateElapsedWholeSeconds", () => {
  it("returns exact elapsed whole seconds", () => {
    expect(
      calculateElapsedWholeSeconds("2026-04-06T09:00:00.000Z", "2026-04-06T09:00:04.999Z"),
    ).toBe(4);
  });

  it("returns zero when the end time is not after the start time", () => {
    expect(
      calculateElapsedWholeSeconds("2026-04-06T09:00:00.000Z", "2026-04-06T09:00:00.000Z"),
    ).toBe(0);
  });
});
