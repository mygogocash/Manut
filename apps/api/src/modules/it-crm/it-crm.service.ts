import type { Prisma } from "@manut/database";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { PORTAL_URL } from "@/lib/portal-url";
import { HELPDESK_SLA, slaTargetFor } from "@/modules/helpdesk/helpdesk.sla";
import type {
  CreateItProjectColumnInput,
  CreateItProjectInput,
  CreateItProjectTaskCommentInput,
  CreateItProjectTaskInput,
  ItProjectQuery,
  ManageItProjectMembersInput,
  ManageItProjectTaskAssigneesInput,
  ReorderItProjectsInput,
  UpdateItProjectColumnInput,
  UpdateItProjectInput,
  UpdateItProjectTaskInput,
} from "@/modules/it-crm/it-crm.validation";

// Phase 2 of the IT CRM standalone workspace. All reads / writes
// target the `it_*` tables (Phase 1 = #609). Phase 3 wires the
// frontend `/it-crm` page off the existing shared-Project routes
// and onto this module.

// Admin-editable extra recipients for deadline-reminder emails (on top of the
// owner + task assignees). Single SystemSetting row; empty = owner/assignees
// only. Mirrors the survey notification-recipients convention.
const REMINDER_RECIPIENTS_KEY = "it-crm.reminder_recipients";

export interface ReminderRecipients {
  recipients: string[];
}

function readReminderRecipients(value: unknown): ReminderRecipients {
  const v = (value ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(v.recipients)
    ? v.recipients.filter((x): x is string => typeof x === "string")
    : [];
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const e of raw) {
    const clean = e.trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      recipients.push(clean);
    }
  }
  return { recipients };
}

const DEFAULT_COLUMNS = [
  { key: "backlog", label: "Backlog", color: "bg-zinc-500", sortOrder: 0 },
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
  { key: "done", label: "Done", color: "bg-emerald-500", sortOrder: 4 },
];

function statusLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let counter = 0;

  while (true) {
    const existing = await prisma.itProject.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    counter += 1;
    slug = `${base}-${counter}`;
  }
}

async function requireMembership(
  projectId: string,
  userId: string,
  perms: string[],
): Promise<"owner" | "member" | "admin"> {
  if (perms.includes(PERMISSIONS.IT_CRM_READ_ALL)) return "admin";
  const project = await prisma.itProject.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true },
  });
  if (!project) throw new NotFoundException("IT project not found");
  if (project.ownerId === userId) return "owner";
  const member = await prisma.itProjectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  if (member) return "member";
  throw new ForbiddenException("You do not have access to this project");
}

function requireOwnerOrManage(
  role: "owner" | "member" | "admin",
  perms: string[],
): void {
  if (role === "owner" || role === "admin") return;
  if (perms.includes(PERMISSIONS.IT_CRM_MANAGE)) return;
  throw new ForbiddenException(
    "Only the project owner or an IT CRM manager can do this",
  );
}

// Compose the helpdesk block of the IT CRM dashboard payload. Kept as
// a free function (rather than a method) so the dashboard() body stays
// readable — the arithmetic + JS-side averaging would otherwise drown
// the orchestration logic of the surrounding queries.
function computeHelpdeskBlock(input: {
  createdToday: number;
  createdYesterday: number;
  createdWeek: number;
  resolvedToday: number;
  resolvedYesterday: number;
  resolvedWeek: number;
  open: number;
  openHighPriority: number;
  byStatusRaw: Array<{ status: string; _count: { _all: number } }>;
  byPriorityRaw: Array<{ priority: string; _count: { _all: number } }>;
  byCategoryRaw: Array<{ category: string; _count: { _all: number } }>;
  resolutionSamples: Array<{
    createdAt: Date;
    resolvedAt: Date | null;
    priority: string;
  }>;
  openSpotlight: Array<{
    id: string;
    ticketNumber: number;
    title: string;
    status: string;
    priority: string;
    category: string;
    createdAt: Date;
    assignee: { id: string; name: string } | null;
  }>;
  createdDaily: Array<{ day: Date; count: bigint }>;
  resolvedDaily: Array<{ day: Date; count: bigint }>;
  todayStart: Date;
}) {
  // Average time-to-resolve in hours. Compute overall + per-priority
  // so management can spot whether urgent tickets actually get a
  // faster response than the long tail. Round to one decimal for
  // display.
  const samples = input.resolutionSamples.filter(
    (s): s is typeof s & { resolvedAt: Date } => s.resolvedAt != null,
  );
  function avgHours(rows: typeof samples): number | null {
    if (rows.length === 0) return null;
    const total = rows.reduce(
      (sum, r) =>
        sum + (r.resolvedAt.getTime() - r.createdAt.getTime()) / 3_600_000,
      0,
    );
    return Math.round((total / rows.length) * 10) / 10;
  }
  const byPriorityAvg: Record<string, number | null> = {};
  for (const p of ["urgent", "high", "medium", "low"]) {
    byPriorityAvg[p] = avgHours(samples.filter((s) => s.priority === p));
  }
  // Stitch the two daily series into a single 7-day array. Maps the
  // ISO date (YYYY-MM-DD) to created + resolved counts; missing days
  // get 0 so the chart x-axis stays continuous even on quiet days.
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const createdMap = new Map(
    input.createdDaily.map((r) => [dayKey(r.day), Number(r.count)]),
  );
  const resolvedMap = new Map(
    input.resolvedDaily.map((r) => [dayKey(r.day), Number(r.count)]),
  );
  const dailySeries: Array<{
    day: string;
    created: number;
    resolved: number;
  }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(input.todayStart);
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    dailySeries.push({
      day: k,
      created: createdMap.get(k) ?? 0,
      resolved: resolvedMap.get(k) ?? 0,
    });
  }
  return {
    created: {
      today: input.createdToday,
      yesterday: input.createdYesterday,
      thisWeek: input.createdWeek,
    },
    resolved: {
      today: input.resolvedToday,
      yesterday: input.resolvedYesterday,
      thisWeek: input.resolvedWeek,
    },
    open: input.open,
    openHighPriority: input.openHighPriority,
    avgResolutionHours: avgHours(samples),
    avgResolutionHoursByPriority: byPriorityAvg,
    byStatus: input.byStatusRaw.map((s) => ({
      status: s.status,
      count: s._count._all,
    })),
    byPriority: input.byPriorityRaw.map((p) => ({
      priority: p.priority,
      count: p._count._all,
    })),
    byCategory: input.byCategoryRaw.map((c) => ({
      category: c.category,
      count: c._count._all,
    })),
    dailySeries,
    openSpotlight: input.openSpotlight.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      title: t.title,
      status: t.status,
      priority: t.priority,
      category: t.category,
      createdAt: t.createdAt.toISOString(),
      // "Ageing" in hours since the ticket landed — useful sort key
      // for the spotlight list; the UI can render it as "3d 4h".
      ageHours:
        Math.round(((Date.now() - t.createdAt.getTime()) / 3_600_000) * 10) /
        10,
      assignee: t.assignee,
    })),
  };
}

