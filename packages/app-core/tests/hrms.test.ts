import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  checkInAttendance,
  checkOutAttendance,
  getAttendanceToday,
  listEsopGrants,
  listOnboardingRuns,
} from "../src/hrms/hrms";

const grant = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
    department: "Operations",
  },
  grantDate: "2026-01-15",
  grantType: "equity",
  valueType: "shares",
  shares: 1000,
  currencyCode: null,
  currencyAmount: null,
  percentOfBase: null,
  vestingMonths: 48,
  cliffMonths: 12,
  lockMonths: 0,
  strikePrice: 0,
  allocationMode: "one_time",
  monthlyAmount: null,
  allocationStartMonth: null,
  allocationEndMonth: null,
  vestedToDateOverride: null,
  vestedToDate: 250,
  scheduled: true,
  source: "import",
  status: "vesting",
  exercisedShares: 0,
  notes: "internal",
  createdAt: "2026-01-15T00:00:00.000Z",
};

const onboarding = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
  },
  employeeName: "Person",
  department: "Operations",
  startDate: "2026-07-01",
  tasks: [
    { key: "a", label: "Laptop", part: "Setup", done: true },
    { key: "b", label: "NDA", part: "Setup", done: false },
  ],
  status: "in_progress",
  entity: { id: "entity-1", name: "Manut" },
  createdAt: "2026-06-01T00:00:00.000Z",
};

const today = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  employeeId: "11111111-1111-4111-8111-111111111111",
  attendanceDate: "2026-07-18",
  checkIn: "2026-07-18T01:00:00.000Z",
  checkOut: null,
  checkInUtc: "2026-07-18T01:00:00.000Z",
  checkOutUtc: null,
  employeeTimezone: "Asia/Bangkok",
  localCheckInTime: "2026-07-18 08:00",
  localCheckOutTime: null,
  checkInDisplay: { employeeLocal: "08:00" },
  workMode: "office",
  status: "present",
  totalHours: null,
  lateMinutes: 0,
  remarks: null,
  createdAt: "2026-07-18T01:00:00.000Z",
  updatedAt: "2026-07-18T01:00:00.000Z",
};

describe("hrms foundation contracts", () => {
  it("lists projected ESOP grants and strips notes", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [grant],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listEsopGrants(client, { page: 1, limit: 20 });
    expect(result.data[0]).toMatchObject({
      id: grant.id,
      grantType: "equity",
      shares: 1000,
      status: "vesting",
      vestedToDate: 250,
      employee: { name: "Person" },
    });
    expect(result.data[0]).not.toHaveProperty("notes");
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining("/hrms/esop-grants?"),
      undefined,
    );
  });

  it("lists onboarding runs with task progress only", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [onboarding],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listOnboardingRuns(client);
    expect(result.data[0]).toEqual({
      id: onboarding.id,
      employeeName: "Person",
      department: "Operations",
      startDate: "2026-07-01",
      status: "in_progress",
      tasksDone: 1,
      tasksTotal: 2,
      entityName: "Manut",
    });
    expect(result.data[0]).not.toHaveProperty("tasks");
  });

  it("loads today attendance and supports check-in/out", async () => {
    const get = vi.fn().mockResolvedValue({ data: today });
    const post = vi.fn().mockResolvedValue({ data: today });
    const client = { get, post } as unknown as ApiClient;

    await expect(getAttendanceToday(client)).resolves.toMatchObject({
      attendanceDate: "2026-07-18",
      status: "present",
      workMode: "office",
      localCheckInTime: "2026-07-18 08:00",
    });
    expect(get).toHaveBeenCalledWith("/hrms/attendance/today", undefined);

    await expect(
      checkInAttendance(client, { workMode: "remote" }),
    ).resolves.toMatchObject({ workMode: "office" });
    expect(post).toHaveBeenCalledWith("/hrms/attendance/check-in", {
      workMode: "remote",
    });

    await expect(checkOutAttendance(client, {})).resolves.toMatchObject({
      status: "present",
    });
    expect(post).toHaveBeenCalledWith("/hrms/attendance/check-out", {});
  });

  it("returns null when there is no attendance record today", async () => {
    const get = vi.fn().mockResolvedValue({ data: null });
    const client = { get } as unknown as ApiClient;
    await expect(getAttendanceToday(client)).resolves.toBeNull();
  });
});
