import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  createDeal,
  createDealInputSchema,
  DEAL_STAGES,
  dealDetailSchema,
  dealSchema,
  getDeal,
  getDealPipeline,
  listDeals,
  updateDeal,
  updateDealInputSchema,
} from "../src/deals/deals";

const deal = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  company: "Acme",
  contact: "Jane Doe",
  value: "15000.50",
  stage: "proposal",
  probability: 40,
  type: "new",
  country: "TH",
  closeDate: "2026-08-01T00:00:00.000Z",
  notes: "Internal negotiation note",
  owner: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
  partner: { id: "partner-1", company: "Partner Co" },
};

describe("deals foundation contracts", () => {
  it("keeps list fields and strips notes/emails/partner", () => {
    const parsed = dealSchema.parse(deal);
    expect(parsed).toEqual({
      id: deal.id,
      company: "Acme",
      contact: "Jane Doe",
      value: 15000.5,
      stage: "proposal",
      probability: 40,
      type: "new",
      country: "TH",
      closeDate: "2026-08-01T00:00:00.000Z",
      owner: { id: deal.owner.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("notes");
    expect(parsed).not.toHaveProperty("partner");
  });

  it("lists deals with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [deal],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listDeals(client, { page: 1, limit: 20, stage: "proposal" }, signal),
    ).resolves.toEqual({
      data: [expect.objectContaining({ company: "Acme", value: 15000.5 })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith("/deals?page=1&limit=20&stage=proposal", {
      signal,
    });
  });

  it("createDealInputSchema requires company and non-negative value", () => {
    expect(createDealInputSchema.safeParse({ company: "", value: 0 }).success).toBe(
      false,
    );
    expect(
      createDealInputSchema.safeParse({ company: "Acme", value: -1 }).success,
    ).toBe(false);
    expect(
      createDealInputSchema.parse({
        company: "  Acme  ",
        value: 1000,
        contact: "  Jane  ",
      }),
    ).toEqual({
      company: "Acme",
      value: 1000,
      contact: "Jane",
      stage: "lead",
      probability: 10,
    });
  });

  it("creates a deal via POST and strips notes/email/partner", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        ...deal,
        company: "New Co",
        value: 2500,
        stage: "lead",
        probability: 10,
        contact: null,
        type: null,
        country: null,
        closeDate: null,
      },
    });
    const client = { post } as unknown as ApiClient;

    await expect(
      createDeal(client, { company: "New Co", value: 2500 }),
    ).resolves.toEqual({
      id: deal.id,
      company: "New Co",
      contact: null,
      value: 2500,
      stage: "lead",
      probability: 10,
      type: null,
      country: null,
      closeDate: null,
      owner: { id: deal.owner.id, name: "Alex Example" },
    });
    expect(post).toHaveBeenCalledWith("/deals", {
      company: "New Co",
      value: 2500,
      stage: "lead",
      probability: 10,
    });
  });

  it("loads pipeline summary by stage", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [
        { stage: "lead", count: 2, totalValue: 1000 },
        { stage: "proposal", count: 1, totalValue: 15000.5 },
      ],
    });
    const client = { get } as unknown as ApiClient;

    await expect(getDealPipeline(client, signal)).resolves.toEqual([
      { stage: "lead", count: 2, totalValue: 1000 },
      { stage: "proposal", count: 1, totalValue: 15000.5 },
    ]);
    expect(get).toHaveBeenCalledWith("/deals/pipeline", { signal });
  });

  it("deal detail keeps notes and strips email/partner", () => {
    const parsed = dealDetailSchema.parse(deal);
    expect(parsed.notes).toBe("Internal negotiation note");
    expect(parsed.owner).toEqual({ id: deal.owner.id, name: "Alex Example" });
    expect(parsed).not.toHaveProperty("partner");
    expect(parsed.owner).not.toHaveProperty("email");
  });

  it("loads a deal by id with notes", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: deal });
    const client = { get } as unknown as ApiClient;

    await expect(getDeal(client, deal.id, signal)).resolves.toEqual(
      expect.objectContaining({
        id: deal.id,
        company: "Acme",
        notes: "Internal negotiation note",
      }),
    );
    expect(get).toHaveBeenCalledWith(`/deals/${deal.id}`, { signal });
  });

  it("updateDealInputSchema accepts stage and notes", () => {
    expect(DEAL_STAGES).toContain("negotiation");
    expect(
      updateDealInputSchema.parse({
        stage: "negotiation",
        notes: "  Follow up Monday  ",
      }),
    ).toEqual({
      stage: "negotiation",
      notes: "Follow up Monday",
    });
    expect(
      updateDealInputSchema.safeParse({ stage: "not-a-stage" }).success,
    ).toBe(false);
  });

  it("updates a deal via PUT and returns detail with notes", async () => {
    const put = vi.fn().mockResolvedValue({
      data: {
        ...deal,
        stage: "negotiation",
        notes: "Follow up Monday",
      },
    });
    const client = { put } as unknown as ApiClient;

    await expect(
      updateDeal(client, deal.id, {
        stage: "negotiation",
        notes: "Follow up Monday",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: deal.id,
        stage: "negotiation",
        notes: "Follow up Monday",
      }),
    );
    expect(put).toHaveBeenCalledWith(`/deals/${deal.id}`, {
      stage: "negotiation",
      notes: "Follow up Monday",
    });
  });
});
