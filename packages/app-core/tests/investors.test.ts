import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getInvestorDashboard,
  investorDashboardSchema,
  investorSchema,
  listInvestors,
} from "../src/investors/investors";

const investor = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Northwind Capital",
  type: "vc",
  status: "investors",
  contactName: "Jamie Example",
  contactEmail: "jamie@example.com",
  contactPhone: "+66-2000-0000",
  website: "https://example.com",
  location: "Bangkok",
  region: "APAC",
  title: "Partner",
  linkedinUrl: "https://linkedin.com/in/jamie",
  revenueStream: "Series A",
  lastContactDate: "2026-06-01T00:00:00.000Z",
  nextAction: "Send deck",
  actInvestment: "1000000",
  estInvestment: "2000000",
  crossSell: "Intro to product",
  notesText: "Internal pipeline note",
  notes: { secret: true },
  adder: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    avatarUrl: null,
  },
  _count: { investments: 3 },
};

describe("investors foundation contracts", () => {
  it("keeps list fields and strips contact secrets/notes/amounts", () => {
    const parsed = investorSchema.parse(investor);
    expect(parsed).toEqual({
      id: investor.id,
      name: "Northwind Capital",
      type: "vc",
      status: "investors",
      contactName: "Jamie Example",
      location: "Bangkok",
      region: "APAC",
      title: "Partner",
      revenueStream: "Series A",
      lastContactDate: "2026-06-01T00:00:00.000Z",
      nextAction: "Send deck",
      investmentCount: 3,
      adder: { id: investor.adder.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("contactEmail");
    expect(parsed).not.toHaveProperty("contactPhone");
    expect(parsed).not.toHaveProperty("website");
    expect(parsed).not.toHaveProperty("notesText");
    expect(parsed).not.toHaveProperty("actInvestment");
    expect(parsed).not.toHaveProperty("estInvestment");
  });

  it("lists investors with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [investor],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listInvestors(client, { page: 1, limit: 20 }, signal),
    ).resolves.toEqual({
      data: [expect.objectContaining({ name: "Northwind Capital" })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith("/investors?page=1&limit=20", {
      signal,
    });
  });

  it("dashboard keeps KPI scalars and strips byCurrency", () => {
    const parsed = investorDashboardSchema.parse({
      totalInvestors: 12,
      totalInvestments: 4,
      totalCommitted: 1000,
      totalReceived: 500,
      totalEstInvestment: 2000,
      totalActInvestment: 800,
      statusBreakdown: [
        { status: "lead", count: 5 },
        { status: "dd", count: 2 },
      ],
    });
    expect(parsed.totalInvestors).toBe(12);
    expect(parsed.statusBreakdown).toEqual([
      { status: "lead", count: 5 },
      { status: "dd", count: 2 },
    ]);
    expect(parsed).not.toHaveProperty("byCurrency");
  });

  it("loads investor dashboard", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: {
        totalInvestors: 3,
        totalInvestments: 1,
        totalCommitted: 100,
        totalReceived: 50,
        totalEstInvestment: 200,
        totalActInvestment: 80,
        statusBreakdown: { lead: 2, dd: 1 },
        byCurrency: { THB: { committed: 100, received: 50 } },
      },
    });
    const client = { get } as unknown as ApiClient;

    await expect(getInvestorDashboard(client, signal)).resolves.toEqual({
      totalInvestors: 3,
      totalInvestments: 1,
      totalCommitted: 100,
      totalReceived: 50,
      totalEstInvestment: 200,
      totalActInvestment: 80,
      statusBreakdown: [
        { status: "lead", count: 2 },
        { status: "dd", count: 1 },
      ],
    });
    expect(get).toHaveBeenCalledWith("/investors/dashboard", { signal });
  });
});
