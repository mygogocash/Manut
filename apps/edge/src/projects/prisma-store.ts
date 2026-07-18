import { createPrismaClient, type PrismaClient } from "@manut/database";

import { hyperdriveConnectionString } from "../hyperdrive";
import { loadUserPermissions } from "../rbac";
import type { RuntimeBindings } from "../runtime";
import { PROJECTS_ADMIN_EXTRAS } from "./access";
import type {
  ProjectColumnRecord,
  ProjectRecord,
  ProjectsStore,
  ProjectTaskRecord,
} from "./store";

function asIsoDate(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function mapColumn(raw: {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
}): ProjectColumnRecord {
  return {
    id: raw.id,
    key: raw.key,
    label: raw.label,
    sortOrder: raw.sortOrder,
  };
}

function mapTask(raw: {
  id: string;
  title: string;
  status: string;
  priority: string;
  sortOrder: number;
  owner: { id: string; name: string | null } | null;
}): ProjectTaskRecord {
  return {
    id: raw.id,
    title: raw.title,
    status: raw.status,
    priority: raw.priority,
    sortOrder: raw.sortOrder,
    ownerId: raw.owner?.id ?? null,
    ownerName: raw.owner?.name ?? null,
  };
}

function mapProject(raw: {
  id: string;
  name: string;
  slug: string;
  status: string;
  team: string;
  department: string | null;
  startDate: Date | null;
  endDate: Date | null;
  goLiveDate: Date | null;
  workstream: string | null;
  owner: { id: string; name: string | null };
  _count?: { tasks: number };
  members?: Array<{ userId: string }>;
  columns?: Array<{
    id: string;
    key: string;
    label: string;
    sortOrder: number;
  }>;
  tasks?: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    sortOrder: number;
    owner: { id: string; name: string | null } | null;
  }>;
}): ProjectRecord {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    status: raw.status,
    team: raw.team,
    department: raw.department,
    ownerId: raw.owner.id,
    ownerName: raw.owner.name ?? "User",
    taskCount: raw._count?.tasks ?? raw.tasks?.length ?? 0,
    startDate: asIsoDate(raw.startDate),
    endDate: asIsoDate(raw.endDate),
    goLiveDate: asIsoDate(raw.goLiveDate),
    workstream: raw.workstream,
    columns: (raw.columns ?? []).map(mapColumn),
    tasks: (raw.tasks ?? []).map(mapTask),
    memberIds: (raw.members ?? []).map((member) => member.userId),
  };
}

const listInclude = {
  owner: { select: { id: true, name: true } },
  _count: { select: { tasks: true } },
  members: { select: { userId: true } },
} as const;

const detailInclude = {
  owner: { select: { id: true, name: true } },
  _count: { select: { tasks: true } },
  members: { select: { userId: true } },
  columns: { orderBy: { sortOrder: "asc" as const } },
  tasks: {
    where: { parentTaskId: null },
    include: {
      owner: { select: { id: true, name: true } },
    },
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

export function createPrismaProjectsStore(client: PrismaClient): ProjectsStore {
  return {
    async loadPermissions(userId) {
      return loadUserPermissions(client, userId, PROJECTS_ADMIN_EXTRAS);
    },

    async findMany(filters, page, limit) {
      const clauses: Array<Record<string, unknown>> = [];
      if (filters.status) clauses.push({ status: filters.status });
      if (filters.team) clauses.push({ team: filters.team });
      if (filters.search) {
        clauses.push({
          name: { contains: filters.search, mode: "insensitive" },
        });
      }
      if (filters.accessibleByUserId) {
        const uid = filters.accessibleByUserId;
        clauses.push({
          OR: [{ ownerId: uid }, { members: { some: { userId: uid } } }],
        });
      }
      const where = clauses.length > 0 ? { AND: clauses } : {};

      const [data, total] = await Promise.all([
        client.project.findMany({
          where,
          include: listInclude,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        client.project.count({ where }),
      ]);

      return { data: data.map(mapProject), total };
    },

    async findByIdOrSlug(idOrSlug) {
      const byId = await client.project.findUnique({
        where: { id: idOrSlug },
        include: detailInclude,
      });
      if (byId) return mapProject(byId);

      const bySlug = await client.project.findUnique({
        where: { slug: idOrSlug },
        include: detailInclude,
      });
      return bySlug ? mapProject(bySlug) : null;
    },

    async findParticipantRole(projectId, userId) {
      const row = await client.project.findUnique({
        where: { id: projectId },
        select: {
          ownerId: true,
          members: { where: { userId }, select: { id: true } },
        },
      });
      if (!row) return null;
      if (row.ownerId === userId) return "owner";
      if (row.members.length > 0) return "member";
      return null;
    },

    async createTask(input) {
      const row = await client.projectTask.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          status: input.status,
          priority: input.priority,
          sortOrder: input.sortOrder,
          ownerId: input.ownerId ?? undefined,
        },
        include: {
          owner: { select: { id: true, name: true } },
        },
      });
      return mapTask(row);
    },
  };
}

export function createHyperdriveProjectsStore(
  env: RuntimeBindings,
): ProjectsStore {
  const client = createPrismaClient(hyperdriveConnectionString(env));
  return createPrismaProjectsStore(client);
}
