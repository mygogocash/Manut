import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { leadSchema, listLeads } from "../src/leads/leads";

const lead = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  company: "Acme",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@acme.example",
  phone: "+66-81-000-0000",
  source: "web",
  status: "new",
  notes: "Internal note",
  disqualifyReason: null,
  ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  createdAt: "2026-07-01T00:00:00.000Z",
  owner: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
  convertedOpportunity: { id: "opp-1", name: "Deal" },
};

describe("leads foundation contracts", () => {
  it("keeps list fields and strips contact notes/emails", () => {
    const parsed = leadSchema.parse(lead);
    expect(parsed).toEqual({
      id: lead.id,
      company: "Acme",
      firstName: "Jane",
      lastName: "Doe",
      source: "web",
      status: "new",
      createdAt: "2026-07-01T00:00:00.000Z",
      owner: { id: lead.owner.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("email");
    expect(parsed).not.toHaveProperty("phone");
    expect(parsed).not.toHaveProperty("notes");
    expect(parsed).not.toHaveProperty("convertedOpportunity");
  });

  it("lists leads with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [lead],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listLeads(client, { page: 1, limit: 20, status: "new" }, signal),
    ).resolves.toEqual({
      data: [expect.objectContaining({ company: "Acme" })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith("/leads?page=1&limit=20&status=new", {
      signal,
    });
  });
});
