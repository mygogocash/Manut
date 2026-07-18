import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  approveLeaveRequest,
  canActOnLeaveRequest,
  listLeaveTeamRequests,
  rejectLeaveRequest,
  rejectLeaveRequestInputSchema,
} from "../src/leave/leave-team";

const teamRequest = {
  id: "22222222-2222-4222-8222-222222222222",
  leaveType: {
    id: "annual-leave",
    name: "Annual leave",
    code: "AL",
    category: "earned" as const,
    daysPerYear: 12,
    requiresApproval: true,
  },
  startDate: "2026-07-20T00:00:00.000Z",
  endDate: "2026-07-20T00:00:00.000Z",
  durationType: "full_day" as const,
  halfDayPeriod: null,
  days: "1.0",
  reason: "Personal",
  status: "pending" as const,
  createdAt: "2026-07-01T10:00:00.000Z",
  employee: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Alex Example",
    email: "alex@example.com",
    department: "Engineering",
    reportingTo: "manager-1",
  },
  approver: { id: "approver-1", name: "Approver", email: "a@example.com" },
};

describe("leave team approve contracts", () => {
  it("lists pending team requests with employee name only", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [teamRequest],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listLeaveTeamRequests(
      client,
      { status: "pending", page: 1, limit: 20 },
      signal,
    );
    expect(result.data[0]).toEqual({
      id: teamRequest.id,
      leaveType: {
        id: "annual-leave",
        name: "Annual leave",
        code: "AL",
        category: "earned",
      },
      startDate: "2026-07-20",
      endDate: "2026-07-20",
      durationType: "full_day",
      halfDayPeriod: null,
      days: "1.0",
      reason: "Personal",
      status: "pending",
      createdAt: "2026-07-01T10:00:00.000Z",
      employee: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Alex Example",
      },
    });
    expect(result.data[0]).not.toHaveProperty("approver");
    expect(result.data[0]?.employee).not.toHaveProperty("email");
    expect(get).toHaveBeenCalledWith(
      "/leave/requests?page=1&limit=20&status=pending",
      { signal },
    );
  });

  it("approves and rejects pending requests", async () => {
    expect(canActOnLeaveRequest("pending")).toBe(true);
    expect(canActOnLeaveRequest("approved")).toBe(false);
    expect(
      rejectLeaveRequestInputSchema.parse({ reason: "  Missing coverage  " }),
    ).toEqual({ reason: "Missing coverage" });

    const put = vi
      .fn()
      .mockResolvedValueOnce({
        data: { id: teamRequest.id, status: "approved" },
      })
      .mockResolvedValueOnce({
        data: { id: teamRequest.id, status: "rejected" },
      });
    const client = { put } as unknown as ApiClient;

    await expect(approveLeaveRequest(client, teamRequest.id)).resolves.toEqual({
      id: teamRequest.id,
      status: "approved",
    });
    expect(put).toHaveBeenNthCalledWith(
      1,
      `/leave/requests/${teamRequest.id}/approve`,
    );

    await expect(
      rejectLeaveRequest(client, teamRequest.id, {
        reason: "Missing coverage",
      }),
    ).resolves.toEqual({ id: teamRequest.id, status: "rejected" });
    expect(put).toHaveBeenNthCalledWith(
      2,
      `/leave/requests/${teamRequest.id}/reject`,
      { reason: "Missing coverage" },
    );
  });
});
