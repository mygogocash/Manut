import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  legalCrmProjectSchema,
  listLegalCrmProjects,
} from "../src/legal-crm/legal-crm";

const project = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Contract review",
  slug: "contract-review",
  status: "in_progress",
  department: "Legal",
  sortOrder: 2,
  details: "Sensitive case notes",
  comment: "Internal note",
  owner: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
  tasks: [{ id: "task-1", title: "Draft" }],
};

describe("legal-crm foundation contracts", () => {
  it("keeps list fields and strips emails/notes/board", () => {
    const parsed = legalCrmProjectSchema.parse(project);
    expect(parsed).toEqual({
      id: project.id,
      name: "Contract review",
      slug: "contract-review",
      status: "in_progress",
      department: "Legal",
      sortOrder: 2,
      owner: { id: project.owner.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("details");
    expect(parsed).not.toHaveProperty("tasks");
  });

  it("lists legal-crm projects with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [project],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listLegalCrmProjects(client, { page: 1, limit: 20 }, signal),
    ).resolves.toEqual({
      data: [expect.objectContaining({ name: "Contract review" })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith("/legal-crm?page=1&limit=20", { signal });
  });
});
