import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  canCancelLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  createLeaveRequestInputSchema,
  getLeaveBalances,
  getLeaveRequests,
  getLeaveTypes,
  leaveBalanceSchema,
  leaveRequestSchema,
} from "../src/leave/leave";

const leaveType = {
  id: "annual-leave",
  entityId: null,
  entity: null,
  name: "Annual leave",
  code: "AL",
  description: null,
  category: "earned" as const,
  daysPerYear: 12,
  requiresApproval: true,
  isPaid: true,
  isActive: true,
};

const balance = {
  id: "11111111-1111-4111-8111-111111111111",
  leaveType: {
    id: leaveType.id,
    name: leaveType.name,
    code: leaveType.code,
    category: leaveType.category,
  },
  year: 2026,
  entitled: 12,
  used: 2.5,
  carried: 1,
  carriedUsed: 0,
  carriedExpiry: "2026-12-31",
  carriedExpired: false,
  carriedRemaining: 1,
  adjustment: 0,
  remaining: 9.5,
};

describe("leave contracts", () => {
  it("accepts exact half-day balances and rejects unknown internal fields", () => {
    expect(leaveBalanceSchema.parse(balance).used).toBe(2.5);
    expect(
      leaveBalanceSchema.safeParse({ ...balance, employeeId: "private" })
        .success,
    ).toBe(false);
  });

  it("validates calendar dates and half-day invariants", () => {
    expect(
      createLeaveRequestInputSchema.parse({
        leaveTypeId: leaveType.id,
        startDate: "2026-07-20",
        endDate: "2026-07-20",
        durationType: "half_day",
        halfDayPeriod: "am",
        reason: "  Appointment  ",
      }),
    ).toEqual({
      leaveTypeId: leaveType.id,
      startDate: "2026-07-20",
      endDate: "2026-07-20",
      durationType: "half_day",
      halfDayPeriod: "am",
      reason: "Appointment",
      source: "entitled",
    });
    expect(
      createLeaveRequestInputSchema.safeParse({
        leaveTypeId: leaveType.id,
        startDate: "2026-02-30",
        endDate: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      createLeaveRequestInputSchema.safeParse({
        leaveTypeId: leaveType.id,
        startDate: "2026-07-20",
        endDate: "2026-07-21",
        durationType: "half_day",
        halfDayPeriod: "pm",
      }).success,
    ).toBe(false);
  });

  it("loads abortable types and balances through the shared client", async () => {
    const signal = { aborted: false };
    const get = vi
      .fn()
      .mockResolvedValueOnce({ data: [leaveType] })
      .mockResolvedValueOnce({ data: [balance] });
    const client = { get } as unknown as ApiClient;

    await expect(getLeaveTypes(client, signal)).resolves.toEqual([leaveType]);
    await expect(getLeaveBalances(client, signal)).resolves.toEqual([balance]);
    expect(get).toHaveBeenNthCalledWith(1, "/leave/types", { signal });
    expect(get).toHaveBeenNthCalledWith(2, "/leave/balances", { signal });
  });

  it("submits only validated request fields and returns a minimal receipt", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        id: "request-1",
        status: "pending",
        employee: { id: "private-employee", email: "private@example.com" },
      },
    });
    const client = { post } as unknown as ApiClient;

    await expect(
      createLeaveRequest(client, {
        leaveTypeId: leaveType.id,
        startDate: "2026-07-20",
        endDate: "2026-07-20",
        durationType: "full_day",
        reason: "  Personal  ",
      }),
    ).resolves.toEqual({ id: "request-1", status: "pending" });
    expect(post).toHaveBeenCalledWith("/leave/requests", {
      leaveTypeId: leaveType.id,
      startDate: "2026-07-20",
      endDate: "2026-07-20",
      durationType: "full_day",
      reason: "Personal",
      source: "entitled",
    });
  });

  it("allows cancel only for pending and approved requests", () => {
    expect(canCancelLeaveRequest("pending")).toBe(true);
    expect(canCancelLeaveRequest("approved")).toBe(true);
    expect(canCancelLeaveRequest("rejected")).toBe(false);
    expect(canCancelLeaveRequest("cancelled")).toBe(false);
    expect(canCancelLeaveRequest("pending_cancellation")).toBe(false);
  });

  it("projects leave request history to a non-sensitive receipt", () => {
    const parsed = leaveRequestSchema.parse({
      id: "22222222-2222-4222-8222-222222222222",
      leaveType: {
        id: leaveType.id,
        name: leaveType.name,
        code: leaveType.code,
        category: leaveType.category,
        daysPerYear: 12,
        requiresApproval: true,
      },
      startDate: "2026-07-20T00:00:00.000Z",
      endDate: "2026-07-21T00:00:00.000Z",
      durationType: "full_day",
      halfDayPeriod: null,
      days: "2.0",
      reason: "Travel",
      status: "pending",
      createdAt: "2026-07-01T10:00:00.000Z",
      employee: {
        id: "private-employee",
        email: "private@example.com",
        reportingTo: "manager-1",
      },
      approver: { id: "approver-1", name: "Approver", email: "a@example.com" },
    });

    expect(parsed).toEqual({
      id: "22222222-2222-4222-8222-222222222222",
      leaveType: {
        id: leaveType.id,
        name: leaveType.name,
        code: leaveType.code,
        category: leaveType.category,
      },
      startDate: "2026-07-20",
      endDate: "2026-07-21",
      durationType: "full_day",
      halfDayPeriod: null,
      days: "2.0",
      reason: "Travel",
      status: "pending",
      createdAt: "2026-07-01T10:00:00.000Z",
    });
    expect(parsed).not.toHaveProperty("employee");
    expect(parsed).not.toHaveProperty("approver");
  });

  it("loads abortable self-scoped requests and cancels with a minimal receipt", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          leaveType: {
            id: leaveType.id,
            name: leaveType.name,
            code: leaveType.code,
            category: leaveType.category,
            daysPerYear: 12,
            requiresApproval: true,
          },
          startDate: "2026-07-20T00:00:00.000Z",
          endDate: "2026-07-20T00:00:00.000Z",
          durationType: "half_day",
          halfDayPeriod: "am",
          days: 0.5,
          reason: null,
          status: "approved",
          createdAt: "2026-07-01T10:00:00.000Z",
          employee: { id: "user-1", email: "private@example.com" },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const put = vi.fn().mockResolvedValue({
      data: {
        id: "22222222-2222-4222-8222-222222222222",
        status: "cancelled",
        employee: { id: "user-1", email: "private@example.com" },
      },
    });
    const client = { get, put } as unknown as ApiClient;

    await expect(
      getLeaveRequests(
        client,
        { employeeId: "11111111-1111-4111-8111-111111111111", page: 1, limit: 20 },
        signal,
      ),
    ).resolves.toEqual({
      data: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          leaveType: {
            id: leaveType.id,
            name: leaveType.name,
            code: leaveType.code,
            category: leaveType.category,
          },
          startDate: "2026-07-20",
          endDate: "2026-07-20",
          durationType: "half_day",
          halfDayPeriod: "am",
          days: "0.5",
          reason: null,
          status: "approved",
          createdAt: "2026-07-01T10:00:00.000Z",
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith(
      "/leave/requests?page=1&limit=20&employeeId=11111111-1111-4111-8111-111111111111",
      { signal },
    );

    await expect(
      cancelLeaveRequest(client, "22222222-2222-4222-8222-222222222222"),
    ).resolves.toEqual({
      id: "22222222-2222-4222-8222-222222222222",
      status: "cancelled",
    });
    expect(put).toHaveBeenCalledWith(
      "/leave/requests/22222222-2222-4222-8222-222222222222/cancel",
    );
  });
});
