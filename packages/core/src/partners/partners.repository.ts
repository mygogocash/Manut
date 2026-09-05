import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { createCuid } from "../lib/id";
import { buildPartnerSlug } from "./partner-slug";

const ownerUser = alias(schema.users, "partner_owner");
const taskOwner = alias(schema.users, "partner_task_owner");
const parentTask = alias(schema.partnerTasks, "partner_parent_task");

export type PartnerListFilters = {
  type?: string;
  status?: string;
  department?: string;
  search?: string;
};

function nowIso() {
  return new Date().toISOString();
}

async function attachCounts(db: Db, ids: string[]) {
  if (ids.length === 0) {
    return { projects: new Map<string, number>(), deals: new Map<string, number>() };
  }
  const [projectRows, dealRows] = await Promise.all([
    db
      .select({ partnerId: schema.projects.partnerId, n: count() })
      .from(schema.projects)
      .where(inArray(schema.projects.partnerId, ids))
      .groupBy(schema.projects.partnerId),
    db
      .select({ partnerId: schema.deals.partnerId, n: count() })
      .from(schema.deals)
      .where(inArray(schema.deals.partnerId, ids))
      .groupBy(schema.deals.partnerId),
  ]);
  return {
    projects: new Map(projectRows.map((r) => [r.partnerId!, Number(r.n)])),
    deals: new Map(dealRows.map((r) => [r.partnerId!, Number(r.n)])),
  };
}

function withCounts(
  partner: typeof schema.partners.$inferSelect,
  owner: { id: string; name: string; email: string } | null,
  counts: { projects: Map<string, number>; deals: Map<string, number> },
  contacts?: (typeof schema.partnerContacts.$inferSelect)[],
) {
  return {
    ...partner,
    owner,
    contacts,
    _count: {
      projects: counts.projects.get(partner.id) ?? 0,
      deals: counts.deals.get(partner.id) ?? 0,
    },
  };
}

async function loadContacts(db: Db, partnerId: string) {
  return db
    .select()
    .from(schema.partnerContacts)
    .where(eq(schema.partnerContacts.partnerId, partnerId))
    .orderBy(desc(schema.partnerContacts.isPrimary), asc(schema.partnerContacts.name));
}

