import { desc, eq, gte, lte, and } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

export async function recentMetrics(db: Db, from: string, to: string, telco?: string) {
  const conditions = [gte(schema.owDailyMetrics.date, from), lte(schema.owDailyMetrics.date, to)];
  if (telco) conditions.push(eq(schema.owDailyMetrics.telco, telco));
  return db
    .select({
      date: schema.owDailyMetrics.date,
      telco: schema.owDailyMetrics.telco,
      dauGa: schema.owDailyMetrics.dauGa,
      mauRolling30: schema.owDailyMetrics.mauRolling30,
      homepageViews: schema.owDailyMetrics.homepageViews,
      isIntraday: schema.owDailyMetrics.isIntraday,
    })
    .from(schema.owDailyMetrics)
    .where(and(...conditions))
    .orderBy(desc(schema.owDailyMetrics.date), schema.owDailyMetrics.telco);
}

export async function listTelcos(db: Db) {
  const rows = await db
    .selectDistinct({ telco: schema.owDailyMetrics.telco })
    .from(schema.owDailyMetrics)
    .orderBy(schema.owDailyMetrics.telco);
  return rows.map((r) => r.telco);
}
