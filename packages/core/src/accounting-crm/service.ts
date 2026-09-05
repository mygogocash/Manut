import { PERMISSIONS } from "@nexora/contracts";
import type {
  CreateAccountingProjectInput,
  AccountingProjectQuery,
  ReorderAccountingProjectsInput,
  UpdateAccountingProjectInput,
} from "@nexora/contracts/modules/accounting-crm/accounting-crm.validation";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { and, asc, count, desc, eq, exists, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { NotFoundException } from "../http-exception";
import { createCuid } from "../lib/id";
import { getSetting, upsertSetting } from "../survey/system-settings.repository";
import { requireMembership, requireOwnerOrManage } from "./access";

import { DEFAULT_COLUMNS } from "./repository";

const projects = schema.accountingProjects;
const members = schema.accountingProjectMembers;
const columns = schema.accountingProjectColumns;
const owner = alias(schema.users, "accounting_crm_owner");

function nowIso() {
  return new Date().toISOString();
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

async function uniqueSlug(db: Db, base: string): Promise<string> {
  let slug = base;
  let counter = 0;
  while (true) {
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);
    if (!existing) return slug;
    counter += 1;
    slug = `${base}-${counter}`;
  }
}

function optionalDate(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return v;
}

function ownerRow(r: {
  project: typeof projects.$inferSelect;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
}) {
  return {
    ...r.project,
    owner: { id: r.ownerId, name: r.ownerName, email: r.ownerEmail },
  };
}

export async function list(db: Db, userId: string, perms: string[], query: AccountingProjectQuery) {
  const canSeeAll =
    perms.includes(PERMISSIONS.ACCOUNTING_CRM_READ_ALL) ||
    perms.includes(PERMISSIONS.PROJECTS_READ_ALL);

  const parts = [];
  if (query.search?.trim()) {
    const q = `%${query.search.trim()}%`;
    parts.push(or(ilike(projects.name, q), ilike(projects.slug, q)));
  }
  if (query.status) parts.push(eq(projects.status, query.status));
  if (query.department) parts.push(eq(projects.department, query.department));
  parts.push(query.archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt));

  if (!canSeeAll) {
    parts.push(
      or(
        eq(projects.ownerId, userId),
        exists(
          db
            .select({ x: sql`1` })
            .from(members)
            .where(and(eq(members.projectId, projects.id), eq(members.userId, userId))),
        ),
      )!,
    );
  }

  const where = parts.length ? and(...parts) : undefined;
  const offset = (query.page - 1) * query.limit;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        project: projects,
        ownerId: owner.id,
        ownerName: owner.name,
        ownerEmail: owner.email,
      })
      .from(projects)
      .innerJoin(owner, eq(projects.ownerId, owner.id))
      .where(where)
      .orderBy(asc(projects.sortOrder), desc(projects.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ c: count() }).from(projects).where(where),
  ]);

  const total = Number(totalRow[0]?.c ?? 0);
  return {
    data: rows.map(ownerRow),
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) || 1 },
  };
}

export async function create(db: Db, userId: string, input: CreateAccountingProjectInput) {
  const slug = await uniqueSlug(db, generateSlug(input.name));
  const ownerId = input.ownerId ?? userId;
  const id = createCuid();
  const ts = nowIso();

  await db.transaction(async (tx) => {
    await tx.insert(projects).values({
      id,
      name: input.name,
      slug,
      description: input.description ?? null,
      status: input.status,
      ownerId,
      startDate: optionalDate(input.startDate) ?? null,
      endDate: optionalDate(input.endDate) ?? null,
      productionLiveDate: optionalDate(input.productionLiveDate) ?? null,
      goLiveDate: optionalDate(input.goLiveDate) ?? null,
      revisedGoLiveDate: optionalDate(input.revisedGoLiveDate) ?? null,
      dependency: input.dependency ?? null,
      comment: input.comment ?? null,
      department: input.department ?? null,      defaultAssigneeMode: input.defaultAssigneeMode,
      defaultAssigneeId:
        input.defaultAssigneeMode === "user" ? (input.defaultAssigneeId ?? null) : null,
      sortOrder: input.sortOrder,
      createdAt: ts,
      updatedAt: ts,
    });

    await tx.insert(columns).values(
      DEFAULT_COLUMNS.map((c) => ({
        id: crypto.randomUUID(),
        projectId: id,
        key: c.key,
        label: c.label,
        color: c.color,
        sortOrder: c.sortOrder,
      })),
    );

    await tx.insert(members).values({
      id: crypto.randomUUID(),
      projectId: id,
      userId: ownerId,
      role: "owner",
      createdAt: ts,
    });
  });

  return getById(db, id, userId, [PERMISSIONS.ACCOUNTING_CRM_READ]);
}

export async function importRows(db: Db, userId: string, rows: CreateAccountingProjectInput[]) {
  let created = 0;
  for (const row of rows) {
    await create(db, userId, row);
    created += 1;
  }
  return { created };
}

