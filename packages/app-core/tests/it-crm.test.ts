import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { itCrmProjectSchema, listItCrmProjects } from "../src/it-crm/it-crm";

const project = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Edge gateway",
  slug: "edge-gateway",
  status: "in_progress",
  department: "Engineering",
  sortOrder: 1,
  description: "Long description",
  comment: "Internal note",
  budget: 50000,
  effortPoints: 8,
  healthStatus: "green",
  owner: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
  columns: [{ id: "col-1", key: "todo", label: "Todo" }],
  tasks: [{ id: "task-1", title: "Ship" }],
};

describe("it-crm foundation contracts", () => {
  it("keeps list fields and strips emails/notes/budget/board", () => {
    const parsed = itCrmProjectSchema.parse(project);
    expect(parsed).toEqual({
      id: project.id,
      name: "Edge gateway",
      slug: "edge-gateway",
      status: "in_progress",
      department: "Engineering",
      sortOrder: 1,
      owner: { id: project.owner.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("description");
    expect(parsed).not.toHaveProperty("comment");
    expect(parsed).not.toHaveProperty("budget");
    expect(parsed).not.toHaveProperty("columns");
    expect(parsed).not.toHaveProperty("tasks");
    expect(parsed.owner).not.toHaveProperty("email");
  });

  it("lists it-crm projects with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [project],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listItCrmProjects(client, { page: 1, limit: 20 }, signal),
    ).resolves.toEqual({
      data: [expect.objectContaining({ name: "Edge gateway" })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith("/it-crm?page=1&limit=20", { signal });
  });
});
