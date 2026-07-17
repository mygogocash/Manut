import { describe, expect, it } from "vitest";

import type { SalesDashboardRow } from "@/services/crm-opportunity.service";

import {
  countryMatchesFeature,
  deriveStage,
  fmtMoney,
  fmtUsers,
  stageBucket,
} from "./sales-dashboard-utils";

function row(overrides: Partial<SalesDashboardRow>): SalesDashboardRow {
  return {
    id: "1",
    name: "Acme",
    stage: "qualified",
    value: 0,
    currency: "USD",
    probability: 20,
    launchDate: null,
    revenueLaunchDate: null,
    accountId: "acc-1",
    accountName: "Acme",
    country: null,
    region: null,
    industry: null,
    totalUsers: null,
    appUsers: null,
    engagementType: null,
    ownerName: null,
    ...overrides,
  };
}

describe("deriveStage", () => {
  it("maps the live stage to Live", () => {
    const s = deriveStage(row({ stage: "live" }));
    expect(s).toBe("Live");
    expect(stageBucket(s)).toBe("live");
  });

  it("maps closed_won to Going Live regardless of launch date", () => {
    expect(
      deriveStage(row({ stage: "closed_won", launchDate: "2026-01-10" })),
    ).toBe("Going Live");
    expect(deriveStage(row({ stage: "closed_won", launchDate: null }))).toBe(
      "Going Live",
    );
    expect(stageBucket(deriveStage(row({ stage: "closed_won" })))).toBe(
      "going_live",
    );
  });

  it("maps active stages to their title-cased label and the pipeline bucket", () => {
    expect(deriveStage(row({ stage: "negotiation" }))).toBe("Negotiation");
    expect(deriveStage(row({ stage: "proposal" }))).toBe("Proposal");
    expect(deriveStage(row({ stage: "qualified" }))).toBe("Qualified");
    expect(stageBucket(deriveStage(row({ stage: "proposal" })))).toBe(
      "pipeline",
    );
  });

  it("maps closed_lost to Closed Lost", () => {
    const s = deriveStage(row({ stage: "closed_lost" }));
    expect(s).toBe("Closed Lost");
    expect(stageBucket(s)).toBe("lost");
  });
});

describe("formatters", () => {
  it("formats money in M / K / raw", () => {
    expect(fmtMoney(2_741_133)).toBe("$2.74M");
    expect(fmtMoney(800_000)).toBe("$800K");
    expect(fmtMoney(0)).toBe("$0");
  });

  it("formats absolute user counts with K/M/B suffixes", () => {
    expect(fmtUsers(0)).toBe("0");
    expect(fmtUsers(80)).toBe("80");
    expect(fmtUsers(1_200)).toBe("1.2K");
    expect(fmtUsers(250_000)).toBe("250.0K");
    expect(fmtUsers(133_000_000)).toBe("133.0M");
    expect(fmtUsers(2_500_000_000)).toBe("2.5B");
  });
});

describe("countryMatchesFeature", () => {
  it("matches case-insensitively and via aliases", () => {
    expect(countryMatchesFeature("Vietnam", "Vietnam")).toBe(true);
    expect(countryMatchesFeature("laos", "Laos")).toBe(true);
    expect(countryMatchesFeature("USA", "United States of America")).toBe(true);
    expect(countryMatchesFeature("Kenya", "Nigeria")).toBe(false);
  });
});