// ── Flow + SLA helpers ───────────────────────────────────
function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 3_600_000;
}
// Average gap in DAYS, rounded to one decimal; null on an empty set so the
// UI shows "—" rather than a misleading 0. Exported for unit testing.
export function avgDays(pairs: Array<{ from: Date; to: Date }>): number | null {
  if (pairs.length === 0) return null;
  const total = pairs.reduce(
    (s, p) => s + (p.to.getTime() - p.from.getTime()),
    0,
  );
  return Math.round((total / pairs.length / 86_400_000) * 10) / 10;
}

// Helpdesk SLA attainment. Response attainment is measured over tickets that
// actually got a first response; resolution + first-fix over tickets that
// reached resolved/closed. Percentages are 0-100 (one decimal) or null when
// the denominator is 0, so the UI can render "—" instead of a fake 0%.
// Exported for unit testing.
export function computeSlaBlock(input: {
  resolution: Array<{
    createdAt: Date;
    resolvedAt: Date | null;
    priority: string;
    reopenedCount: number;
  }>;
  response: Array<{
    createdAt: Date;
    firstResponseAt: Date | null;
    priority: string;
  }>;
}) {
  const resolved = input.resolution.filter(
    (r): r is typeof r & { resolvedAt: Date } => r.resolvedAt != null,
  );
  const responded = input.response.filter(
    (r): r is typeof r & { firstResponseAt: Date } => r.firstResponseAt != null,
  );
  const pct = (num: number, den: number): number | null =>
    den === 0 ? null : Math.round((num / den) * 1000) / 10;

  const resMet = resolved.filter(
    (r) =>
      hoursBetween(r.createdAt, r.resolvedAt) <=
      slaTargetFor(r.priority).resolution,
  ).length;
  const respMet = responded.filter(
    (r) =>
      hoursBetween(r.createdAt, r.firstResponseAt) <=
      slaTargetFor(r.priority).response,
  ).length;
  const cleanFix = resolved.filter((r) => (r.reopenedCount ?? 0) === 0).length;

  return {
    response: {
      total: responded.length,
      met: respMet,
      breached: responded.length - respMet,
      attainmentPct: pct(respMet, responded.length),
    },
    resolution: {
      total: resolved.length,
      met: resMet,
      breached: resolved.length - resMet,
      attainmentPct: pct(resMet, resolved.length),
    },
    firstFix: {
      total: resolved.length,
      clean: cleanFix,
      firstFixPct: pct(cleanFix, resolved.length),
    },
    targets: HELPDESK_SLA,
  };
}

export class ItCrmService {
  // ─── Project CRUD ─────────────────────────────────────────────

