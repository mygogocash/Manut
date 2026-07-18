import { HttpError } from "../http-error";
import {
  canAccessProjectAsAdmin,
  canSeeAllProjects,
  hasProjectsRead,
  hasProjectsWrite,
} from "./access";
import type {
  ProjectRecord,
  ProjectsStore,
  ProjectTaskRecord,
} from "./store";

const TASK_PRIORITIES = new Set(["P0", "P1", "P2"]);

function assertRead(permissions: Set<string>): void {
  if (!hasProjectsRead(permissions)) {
    throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
  }
}

function assertWrite(permissions: Set<string>): void {
  if (!hasProjectsWrite(permissions)) {
    throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
  }
}

function asIsoDate(value: string | null): string | null {
  if (value == null) return null;
  return value.slice(0, 10);
}

/**
 * Client projection: strip budget, comments, emails, members, partner.
 * Matches app-core projectSchema / projectDetailSchema.
 */
function serializeListProject(raw: ProjectRecord): Record<string, unknown> {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    status: raw.status,
    team: raw.team,
    department: raw.department,
    taskCount: raw.taskCount,
    owner: {
      id: raw.ownerId,
      name: raw.ownerName,
    },
  };
}

function serializeTask(raw: ProjectTaskRecord): Record<string, unknown> {
  return {
    id: raw.id,
    title: raw.title,
    status: raw.status,
    priority: raw.priority,
    sortOrder: raw.sortOrder,
    owner: raw.ownerId
      ? { id: raw.ownerId, name: raw.ownerName ?? "User" }
      : null,
  };
}

function serializeDetail(raw: ProjectRecord): Record<string, unknown> {
  return {
    ...serializeListProject(raw),
    startDate: asIsoDate(raw.startDate),
    endDate: asIsoDate(raw.endDate),
    goLiveDate: asIsoDate(raw.goLiveDate),
    workstream: raw.workstream,
    columns: [...raw.columns]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((column) => ({
        id: column.id,
        key: column.key,
        label: column.label,
        sortOrder: column.sortOrder,
      })),
    tasks: [...raw.tasks]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(serializeTask),
  };
}

async function requireAccessibleProject(
  store: ProjectsStore,
  userId: string,
  permissions: Set<string>,
  idOrSlug: string,
): Promise<ProjectRecord> {
  const project = await store.findByIdOrSlug(idOrSlug);
  if (!project) {
    throw new HttpError(404, "NOT_FOUND", "Project not found");
  }

  if (canAccessProjectAsAdmin(permissions, project.team)) {
    return project;
  }

  const role = await store.findParticipantRole(project.id, userId);
  if (!role) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "You do not have access to this project",
    );
  }
  return project;
}

export function createProjectsService(store: ProjectsStore) {
  return {
    async list(
      userId: string,
      query: {
        page: number;
        limit: number;
        search?: string;
        status?: string;
        team?: string;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      assertRead(permissions);

      const canSeeAll = canSeeAllProjects(permissions, query.team);
      const { data, total } = await store.findMany(
        {
          search: query.search,
          status: query.status,
          team: query.team,
          accessibleByUserId: canSeeAll ? undefined : userId,
        },
        query.page,
        query.limit,
      );

      return {
        data: data.map(serializeListProject),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    },

    async getById(userId: string, idOrSlug: string) {
      const permissions = await store.loadPermissions(userId);
      assertRead(permissions);
      const project = await requireAccessibleProject(
        store,
        userId,
        permissions,
        idOrSlug,
      );
      return { data: serializeDetail(project) };
    },

    async createTask(
      userId: string,
      projectId: string,
      input: {
        title: string;
        status?: string;
        priority?: string;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      assertWrite(permissions);

      const project = await requireAccessibleProject(
        store,
        userId,
        permissions,
        projectId,
      );

      const title = input.title.trim();
      if (!title) {
        throw new HttpError(400, "INVALID_TASK", "Title is required.");
      }
      if (title.length > 500) {
        throw new HttpError(
          400,
          "INVALID_TASK",
          "Title must be at most 500 characters.",
        );
      }

      const status = (input.status?.trim() || "todo").slice(0, 64);
      const priority = (input.priority?.trim() || "P1").toUpperCase();
      if (!TASK_PRIORITIES.has(priority)) {
        throw new HttpError(
          400,
          "INVALID_TASK",
          "Priority must be P0, P1, or P2.",
        );
      }

      const created = await store.createTask({
        projectId: project.id,
        title,
        status,
        priority,
        sortOrder: 0,
        ownerId: null,
      });

      return { data: serializeTask(created) };
    },
  };
}

export type ProjectsService = ReturnType<typeof createProjectsService>;
