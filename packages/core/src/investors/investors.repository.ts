import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { INVESTOR_TAG_UNTAGGED } from "@nexora/contracts/modules/investor-tags/investor-tags.validation";
import { createCuid } from "../lib/id";
import { parseInvestmentAmount } from "./investment-amount";

export interface InvestorFilters {
  search?: string;
  status?: string;
  statusIn?: string[];
  type?: string;
  addedBy?: string;
  fundraisingEntity?: string;
  archived?: boolean;
  tag?: string;
  ids?: string[];
  ownerScope?: string[];
}

const SORTABLE: Record<string, keyof typeof schema.investors.$inferSelect> = {
  name: "name",
  type: "type",
  status: "status",
  contact: "contactName",
  contactName: "contactName",
  location: "location",
  region: "region",
  title: "title",
  revenueStream: "revenueStream",
  lastContact: "lastContactDate",
  lastContactDate: "lastContactDate",
  nextAction: "nextAction",
  actInvestment: "actInvestment",
  estInvestment: "estInvestment",
  crossSell: "crossSell",
  createdAt: "createdAt",
};

export function buildInvestorWhere(filters: InvestorFilters): SQL | undefined {
  const parts: SQL[] = [];

  if (filters.ids !== undefined) {
    if (filters.ids.length === 0) parts.push(sql`false`);
    else parts.push(inArray(schema.investors.id, filters.ids));
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    parts.push(
      or(
        ilike(schema.investors.name, term),
        ilike(schema.investors.contactName, term),
        ilike(schema.investors.contactEmail, term),
      )!,
    );
  }

  if (filters.type) parts.push(eq(schema.investors.type, filters.type));
  if (filters.statusIn && filters.statusIn.length > 0) {
    parts.push(inArray(schema.investors.status, filters.statusIn));
  } else if (filters.status) {
    parts.push(eq(schema.investors.status, filters.status));
  }
  if (filters.addedBy) parts.push(eq(schema.investors.addedBy, filters.addedBy));
  if (filters.ownerScope?.length) {
    parts.push(inArray(schema.investors.addedBy, filters.ownerScope));
  }
  if (filters.fundraisingEntity) {
    parts.push(eq(schema.investors.fundraisingEntity, filters.fundraisingEntity));
  }
  if (filters.archived !== undefined) {
    parts.push(
      filters.archived
        ? isNotNull(schema.investors.archivedAt)
        : isNull(schema.investors.archivedAt),
    );
  }
  if (filters.tag) {
    parts.push(
      filters.tag === INVESTOR_TAG_UNTAGGED
        ? sql`cardinality(${schema.investors.tags}) = 0`
        : sql`${filters.tag} = ANY(${schema.investors.tags})`,
    );
  }

  return parts.length ? and(...parts) : undefined;
}

async function withAdder(db: Db, row: typeof schema.investors.$inferSelect) {
  const [adder] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.users)
    .where(eq(schema.users.id, row.addedBy))
    .limit(1);
  return { ...row, adder: adder ?? null };
}

export async function findMany(
  db: Db,
  filters: InvestorFilters,
  page: number,
  limit: number,
  sortBy?: string,
  sortOrder?: "asc" | "desc",
) {
  const where = buildInvestorWhere(filters);
  const offset = (page - 1) * limit;
  const sortCol = sortBy && SORTABLE[sortBy] ? SORTABLE[sortBy] : null;
  const order =
    sortCol && sortOrder
      ? sortOrder === "desc"
        ? desc(schema.investors[sortCol])
        : asc(schema.investors[sortCol])
      : asc(schema.investors.sortOrder);

  const base = db.select().from(schema.investors);
  const rows = await (where ? base.where(where) : base)
    .orderBy(order, desc(schema.investors.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ n: count() })
    .from(schema.investors)
    .where(where ?? sql`true`);

  const data = await Promise.all(rows.map((r) => withAdder(db, r)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.investors).where(eq(schema.investors.id, id)).limit(1);
  return row ? withAdder(db, row) : null;
}

export async function create(
  db: Db,
  data: Omit<typeof schema.investors.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.investors).values({
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  data: Partial<typeof schema.investors.$inferInsert>,
) {
  const now = new Date().toISOString();
  await db
    .update(schema.investors)
    .set({ ...data, updatedAt: now })
    .where(eq(schema.investors.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.investors).where(eq(schema.investors.id, id));
}

export async function reorder(db: Db, orderedIds: string[]) {
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (let index = 0; index < orderedIds.length; index++) {
      await tx
        .update(schema.investors)
        .set({ sortOrder: index, updatedAt: now })
        .where(eq(schema.investors.id, orderedIds[index]!));
    }
  });
}

export async function pipelineTotals(db: Db, filters: InvestorFilters = {}) {
  const where = buildInvestorWhere({
    ...filters,
    archived: filters.archived ?? false,
  });
  const base = db
    .select({
      status: schema.investors.status,
      estInvestment: schema.investors.estInvestment,
      actInvestment: schema.investors.actInvestment,
    })
    .from(schema.investors);
  const rows = await (where ? base.where(where) : base);

  const totals: Record<string, { count: number; est: number; act: number }> = {};
  for (const row of rows) {
    const bucket = (totals[row.status] ??= { count: 0, est: 0, act: 0 });
    bucket.count += 1;
    bucket.est += parseInvestmentAmount(row.estInvestment);
    bucket.act += parseInvestmentAmount(row.actInvestment);
  }
  return totals;
}

export async function updateMany(
  db: Db,
  filters: InvestorFilters,
  data: Partial<typeof schema.investors.$inferInsert>,
) {
  const where = buildInvestorWhere(filters);
  const now = new Date().toISOString();
  const q = db
    .update(schema.investors)
    .set({ ...data, updatedAt: now })
    .returning({ id: schema.investors.id });
  const rows = await (where ? q.where(where) : q);
  return { count: rows.length };
}

export async function deleteMany(db: Db, filters: InvestorFilters) {
  const where = buildInvestorWhere(filters);
  const q = db.delete(schema.investors).returning({ id: schema.investors.id });
  const rows = await (where ? q.where(where) : q);
  return { count: rows.length };
}

export async function countMatching(db: Db, filters: InvestorFilters) {
  const where = buildInvestorWhere(filters);
  const [row] = await db
    .select({ n: count() })
    .from(schema.investors)
    .where(where ?? sql`true`);
  return Number(row?.n ?? 0);
}

export async function addTagCodes(db: Db, filters: InvestorFilters, codes: string[]) {
  const where = buildInvestorWhere(filters);
  const base = db.select({ id: schema.investors.id, tags: schema.investors.tags }).from(schema.investors);
  const rows = await (where ? base.where(where) : base);
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (const row of rows) {
      const tags = [...(row.tags ?? [])];
      for (const code of codes) {
        if (!tags.includes(code)) tags.push(code);
      }
      await tx
        .update(schema.investors)
        .set({ tags, updatedAt: now })
        .where(eq(schema.investors.id, row.id));
    }
  });
}
