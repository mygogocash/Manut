import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

export async function findMany(
  db: Db,
  filters: { baseCurrency?: string; currency?: string },
) {
  const parts = [];
  if (filters.baseCurrency) parts.push(eq(schema.exchangeRates.baseCurrency, filters.baseCurrency));
  if (filters.currency) parts.push(eq(schema.exchangeRates.currency, filters.currency));
  const where = parts.length ? and(...parts) : undefined;
  return db
    .select()
    .from(schema.exchangeRates)
    .where(where)
    .orderBy(
      asc(schema.exchangeRates.baseCurrency),
      asc(schema.exchangeRates.currency),
      desc(schema.exchangeRates.effectiveDate),
    );
}

export async function findById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.exchangeRates)
    .where(eq(schema.exchangeRates.id, id))
    .limit(1);
  return row ?? null;
}

export async function findByPairDate(
  db: Db,
  baseCurrency: string,
  currency: string,
  effectiveDate: string,
) {
  const [row] = await db
    .select()
    .from(schema.exchangeRates)
    .where(
      and(
        eq(schema.exchangeRates.baseCurrency, baseCurrency),
        eq(schema.exchangeRates.currency, currency),
        eq(schema.exchangeRates.effectiveDate, effectiveDate),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findRate(
  db: Db,
  baseCurrency: string,
  currency: string,
  asOf?: Date,
) {
  if (asOf) {
    const asOfStr = asOf.toISOString().slice(0, 10);
    const [dated] = await db
      .select({ rate: schema.exchangeRates.rate })
      .from(schema.exchangeRates)
      .where(
        and(
          eq(schema.exchangeRates.baseCurrency, baseCurrency),
          eq(schema.exchangeRates.currency, currency),
          lte(schema.exchangeRates.effectiveDate, asOfStr),
        ),
      )
      .orderBy(desc(schema.exchangeRates.effectiveDate))
      .limit(1);
    if (dated) return Number(dated.rate);
  }
  const [latest] = await db
    .select({ rate: schema.exchangeRates.rate })
    .from(schema.exchangeRates)
    .where(
      and(
        eq(schema.exchangeRates.baseCurrency, baseCurrency),
        eq(schema.exchangeRates.currency, currency),
      ),
    )
    .orderBy(desc(schema.exchangeRates.effectiveDate))
    .limit(1);
  return latest ? Number(latest.rate) : null;
}

export async function create(
  db: Db,
  data: {
    baseCurrency: string;
    currency: string;
    rate: number;
    effectiveDate: string;
    source?: string | null;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.exchangeRates).values({
    id,
    baseCurrency: data.baseCurrency,
    currency: data.currency,
    rate: String(data.rate),
    effectiveDate: data.effectiveDate,
    source: data.source ?? "manual",
    createdAt: now,
  });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  data: { rate?: number; source?: string | null },
) {
  const patch: Record<string, string | null> = {};
  if (data.rate !== undefined) patch.rate = String(data.rate);
  if (data.source !== undefined) patch.source = data.source;
  if (Object.keys(patch).length > 0) {
    await db.update(schema.exchangeRates).set(patch).where(eq(schema.exchangeRates.id, id));
  }
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.exchangeRates).where(eq(schema.exchangeRates.id, id));
}

export async function upsertSyncedRate(
  db: Db,
  input: {
    currency: string;
    rate: number;
    effectiveDate: string;
    source: "bot" | "fallback";
  },
) {
  const key = {
    baseCurrency: input.currency,
    currency: "THB",
    effectiveDate: input.effectiveDate,
  };
  const existing = await findByPairDate(db, key.baseCurrency, key.currency, key.effectiveDate);
  if (existing?.source && !["bot", "fallback"].includes(existing.source)) {
    return { written: false as const, keptSource: existing.source };
  }
  const id = existing?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .insert(schema.exchangeRates)
    .values({
      id,
      ...key,
      rate: String(input.rate),
      source: input.source,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.exchangeRates.baseCurrency,
        schema.exchangeRates.currency,
        schema.exchangeRates.effectiveDate,
      ],
      set: { rate: String(input.rate), source: input.source },
    });
  return { written: true as const };
}

export async function distinctExpenseCurrencies(db: Db) {
  const rows = await db
    .selectDistinct({ currency: schema.expenses.currency })
    .from(schema.expenses);
  return rows.map((r) => r.currency).filter(Boolean);
}
