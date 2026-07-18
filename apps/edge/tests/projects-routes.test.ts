import { afterEach, describe, expect, it, vi } from "vitest";

import { createEdgeApp } from "../src/index";
import type { ProjectsStore } from "../src/projects/store";
import type { RuntimeBindings } from "../src/runtime";

const TEST_TOKEN = "test-token-that-is-long-enough-for-edge-auth";

function testEnv(overrides: Partial<RuntimeBindings> = {}): RuntimeBindings {
  return {
    API_ORIGIN: "https://api.example",
    API_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true })),
    },
    ENABLE_HYPERDRIVE_BOUNDARY: "false",
    ...overrides,
  } as RuntimeBindings;
}

function hyperdriveEnv(
  overrides: Partial<RuntimeBindings> = {},
): RuntimeBindings {
  return testEnv({
    ENABLE_HYPERDRIVE_BOUNDARY: "true",
    HYPERDRIVE_DATABASE: {
      connectionString: "postgresql://edge:local@127.0.0.1:5432/manut",
    } as Hyperdrive,
    ...overrides,
  });
}

const verifyToken = vi.fn(async () => ({
  role: "employee",
  subject: "user-123",
}));

function memoryStore(seed?: {
  projects?: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    team: string;
    department: string | null;
    ownerId: string;
    ownerName: string;
    taskCount: number;
    startDate: string | null;
    endDate: string | null;
    goLiveDate: string | null;
    workstream: string | null;
    memberIds: string[];
    columns: Array<{
      id: string;
      key: string;
      label: string;
      sortOrder: number;
    }>;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      sortOrder: number;
      ownerId: string | null;
      ownerName: string | null;
    }>;
  }>;
  permissionsByUser?: Record<string, string[]>;
}): ProjectsStore {
  const projects = (seed?.projects ?? []).map((project) => ({
    ...project,
    columns: [...project.columns],
    tasks: [...project.tasks],
    memberIds: [...project.memberIds],
  }));
  const permissionsByUser = seed?.permissionsByUser ?? {
    "user-123": ["projects:read", "projects:update"],
  };

  return {
    async loadPermissions(userId) {
      return new Set(permissionsByUser[userId] ?? []);
    },
    async findMany(filters, page, limit) {
      let rows = [...projects];
      if (filters.accessibleByUserId) {
        const uid = filters.accessibleByUserId;
        rows = rows.filter(
          (project) =>
            project.ownerId === uid || project.memberIds.includes(uid),
        );
      }
      if (filters.team) {
        rows = rows.filter((project) => project.team === filters.team);
      }
      if (filters.status) {
        rows = rows.filter((project) => project.status === filters.status);
      }
      if (filters.search) {
        const needle = filters.search.toLowerCase();
        rows = rows.filter((project) =>
          project.name.toLowerCase().includes(needle),
        );
      }
      rows.sort((a, b) => a.name.localeCompare(b.name));
      const total = rows.length;
      const start = (page - 1) * limit;
      return {
        data: rows.slice(start, start + limit).map((project) => ({
          id: project.id,
          name: project.name,
          slug: project.slug,
          status: project.status,
          team: project.team,
          department: project.department,
          ownerId: project.ownerId,
          ownerName: project.ownerName,
          taskCount: project.taskCount,
          startDate: project.startDate,
          endDate: project.endDate,
          goLiveDate: project.goLiveDate,
          workstream: project.workstream,
          columns: project.columns,
          tasks: project.tasks,
          memberIds: project.memberIds,
        })),
        total,
      };
    },
    async findByIdOrSlug(idOrSlug) {
      const project = projects.find(
        (row) => row.id === idOrSlug || row.slug === idOrSlug,
      );
      if (!project) return null;
      return {
        id: project.id,
        name: project.name,
        slug: project.slug,
        status: project.status,
        team: project.team,
        department: project.department,
        ownerId: project.ownerId,
        ownerName: project.ownerName,
        taskCount: project.taskCount,
        startDate: project.startDate,
        endDate: project.endDate,
        goLiveDate: project.goLiveDate,
        workstream: project.workstream,
        columns: project.columns,
        tasks: project.tasks,
        memberIds: project.memberIds,
      };
    },
    async findParticipantRole(projectId, userId) {
      const project = projects.find((row) => row.id === projectId);
      if (!project) return null;
      if (project.ownerId === userId) return "owner";
      if (project.memberIds.includes(userId)) return "member";
      return null;
    },
    async createTask(input) {
      const project = projects.find((row) => row.id === input.projectId);
      if (!project) throw new Error("missing project");
      const task = {
        id: `task-${project.tasks.length + 1}`,
        title: input.title,
        status: input.status,
        priority: input.priority,
        sortOrder: input.sortOrder,
        ownerId: input.ownerId,
        ownerName: input.ownerId === "user-123" ? "Test User" : null,
      };
      project.tasks.push(task);
      project.taskCount += 1;
      return task;
    },
  };
}

