import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  listProductCrmProjects,
  productCrmProjectSchema,
} from "../src/product-crm/product-crm";

const project = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Mobile release",
  slug: "mobile-release",
  status: "not_yet_started",
  department: "Product",
  sortOrder: 0,
  description: "Long description",
  comment: "Internal note",
  owner: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
  columns: [{ id: "col-1", key: "todo", label: "Todo" }],
};

describe("product-crm foundation contracts", () => {
  it("keeps list fields and strips emails/notes/board", () => {
    const parsed = productCrmProjectSchema.parse(project);
    expect(parsed).toEqual({
      id: project.id,
      name: "Mobile release",
      slug: "mobile-release",
      status: "not_yet_started",
      department: "Product",
      sortOrder: 0,
      owner: { id: project.owner.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("comment");
    expect(parsed).not.toHaveProperty("columns");
  });

  it("lists product-crm projects with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [project],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listProductCrmProjects(client, { page: 1, limit: 20 }, signal),
    ).resolves.toEqual({
      data: [expect.objectContaining({ name: "Mobile release" })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith("/product-crm?page=1&limit=20", {
      signal,
    });
  });
});
