import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  accountingCrmProjectSchema,
  listAccountingCrmProjects,
} from "../src/accounting-crm/accounting-crm";

const project = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Close books",
  slug: "close-books",
  status: "in_progress",
  department: "Finance",
  sortOrder: 0,
  details: "Sensitive ledger notes",
  comment: "Internal note",
  owner: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
  columns: [{ id: "col-1", key: "todo", label: "Todo" }],
};

describe("accounting-crm foundation contracts", () => {
  it("keeps list fields and strips emails/notes/board", () => {
    const parsed = accountingCrmProjectSchema.parse(project);
    expect(parsed).toEqual({
      id: project.id,
      name: "Close books",
      slug: "close-books",
      status: "in_progress",
      department: "Finance",
      sortOrder: 0,
      owner: { id: project.owner.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("details");
    expect(parsed).not.toHaveProperty("columns");
  });

  it("lists accounting-crm projects with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [project],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listAccountingCrmProjects(client, { page: 1, limit: 20 }, signal),
    ).resolves.toEqual({
      data: [expect.objectContaining({ name: "Close books" })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith("/accounting-crm?page=1&limit=20", {
      signal,
    });
  });
});
