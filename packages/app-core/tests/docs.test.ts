import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listWikiPages } from "../src/docs/docs";

const page = {
  id: "clwiki00000000000000000001",
  title: "Onboarding guide",
  body: "# Full markdown body",
  parentId: null,
  position: 0,
  folder: "hr",
  slug: "onboarding-guide",
  isPublished: true,
  isRestricted: false,
  createdById: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  createdBy: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Alex Example",
    email: "alex@manut.example",
  },
  updatedBy: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Alex Example",
    email: "alex@manut.example",
  },
};

describe("docs foundation contracts", () => {
  it("lists wiki pages without body or creator email", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [page],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listWikiPages(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: page.id,
      title: "Onboarding guide",
      slug: "onboarding-guide",
      folder: "hr",
      parentId: null,
      isPublished: true,
      isRestricted: false,
      createdBy: { id: page.createdBy.id, name: "Alex Example" },
    });
    expect(result.data[0]).not.toHaveProperty("body");
    expect(result.data[0].createdBy).not.toHaveProperty("email");
    expect(get).toHaveBeenCalledWith("/docs?page=1&limit=20", undefined);
  });
});
