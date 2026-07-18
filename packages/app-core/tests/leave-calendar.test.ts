import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  leaveCalendarEntrySchema,
  leaveCalendarParamsSchema,
  listLeaveCalendar,
} from "../src/leave/leave-calendar";

const entry = {
  id: "22222222-2222-4222-8222-222222222222",
  employeeId: "11111111-1111-4111-8111-111111111111",
  startDate: "2026-07-20T00:00:00.000Z",
  endDate: "2026-07-21T00:00:00.000Z",
  status: "approved" as const,
  durationType: "full_day" as const,
  halfDayPeriod: null,
  days: "2.0",
  reason: "Internal note",
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Alex Example",
    department: "Engineering",
    email: "alex@example.com",
  },
  leaveType: {
    id: "annual-leave",
    name: "Annual leave",
    code: "AL",
    category: "earned" as const,
  },
};

describe("leave calendar contracts", () => {
  it("projects calendar rows without reason or employee email", () => {
    const parsed = leaveCalendarEntrySchema.parse(entry);
    expect(parsed).toEqual({
      id: entry.id,
      startDate: "2026-07-20",
      endDate: "2026-07-21",
      status: "approved",
      durationType: "full_day",
      halfDayPeriod: null,
      days: "2.0",
      employee: {
        id: entry.employee.id,
        name: "Alex Example",
        department: "Engineering",
      },
      leaveType: {
        id: "annual-leave",
        name: "Annual leave",
        code: "AL",
        category: "earned",
      },
    });
    expect(parsed).not.toHaveProperty("reason");
    expect(parsed.employee).not.toHaveProperty("email");
  });

  it("requires a valid from/to range", () => {
    expect(
      leaveCalendarParamsSchema.parse({
        from: "2026-07-01",
        to: "2026-07-31",
      }),
    ).toEqual({ from: "2026-07-01", to: "2026-07-31" });
    expect(
      leaveCalendarParamsSchema.safeParse({
        from: "2026-07-31",
        to: "2026-07-01",
      }).success,
    ).toBe(false);
  });

  it("lists calendar entries with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: [entry] });
    const client = { get } as unknown as ApiClient;

    await expect(
      listLeaveCalendar(
        client,
        { from: "2026-07-01", to: "2026-07-31", department: "Engineering" },
        signal,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: entry.id,
        employee: expect.objectContaining({ name: "Alex Example" }),
      }),
    ]);
    expect(get).toHaveBeenCalledWith(
      "/leave/calendar?from=2026-07-01&to=2026-07-31&department=Engineering",
      { signal },
    );
  });
});
