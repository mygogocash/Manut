import { describe, expect, it } from "vitest";

import {
  attendanceDateFromInstant,
  COMPANY_DEFAULT_TIMEZONE,
  computeLateMinutesInTimezone,
  resolveEmployeeTimezone,
  zonedLocalToUtc,
} from "@/modules/hrms/attendance-timezone.util";

// These zones don't observe DST, so the offsets are constant year-round and
// the assertions below are deterministic.
describe("zonedLocalToUtc", () => {
  it("maps a wall-clock time to the exact UTC instant (half-hour offset)", () => {
    // Asia/Kolkata is UTC+5:30 → 09:00 local = 03:30 UTC.
    expect(
      zonedLocalToUtc("2026-06-12", "09:00", "Asia/Kolkata").toISOString(),
    ).toBe("2026-06-12T03:30:00.000Z");
  });

  it("handles UTC+7 (Bangkok) and UTC+4 (Dubai)", () => {
    expect(
      zonedLocalToUtc("2026-06-12", "09:00", "Asia/Bangkok").toISOString(),
    ).toBe("2026-06-12T02:00:00.000Z");
    expect(
      zonedLocalToUtc("2026-06-12", "09:00", "Asia/Dubai").toISOString(),
    ).toBe("2026-06-12T05:00:00.000Z");
  });
});

describe("computeLateMinutesInTimezone", () => {
  const attendanceDate = new Date(Date.UTC(2026, 5, 12)); // 2026-06-12
  const tz = "Asia/Kolkata";

  it("returns 0 exactly at shiftStart + grace", () => {
    // shift 09:00 + 15m grace → on-time boundary at 09:15 local.
    const checkIn = zonedLocalToUtc("2026-06-12", "09:15", tz);
    expect(
      computeLateMinutesInTimezone(checkIn, "09:00", 15, attendanceDate, tz),
    ).toBe(0);
  });

  it("returns the minutes past the grace boundary", () => {
    const checkIn = new Date(
      zonedLocalToUtc("2026-06-12", "09:15", tz).getTime() + 7 * 60_000,
    );
    expect(
      computeLateMinutesInTimezone(checkIn, "09:00", 15, attendanceDate, tz),
    ).toBe(7);
  });
});

describe("attendanceDateFromInstant", () => {
  it("rolls over to the next local calendar day for an ahead-of-UTC zone", () => {
    // 2026-06-12T19:00Z is 2026-06-13 02:00 in Bangkok (+7).
    const instant = new Date("2026-06-12T19:00:00.000Z");
    expect(
      attendanceDateFromInstant(instant, "Asia/Bangkok").toISOString(),
    ).toBe("2026-06-13T00:00:00.000Z");
  });
});

describe("resolveEmployeeTimezone", () => {
  it("prefers the user's timezone when valid", () => {
    expect(resolveEmployeeTimezone("Asia/Dubai", "Asia/Bangkok")).toBe(
      "Asia/Dubai",
    );
  });

  it("falls back to the policy default when the user tz is invalid", () => {
    expect(resolveEmployeeTimezone("Not/AZone", "Asia/Bangkok")).toBe(
      "Asia/Bangkok",
    );
  });

  it("falls back to the company default when both are missing/invalid", () => {
    expect(resolveEmployeeTimezone(null, null)).toBe(COMPANY_DEFAULT_TIMEZONE);
    expect(resolveEmployeeTimezone("garbage", "also-garbage")).toBe(
      COMPANY_DEFAULT_TIMEZONE,
    );
  });
});