export async function getById(db: Db, id: string, userId: string, perms: string[]) {
  const { role } = await requireMembership(db, id, userId, perms);
  const [r] = await db
    .select({
      project: projects,
      ownerId: owner.id,
      ownerName: owner.name,
      ownerEmail: owner.email,
    })
    .from(projects)
    .innerJoin(owner, eq(projects.ownerId, owner.id))
    .where(or(eq(projects.id, id), eq(projects.slug, id)))
    .limit(1);
  if (!r) throw new NotFoundException("Project not found");
  return { ...ownerRow(r), role };
}

export async function update(
  db: Db,
  id: string,
  userId: string,
  perms: string[],
  input: UpdateAccountingProjectInput,
) {
  const { projectId, role } = await requireMembership(db, id, userId, perms);
  requireOwnerOrManage(role, perms);

  const [existing] = await db
    .select({ name: projects.name, status: projects.status })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!existing) throw new NotFoundException("Project not found");

  const patch: Partial<typeof projects.$inferInsert> = { updatedAt: nowIso() };
  if (input.name !== undefined && input.name !== existing.name) {
    patch.name = input.name;
    patch.slug = await uniqueSlug(db, generateSlug(input.name));
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;  if (input.ownerId !== undefined) patch.ownerId = input.ownerId;
  if (input.startDate !== undefined) patch.startDate = optionalDate(input.startDate) ?? null;
  if (input.endDate !== undefined) patch.endDate = optionalDate(input.endDate) ?? null;
  if (input.productionLiveDate !== undefined) {
    patch.productionLiveDate = optionalDate(input.productionLiveDate) ?? null;
  }
  if (input.goLiveDate !== undefined) patch.goLiveDate = optionalDate(input.goLiveDate) ?? null;
  if (input.revisedGoLiveDate !== undefined) {
    patch.revisedGoLiveDate = optionalDate(input.revisedGoLiveDate) ?? null;
  }
  if (input.dependency !== undefined) patch.dependency = input.dependency;
  if (input.comment !== undefined) patch.comment = input.comment;
  if (input.department !== undefined) patch.department = input.department;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  if (input.defaultAssigneeMode !== undefined) {
    patch.defaultAssigneeMode = input.defaultAssigneeMode;
    patch.defaultAssigneeId =
      input.defaultAssigneeMode === "user" ? (input.defaultAssigneeId ?? null) : null;
  } else if (input.defaultAssigneeId !== undefined) {
    patch.defaultAssigneeId = input.defaultAssigneeId;
  }
  if (input.workstream !== undefined) patch.workstream = input.workstream;
  if (input.details !== undefined) patch.details = input.details;
  if (input.priority !== undefined) patch.priority = input.priority;

  await db.update(projects).set(patch).where(eq(projects.id, projectId));
  return getById(db, projectId, userId, perms);
}

export async function remove(db: Db, id: string, userId: string, perms: string[]) {
  const { projectId, role } = await requireMembership(db, id, userId, perms);
  requireOwnerOrManage(role, perms);
  await db.delete(projects).where(eq(projects.id, projectId));
  return { success: true };
}

export async function archive(db: Db, id: string, userId: string, perms: string[]) {
  const { projectId, role } = await requireMembership(db, id, userId, perms);
  requireOwnerOrManage(role, perms);
  const [existing] = await db
    .select({ archivedAt: projects.archivedAt })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!existing) throw new NotFoundException("Project not found");
  const ts = existing.archivedAt ?? nowIso();
  await db.update(projects).set({ archivedAt: ts, updatedAt: nowIso() }).where(eq(projects.id, projectId));
  return getById(db, projectId, userId, perms);
}

export async function unarchive(db: Db, id: string, userId: string, perms: string[]) {
  const { projectId, role } = await requireMembership(db, id, userId, perms);
  requireOwnerOrManage(role, perms);
  const [existing] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!existing) throw new NotFoundException("Project not found");
  await db.update(projects).set({ archivedAt: null, updatedAt: nowIso() }).where(eq(projects.id, projectId));
  return getById(db, projectId, userId, perms);
}

export async function reorder(db: Db, input: ReorderAccountingProjectsInput) {
  const ts = nowIso();
  await db.transaction(async (tx) => {
    for (let i = 0; i < input.orderedIds.length; i += 1) {
      await tx.update(projects).set({ sortOrder: i, updatedAt: ts }).where(eq(projects.id, input.orderedIds[i]!));
    }
  });
  return { success: true };
}

export async function getReminderRecipients(db: Db) {
  const value = await getSetting(db, "accounting-crm.reminder_recipients");
  const raw =
    value && typeof value === "object" && Array.isArray((value as { recipients?: unknown }).recipients)
      ? (value as { recipients: unknown[] }).recipients.filter((x): x is string => typeof x === "string")
      : [];
  return { recipients: [...new Set(raw.map((e) => e.trim().toLowerCase()).filter(Boolean))] };
}

export async function setReminderRecipients(db: Db, input: { recipients: string[] }) {
  const recipients = input.recipients.map((e) => e.trim().toLowerCase()).filter(Boolean);
  await upsertSetting(db, "accounting-crm.reminder_recipients", { recipients: [...new Set(recipients)] });
  return getReminderRecipients(db);
}

export async function dashboard(db: Db) {
  const [totalRow] = await db.select({ c: count() }).from(projects);
  return { summary: { totalProjects: Number(totalRow?.c ?? 0) }, exhibits: [] };
}
