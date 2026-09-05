import type { Db } from "@nexora/db";
import * as ratesRepo from "../exchange-rates/exchange-rates.repository";

export type FxLookup = { rate: number; source: "direct" | "inverse" | "missing" };

export async function resolveRate(db: Db, from: string, to: string): Promise<FxLookup> {
  const base = from.toUpperCase();
  const quote = to.toUpperCase();
  if (base === quote) return { rate: 1, source: "direct" };

  const direct = await ratesRepo.findRate(db, base, quote);
  if (direct != null) return { rate: direct, source: "direct" };

  const inverse = await ratesRepo.findRate(db, quote, base);
  if (inverse != null && inverse !== 0) return { rate: 1 / inverse, source: "inverse" };

  return { rate: 0, source: "missing" };
}
