import { describe, it, expect } from "vitest";
import { getMondayOfWeek, addDays, getWeekDates, formatDate } from "./dates";

describe("dates", () => {
  it('getMondayOfWeek("2026-10-07") is "2026-10-05"', () => {
    expect(getMondayOfWeek("2026-10-07")).toBe("2026-10-05");
  });

  it('addDays("2026-09-30", 1) crosses the month: "2026-10-01"', () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
  });

  it('getWeekDates("2026-09-28") gives 7 dates, 2026-09-28 to 2026-10-04', () => {
    expect(getWeekDates("2026-09-28")).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });

  it('formatDate("2026-09-30") is "Wed 30 September 2026"', () => {
    expect(formatDate("2026-09-30")).toBe("Wed 30 September 2026");
  });
});
