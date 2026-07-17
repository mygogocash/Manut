import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const userSelect = { id: true, name: true, email: true };

const projectIncludes = {
  owner: { select: userSelect },
  partner: { select: { id: true, company: true } },
  _count: { select: { tasks: true } },
  members: { include: { user: { select: userSelect } } },
} satisfies Prisma.ProjectInclude;

const projectDetailIncludes = {
  ...projectIncludes,
  tasks: {
    where: { parentTaskId: null },
    include: {
      owner: { select: userSelect },
      assignees: { include: { user: { select: userSelect } } },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  columns: { orderBy: { sortOrder: "asc" as const } },
  milestones: {
    include: { owner: { select: userSelect } },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.ProjectInclude;

const taskIncludes = {
  owner: { select: userSelect },
  assignees: { include: { user: { select: userSelect } } },
} satisfies Prisma.ProjectTaskInclude;

export class ProjectRepository {
  async findMany(
    filters: {
      status?: string;
      search?: string;
      team?: string;
      department?: string;
      partnerId?: string;
      /** When set, only projects owned by or assigned to this user. */
      accessibleByUserId?: string;
    },
    page: number,
    limit: number,
  ) {
    const clauses: Prisma.ProjectWhereInput[] = [];
    if (filters.status) clauses.push({ status: filters.status });
    if (filters.team) clauses.push({ team: filters.team });
    if (filters.department) clauses.push({ department: filters.department });
    if (filters.partnerId) clauses.push({ partnerId: filters.partnerId });
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
    const where: Prisma.ProjectWhereInput =
      clauses.length > 0 ? { AND: clauses } : {};

    const [data, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: projectIncludes,
        // User-driven manual order is primary;
        // createdAt is the deterministic tie-breaker so two projects
        // with the same sort_order (e.g. fresh inserts at 0) stay
        // stable across re-renders.
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Look up which of the supplied ids the user has access to (owner OR
   * member). Returns the accessible ids in input order. Used by the
   * reorder endpoint so unauthorized ids are silently dropped instead
   * of leaking "this project exists but you can't touch it".
   */
  async filterAccessibleIds(userId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await prisma.project.findMany({
      where: {
        id: { in: ids },
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });
    const accessible = new Set(rows.map((r) => r.id));
    return ids.filter((id) => accessible.has(id));
  }

  /**
   * Rollup figures for the Project CRM dashboard. Scoped to a single
   * `team` so the BD / IT / Product / Legal / HR workspaces each get
   * their own snapshot. Runs as a single batch so a slow `findMany`
   * doesn't block the cheaper `groupBy` calls.
   */
  async dashboardSnapshot(team: string) {
    const where: Prisma.ProjectWhereInput = { team };
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // status / department buckets run as groupBy aggregates so the
    // payload stays bounded regardless of project count.
    const [
      total,
      productionLive,
      atRisk,
      byStatus,
      byDepartment,
      upcomingGoLives,
      recentUpdates,
    ] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.count({
        where: { ...where, productionLiveDate: { not: null } },
      }),
      // "At risk" = the rep moved Go-Live forward (revised set) but
      // the project isn't yet at a terminal status. Same heuristic
      // BD uses on their weekly review.
      prisma.project.count({
        where: {
          ...where,
          revisedGoLiveDate: { not: null },
          NOT: {
            status: {
              in: ["completed", "prod_integrated", "closed", "cancelled"],
            },
          },
        },
      }),
      prisma.project.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      prisma.project.groupBy({
        by: ["department"],
        where,
        _count: { _all: true },
      }),
      prisma.project.findMany({
        where: {
          ...where,
          goLiveDate: { gte: now, lte: in14Days },
          NOT: {
            status: {
              in: ["completed", "prod_integrated", "closed", "cancelled"],
            },
          },
        },
        orderBy: { goLiveDate: "asc" },
        take: 8,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          department: true,
          goLiveDate: true,
          revisedGoLiveDate: true,
          owner: { select: { id: true, name: true } },
        },
      }),
      prisma.project.findMany({
        where: { ...where, updatedAt: { gte: last7Days } },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          department: true,
          comment: true,
          updatedAt: true,
          owner: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      total,
      productionLive,
      atRisk,
      inProgress:
        byStatus.find((s) => s.status === "in_progress")?._count._all ?? 0,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      byDepartment: byDepartment.map((d) => ({
        department: d.department,
        count: d._count._all,
      })),
      upcomingGoLives,
      recentUpdates,
    };
  }

  /**
   * Bulk-apply new sort_order values. Runs inside a single transaction
   * so the list view is never observed mid-reorder.
   */
  async applySortOrder(
    items: Array<{ id: string; sortOrder: number }>,
  ): Promise<void> {
    if (items.length === 0) return;
    await prisma.$transaction(
      items.map((item) =>
        prisma.project.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
          select: { id: true },
        }),
      ),
    );
  }

  /**
   * Verify every supplied task id belongs to `projectId`. Returns the
   * matching ids in arbitrary order; callers compare lengths to reject
   * a mixed-project payload before mutating sort_order.
   */
  async findTaskIdsInProject(
    projectId: string,
    ids: string[],
  ): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await prisma.projectTask.findMany({
      where: { id: { in: ids }, projectId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /**
   * Bulk task reorder used by the board's drag-end handler. Writes
   * `sort_order = index` for each id and, when `status` is set, moves
   * every id into that column as the same transaction — that's the
   * cross-column drop-at-position case. Runs in a single transaction
   * so the board never observes a half-arranged column.
   */
  async applyTaskSortOrder(
    items: Array<{ id: string; sortOrder: number }>,
    status?: string,
  ): Promise<void> {
    if (items.length === 0) return;
    await prisma.$transaction(
      items.map((item) =>
        prisma.projectTask.update({
          where: { id: item.id },
          data: {
            sortOrder: item.sortOrder,
            ...(status ? { status } : null),
          },
          select: { id: true },
        }),
      ),
    );
  }

  /** `owner` if project owner; `member` if in project_members; otherwise null. */
  async findParticipantRole(
    projectId: string,
    userId: string,
  ): Promise<"owner" | "member" | null> {
    const row = await prisma.project.findUnique({
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
  }

  async findById(id: string) {
    return prisma.project.findUnique({
      where: { id },
      include: projectDetailIncludes,
    });
  }

  async findBySlug(slug: string) {
    return prisma.project.findUnique({
      where: { slug },
      include: projectDetailIncludes,
    });
  }

  // New Legal / IT-CRM workstreams live ONLY in their native
  // `legal_projects` / `it_projects` tables until the first time someone
  // opens them on the shared `/projects/:id` board. The one-time
  // `*_native_workspace` migration mirrored every PRE-EXISTING legal/IT
  // row into `projects` (same id) — which is why older workstreams open
  // fine — but rows created afterwards were never mirrored, so the board
  // 404s. Lazily create the missing mirror (row + members + columns +
  // any native tasks) so the shared board, task CRUD, members and AI
  // Generate all resolve it. Idempotent and concurrency-safe.
  async mirrorNativeProjectIfNeeded(idOrSlug: string): Promise<boolean> {
    // Already a general project (by id or slug)? Nothing to do.
    const existing = await prisma.project.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true },
    });
    if (existing) return true;

    const nativeInclude = {
      members: { select: { userId: true, role: true } },
      columns: {
        select: { key: true, label: true, color: true, sortOrder: true },
      },
      tasks: {
        select: {
          id: true,
          parentTaskId: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          ownerId: true,
          startDate: true,
          endDate: true,
          sortOrder: true,
          assignees: { select: { userId: true, allocationPct: true } },
        },
      },
    };

    const legal = await prisma.legalProject.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: nativeInclude,
    });
    const accounting = legal
      ? null
      : await prisma.accountingProject.findFirst({
          where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
          include: nativeInclude,
        });
    const itp =
      legal || accounting
        ? null
        : await prisma.itProject.findFirst({
            where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
            include: nativeInclude,
          });
    const src = legal ?? accounting ?? itp;
    if (!src) return false;
    const team = legal ? "legal" : accounting ? "accounting" : "it";

    // A native slug can collide with an existing general project slug
    // (`projects.slug` is unique across every team). Suffix on clash —
    // the board always navigates by id, so the mirror slug only needs to
    // be unique, not stable.
    let slug = src.slug;
    for (let i = 1; ; i++) {
      const clash = await prisma.project.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!clash) break;
      slug = `${src.slug}-${team}${i > 1 ? `-${i}` : ""}`;
    }

    const columns =
      src.columns.length > 0
        ? src.columns
        : [
            {
              key: "backlog",
              label: "Backlog",
              color: "bg-zinc-500",
              sortOrder: 0,
            },
            { key: "todo", label: "To Do", color: "bg-blue-500", sortOrder: 1 },
            {
              key: "in_progress",
              label: "In Progress",
              color: "bg-amber-500",
              sortOrder: 2,
            },
            {
              key: "in_review",
              label: "In Review",
              color: "bg-purple-500",
              sortOrder: 3,
            },
            {
              key: "done",
              label: "Done",
              color: "bg-emerald-500",
              sortOrder: 4,
            },
          ];

    try {
      await prisma.project.create({
        data: {
          id: src.id,
          name: src.name,
          slug,
          description: src.description,
          status: src.status,
          owner: { connect: { id: src.ownerId } },
          team,
          startDate: src.startDate,
          endDate: src.endDate,
          productionLiveDate: src.productionLiveDate,
          goLiveDate: src.goLiveDate,
          revisedGoLiveDate: src.revisedGoLiveDate,
          dependency: src.dependency,
          comment: src.comment,
          department: src.department,
          workstream: legal
            ? legal.workstream
            : accounting
              ? accounting.workstream
              : null,
          details: legal
            ? legal.details
            : accounting
              ? accounting.details
              : null,
          sortOrder: src.sortOrder,
          createdAt: src.createdAt,
          members: {
            createMany: {
              data: src.members.map((m) => ({
                userId: m.userId,
                role: m.role,
              })),
              skipDuplicates: true,
            },
          },
          columns: { createMany: { data: columns, skipDuplicates: true } },
        },
      });
    } catch (err) {
      // A concurrent open may have created the mirror first (unique id /
      // slug). Treat as success if the row now exists; otherwise rethrow.
      const now = await prisma.project.findUnique({
        where: { id: src.id },
        select: { id: true },
      });
      if (now) return true;
      throw err;
    }

    // Copy any native tasks (rare — the UI drives tasks through the
    // shared board, not the native task API). Parents first to satisfy
    // the self-referencing FK; ids are uuid in both tables so they
    // transfer 1:1. Assignees follow once the tasks exist.
    if (src.tasks.length > 0) {
      const ordered = [...src.tasks].sort(
        (a, b) =>
          Number(Boolean(a.parentTaskId)) - Number(Boolean(b.parentTaskId)),
      );
      await prisma.projectTask.createMany({
        data: ordered.map((t) => ({
          id: t.id,
          projectId: src.id,
          parentTaskId: t.parentTaskId,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          ownerId: t.ownerId,
          startDate: t.startDate,
          endDate: t.endDate,
          sortOrder: t.sortOrder,
        })),
        skipDuplicates: true,
      });
      const assignees = src.tasks.flatMap((t) =>
        t.assignees.map((a) => ({
          taskId: t.id,
          userId: a.userId,
          allocationPct: a.allocationPct,
        })),
      );
      if (assignees.length > 0) {
        await prisma.projectTaskAssignee.createMany({
          data: assignees,
          skipDuplicates: true,
        });
      }
    }

    return true;
  }

  async create(data: Prisma.ProjectCreateInput) {
    return prisma.project.create({
      data,
      include: projectDetailIncludes,
    });
  }

  async update(id: string, data: Prisma.ProjectUpdateInput) {
    return prisma.project.update({
      where: { id },
      data,
      include: projectDetailIncludes,
    });
  }

  async delete(id: string) {
    return prisma.project.delete({ where: { id } });
  }

  // Move a project (and its whole board) into the native Partner CRM
  // tables, then delete the source project. One transaction so a partial
  // copy can't leave a half-migrated partner behind. Task parent links
  // are remapped to the new partner-task ids (created-then-relinked, so
  // arbitrary nesting depth is safe). Partner needs a unique slug, so we
  // derive one from the company name and de-dupe inside the tx.
  async moveToPartner(projectId: string, company: string) {
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        include: {
          columns: true,
          members: true,
          tasks: { include: { assignees: true, comments: true } },
        },
      });
      if (!project) return null;

      const base =
        company
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80) || "partner";
      let slug = base;
      let counter = 0;
      while (await tx.partner.findUnique({ where: { slug } })) {
        counter++;
        slug = `${base}-${counter}`;
      }

      const partner = await tx.partner.create({
        data: {
          slug,
          company,
          type: "other",
          status: "active",
          description: project.description,
          department: project.department,
          dependency: project.dependency,
          comment: project.comment,
          productionLiveDate: project.productionLiveDate,
          goLiveDate: project.goLiveDate,
          revisedGoLiveDate: project.revisedGoLiveDate,
          ownerId: project.ownerId,
        },
      });

      if (project.columns.length > 0) {
        await tx.partnerColumn.createMany({
          data: project.columns.map((c) => ({
            partnerId: partner.id,
            key: c.key,
            label: c.label,
            color: c.color,
            sortOrder: c.sortOrder,
          })),
        });
      }

      // Create every task parent-less first, recording old→new id, then
      // relink parents — handles any nesting depth without ordering.
      const idMap = new Map<string, string>();
      for (const t of project.tasks) {
        const created = await tx.partnerTask.create({
          data: {
            partnerId: partner.id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            ownerId: t.ownerId,
            startDate: t.startDate,
            endDate: t.endDate,
            sortOrder: t.sortOrder,
          },
        });
        idMap.set(t.id, created.id);
        if (t.assignees.length > 0) {
          await tx.partnerTaskAssignee.createMany({
            data: t.assignees.map((a) => ({
              taskId: created.id,
              userId: a.userId,
              allocationPct: a.allocationPct,
            })),
          });
        }
        for (const c of t.comments) {
          await tx.partnerTaskComment.create({
            data: {
              taskId: created.id,
              authorId: c.authorId,
              body: c.body,
              createdAt: c.createdAt,
            },
          });
        }
      }
      for (const t of project.tasks) {
        if (!t.parentTaskId) continue;
        const newId = idMap.get(t.id);
        const newParent = idMap.get(t.parentTaskId);
        if (newId && newParent) {
          await tx.partnerTask.update({
            where: { id: newId },
            data: { parentTaskId: newParent },
          });
        }
      }

      if (project.members.length > 0) {
        await tx.partnerMember.createMany({
          data: project.members.map((m) => ({
            partnerId: partner.id,
            userId: m.userId,
            role: m.role,
          })),
          skipDuplicates: true,
        });
      }

      // Cascades project tasks / columns / members.
      await tx.project.delete({ where: { id: projectId } });

      return partner;
    });
  }

  // ─── Members ──────────────────────────────────────────

  async setMembers(projectId: string, userIds: string[]) {
    await prisma.projectMember.deleteMany({ where: { projectId } });
    if (userIds.length > 0) {
      await prisma.projectMember.createMany({
        data: userIds.map((userId) => ({ projectId, userId })),
        skipDuplicates: true,
      });
    }
    return prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: userSelect } },
    });
  }

  async getMembers(projectId: string) {
    return prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: userSelect } },
    });
  }

  // ─── Columns ──────────────────────────────────────────

  async getColumns(projectId: string) {
    return prisma.projectColumn.findMany({
      where: { projectId },
      orderBy: { sortOrder: "asc" },
    });
  }

  async createColumn(data: Prisma.ProjectColumnUncheckedCreateInput) {
    return prisma.projectColumn.create({ data });
  }

  async updateColumn(id: string, data: Prisma.ProjectColumnUpdateInput) {
    return prisma.projectColumn.update({ where: { id }, data });
  }

  async deleteColumn(id: string) {
    return prisma.projectColumn.delete({ where: { id } });
  }

  // Shared resolution of a per-project auto-assign default → the user id a new
  // task's owner should default to (or null for none). `user` mode is
  // validated against an ACTIVE, non-deleted user (soft-delete stamps deletedAt
  // without flipping isActive, so both are checked; the assignee-join FK would
  // otherwise reject a stale id).
  private async resolveDefaultAssignee(
    cfg: {
      defaultAssigneeMode: string;
      defaultAssigneeId: string | null;
      ownerId: string | null;
    },
    actorId: string,
  ): Promise<string | null> {
    switch (cfg.defaultAssigneeMode) {
      case "creator":
        return actorId;
      case "owner":
        return cfg.ownerId;
      case "user": {
        if (!cfg.defaultAssigneeId) return null;
        const user = await prisma.user.findFirst({
          where: { id: cfg.defaultAssigneeId, isActive: true, deletedAt: null },
          select: { id: true },
        });
        return user?.id ?? null;
      }
      default:
        return null;
    }
  }

  // IT CRM stores its default on the native it_projects row.
  async resolveItDefaultAssignee(
    projectId: string,
    actorId: string,
  ): Promise<string | null> {
    const it = await prisma.itProject.findUnique({
      where: { id: projectId },
      select: {
        defaultAssigneeMode: true,
        defaultAssigneeId: true,
        ownerId: true,
      },
    });
    if (!it) return null;
    return this.resolveDefaultAssignee(it, actorId);
  }

  // Pure shared-board CRMs (general / hr) store the default on the shared
  // projects row. (Native-mirror CRMs — it/legal/accounting — keep their own
  // copy on the native table; see the resolvers above/below.)
  async resolveProjectDefaultAssignee(
    projectId: string,
    actorId: string,
  ): Promise<string | null> {
    const p = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        defaultAssigneeMode: true,
        defaultAssigneeId: true,
        ownerId: true,
      },
    });
    if (!p) return null;
    return this.resolveDefaultAssignee(p, actorId);
  }

  // Legal CRM stores its default on the native legal_projects row.
  async resolveLegalDefaultAssignee(
    projectId: string,
    actorId: string,
  ): Promise<string | null> {
    const p = await prisma.legalProject.findUnique({
      where: { id: projectId },
      select: {
        defaultAssigneeMode: true,
        defaultAssigneeId: true,
        ownerId: true,
      },
    });
    if (!p) return null;
    return this.resolveDefaultAssignee(p, actorId);
  }

  // Accounting CRM stores its default on the native accounting_projects row.
  async resolveAccountingDefaultAssignee(
    projectId: string,
    actorId: string,
  ): Promise<string | null> {
    const p = await prisma.accountingProject.findUnique({
      where: { id: projectId },
      select: {
        defaultAssigneeMode: true,
        defaultAssigneeId: true,
        ownerId: true,
      },
    });
    if (!p) return null;
    return this.resolveDefaultAssignee(p, actorId);
  }

  // Propagate go-live date edits made on the shared (mirror) board row to the
  // CRM's NATIVE table, so the CRM's own list page and the native reminder
  // scans (it / legal / accounting) see the new date — and re-arm the native
  // reminder ladder when a go-live/revised date changed (fired "golive-*"
  // markers were tied to the old deadline). Without this, a date edited on the
  // shared /projects board forked from the native row (stale list + a reminder
  // schedule stuck on the old date). `updateMany` makes a missing native row a
  // silent no-op (a `general`/`hr`-turned-team edge or a pre-mirror row).
  async syncNativeGoLiveDates(
    team: string,
    projectId: string,
    dates: {
      goLiveDate?: Date | null;
      revisedGoLiveDate?: Date | null;
      productionLiveDate?: Date | null;
    },
  ): Promise<void> {
    const data: Record<string, unknown> = {
      ...(dates.goLiveDate !== undefined && { goLiveDate: dates.goLiveDate }),
      ...(dates.revisedGoLiveDate !== undefined && {
        revisedGoLiveDate: dates.revisedGoLiveDate,
      }),
      ...(dates.productionLiveDate !== undefined && {
        productionLiveDate: dates.productionLiveDate,
      }),
    };
    if (Object.keys(data).length === 0) return;
    // Reset the ladder only when the reminder deadline inputs changed —
    // productionLiveDate is display-only for the cron.
    if (
      dates.goLiveDate !== undefined ||
      dates.revisedGoLiveDate !== undefined
    ) {
      data.remindersSent = [];
      data.lastReminderSentAt = null;
    }
    const args = { where: { id: projectId }, data };
    if (team === "it") {
      await prisma.itProject.updateMany(args);
    } else if (team === "legal") {
      await prisma.legalProject.updateMany(args);
    } else if (team === "accounting") {
      await prisma.accountingProject.updateMany(args);
    }
  }

  // ─── Tasks ────────────────────────────────────────────

  async createTask(data: Prisma.ProjectTaskUncheckedCreateInput) {
    return prisma.projectTask.create({ data, include: taskIncludes });
  }

  async findTaskById(id: string) {
    return prisma.projectTask.findUnique({ where: { id } });
  }

  async updateTask(id: string, data: Prisma.ProjectTaskUpdateInput) {
    return prisma.projectTask.update({
      where: { id },
      data,
      include: taskIncludes,
    });
  }

  async updateTaskAndLog(
    taskId: string,
    data: Prisma.ProjectTaskUpdateInput,
    activityRows: Prisma.ProjectTaskActivityCreateManyInput[],
  ) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.projectTask.update({
        where: { id: taskId },
        data,
        include: taskIncludes,
      });
      if (activityRows.length > 0) {
        await tx.projectTaskActivity.createMany({ data: activityRows });
      }
      return updated;
    });
  }

  async deleteTask(id: string) {
    return prisma.projectTask.delete({ where: { id } });
  }

  async findTaskWithOwner(id: string) {
    return prisma.projectTask.findUnique({
      where: { id },
      include: taskIncludes,
    });
  }

  async findTaskForDetail(id: string) {
    return prisma.projectTask.findUnique({
      where: { id },
      include: {
        owner: { select: userSelect },
        parent: { select: { id: true, title: true } },
        // Phase 3b: include the multi-assign + dependency + resource
        // surface so the detail sheet can render them without extra
        // round-trips. Each relation is small per task, so the cost
        // is bounded.
        assignees: { include: { user: { select: userSelect } } },
        dependencies: {
          include: {
            dependsOnTask: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        dependents: {
          include: {
            task: { select: { id: true, title: true, status: true } },
          },
        },
        resources: { include: { creator: { select: userSelect } } },
      },
    });
  }

  async listSubtasks(parentId: string) {
    return prisma.projectTask.findMany({
      where: { parentTaskId: parentId },
      include: taskIncludes,
      orderBy: { sortOrder: "asc" },
    });
  }

  // Flat task list across many projects for the Tasks export. Top-level
  // rows precede their subtasks (parentTaskId asc nulls-first) so the
  // exported sheet reads project → task → its subtasks.
  async findTasksByProjectIds(projectIds: string[]) {
    if (projectIds.length === 0) return [];
    return prisma.projectTask.findMany({
      where: { projectId: { in: projectIds } },
      include: {
        project: { select: { name: true } },
        owner: { select: { id: true, name: true } },
        parent: { select: { title: true } },
      },
      orderBy: [
        { projectId: "asc" },
        { parentTaskId: { sort: "asc", nulls: "first" } },
        { sortOrder: "asc" },
      ],
    });
  }

  async listCommentsForTasks(taskIds: string[]) {
    if (taskIds.length === 0) return [];
    return prisma.projectTaskComment.findMany({
      where: { taskId: { in: taskIds } },
      include: { author: { select: userSelect } },
      orderBy: { createdAt: "desc" },
    });
  }

  async listActivitiesForTasks(taskIds: string[]) {
    if (taskIds.length === 0) return [];
    return prisma.projectTaskActivity.findMany({
      where: { taskId: { in: taskIds } },
      include: { actor: { select: userSelect } },
      orderBy: { createdAt: "desc" },
    });
  }

  async createComment(data: {
    taskId: string;
    authorId: string;
    body: string;
  }) {
    return prisma.projectTaskComment.create({
      data,
      include: { author: { select: userSelect } },
    });
  }

  async createActivities(rows: Prisma.ProjectTaskActivityCreateManyInput[]) {
    if (rows.length === 0) return;
    await prisma.projectTaskActivity.createMany({ data: rows });
  }

  // ─── Milestones ───────────────────────────────────────

  async listMilestones(projectId: string) {
    return prisma.projectMilestone.findMany({
      where: { projectId },
      include: {
        owner: { select: userSelect },
        _count: { select: { tasks: true } },
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  async findMilestoneById(id: string) {
    return prisma.projectMilestone.findUnique({
      where: { id },
      include: { owner: { select: userSelect } },
    });
  }

  async createMilestone(data: Prisma.ProjectMilestoneUncheckedCreateInput) {
    return prisma.projectMilestone.create({
      data,
      include: { owner: { select: userSelect } },
    });
  }

  async updateMilestone(id: string, data: Prisma.ProjectMilestoneUpdateInput) {
    return prisma.projectMilestone.update({
      where: { id },
      data,
      include: { owner: { select: userSelect } },
    });
  }

  async deleteMilestone(id: string) {
    return prisma.projectMilestone.delete({ where: { id } });
  }

  // ─── Multi-assign ─────────────────────────────────────

  async setAssignees(
    taskId: string,
    rows: Array<{ userId: string; allocationPct?: number | null }>,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.projectTaskAssignee.deleteMany({ where: { taskId } });
      if (rows.length > 0) {
        await tx.projectTaskAssignee.createMany({
          data: rows.map((r) => ({
            taskId,
            userId: r.userId,
            allocationPct: r.allocationPct ?? null,
          })),
          skipDuplicates: true,
        });
      }
      return tx.projectTaskAssignee.findMany({
        where: { taskId },
        include: { user: { select: userSelect } },
      });
    });
  }

  async listAssignees(taskId: string) {
    return prisma.projectTaskAssignee.findMany({
      where: { taskId },
      include: { user: { select: userSelect } },
    });
  }

  // ─── Dependencies ─────────────────────────────────────

  async listDependencies(taskId: string) {
    // `blockedBy` = tasks blocking me (task_id = me).
    // `blocking`  = tasks I block (depends_on_task_id = me).
    const [blockedBy, blocking] = await Promise.all([
      prisma.projectTaskDependency.findMany({
        where: { taskId },
        include: {
          dependsOnTask: { select: { id: true, title: true, status: true } },
        },
      }),
      prisma.projectTaskDependency.findMany({
        where: { dependsOnTaskId: taskId },
        include: {
          task: { select: { id: true, title: true, status: true } },
        },
      }),
    ]);
    return { blockedBy, blocking };
  }

  async createDependency(data: {
    taskId: string;
    dependsOnTaskId: string;
    type: string;
  }) {
    return prisma.projectTaskDependency.create({ data });
  }

  async deleteDependency(id: string) {
    return prisma.projectTaskDependency.delete({ where: { id } });
  }

  async findDependencyById(id: string) {
    return prisma.projectTaskDependency.findUnique({ where: { id } });
  }

  /**
   * Returns every dependency edge (task_id → depends_on_task_id) for
   * tasks in a project. Used by the service-layer DFS cycle check.
   */
  async listProjectDependencyEdges(projectId: string) {
    const rows = await prisma.projectTaskDependency.findMany({
      where: { task: { projectId } },
      select: { taskId: true, dependsOnTaskId: true },
    });
    return rows;
  }

  /**
   * Returns every task that lists `taskId` as a predecessor, hydrated
   * with each dependent's assignee emails. Used by Phase 4's unblock
   * notification — when `taskId` flips to "done" we email the people
   * who can now start work on it.
   */
  async listDependentsWithAssignees(taskId: string) {
    return prisma.projectTaskDependency.findMany({
      where: { dependsOnTaskId: taskId },
      select: {
        id: true,
        taskId: true,
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            project: { select: { id: true, name: true } },
            owner: { select: userSelect },
            assignees: {
              select: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });
  }

  // ─── Resources ────────────────────────────────────────

  async listResources(taskId: string) {
    return prisma.projectTaskResource.findMany({
      where: { taskId },
      include: { creator: { select: userSelect } },
      orderBy: { createdAt: "desc" },
    });
  }

  async createResource(data: Prisma.ProjectTaskResourceUncheckedCreateInput) {
    return prisma.projectTaskResource.create({
      data,
      include: { creator: { select: userSelect } },
    });
  }

  async findResourceById(id: string) {
    return prisma.projectTaskResource.findUnique({ where: { id } });
  }

  async deleteResource(id: string) {
    return prisma.projectTaskResource.delete({ where: { id } });
  }

  // ─── Timeline (Gantt) ─────────────────────────────────

  /**
   * Returns the full hierarchy needed to render a Gantt:
   *   - milestones (with start/end + owner)
   *   - tasks (every task, all levels — parent links + range)
   *   - dependencies (every edge)
   *
   * Caller is responsible for tree-building on the client.
   */
  async getTimelineSnapshot(projectId: string) {
    const [milestones, tasks, dependencies] = await Promise.all([
      prisma.projectMilestone.findMany({
        where: { projectId },
        include: { owner: { select: userSelect } },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.projectTask.findMany({
        where: { projectId },
        include: {
          owner: { select: userSelect },
          assignees: { include: { user: { select: userSelect } } },
        },
        orderBy: [{ parentTaskId: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.projectTaskDependency.findMany({
        where: { task: { projectId } },
      }),
    ]);
    return { milestones, tasks, dependencies };
  }

  /**
   * Walks `parent_task_id` chain upward from `taskId`. Used to enforce
   * subtask cycle-free guarantee — caller wants the set of ancestor
   * ids so it can reject "set parent = self or descendant".
   */
  async getAncestorTaskIds(taskId: string): Promise<string[]> {
    const ancestors: string[] = [];
    let current: string | null = taskId;
    const guard = new Set<string>();
    while (current) {
      if (guard.has(current)) break; // already cyclic — bail
      guard.add(current);
      const row: { parentTaskId: string | null } | null =
        await prisma.projectTask.findUnique({
          where: { id: current },
          select: { parentTaskId: true },
        });
      if (!row?.parentTaskId) break;
      ancestors.push(row.parentTaskId);
      current = row.parentTaskId;
    }
    return ancestors;
  }
}

export const projectRepository = new ProjectRepository();
