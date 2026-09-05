import { and, eq } from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import { BadRequestException } from "../http-exception";

type DbLike = Db | DbTransaction;

export function utcYearMonth(date: Date | string): { year: number; month: number } {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00.000Z`) : new Date(date);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function firstDayOfUtcMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

export async function isPostingPeriodClosed(
  db: DbLike,
  entityId: string,
  date: Date | string,
): Promise<boolean> {
  const { year, month } = utcYearMonth(date);
  const [period] = await db
    .select({ status: schema.fiscalPeriods.status })
    .from(schema.fiscalPeriods)
    .where(
      and(
        eq(schema.fiscalPeriods.entityId, entityId),
        eq(schema.fiscalPeriods.year, year),
        eq(schema.fiscalPeriods.month, month),
      ),
    )
    .limit(1);
  return period?.status === "closed";
}

export async function assertPostingPeriodOpen(
  db: DbLike,
  entityId: string,
  date: Date | string,
): Promise<void> {
  const { year, month } = utcYearMonth(date);
  const closed = await isPostingPeriodClosed(db, entityId, date);
  if (closed) {
    throw new BadRequestException(
      `Fiscal period ${year}-${String(month).padStart(2, "0")} is closed; ` +
        `postings dated into it are not allowed.`,
    );
  }
}
