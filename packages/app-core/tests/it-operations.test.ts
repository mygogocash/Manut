import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getItOpsDashboard,
  listAccessRequests,
  listItSubscriptions,
} from "../src/it-operations/it-operations";

describe("it-operations foundation contracts", () => {
  it("loads dashboard KPIs without recent access identity rows", async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        cards: {
          monthlySpendByCurrency: { USD: 1200 },
          primaryCurrency: "USD",
          upcomingRenewals7: 2,
          activeSubscriptions: 8,
          pendingAccessRequests: 3,
          totalLicenses: 100,
          assignedLicenses: 70,
          unusedLicenses: 30,
          potentialMonthlySavingsByCurrency: { USD: 50 },
        },
        recentGrantedAccess: [
          {
            id: "g1",
            employee: { id: "u1", name: "Alex" },
            system: { id: "s1", name: "Git" },
            accessLevel: "user",
            grantedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    });
    const client = { get } as unknown as ApiClient;

    const result = await getItOpsDashboard(client);
    expect(result.activeSubscriptions).toBe(8);
    expect(result.pendingAccessRequests).toBe(3);
    expect(result).not.toHaveProperty("recentGrantedAccess");
    expect(get).toHaveBeenCalledWith("/it-operations/dashboard", undefined);
  });

  it("lists access requests without emails or justification", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          id: "req1",
          requestNumber: 12,
          status: "pending-it",
          requestedAccessLevel: "user",
          businessJustification: "Need access for project",
          system: { id: "s1", name: "GitHub" },
          employee: {
            id: "u1",
            name: "Alex Example",
            email: "alex@manut.example",
          },
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listAccessRequests(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: "req1",
      requestNumber: 12,
      status: "pending-it",
      requestedAccessLevel: "user",
      systemName: "GitHub",
      employeeName: "Alex Example",
    });
    expect(result.data[0]).not.toHaveProperty("businessJustification");
    expect(get).toHaveBeenCalledWith(
      "/it-access/requests?page=1&limit=20",
      undefined,
    );
  });

  it("lists subscriptions without owner email", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          id: "sub1",
          productName: "Seat pack",
          status: "active",
          currency: "USD",
          monthlySpend: 99,
          renewalDate: "2026-12-01",
          vendor: { id: "v1", name: "Vendor Co" },
          owner: {
            id: "u1",
            name: "Alex",
            email: "alex@manut.example",
          },
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listItSubscriptions(client);
    expect(result.data[0]).toEqual({
      id: "sub1",
      productName: "Seat pack",
      status: "active",
      currency: "USD",
      monthlySpend: 99,
      renewalDate: "2026-12-01",
      vendorName: "Vendor Co",
    });
    expect(result.data[0]).not.toHaveProperty("owner");
  });
});