export async function findMany(db: Db, filters: PartnerListFilters, page: number, limit: number) {
  const parts = [];
  if (filters.type) parts.push(eq(schema.partners.type, filters.type));
  if (filters.status) parts.push(eq(schema.partners.status, filters.status));
  if (filters.department) parts.push(eq(schema.partners.department, filters.department));
  if (filters.search?.trim()) {
    parts.push(ilike(schema.partners.company, `%${filters.search.trim()}%`));
  }
  const where = parts.length ? and(...parts) : undefined;

  const [totalRow] = await db.select({ n: count() }).from(schema.partners).where(where);
  const total = Number(totalRow?.n ?? 0);

  const rows = await db
    .select({
      partner: schema.partners,
      ownerId: ownerUser.id,
      ownerName: ownerUser.name,
      ownerEmail: ownerUser.email,
    })
    .from(schema.partners)
    .leftJoin(ownerUser, eq(schema.partners.ownerId, ownerUser.id))
    .where(where)
    .orderBy(asc(schema.partners.sortOrder), desc(schema.partners.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const ids = rows.map((r) => r.partner.id);
  const counts = await attachCounts(db, ids);

  const data = rows.map((r) =>
    withCounts(
      r.partner,
      r.ownerId ? { id: r.ownerId, name: r.ownerName!, email: r.ownerEmail! } : null,
      counts,
    ),
  );

  return { data, total };
}

export async function findById(db: Db, id: string) {
  const [row] = await db
    .select({
      partner: schema.partners,
      ownerId: ownerUser.id,
      ownerName: ownerUser.name,
      ownerEmail: ownerUser.email,
    })
    .from(schema.partners)
    .leftJoin(ownerUser, eq(schema.partners.ownerId, ownerUser.id))
    .where(eq(schema.partners.id, id))
    .limit(1);
  if (!row) return null;

  const contacts = await loadContacts(db, id);
  const counts = await attachCounts(db, [id]);
  return withCounts(
    row.partner,
    row.ownerId ? { id: row.ownerId, name: row.ownerName!, email: row.ownerEmail! } : null,
    counts,
    contacts,
  );
}

export async function findByIdOrSlug(db: Db, idOrSlug: string) {
  const [row] = await db
    .select({
      partner: schema.partners,
      ownerId: ownerUser.id,
      ownerName: ownerUser.name,
      ownerEmail: ownerUser.email,
    })
    .from(schema.partners)
    .leftJoin(ownerUser, eq(schema.partners.ownerId, ownerUser.id))
    .where(or(eq(schema.partners.id, idOrSlug), eq(schema.partners.slug, idOrSlug)))
    .limit(1);
  if (!row) return null;

  const contacts = await loadContacts(db, row.partner.id);
  const counts = await attachCounts(db, [row.partner.id]);
  return withCounts(
    row.partner,
    row.ownerId ? { id: row.ownerId, name: row.ownerName!, email: row.ownerEmail! } : null,
    counts,
    contacts,
  );
}

export async function findTasksByPartnerIds(db: Db, partnerIds: string[]) {
  if (partnerIds.length === 0) return [];
  const rows = await db
    .select({
      task: schema.partnerTasks,
      partnerCompany: schema.partners.company,
      ownerId: taskOwner.id,
      ownerName: taskOwner.name,
      parentTitle: parentTask.title,
    })
    .from(schema.partnerTasks)
    .innerJoin(schema.partners, eq(schema.partnerTasks.partnerId, schema.partners.id))
    .leftJoin(taskOwner, eq(schema.partnerTasks.ownerId, taskOwner.id))
    .leftJoin(parentTask, eq(schema.partnerTasks.parentTaskId, parentTask.id))
    .where(inArray(schema.partnerTasks.partnerId, partnerIds))
    .orderBy(
      asc(schema.partnerTasks.partnerId),
      sql`${schema.partnerTasks.parentTaskId} asc nulls first`,
      asc(schema.partnerTasks.sortOrder),
    );

  return rows.map((r) => ({
    ...r.task,
    partner: { company: r.partnerCompany },
    owner: r.ownerId ? { id: r.ownerId, name: r.ownerName! } : null,
    parent: r.parentTitle ? { title: r.parentTitle } : null,
  }));
}

export async function createTaskRaw(
  db: Db,
  data: {
    partnerId: string;
    parentTaskId?: string | null;
    title: string;
    description?: string | null;
    status?: string;
    priority?: string;
    ownerId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    sortOrder?: number;
  },
) {
  const id = crypto.randomUUID();
  const now = nowIso();
  await db.insert(schema.partnerTasks).values({
    id,
    partnerId: data.partnerId,
    parentTaskId: data.parentTaskId ?? null,
    title: data.title,
    description: data.description ?? null,
    status: data.status ?? "todo",
    priority: data.priority ?? "medium",
    ownerId: data.ownerId ?? null,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    sortOrder: data.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  });
  const [row] = await db.select().from(schema.partnerTasks).where(eq(schema.partnerTasks.id, id)).limit(1);
  return row!;
}

export async function reorder(db: Db, ids: string[]) {
  const known = await db
    .select({ id: schema.partners.id })
    .from(schema.partners)
    .where(inArray(schema.partners.id, ids));
  const knownSet = new Set(known.map((p) => p.id));
  const filtered = ids.filter((id) => knownSet.has(id));
  const now = nowIso();

  await db.transaction(async (tx) => {
    for (let idx = 0; idx < filtered.length; idx++) {
      await tx
        .update(schema.partners)
        .set({ sortOrder: idx, updatedAt: now })
        .where(eq(schema.partners.id, filtered[idx]!));
    }
  });

  return filtered.map((id, idx) => ({ id, sortOrder: idx }));
}

type ContactInput = {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
};

export async function create(
  db: Db,
  data: Omit<typeof schema.partners.$inferInsert, "id" | "slug" | "createdAt" | "updatedAt"> & {
    contacts?: ContactInput[];
  },
) {
  const { contacts, ...partnerData } = data;
  const id = createCuid();
  const now = nowIso();

  return db.transaction(async (tx) => {
    await tx.insert(schema.partners).values({
      id,
      slug: `__pending_${crypto.randomUUID()}`,
      ...partnerData,
      createdAt: now,
      updatedAt: now,
    });

    if (contacts?.length) {
      await tx.insert(schema.partnerContacts).values(
        contacts.map((c) => ({
          id: crypto.randomUUID(),
          partnerId: id,
          name: c.name,
          title: c.title ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          isPrimary: c.isPrimary,
        })),
      );
    }

    await tx
      .update(schema.partners)
      .set({
        slug: buildPartnerSlug(partnerData.company, id),
        updatedAt: now,
      })
      .where(eq(schema.partners.id, id));

    return findById(tx as unknown as Db, id);
  });
}

export async function update(
  db: Db,
  id: string,
  data: Partial<typeof schema.partners.$inferInsert> & { contacts?: ContactInput[] },
) {
  const { contacts, ...partnerData } = data;
  const now = nowIso();

  return db.transaction(async (tx) => {
    if (contacts !== undefined) {
      await tx.delete(schema.partnerContacts).where(eq(schema.partnerContacts.partnerId, id));
      if (contacts.length) {
        await tx.insert(schema.partnerContacts).values(
          contacts.map((c) => ({
            id: crypto.randomUUID(),
            partnerId: id,
            name: c.name,
            title: c.title ?? null,
            email: c.email ?? null,
            phone: c.phone ?? null,
            isPrimary: c.isPrimary,
          })),
        );
      }
    }

    if (Object.keys(partnerData).length > 0) {
      await tx
        .update(schema.partners)
        .set({ ...partnerData, updatedAt: now })
        .where(eq(schema.partners.id, id));
    }

    return findById(tx as unknown as Db, id);
  });
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.partners).where(eq(schema.partners.id, id));
}

export async function findContacts(db: Db, partnerId: string) {
  return loadContacts(db, partnerId);
}

export async function findContactById(db: Db, contactId: string) {
  const [row] = await db
    .select()
    .from(schema.partnerContacts)
    .where(eq(schema.partnerContacts.id, contactId))
    .limit(1);
  return row ?? null;
}

export async function createContact(
  db: Db,
  partnerId: string,
  data: {
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    isPrimary: boolean;
  },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.partnerContacts).values({
    id,
    partnerId,
    name: data.name,
    title: data.role ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    isPrimary: data.isPrimary,
  });
  const [row] = await db.select().from(schema.partnerContacts).where(eq(schema.partnerContacts.id, id)).limit(1);
  return row!;
}

export async function updateContact(
  db: Db,
  contactId: string,
  data: Partial<{ name: string; email: string | null; phone: string | null; role: string | null; isPrimary: boolean }>,
) {
  const patch: Partial<typeof schema.partnerContacts.$inferInsert> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.email !== undefined) patch.email = data.email;
  if (data.phone !== undefined) patch.phone = data.phone;
  if (data.role !== undefined) patch.title = data.role;
  if (data.isPrimary !== undefined) patch.isPrimary = data.isPrimary;

  await db.update(schema.partnerContacts).set(patch).where(eq(schema.partnerContacts.id, contactId));
  const [row] = await db.select().from(schema.partnerContacts).where(eq(schema.partnerContacts.id, contactId)).limit(1);
  return row!;
}

export async function deleteContact(db: Db, contactId: string) {
  await db.delete(schema.partnerContacts).where(eq(schema.partnerContacts.id, contactId));
}
