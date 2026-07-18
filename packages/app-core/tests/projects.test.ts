import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getProject,
  getProjectsDashboard,
  listProjects,
  projectDetailSchema,
  projectSchema,
  projectsDashboardSchema,
} from "../src/projects/projects";

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

  it("project detail fields and strips budget/board/member emails", () => {
    const parsed = projectDetailSchema.parse({
      ...project,
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: null,
      goLiveDate: "2026-08-01T00:00:00.000Z",
      workstream: "Hardening",
      columns: [{ id: "col-1", key: "todo", label: "To do" }],
      tasks: [{ id: "task-1", title: "Secret task" }],
    });

    expect(parsed).toEqual({
      id: project.id,
      name: "Intranet hardening",
      slug: "intranet-hardening",
      status: "in_progress",
      team: "general",
      department: "Engineering",
      taskCount: 12,
      owner: { id: project.owner.id, name: "Alex Example" },
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: null,
      goLiveDate: "2026-08-01T00:00:00.000Z",
      workstream: "Hardening",
    });
    expect(parsed).not.toHaveProperty("budget");
    expect(parsed).not.toHaveProperty("columns");
    expect(parsed).not.toHaveProperty("tasks");
    expect(parsed).not.toHaveProperty("members");
  });

  it("loads project detail by id", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: project });
    const client = { get } as unknown as ApiClient;

    await expect(getProject(client, project.id, signal)).resolves.toEqual(
      expect.objectContaining({ id: project.id, name: "Intranet hardening" }),
    );
    expect(get).toHaveBeenCalledWith(`/projects/${project.id}`, { signal });
  });

  it("dashboard rollup strips comments from recent updates", () => {
    const parsed = projectsDashboardSchema.parse({
      total: 4,
      productionLive: 1,
      atRisk: 1,
      inProgress: 2,
      byStatus: [{ status: "in_progress", count: 2 }],
      byDepartment: [{ department: "Engineering", count: 3 }],
      upcomingGoLives: [
        {
          id: project.id,
          name: "Intranet hardening",
          slug: "intranet-hardening",
          status: "in_progress",
          department: "Engineering",
          goLiveDate: "2026-08-01T00:00:00.000Z",
          revisedGoLiveDate: null,
          owner: { id: project.owner.id, name: "Alex Example" },
        },
      ],
      recentUpdates: [
        {
          id: project.id,
          name: "Intranet hardening",
          slug: "intranet-hardening",
          status: "in_progress",
          department: "Engineering",
          comment: "Internal note",
          updatedAt: "2026-07-17T12:00:00.000Z",
          owner: {
            id: project.owner.id,
            name: "Alex Example",
            email: "alex@example.com",
          },
        },
      ],
    });

    expect(parsed.total).toBe(4);
    expect(parsed.atRisk).toBe(1);
    expect(parsed.recentUpdates[0]).toEqual({
      id: project.id,
      name: "Intranet hardening",
      slug: "intranet-hardening",
      status: "in_progress",
      department: "Engineering",
      goLiveDate: null,
      revisedGoLiveDate: null,
      updatedAt: "2026-07-17T12:00:00.000Z",
      owner: { id: project.owner.id, name: "Alex Example" },
    });
    expect(parsed.recentUpdates[0]).not.toHaveProperty("comment");
  });

  it("loads projects dashboard with team query", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: {
        total: 1,
        productionLive: 0,
        atRisk: 0,
        inProgress: 1,
        byStatus: [],
        byDepartment: [],
        upcomingGoLives: [],
        recentUpdates: [],
      },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      getProjectsDashboard(client, { team: "general" }, signal),
    ).resolves.toEqual(
      expect.objectContaining({ total: 1, inProgress: 1 }),
    );
    expect(get).toHaveBeenCalledWith("/projects/dashboard?team=general", {
      signal,
    });
  });
});
