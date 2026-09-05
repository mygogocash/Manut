import { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

export type AccountingFxSide = "buying" | "selling";

export type AccountingFxSource =
  "spot" | "previous" | "expense-average" | "identity";

export interface AccountingFxQuote {
  rate: Prisma.Decimal;
  rateDate: string;
  side: AccountingFxSide;
  source: AccountingFxSource;
}

/** BOT buying for AR/revenue (and AR revaluation); selling for AP/expense. */
export function accountingFxSide(documentType: string): AccountingFxSide {
  return documentType === "payable" ? "selling" : "buying";
}

export async function resolveAccountingFx(
  currency: string,
  date: Date,
  side: AccountingFxSide,
  deps: {
    findRate?: (
      ccy: string,
      on: Date,
    ) => Promise<{
      buyingRate: Prisma.Decimal;
      sellingRate: Prisma.Decimal;
      effectiveDate: Date;
    } | null>;
    findPrevious?: (
      ccy: string,
      before: Date,
    ) => Promise<{
      buyingRate: Prisma.Decimal;
      sellingRate: Prisma.Decimal;
      effectiveDate: Date;
    } | null>;
    findExpenseAverage?: (
      ccy: string,
      on: Date,
    ) => Promise<{
      rate: Prisma.Decimal;
      rateDate: Date;
    } | null>;
  } = {},
): Promise<AccountingFxQuote> {
  const ccy = currency.toUpperCase();
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const findRate =
    deps.findRate ??
    (async (code, on) =>
      prisma.accountingFxRate.findUnique({
        where: {
          currency_effectiveDate: { currency: code, effectiveDate: on },
        },
        select: {
          buyingRate: true,
          sellingRate: true,
          effectiveDate: true,
        },
      }));
  const findPrevious =
    deps.findPrevious ??
    (async (code, before) =>
      prisma.accountingFxRate.findFirst({
        where: { currency: code, effectiveDate: { lt: before } },
        orderBy: { effectiveDate: "desc" },
        select: {
          buyingRate: true,
          sellingRate: true,
          effectiveDate: true,
        },
      }));

  const spot = await findRate(ccy, day);
  if (spot) {
    return {
      rate: side === "buying" ? spot.buyingRate : spot.sellingRate,
      rateDate: spot.effectiveDate.toISOString().slice(0, 10),
      side,
      source: "spot",
    };
  }
  const previous = await findPrevious(ccy, day);
  if (previous) {
    return {
      rate: side === "buying" ? previous.buyingRate : previous.sellingRate,
      rateDate: previous.effectiveDate.toISOString().slice(0, 10),
      side,
      source: "previous",
    };
  }

  const avg = deps.findExpenseAverage
    ? await deps.findExpenseAverage(ccy, day)
    : null;
  if (avg) {
    return {
      rate: avg.rate,
      rateDate: avg.rateDate.toISOString().slice(0, 10),
      side,
      source: "expense-average",
    };
  }
  return {
    rate: new Prisma.Decimal(1),
    rateDate: day.toISOString().slice(0, 10),
    side,
    source: "identity",
  };
}

export interface AccountingFxMidRow {
  currency: string;
  effectiveDate: Date;
  rate: Prisma.Decimal;
  source: string;
}

export interface AccountingFxUpsertRow {
  currency: string;
  effectiveDate: Date;
  buyingRate: Prisma.Decimal;
  sellingRate: Prisma.Decimal;
  source: string;
}

/**
 * Populate AccountingFxRate. Prefers BOT buying/selling when the cron
 * passes `listSideRates`; otherwise copies ExchangeRate mid to both sides.
 * Does not write ExchangeRate.
 */
export async function syncAccountingFxRates(
  deps: {
    listMidRates?: () => Promise<AccountingFxMidRow[]>;
    listSideRates?: () => Promise<AccountingFxUpsertRow[]>;
    upsert?: (row: AccountingFxUpsertRow) => Promise<void>;
  } = {},
): Promise<{ upserted: number }> {
  const listMidRates =
    deps.listMidRates ??
    (async () => {
      const end = new Date();
      const start = new Date(
        Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
      );
      start.setUTCDate(start.getUTCDate() - 10);
      const rows = await prisma.exchangeRate.findMany({
        where: {
          currency: "THB",
          effectiveDate: { gte: start },
        },
        select: {
          baseCurrency: true,
          effectiveDate: true,
          rate: true,
          source: true,
        },
      });
      return rows.map((row) => ({
        currency: row.baseCurrency,
        effectiveDate: row.effectiveDate,
        rate: row.rate,
        source: row.source ?? "bot",
      }));
    });
  const upsert =
    deps.upsert ??
    (async (row) => {
      await prisma.accountingFxRate.upsert({
        where: {
          currency_effectiveDate: {
            currency: row.currency,
            effectiveDate: row.effectiveDate,
          },
        },
        create: {
          currency: row.currency,
          effectiveDate: row.effectiveDate,
          buyingRate: row.buyingRate,
          sellingRate: row.sellingRate,
          source: row.source,
        },
        update: {
          buyingRate: row.buyingRate,
          sellingRate: row.sellingRate,
          source: row.source,
        },
      });
    });

  const sideRows = deps.listSideRates ? await deps.listSideRates() : [];
  const rows =
    sideRows.length > 0
      ? sideRows
      : (await listMidRates()).map((row) => ({
          currency: row.currency,
          effectiveDate: row.effectiveDate,
          buyingRate: row.rate,
          sellingRate: row.rate,
          source: row.source,
        }));
  let upserted = 0;
  for (const row of rows) {
    const currency = row.currency.toUpperCase();
    if (currency === "THB") continue;
    const buying = new Prisma.Decimal(row.buyingRate);
    const selling = new Prisma.Decimal(row.sellingRate);
    if (
      !buying.isFinite() ||
      buying.lte(0) ||
      !selling.isFinite() ||
      selling.lte(0)
    ) {
      continue;
    }
    const effectiveDate = new Date(
      Date.UTC(
        row.effectiveDate.getUTCFullYear(),
        row.effectiveDate.getUTCMonth(),
        row.effectiveDate.getUTCDate(),
      ),
    );
    await upsert({
      currency,
      effectiveDate,
      buyingRate: buying,
      sellingRate: selling,
      source: row.source || "bot",
    });
    upserted += 1;
  }
  return { upserted };
}
