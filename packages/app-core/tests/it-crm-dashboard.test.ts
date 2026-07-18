import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getItCrmDashboard,
  itCrmDashboardSchema,
} from "../src/it-crm/it-crm-dashboard";

describe("it-crm dashboard foundation contracts", () => {
  it("collapses KPI rollup and strips comments/flow/helpdesk", () => {
    const parsed = itCrmDashboardSchema.parse({
      total: 4,
      productionLive: 1,
      atRisk: 1,
      inProgress: 2,
      byStatus: [{ status: "in_progress", count: 2 }],
      byDepartment: [{ department: "Engineering", count: 3 }],
      upcomingGoLives: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Edge hardening",
          slug: "edge-hardening",
          status: "in_progress",
          department: "Engineering",
          goLiveDate: "2026-08-01T00:00:00.000Z",
          revisedGoLiveDate: null,
          owner: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            name: "Alex Example",
          },
        },
      ],
      recentUpdates: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Edge hardening",
          slug: "edge-hardening",
          status: "in_progress",
          department: "Engineering",
          comment: "Blocked on vendor",
          updatedAt: "2026-07-17T12:00:00.000Z",
          owner: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            name: "Alex Example",
            email: "alex@example.com",
          },
        },
      ],
    });

    expect(parsed.total).toBe(4);
    expect(parsed.recentUpdates[0]).toEqual({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Edge hardening",
      slug: "edge-hardening",
      status: "in_progress",
      department: "Engineering",
      goLiveDate: null,
      revisedGoLiveDate: null,
      updatedAt: "2026-07-17T12:00:00.000Z",
      owner: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "Alex Example",
      },
    });
    expect(parsed.recentUpdates[0]).not.toHaveProperty("comment");
  });

  it("loads it-crm dashboard", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: {
        total: 1,
        productionLive: 0,
        atRisk: 0,
        completed: 0,
        inProgress: 1,
        byStatus: [],
        byDepartment: [],
        upcomingGoLives: [],
        recentUpdates: [],
        flow: { leadTimeDays: 12 },
        sla: { response: {} },
        helpdesk: { open: 3 },
      },
    });
    const client = { get } as unknown as ApiClient;

    await expect(getItCrmDashboard(client, signal)).resolves.toEqual(
      expect.objectContaining({ total: 1, inProgress: 1 }),
    );
    expect(get).toHaveBeenCalledWith("/it-crm/dashboard", { signal });
  });
});
