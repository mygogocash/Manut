import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listQaCrmProjects, qaCrmProjectSchema } from "../src/qa-crm/qa-crm";

const project = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Regression suite",
  slug: "regression-suite",
  status: "active",
  department: "QA",
  sortOrder: 3,
  description: "Long description",
  comment: "Internal note",
  owner: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
  tasks: [{ id: "task-1", title: "Bug", observation: "secret" }],
};

describe("qa-crm foundation contracts", () => {
  it("keeps list fields and strips emails/notes/board", () => {
    const parsed = qaCrmProjectSchema.parse(project);
    expect(parsed).toEqual({
      id: project.id,
      name: "Regression suite",
      slug: "regression-suite",
      status: "active",
      department: "QA",
      sortOrder: 3,
      owner: { id: project.owner.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("comment");
    expect(parsed).not.toHaveProperty("tasks");
  });

  it("lists qa-crm projects with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [project],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listQaCrmProjects(client, { page: 1, limit: 20 }, signal),
    ).resolves.toEqual({
      data: [expect.objectContaining({ name: "Regression suite" })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith("/qa-crm?page=1&limit=20", { signal });
  });
});
