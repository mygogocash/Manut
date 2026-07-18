import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { dealSchema, listDeals } from "../src/deals/deals";

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
});
