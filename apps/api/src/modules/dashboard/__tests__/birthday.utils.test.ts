import { describe, expect, it } from "vitest";

import {
  birthdayWindowLabel,
  daysUntilBirthday,
  getBirthdayWindowDays,
} from "@/modules/dashboard/birthday.utils";

describe("getBirthdayWindowDays", () => {
  it("includes today and the next three days", () => {
    const window = getBirthdayWindowDays(new Date("2026-06-02T12:00:00Z"));
    expect(window).toHaveLength(4);
    expect(window[0]).toMatchObject({ month: 6, day: 2, offset: 0 });
    expect(window[3]).toMatchObject({ month: 6, day: 5, offset: 3 });
  });

  it("handles year rollover at month end", () => {
    const window = getBirthdayWindowDays(new Date("2026-12-31T12:00:00Z"));
    expect(window.map((d) => `${d.month}-${d.day}`)).toEqual([
      "12-31",
      "1-1",
      "1-2",
      "1-3",
    ]);
  });
});

describe("daysUntilBirthday", () => {
  const window = getBirthdayWindowDays(new Date("2026-06-02T12:00:00Z"));

  it("returns offset when birthday falls in the window", () => {
    expect(daysUntilBirthday(new Date("1990-06-04T00:00:00Z"), window)).toBe(2);
  });

  it("returns null when birthday is outside the window", () => {
    expect(
      daysUntilBirthday(new Date("1990-06-10T00:00:00Z"), window),
    ).toBeNull();
  });
});

describe("birthdayWindowLabel", () => {
  it("labels near-term offsets", () => {
    expect(birthdayWindowLabel(0)).toBe("Today");
    expect(birthdayWindowLabel(1)).toBe("Tomorrow");
    expect(birthdayWindowLabel(3)).toBe("In 3 days");
  });
});