const sampleProject = {
  id: "proj-1",
  name: "Alpha Board",
  slug: "alpha-board",
  status: "in_progress",
  team: "general",
  department: "Engineering",
  ownerId: "user-123",
  ownerName: "Test User",
  taskCount: 1,
  startDate: "2026-07-01",
  endDate: null as string | null,
  goLiveDate: "2026-08-01",
  workstream: null as string | null,
  memberIds: ["user-123"],
  columns: [
    { id: "col-todo", key: "todo", label: "To Do", sortOrder: 1 },
    {
      id: "col-done",
      key: "done",
      label: "Done",
      sortOrder: 2,
    },
  ],
  tasks: [
    {
      id: "task-1",
      title: "Ship dual-path",
      status: "todo",
      priority: "P1",
      sortOrder: 0,
      ownerId: "user-123",
      ownerName: "Test User",
    },
  ],
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("projects dual-path routes", () => {
  it("proxies /api/projects to Express when Hyperdrive boundary is off", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/api/projects");
      return Response.json({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/projects",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("fails closed for projects when Hyperdrive is flagged on without a binding", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/projects",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv({ ENABLE_HYPERDRIVE_BOUNDARY: "true" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "HYPERDRIVE_NOT_PROVISIONED",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("lists accessible projects on the Hyperdrive path", async () => {
    const store = memoryStore({
      projects: [
        sampleProject,
        {
          ...sampleProject,
          id: "proj-other",
          name: "Other Board",
          slug: "other-board",
          ownerId: "user-456",
          ownerName: "Other User",
          memberIds: ["user-456"],
          taskCount: 0,
          columns: [],
          tasks: [],
        },
      ],
    });

    const app = createEdgeApp({
      createProjectsStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/projects?page=1&limit=20&team=general",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<Record<string, unknown>>;
      meta: Record<string, unknown>;
    };
    expect(body).toMatchObject({
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: "proj-1",
      name: "Alpha Board",
      slug: "alpha-board",
      status: "in_progress",
      team: "general",
      taskCount: 1,
      owner: { id: "user-123", name: "Test User" },
    });
    expect(body.data[0]).not.toHaveProperty("budget");
    expect(body.data[0]).not.toHaveProperty("memberIds");
    expect(
      (body.data[0]?.owner as Record<string, unknown> | undefined) ?? {},
    ).not.toHaveProperty("email");
  });

  it("lists all projects when projects:read-all is present", async () => {
    const store = memoryStore({
      permissionsByUser: {
        "user-123": ["projects:read", "projects:read-all"],
      },
      projects: [
        sampleProject,
        {
          ...sampleProject,
          id: "proj-other",
          name: "Other Board",
          slug: "other-board",
          ownerId: "user-456",
          ownerName: "Other User",
          memberIds: ["user-456"],
          taskCount: 0,
          columns: [],
          tasks: [],
        },
      ],
    });

    const app = createEdgeApp({
      createProjectsStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/projects",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: unknown[];
      meta: { total: number };
    };
    expect(body.meta.total).toBe(2);
    expect(body.data).toHaveLength(2);
  });

  it("returns project detail with kanban columns and tasks", async () => {
    const store = memoryStore({ projects: [sampleProject] });
    const app = createEdgeApp({
      createProjectsStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/projects/proj-1",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Record<string, unknown>;
    };
    expect(body.data).toMatchObject({
      id: "proj-1",
      name: "Alpha Board",
      owner: { id: "user-123", name: "Test User" },
      goLiveDate: "2026-08-01",
    });
    expect(body.data.columns).toEqual([
      { id: "col-todo", key: "todo", label: "To Do", sortOrder: 1 },
      { id: "col-done", key: "done", label: "Done", sortOrder: 2 },
    ]);
    expect(body.data.tasks).toEqual([
      {
        id: "task-1",
        title: "Ship dual-path",
        status: "todo",
        priority: "P1",
        sortOrder: 0,
        owner: { id: "user-123", name: "Test User" },
      },
    ]);
    expect(body.data).not.toHaveProperty("budget");
    expect(body.data).not.toHaveProperty("comment");
  });

  it("403s detail when caller is not a participant", async () => {
    const store = memoryStore({
      projects: [
        {
          ...sampleProject,
          id: "proj-other",
          ownerId: "user-456",
          ownerName: "Other User",
          memberIds: ["user-456"],
        },
      ],
    });
    const app = createEdgeApp({
      createProjectsStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/projects/proj-other",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );
    expect(response.status).toBe(403);
  });

  it("creates a task on the Hyperdrive path", async () => {
    const store = memoryStore({
      permissionsByUser: {
        "user-123": ["projects:read", "projects:update"],
      },
      projects: [sampleProject],
    });
    const app = createEdgeApp({
      createProjectsStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/projects/proj-1/tasks",
      {
        body: JSON.stringify({
          title: "New card",
          status: "todo",
          priority: "P0",
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "task-2",
        title: "New card",
        status: "todo",
        priority: "P0",
        sortOrder: 0,
      },
    });
  });

  it("proxies dashboard even when Hyperdrive is on", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/api/projects/dashboard");
      return Response.json({
        data: {
          total: 0,
          productionLive: 0,
          atRisk: 0,
          inProgress: 0,
          byStatus: [],
          byDepartment: [],
          upcomingGoLives: [],
          recentUpdates: [],
        },
      });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({
      createProjectsStore: async () => memoryStore(),
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/projects/dashboard?team=general",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("requires authentication before projects proxy or Hyperdrive handling", async () => {
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/projects",
      {},
      testEnv(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });
  });
});
