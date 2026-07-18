import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getPartner,
  listPartners,
  partnerDetailSchema,
  partnerSchema,
} from "../src/partners/partners";

const partner = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  slug: "acme-corp",
  company: "Acme Corp",
  type: "reseller",
  status: "prospect",
  department: "Marketing",
  region: "APAC",
  country: "TH",
  website: "https://example.com",
  description: "Long description",
  notes: "Internal notes",
  comment: "Finance comment",
  contractValue: "100000",
  contractStart: "2026-01-01T00:00:00.000Z",
  contractEnd: "2026-12-31T00:00:00.000Z",
  productionLiveDate: "2026-03-01T00:00:00.000Z",
  goLiveDate: "2026-04-01T00:00:00.000Z",
  revisedGoLiveDate: null,
  dependency: "Legal review",
  sortOrder: 0,
  owner: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
  contacts: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Pat Contact",
      email: "pat@example.com",
      phone: "+66-2000-0000",
    },
  ],
  _count: { projects: 2, deals: 1 },
};

describe("partners foundation contracts", () => {
  it("keeps list fields and strips contracts/notes/website", () => {
    const parsed = partnerSchema.parse(partner);
    expect(parsed).toEqual({
      id: partner.id,
      slug: "acme-corp",
      company: "Acme Corp",
      type: "reseller",
      status: "prospect",
      department: "Marketing",
      region: "APAC",
      country: "TH",
      sortOrder: 0,
      projectCount: 2,
      owner: { id: partner.owner.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("website");
    expect(parsed).not.toHaveProperty("notes");
    expect(parsed).not.toHaveProperty("contractValue");
  });

  it("lists partners with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [partner],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listPartners(client, { page: 1, limit: 20 }, signal),
    ).resolves.toEqual({
      data: [expect.objectContaining({ company: "Acme Corp" })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith("/partners?page=1&limit=20", { signal });
  });

  it("keeps detail fields and strips contracts/notes/website/contacts", () => {
    const parsed = partnerDetailSchema.parse(partner);
    expect(parsed).toEqual({
      id: partner.id,
      slug: "acme-corp",
      company: "Acme Corp",
      type: "reseller",
      status: "prospect",
      department: "Marketing",
      region: "APAC",
      country: "TH",
      sortOrder: 0,
      projectCount: 2,
      owner: { id: partner.owner.id, name: "Alex Example" },
      description: "Long description",
      productionLiveDate: "2026-03-01T00:00:00.000Z",
      goLiveDate: "2026-04-01T00:00:00.000Z",
      revisedGoLiveDate: null,
      dependency: "Legal review",
    });
    expect(parsed).not.toHaveProperty("website");
    expect(parsed).not.toHaveProperty("notes");
    expect(parsed).not.toHaveProperty("contractValue");
    expect(parsed).not.toHaveProperty("contacts");
  });

  it("loads partner detail by id", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: partner });
    const client = { get } as unknown as ApiClient;

    await expect(
      getPartner(client, partner.id, signal),
    ).resolves.toEqual(
      expect.objectContaining({ company: "Acme Corp", description: "Long description" }),
    );
    expect(get).toHaveBeenCalledWith(`/partners/${partner.id}`, { signal });
  });
});