  async list(userId: string, perms: string[], query: ItProjectQuery) {
    const { page, limit, search, status, department, archived } = query;
    const canSeeAll =
      perms.includes(PERMISSIONS.IT_CRM_READ_ALL) ||
      perms.includes(PERMISSIONS.PROJECTS_READ_ALL);

    const where: Parameters<typeof prisma.itProject.findMany>[0] extends
      { where?: infer W } | undefined
      ? W
      : never = {};
    // Search and owner-scope are SEPARATE disjunctions that must both hold —
    // keep them as distinct AND'd groups. Merging them into one `where.OR`
    // lets a search term alone satisfy the predicate, bypassing owner-scope
    // for a non read-all caller (RBAC leak). See CLAUDE.md RBAC scoping rules.
    const and: (typeof where)[] = [];
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (status) where.status = status;
    if (department) where.department = department;
    // Archive is orthogonal to status: default view shows active projects
    // only; the Archived tab (archived=true) shows the archived ones. Applied
    // to both findMany and count so pagination totals match the view.
    where.archivedAt = archived ? { not: null } : null;
    if (!canSeeAll) {
      and.push({
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      });
    }
    if (and.length > 0) where.AND = and;

    const [data, total] = await Promise.all([
      prisma.itProject.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.itProject.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(userId: string, input: CreateItProjectInput) {
    const slug = await uniqueSlug(generateSlug(input.name));
    const ownerId = input.ownerId ?? userId;
    const project = await prisma.itProject.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        status: input.status,
        ownerId,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        productionLiveDate: input.productionLiveDate
          ? new Date(input.productionLiveDate)
          : null,
        goLiveDate: input.goLiveDate ? new Date(input.goLiveDate) : null,
        revisedGoLiveDate: input.revisedGoLiveDate
          ? new Date(input.revisedGoLiveDate)
          : null,
        dependency: input.dependency ?? null,
        comment: input.comment ?? null,
        department: input.department ?? null,
        healthStatus: input.healthStatus ?? null,
        effortPoints: input.effortPoints ?? null,
        defaultAssigneeMode: input.defaultAssigneeMode,
        // Only retain a specific-user id in `user` mode — other modes derive
        // the assignee elsewhere, so a stale id would be misleading.
        defaultAssigneeId:
          input.defaultAssigneeMode === "user"
            ? (input.defaultAssigneeId ?? null)
            : null,
        // Stamp the initial status timestamp so stage-aging measures from
        // creation rather than from the first later edit.
        statusChangedAt: new Date(),
        sortOrder: input.sortOrder,
        columns: { createMany: { data: DEFAULT_COLUMNS } },
        members: { create: { userId: ownerId, role: "owner" } },
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    return project;
  }

  async importRows(userId: string, rows: CreateItProjectInput[]) {
    // Create-new-only. Reuse `create` per row so each imported project
    // gets a unique slug + default columns + owner membership, exactly
    // like a hand-created one. Sequential to keep slug generation
    // race-free.
    let created = 0;
    for (const row of rows) {
      await this.create(userId, row);
      created++;
    }
    return { created };
  }

  async getById(id: string, userId: string, perms: string[]) {
    const role = await requireMembership(id, userId, perms);
    const project = await prisma.itProject.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    if (!project) throw new NotFoundException("IT project not found");
    return { ...project, role };
  }

  async update(
    id: string,
    userId: string,
    perms: string[],
    input: UpdateItProjectInput,
  ) {
    const role = await requireMembership(id, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.itProject.findUnique({
      where: { id },
      select: { name: true, status: true },
    });
    if (!existing) throw new NotFoundException("IT project not found");
    let slugUpdate = {};
    if (input.name && existing.name !== input.name) {
      slugUpdate = { slug: await uniqueSlug(generateSlug(input.name)) };
    }
    // Stamp status_changed_at only on a real status transition so
    // stage-aging / cycle-time reflect when work actually moved, not an
    // incidental edit to another field.
    const statusChanged =
      input.status !== undefined && input.status !== existing.status;
    // Re-arm the deadline-reminder ladder when a go-live date is edited: the
    // fired rung markers ("golive-30" …) are tied to the old deadline, so a
    // slipped go-live must start its countdown fresh. Clearing remindersSent
    // lets the cron fire the appropriate rung again for the new date.
    const goLiveEdited =
      input.goLiveDate !== undefined || input.revisedGoLiveDate !== undefined;
    // Normalize the auto-assign default: moving to a non-`user` mode clears
    // any stale specific-user id so it can't be applied by accident.
    const defaultAssigneeUpdate: {
      defaultAssigneeMode?: string;
      defaultAssigneeId?: string | null;
    } = {};
    if (input.defaultAssigneeMode !== undefined) {
      defaultAssigneeUpdate.defaultAssigneeMode = input.defaultAssigneeMode;
      defaultAssigneeUpdate.defaultAssigneeId =
        input.defaultAssigneeMode === "user"
          ? (input.defaultAssigneeId ?? null)
          : null;
    } else if (input.defaultAssigneeId !== undefined) {
      defaultAssigneeUpdate.defaultAssigneeId = input.defaultAssigneeId;
    }
    return prisma.itProject.update({
      where: { id },
      data: {
        ...slugUpdate,
        ...defaultAssigneeUpdate,
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.status !== undefined && { status: input.status }),
        ...(statusChanged && { statusChangedAt: new Date() }),
        ...(goLiveEdited && { remindersSent: [], lastReminderSentAt: null }),
        ...(input.healthStatus !== undefined && {
          healthStatus: input.healthStatus,
        }),
        ...(input.effortPoints !== undefined && {
          effortPoints: input.effortPoints,
        }),
        ...(input.ownerId !== undefined && { ownerId: input.ownerId }),
        ...(input.startDate !== undefined && {
          startDate: input.startDate ? new Date(input.startDate) : null,
        }),
        ...(input.endDate !== undefined && {
          endDate: input.endDate ? new Date(input.endDate) : null,
        }),
        ...(input.productionLiveDate !== undefined && {
          productionLiveDate: input.productionLiveDate
            ? new Date(input.productionLiveDate)
            : null,
        }),
        ...(input.goLiveDate !== undefined && {
          goLiveDate: input.goLiveDate ? new Date(input.goLiveDate) : null,
        }),
        ...(input.revisedGoLiveDate !== undefined && {
          revisedGoLiveDate: input.revisedGoLiveDate
            ? new Date(input.revisedGoLiveDate)
            : null,
        }),
        ...(input.dependency !== undefined && { dependency: input.dependency }),
        ...(input.comment !== undefined && { comment: input.comment }),
        ...(input.department !== undefined && { department: input.department }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async delete(id: string, userId: string, perms: string[]) {
    const role = await requireMembership(id, userId, perms);
    requireOwnerOrManage(role, perms);
    await prisma.itProject.delete({ where: { id } });
    return { success: true };
  }

  // Reversible hide. Owner-or-manage enforced in the SERVICE (not just the
  // route) so a plain it-crm:update holder can't archive another team's
  // project — same IDOR guard as delete/update. Idempotent: re-archiving keeps
  // the original archive time; archive state lives on this native row only and
  // is not propagated to the shared `projects` board mirror.
  async archive(id: string, userId: string, perms: string[]) {
    const role = await requireMembership(id, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.itProject.findUnique({
      where: { id },
      select: { archivedAt: true },
    });
    if (!existing) throw new NotFoundException("IT project not found");
    return prisma.itProject.update({
      where: { id },
      data: { archivedAt: existing.archivedAt ?? new Date() },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async unarchive(id: string, userId: string, perms: string[]) {
    const role = await requireMembership(id, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.itProject.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("IT project not found");
    return prisma.itProject.update({
      where: { id },
      data: { archivedAt: null },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // Admin-editable extra recipients for the deadline-reminder emails.
  async getReminderRecipients(): Promise<ReminderRecipients> {
    const row = await prisma.systemSetting.findUnique({
      where: { key: REMINDER_RECIPIENTS_KEY },
    });
    return readReminderRecipients(row?.value);
  }

  async setReminderRecipients(input: {
    recipients?: string[];
  }): Promise<ReminderRecipients> {
    const clean = readReminderRecipients(input);
    const value: Prisma.InputJsonObject = { recipients: clean.recipients };
    await prisma.systemSetting.upsert({
      where: { key: REMINDER_RECIPIENTS_KEY },
      update: { value },
      create: { key: REMINDER_RECIPIENTS_KEY, value },
    });
    return clean;
  }

  async reorder(input: ReorderItProjectsInput) {
    await prisma.$transaction(
      input.orderedIds.map((id, index) =>
        prisma.itProject.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return { success: true };
  }

  // ─── Dashboard ────────────────────────────────────────────────
  //
  // Intelligence rollup for the management surface. Read-only, gated
  // by the same `IT_READ_PERMS` bundle the list endpoint uses — no
  // new permission. Runs every aggregate inside one `Promise.all` so
  // the payload time is bounded by the slowest single query, not the
  // sum of seven sequential calls.
  async dashboard() {
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Day windows for the Daily Catchup + Helpdesk insights blocks.
    // Floor today to local midnight so "today" / "yesterday" align with
    // the management team's calendar day rather than UTC midnight.
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    // ISO week boundary — Monday 00:00. Reads more useful for weekly
    // standups than a rolling 7-day window which can straddle two weeks.
    const weekStart = new Date(todayStart);
    const dow = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - dow);
    // Six-month rolling window for the throughput line chart. Floor
    // to the first of the month so the buckets align with the labels
    // (Jan / Feb / Mar / ...) regardless of which day the user opens
    // the dashboard on.
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const terminalStatuses = [
      "completed",
      "prod_integrated",
      "closed",
      "cancelled",
    ];

    // Task-level status set the IT CRM board uses (see DEFAULT_COLUMNS
    // above). `done` is the only terminal column; anything else is
    // either backlog or in-flight.
    const taskTerminalStatuses = ["done"];

    const [
      total,
      productionLive,
      atRisk,
      completed,
      byStatus,
      byDepartment,
      ownerWorkloadRaw,
      throughputRaw,
      upcomingGoLives,
      blockedProjects,
      recentUpdates,
      taskTotal,
      taskSubtaskTotal,
      taskInProgress,
      taskDone,
      taskOverdue,
      tasksByStatus,
      overdueTaskList,
      tasksDoneYesterday,
      tasksActiveToday,
      projectsDoneYesterday,
      ticketsCreatedToday,
      ticketsCreatedYesterday,
      ticketsCreatedWeek,
      ticketsResolvedToday,
      ticketsResolvedYesterday,
      ticketsResolvedWeek,
      ticketsOpen,
      ticketsOpenHighPriority,
      ticketsByStatusRaw,
      ticketsByPriorityRaw,
      ticketsByCategoryRaw,
      ticketResolutionSamples,
      openTicketSpotlight,
      ticketsCreatedDaily,
      ticketsResolvedDaily,
      healthDistRaw,
      slippageProjectsRaw,
      activeStageAgingRaw,
      deliveredLeadTimeRaw,
      doneTaskCycleRaw,
      ticketResponseSamples,
    ] = await Promise.all([
      prisma.itProject.count(),
      prisma.itProject.count({ where: { productionLiveDate: { not: null } } }),
      prisma.itProject.count({
        where: {
          revisedGoLiveDate: { not: null },
          NOT: { status: { in: terminalStatuses } },
        },
      }),
      prisma.itProject.count({
        where: { status: { in: ["completed", "prod_integrated"] } },
      }),
      prisma.itProject.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.itProject.groupBy({
        by: ["department"],
        _count: { _all: true },
      }),
      // Owner workload — group + then hydrate to user names (Prisma
      // groupBy doesn't carry the relation). 8 covers the typical
      // engineering org with headroom for re-orgs.
      prisma.itProject.groupBy({
        by: ["ownerId"],
        _count: { _all: true },
        orderBy: { _count: { ownerId: "desc" } },
        take: 8,
      }),
      // Monthly throughput — projects that crossed Production Live in
      // the last 6 months. Raw SQL because Prisma's groupBy can't
      // pivot by month without a generated column.
      prisma.$queryRaw<Array<{ month: Date; count: bigint }>>`
        SELECT date_trunc('month', "production_live_date") AS month,
               COUNT(*)::bigint AS count
        FROM it_projects
        WHERE "production_live_date" IS NOT NULL
          AND "production_live_date" >= ${sixMonthsAgo}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.itProject.findMany({
        where: {
          goLiveDate: { gte: now, lte: in14Days },
          NOT: { status: { in: terminalStatuses } },
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
          dependency: true,
          owner: { select: { id: true, name: true } },
        },
      }),
      // Blocked = anything with a dependency string or non-empty
      // comment field while still active. Management cares about
      // unblockers more than completed work.
      prisma.itProject.findMany({
        where: {
          OR: [{ dependency: { not: null } }, { comment: { not: null } }],
          NOT: { status: { in: terminalStatuses } },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          dependency: true,
          comment: true,
          owner: { select: { id: true, name: true } },
        },
      }),
      prisma.itProject.findMany({
        where: { updatedAt: { gte: last7Days } },
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
      // Task + subtask rollups. The board model uses
      // `parentTaskId IS NULL` for top-level tasks and a non-null
      // pointer for subtasks, so the two counts split cleanly.
      prisma.itProjectTask.count({ where: { parentTaskId: null } }),
      prisma.itProjectTask.count({ where: { parentTaskId: { not: null } } }),
      prisma.itProjectTask.count({ where: { status: "in_progress" } }),
      prisma.itProjectTask.count({ where: { status: "done" } }),
      // "Overdue" = endDate is set, in the past, and the task hasn't
      // hit a terminal column yet. Subtasks count here too — they
      // share the same status enum.
      prisma.itProjectTask.count({
        where: {
          endDate: { lt: now, not: null },
          NOT: { status: { in: taskTerminalStatuses } },
        },
      }),
      prisma.itProjectTask.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.itProjectTask.findMany({
        where: {
          endDate: { lt: now, not: null },
          NOT: { status: { in: taskTerminalStatuses } },
        },
        orderBy: { endDate: "asc" },
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          endDate: true,
          parentTaskId: true,
          owner: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, slug: true } },
        },
      }),
      // Daily Catchup: tasks moved to `done` yesterday vs still active
      // today. There's no status-changed-at column, so we approximate
      // via `updatedAt` + current status — accurate when the only
      // recent edit was the status flip, which is the common case for
      // standup-driven boards.
      prisma.itProjectTask.findMany({
        where: {
          status: { in: taskTerminalStatuses },
          updatedAt: { gte: yesterdayStart, lt: todayStart },
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          title: true,
          status: true,
          parentTaskId: true,
          updatedAt: true,
          owner: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.itProjectTask.findMany({
        where: {
          status: "in_progress",
          updatedAt: { gte: todayStart },
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          title: true,
          status: true,
          parentTaskId: true,
          updatedAt: true,
          owner: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, slug: true } },
        },
      }),
      // Projects (not tasks) flipped to terminal status yesterday.
      // Useful management context — "X projects went live yesterday".
      prisma.itProject.findMany({
        where: {
          status: { in: terminalStatuses },
          updatedAt: { gte: yesterdayStart, lt: todayStart },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          department: true,
          owner: { select: { id: true, name: true } },
        },
      }),
      // Helpdesk insights — created counts in three windows, status /
      // priority / category breakdowns, plus raw resolution durations
      // for avg-time-to-resolve computation in JS (Prisma can't AVG
      // an interval expression cleanly across the ORM).
      prisma.helpdeskTicket.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.helpdeskTicket.count({
        where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
      }),
      prisma.helpdeskTicket.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.helpdeskTicket.count({
        where: { resolvedAt: { gte: todayStart } },
      }),
      prisma.helpdeskTicket.count({
        where: { resolvedAt: { gte: yesterdayStart, lt: todayStart } },
      }),
      prisma.helpdeskTicket.count({
        where: { resolvedAt: { gte: weekStart } },
      }),
      prisma.helpdeskTicket.count({
        where: { status: { in: ["open", "in-progress", "review"] } },
      }),
      prisma.helpdeskTicket.count({
        where: {
          status: { in: ["open", "in-progress", "review"] },
          priority: { in: ["high", "urgent"] },
        },
      }),
      prisma.helpdeskTicket.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.helpdeskTicket.groupBy({
        by: ["priority"],
        _count: { _all: true },
      }),
      prisma.helpdeskTicket.groupBy({
        by: ["category"],
        _count: { _all: true },
      }),
      // Resolution durations: pull resolvedAt + createdAt + priority
      // for tickets resolved in the last 30 days, compute hours in JS.
      // 30-day window keeps the sample fresh; older outliers don't
      // skew the running average for management snapshots.
      prisma.helpdeskTicket.findMany({
        where: {
          resolvedAt: {
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          createdAt: true,
          resolvedAt: true,
          priority: true,
          // reopenedCount feeds the first-fix-rate metric; firstResponseAt
          // is unused here (response SLA uses its own window below) but kept
          // cheap by selecting only scalars.
          reopenedCount: true,
        },
      }),
      prisma.helpdeskTicket.findMany({
        where: {
          status: { in: ["open", "in-progress", "review"] },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: 8,
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          status: true,
          priority: true,
          category: true,
          createdAt: true,
          assignee: { select: { id: true, name: true } },
        },
      }),
      // 7-day daily series — created vs resolved. Two parallel raw
      // queries because we need date_trunc bucketing in two columns
      // (created_at, resolved_at) that don't share a row's identity.
      prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "created_at") AS day,
               COUNT(*)::bigint AS count
        FROM helpdesk_tickets
        WHERE "created_at" >= ${new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "resolved_at") AS day,
               COUNT(*)::bigint AS count
        FROM helpdesk_tickets
        WHERE "resolved_at" IS NOT NULL
          AND "resolved_at" >= ${new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      // ── Dashboard analytics ────────────────────────────
      // Portfolio health RAG distribution.
      prisma.itProject.groupBy({
        by: ["healthStatus"],
        _count: { _all: true },
      }),
      // Schedule slippage — active projects whose go-live was pushed;
      // slipDays is computed in JS from the two dates.
      prisma.itProject.findMany({
        where: {
          goLiveDate: { not: null },
          revisedGoLiveDate: { not: null },
          NOT: { status: { in: terminalStatuses } },
        },
        orderBy: { revisedGoLiveDate: "asc" },
        take: 12,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          goLiveDate: true,
          revisedGoLiveDate: true,
          owner: { select: { id: true, name: true } },
        },
      }),
      // Stage aging — active projects + when status last changed, for a
      // "days in current stage" read. Bounded at 200; an IT portfolio
      // rarely runs hotter and the avg + oldest list degrade gracefully.
      prisma.itProject.findMany({
        where: { NOT: { status: { in: terminalStatuses } } },
        orderBy: { statusChangedAt: "asc" },
        take: 200,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          department: true,
          statusChangedAt: true,
          owner: { select: { id: true, name: true } },
        },
      }),
      // Project lead time — production-live in the last 180 days.
      prisma.itProject.findMany({
        where: {
          productionLiveDate: {
            not: null,
            gte: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          createdAt: true,
          startDate: true,
          productionLiveDate: true,
        },
      }),
      // Task cycle time — tasks completed in the last 90 days.
      prisma.itProjectTask.findMany({
        where: {
          completedAt: {
            not: null,
            gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          },
        },
        select: { createdAt: true, completedAt: true },
      }),
      // Helpdesk response-SLA sample — tickets that received a first
      // response in the last 30 days (own window, not gated on resolution).
      prisma.helpdeskTicket.findMany({
        where: {
          firstResponseAt: {
            not: null,
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: { createdAt: true, firstResponseAt: true, priority: true },
      }),
    ]);

    // Hydrate owner workload with user names. One round-trip; no
    // N+1 since we batch the `in` lookup off the groupBy result.
    const ownerIds = ownerWorkloadRaw
      .map((o) => o.ownerId)
      .filter((id): id is string => Boolean(id));
    const owners =
      ownerIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: ownerIds } },
            select: { id: true, name: true },
          })
        : [];
    const ownerNameById = new Map(owners.map((u) => [u.id, u.name]));

    // ── Derived analytics (dashboard redesign) ─────────────────────
    const healthDistribution = healthDistRaw.map((h) => ({
      health: h.healthStatus ?? "unrated",
      count: h._count._all,
    }));

    // Schedule slippage: days each go-live was pushed (signed). Only
    // positive slips feed the average — a pulled-forward date isn't
    // slippage — but the list keeps the signed delta so the UI can flag
    // pull-ins too. Sorted worst-slip-first for the risk register.
    const slippage = slippageProjectsRaw
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        originalGoLive: p.goLiveDate
          ? p.goLiveDate.toISOString().slice(0, 10)
          : null,
        revisedGoLive: p.revisedGoLiveDate
          ? p.revisedGoLiveDate.toISOString().slice(0, 10)
          : null,
        slipDays:
          p.goLiveDate && p.revisedGoLiveDate
            ? Math.round(
                (p.revisedGoLiveDate.getTime() - p.goLiveDate.getTime()) /
                  86_400_000,
              )
            : 0,
        owner: p.owner,
      }))
      .sort((a, b) => b.slipDays - a.slipDays);
    const positiveSlips = slippage.filter((s) => s.slipDays > 0);
    const avgSlipDays =
      positiveSlips.length > 0
        ? Math.round(
            (positiveSlips.reduce((s, p) => s + p.slipDays, 0) /
              positiveSlips.length) *
              10,
          ) / 10
        : null;

    // Stage aging: days each active project has sat in its current status
    // (now − statusChangedAt). Query returns oldest-first, so the head of
    // the list is already the most-stuck work.
    const stageAgingList = activeStageAgingRaw.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      department: p.department,
      daysInStage: p.statusChangedAt
        ? Math.max(
            0,
            Math.round(
              (now.getTime() - p.statusChangedAt.getTime()) / 86_400_000,
            ),
          )
        : null,
      owner: p.owner,
    }));
    const agedValues = stageAgingList
      .map((p) => p.daysInStage)
      .filter((d): d is number => d != null);
    const avgDaysInStage =
      agedValues.length > 0
        ? Math.round(
            (agedValues.reduce((s, d) => s + d, 0) / agedValues.length) * 10,
          ) / 10
        : null;

    // Lead time (project create → production-live) + task cycle time
    // (task create → completed). Both in days, null when no sample.
    const leadTimeDays = avgDays(
      deliveredLeadTimeRaw
        .filter((p) => p.productionLiveDate != null)
        .map((p) => ({
          from: p.startDate ?? p.createdAt,
          to: p.productionLiveDate as Date,
        })),
    );
    const taskCycleDays = avgDays(
      doneTaskCycleRaw
        .filter((t) => t.completedAt != null)
        .map((t) => ({ from: t.createdAt, to: t.completedAt as Date })),
    );

    return {
      total,
      productionLive,
      atRisk,
      completed,
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
      ownerWorkload: ownerWorkloadRaw.map((o) => ({
        ownerId: o.ownerId,
        ownerName: ownerNameById.get(o.ownerId) ?? "Unknown",
        count: o._count._all,
      })),
      throughput: throughputRaw.map((row) => ({
        month: row.month.toISOString().slice(0, 7),
        count: Number(row.count),
      })),
      upcomingGoLives,
      blockedProjects,
      recentUpdates,
      // Portfolio health RAG mix (heat-map exhibit).
      health: { distribution: healthDistribution },
      // Flow intelligence — the metrics the old approximations couldn't
      // reach: real lead/cycle time, how long active work has been stuck,
      // and schedule slippage as a ranked risk register.
      flow: {
        leadTimeDays,
        taskCycleDays,
        avgDaysInStage,
        stageAgingOldest: stageAgingList
          .filter((p) => p.daysInStage != null)
          .slice(0, 8),
        slippage: { avgSlipDays, projects: slippage },
      },
      // Helpdesk SLA attainment (response / resolution / first-fix).
      sla: computeSlaBlock({
        resolution: ticketResolutionSamples,
        response: ticketResponseSamples,
      }),
      tasks: {
        total: taskTotal,
        subtasks: taskSubtaskTotal,
        inProgress: taskInProgress,
        done: taskDone,
        overdue: taskOverdue,
        byStatus: tasksByStatus.map((s) => ({
          status: s.status,
          count: s._count._all,
        })),
        overdueList: overdueTaskList.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          endDate: t.endDate ? t.endDate.toISOString().slice(0, 10) : null,
          isSubtask: t.parentTaskId !== null,
          owner: t.owner,
          project: t.project,
        })),
      },
      // Daily catchup block. `nextSteps` reuses the existing
      // upcomingGoLives + overdueList so the UI can render a single
      // "what's next?" list without a second round trip; we slice in
      // the controller-side payload to keep the standup view tight.
      dailyCatchup: {
        yesterdayDone: {
          tasks: tasksDoneYesterday.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            isSubtask: t.parentTaskId !== null,
            owner: t.owner,
            project: t.project,
          })),
          projects: projectsDoneYesterday,
        },
        todayInProgress: {
          tasks: tasksActiveToday.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            isSubtask: t.parentTaskId !== null,
            owner: t.owner,
            project: t.project,
          })),
        },
        // Surface 5 upcoming + 5 overdue at most so the UI block stays
        // a quick-scan list; full versions live in the existing
        // Upcoming Go-Lives / Overdue Tasks sections lower down.
        nextSteps: {
          upcomingGoLives: upcomingGoLives.slice(0, 5).map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            goLiveDate: p.goLiveDate
              ? p.goLiveDate.toISOString().slice(0, 10)
              : null,
            owner: p.owner,
          })),
          overdueTasks: overdueTaskList.slice(0, 5).map((t) => ({
            id: t.id,
            title: t.title,
            endDate: t.endDate ? t.endDate.toISOString().slice(0, 10) : null,
            owner: t.owner,
            project: t.project,
          })),
        },
      },
      // Helpdesk insights — created / resolved counts across three
      // calendar windows, plus avg resolution time + open spotlight.
      helpdesk: computeHelpdeskBlock({
        createdToday: ticketsCreatedToday,
        createdYesterday: ticketsCreatedYesterday,
        createdWeek: ticketsCreatedWeek,
        resolvedToday: ticketsResolvedToday,
        resolvedYesterday: ticketsResolvedYesterday,
        resolvedWeek: ticketsResolvedWeek,
        open: ticketsOpen,
        openHighPriority: ticketsOpenHighPriority,
        byStatusRaw: ticketsByStatusRaw,
        byPriorityRaw: ticketsByPriorityRaw,
        byCategoryRaw: ticketsByCategoryRaw,
        resolutionSamples: ticketResolutionSamples,
        openSpotlight: openTicketSpotlight,
        createdDaily: ticketsCreatedDaily,
        resolvedDaily: ticketsResolvedDaily,
        todayStart,
      }),
    };
  }

  // ─── Board ────────────────────────────────────────────────────

  async getBoard(id: string, userId: string, perms: string[]) {
    await requireMembership(id, userId, perms);

    // IT CRM projects migrated from the general workspace
    // (20260904000000_it_crm_native_workspace) keep their original
    // `projects` / `project_tasks` rows under the SAME id, and the shared
    // board at /projects/:id edits those general rows — it never writes
    // it_project_tasks, which has no live writer. So for a migrated
    // project the live board state lives in project_tasks; read it there
    // or this dropdown shows the frozen migration-day snapshot. Native
    // IT-only projects (created post-migration via the IT CRM form) have
    // no general mirror, so they still read the it_* tables below.
    const mirror = await prisma.project.findUnique({
      where: { id },
      select: { team: true },
    });
    if (mirror?.team === "it") {
      return this.getGeneralBoard(id);
    }

    const columns = await prisma.itProjectColumn.findMany({
      where: { projectId: id },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
    if (columns.length === 0) {
      await prisma.itProjectColumn.createMany({
        data: DEFAULT_COLUMNS.map((c) => ({ projectId: id, ...c })),
        skipDuplicates: true,
      });
    }
    const [tasks, members, refreshedColumns] = await Promise.all([
      prisma.itProjectTask.findMany({
        where: { projectId: id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          owner: { select: { id: true, name: true, email: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      prisma.itProjectMember.findMany({
        where: { projectId: id },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      columns.length > 0
        ? Promise.resolve(columns)
        : prisma.itProjectColumn.findMany({
            where: { projectId: id },
            orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
          }),
    ]);
    return { columns: refreshedColumns, tasks, members };
  }

  // Reads the live board from the general project_* tables for a migrated
  // IT project. The returned shape mirrors the it_* board exactly so the
  // IT CRM list dropdown renders identically — and stays in sync with the
  // /projects board, which reads and writes these same rows.
  private async getGeneralBoard(id: string) {
    const [columns, tasks, members] = await Promise.all([
      prisma.projectColumn.findMany({
        where: { projectId: id },
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      }),
      prisma.projectTask.findMany({
        where: { projectId: id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          owner: { select: { id: true, name: true, email: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      prisma.projectMember.findMany({
        where: { projectId: id },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);
    // The general board persists columns lazily — many projects have none
    // and the web board falls back to DEFAULT_COLUMNS client-side. Mirror
    // that fallback so the dropdown can still group tasks by status.
    const resolvedColumns =
      columns.length > 0
        ? columns
        : DEFAULT_COLUMNS.map((c) => ({
            id: `default-${c.key}`,
            projectId: id,
            ...c,
          }));
    return { columns: resolvedColumns, tasks, members };
  }

  // ─── Tasks ────────────────────────────────────────────────────

  async createTask(
    projectId: string,
    userId: string,
    perms: string[],
    input: CreateItProjectTaskInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    if (input.parentTaskId) {
      const parent = await prisma.itProjectTask.findUnique({
        where: { id: input.parentTaskId },
        select: { id: true, projectId: true },
      });
      if (!parent || parent.projectId !== projectId) {
        throw new ConflictException(
          "Parent task does not belong to this project",
        );
      }
    }
    const { assigneeIds, ...taskFields } = input;
    const created = await prisma.$transaction(async (tx) => {
      const task = await tx.itProjectTask.create({
        data: {
          projectId,
          parentTaskId: taskFields.parentTaskId,
          title: taskFields.title,
          description: taskFields.description,
          status: taskFields.status,
          priority: taskFields.priority,
          effortPoints: taskFields.effortPoints ?? null,
          // Initial flow timestamps. completed_at is set up-front only
          // when the task is created directly in the terminal `done`
          // column (a back-dated import or a same-day quick-close).
          statusChangedAt: new Date(),
          completedAt: taskFields.status === "done" ? new Date() : null,
          ownerId: taskFields.ownerId ?? userId,
          startDate: taskFields.startDate
            ? new Date(taskFields.startDate)
            : null,
          endDate: taskFields.endDate ? new Date(taskFields.endDate) : null,
          sortOrder: taskFields.sortOrder,
        },
      });
      if (assigneeIds && assigneeIds.length > 0) {
        await tx.itProjectTaskAssignee.createMany({
          data: assigneeIds.map((uid) => ({ taskId: task.id, userId: uid })),
          skipDuplicates: true,
        });
      }
      return tx.itProjectTask.findUniqueOrThrow({
        where: { id: task.id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });

    // Notify everyone newly attached to the task. Runs post-commit
    // so an email never fires for a row that rolled back. The actor
    // is excluded from the recipient set — no point pinging the rep
    // who just created the task themselves.
    const newOwnerEmail =
      created.owner && created.owner.id !== userId ? created.owner.email : null;
    const newAssigneeEmails = created.assignees
      .filter((a) => a.user.id !== userId && a.user.id !== created.owner?.id)
      .map((a) => a.user.email);
    void this.notifyTaskAssignment({
      projectId,
      taskId: created.id,
      taskTitle: created.title,
      recipientEmails: [
        ...(newOwnerEmail ? [newOwnerEmail] : []),
        ...newAssigneeEmails,
      ].filter((e): e is string => Boolean(e)),
    });

    return created;
  }

  async updateTask(
    projectId: string,
    taskId: string,
    userId: string,
    perms: string[],
    input: UpdateItProjectTaskInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.itProjectTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        status: true,
        ownerId: true,
        title: true,
        assignees: { select: { userId: true } },
      },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    const previousAssigneeIds = new Set(
      existing.assignees.map((a) => a.userId),
    );
    const { assigneeIds, ...taskFields } = input;
    // Flow timestamps follow a real status transition only. Entering the
    // terminal `done` column stamps completed_at; moving back out clears
    // it so a reopened task never keeps a stale completion date.
    const statusChanged =
      taskFields.status !== undefined && taskFields.status !== existing.status;
    const enteringDone = statusChanged && taskFields.status === "done";
    const leavingDone =
      statusChanged &&
      existing.status === "done" &&
      taskFields.status !== "done";
    const updated = await prisma.$transaction(async (tx) => {
      await tx.itProjectTask.update({
        where: { id: taskId },
        data: {
          ...(taskFields.title !== undefined && { title: taskFields.title }),
          ...(taskFields.description !== undefined && {
            description: taskFields.description,
          }),
          ...(taskFields.status !== undefined && { status: taskFields.status }),
          ...(statusChanged && { statusChangedAt: new Date() }),
          ...(enteringDone && { completedAt: new Date() }),
          ...(leavingDone && { completedAt: null }),
          ...(taskFields.effortPoints !== undefined && {
            effortPoints: taskFields.effortPoints,
          }),
          ...(taskFields.priority !== undefined && {
            priority: taskFields.priority,
          }),
          ...(taskFields.ownerId !== undefined && {
            ownerId: taskFields.ownerId || null,
          }),
          ...(taskFields.startDate !== undefined && {
            startDate: taskFields.startDate
              ? new Date(taskFields.startDate)
              : null,
          }),
          ...(taskFields.endDate !== undefined && {
            endDate: taskFields.endDate ? new Date(taskFields.endDate) : null,
          }),
          ...(taskFields.sortOrder !== undefined && {
            sortOrder: taskFields.sortOrder,
          }),
        },
      });
      if (assigneeIds !== undefined) {
        await tx.itProjectTaskAssignee.deleteMany({ where: { taskId } });
        if (assigneeIds.length > 0) {
          await tx.itProjectTaskAssignee.createMany({
            data: assigneeIds.map((uid) => ({ taskId, userId: uid })),
            skipDuplicates: true,
          });
        }
      }
      return tx.itProjectTask.findUniqueOrThrow({
        where: { id: taskId },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });

    // Post-commit notifications. Two separate emails:
    //   1) Newly attached people (owner change + added assignees) get
    //      an "assigned" notice. Already-attached recipients are skipped
    //      via the `previousAssigneeIds` diff so a no-op edit stays quiet.
    //   2) When the status changes, every current attachee + the actor's
    //      own email is excluded; the rest hear about it once.
    const ownerChanged =
      taskFields.ownerId !== undefined &&
      (taskFields.ownerId || null) !== (existing.ownerId || null);
    const newOwnerEmail =
      ownerChanged && updated.owner && updated.owner.id !== userId
        ? updated.owner.email
        : null;
    const addedAssigneeEmails = updated.assignees
      .filter(
        (a) =>
          a.user.id !== userId &&
          !previousAssigneeIds.has(a.user.id) &&
          a.user.id !== updated.owner?.id,
      )
      .map((a) => a.user.email);
    const assignmentRecipients = [
      ...(newOwnerEmail ? [newOwnerEmail] : []),
      ...addedAssigneeEmails,
    ].filter((e): e is string => Boolean(e));
    if (assignmentRecipients.length > 0) {
      void this.notifyTaskAssignment({
        projectId,
        taskId: updated.id,
        taskTitle: updated.title,
        recipientEmails: assignmentRecipients,
      });
    }

    if (statusChanged && taskFields.status) {
      const statusRecipients = new Set<string>();
      if (updated.owner?.email && updated.owner.id !== userId) {
        statusRecipients.add(updated.owner.email);
      }
      for (const a of updated.assignees) {
        if (a.user.email && a.user.id !== userId) {
          statusRecipients.add(a.user.email);
        }
      }
      if (statusRecipients.size > 0) {
        void this.notifyTaskStatusChange({
          projectId,
          taskId: updated.id,
          taskTitle: updated.title,
          previousStatus: existing.status,
          nextStatus: taskFields.status,
          recipientEmails: [...statusRecipients],
        });
      }
    }

    return updated;
  }

  // Fire-and-forget email about a fresh assignment. Wrapped in
  // try/catch so a transient email-provider error never propagates
  // back into the request — the row already committed, the
  // notification is best-effort.
  private async notifyTaskAssignment(payload: {
    projectId: string;
    taskId: string;
    taskTitle: string;
    recipientEmails: string[];
  }): Promise<void> {
    if (payload.recipientEmails.length === 0) return;
    try {
      const project = await prisma.itProject.findUnique({
        where: { id: payload.projectId },
        select: { name: true, slug: true },
      });
      const projectName = project?.name ?? "an IT CRM project";
      const projectHref = project?.slug
        ? `/it-crm/${project.slug}?task=${payload.taskId}`
        : `/it-crm`;
      await sendEmail({
        to: payload.recipientEmails,
        templateId: "it-crm-task-assigned",
        variables: {
          taskTitle: payload.taskTitle,
          projectName,
          portalUrl: `${PORTAL_URL}${projectHref}`,
        },
      });
    } catch (err) {
      logger.error("Failed to send IT CRM task-assigned notification", { err });
    }
  }

  private async notifyTaskStatusChange(payload: {
    projectId: string;
    taskId: string;
    taskTitle: string;
    previousStatus: string;
    nextStatus: string;
    recipientEmails: string[];
  }): Promise<void> {
    if (payload.recipientEmails.length === 0) return;
    try {
      const project = await prisma.itProject.findUnique({
        where: { id: payload.projectId },
        select: { name: true, slug: true },
      });
      const projectName = project?.name ?? "an IT CRM project";
      const projectHref = project?.slug
        ? `/it-crm/${project.slug}?task=${payload.taskId}`
        : `/it-crm`;
      await sendEmail({
        to: payload.recipientEmails,
        templateId: "it-crm-task-status-updated",
        variables: {
          taskTitle: payload.taskTitle,
          projectName,
          previousStatus: statusLabel(payload.previousStatus),
          nextStatus: statusLabel(payload.nextStatus),
          portalUrl: `${PORTAL_URL}${projectHref}`,
        },
      });
    } catch (err) {
      logger.error("Failed to send IT CRM task-status notification", { err });
    }
  }

  async deleteTask(
    projectId: string,
    taskId: string,
    userId: string,
    perms: string[],
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.itProjectTask.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    await prisma.itProjectTask.delete({ where: { id: taskId } });
    return { success: true };
  }

  // ─── Columns ──────────────────────────────────────────────────

  async createColumn(
    projectId: string,
    userId: string,
    perms: string[],
    input: CreateItProjectColumnInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    return prisma.itProjectColumn.create({
      data: {
        projectId,
        key: input.key,
        label: input.label,
        color: input.color ?? "bg-zinc-500",
        sortOrder: input.sortOrder,
      },
    });
  }

  async updateColumn(
    projectId: string,
    columnId: string,
    userId: string,
    perms: string[],
    input: UpdateItProjectColumnInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.itProjectColumn.findUnique({
      where: { id: columnId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Column not found");
    }
    return prisma.itProjectColumn.update({
      where: { id: columnId },
      data: {
        ...(input.label !== undefined && { label: input.label }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      },
    });
  }

  async deleteColumn(
    projectId: string,
    columnId: string,
    userId: string,
    perms: string[],
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.itProjectColumn.findUnique({
      where: { id: columnId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Column not found");
    }
    await prisma.itProjectColumn.delete({ where: { id: columnId } });
    return { success: true };
  }

  // ─── Members ──────────────────────────────────────────────────

  async listMembers(projectId: string, userId: string, perms: string[]) {
    await requireMembership(projectId, userId, perms);
    return prisma.itProjectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async setMembers(
    projectId: string,
    userId: string,
    perms: string[],
    input: ManageItProjectMembersInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const targetIds = new Set(input.userIds);
    return prisma.$transaction(async (tx) => {
      const current = await tx.itProjectMember.findMany({
        where: { projectId },
        select: { userId: true },
      });
      const currentIds = new Set(current.map((m) => m.userId));
      const toAdd = [...targetIds].filter((id) => !currentIds.has(id));
      const toRemove = [...currentIds].filter((id) => !targetIds.has(id));
      if (toRemove.length > 0) {
        await tx.itProjectMember.deleteMany({
          where: { projectId, userId: { in: toRemove } },
        });
      }
      if (toAdd.length > 0) {
        await tx.itProjectMember.createMany({
          data: toAdd.map((uid) => ({ projectId, userId: uid })),
          skipDuplicates: true,
        });
      }
      return tx.itProjectMember.findMany({
        where: { projectId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      });
    });
  }

  // ─── Comments ─────────────────────────────────────────────────

  async createTaskComment(
    projectId: string,
    taskId: string,
    userId: string,
    perms: string[],
    input: CreateItProjectTaskCommentInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.itProjectTask.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    return prisma.itProjectTaskComment.create({
      data: { taskId, authorId: userId, body: input.body },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // ─── Assignees ────────────────────────────────────────────────

  async setTaskAssignees(
    projectId: string,
    taskId: string,
    userId: string,
    perms: string[],
    input: ManageItProjectTaskAssigneesInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.itProjectTask.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    return prisma.$transaction(async (tx) => {
      await tx.itProjectTaskAssignee.deleteMany({ where: { taskId } });
      if (input.assignees.length > 0) {
        await tx.itProjectTaskAssignee.createMany({
          data: input.assignees.map((a) => ({
            taskId,
            userId: a.userId,
            allocationPct: a.allocationPct ?? null,
          })),
          skipDuplicates: true,
        });
      }
      return tx.itProjectTaskAssignee.findMany({
        where: { taskId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    });
  }
}

export const itCrmService = new ItCrmService();
