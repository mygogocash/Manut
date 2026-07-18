import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { listProjects, projectSchema } from "../src/projects/projects";

const project = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Intranet hardening",
  slug: "intranet-hardening",
  status: "in_progress",
  team: "general",
  department: "Engineering",
  budget: 100000,
  comment: "Internal finance note",
  description: "Long description",
  owner: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
  partner: { id: "partner-1", company: "Acme" },
  members: [
    {
      user: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        name: "Sam",
        email: "sam@example.com",
      },
    },
  ],
  _count: { tasks: 12 },
};

describe("projects foundation contracts", () => {
  it("projects list fields and strips budget/member emails", () => {
    const parsed = projectSchema.parse(project);
    expect(parsed).toEqual({
      id: project.id,
      name: "Intranet hardening",
      slug: "intranet-hardening",
      status: "in_progress",
      team: "general",
      department: "Engineering",
      taskCount: 12,
      owner: { id: project.owner.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("budget");
    expect(parsed).not.toHaveProperty("members");
    expect(parsed).not.toHaveProperty("partner");
  });

  it("lists projects with query params", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [project],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listProjects(
        client,
        { page: 1, limit: 20, team: "general" },
        signal,
      ),
    ).resolves.toEqual({
      data: [expect.objectContaining({ name: "Intranet hardening" })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith(
      "/projects?page=1&limit=20&team=general",
      { signal },
    );
  });
});
