import type { Db } from "@nexora/db";
import { normaliseCurrencyCode } from "@nexora/utils";
import { findRate } from "../exchange-rates/exchange-rates.repository";

export interface FxLookupResult {
  rate: number;
  source: "direct" | "inverse" | "triangulated" | "missing";
  bridge?: string;
}

const BRIDGE_CURRENCIES = ["USD", "THB", "EUR"] as const;

function asOfKey(asOf?: Date): string {
  return asOf ? asOf.toISOString().slice(0, 10) : "latest";
}

async function resolveDirectOrInverse(
  db: Db,
  from: string,
  to: string,
  asOf: Date | undefined,
): Promise<number | null> {
  if (from === to) return 1;
  const direct = await findRate(db, from, to, asOf);
  if (direct !== null) return direct;
  const inverse = await findRate(db, to, from, asOf);
  if (inverse !== null) return 1 / inverse;
  return null;
}

async function resolveRateInternal(
  db: Db,
  from: string,
  to: string,
  asOf: Date | undefined,
  cache: Map<string, FxLookupResult>,
  visited: Set<string>,
): Promise<FxLookupResult> {
  const key = `${from}-${to}-${asOfKey(asOf)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (visited.has(key)) {
    return { rate: 0, source: "missing" };
  }
  visited.add(key);

  if (from === to) {
    const result: FxLookupResult = { rate: 1, source: "direct" };
    cache.set(key, result);
    return result;
  }

  const direct = await findRate(db, from, to, asOf);
  if (direct !== null) {
    const result: FxLookupResult = { rate: direct, source: "direct" };
    cache.set(key, result);
    return result;
  }

  const inverse = await findRate(db, to, from, asOf);
  if (inverse !== null) {
    const result: FxLookupResult = { rate: 1 / inverse, source: "inverse" };
    cache.set(key, result);
    return result;
  }

  for (const bridge of BRIDGE_CURRENCIES) {
    if (bridge === from || bridge === to) continue;
    const leg1 = await resolveDirectOrInverse(db, from, bridge, asOf);
    if (leg1 === null) continue;
    const leg2 = await resolveDirectOrInverse(db, bridge, to, asOf);
    if (leg2 === null) continue;
    const result: FxLookupResult = {
      rate: leg1 * leg2,
      source: "triangulated",
      bridge,
    };
    cache.set(key, result);
    return result;
  }

  const missing: FxLookupResult = { rate: 0, source: "missing" };
  cache.set(key, missing);
  return missing;
}

export async function resolveRate(
  db: Db,
  from: string,
  to: string,
  asOf?: Date,
): Promise<FxLookupResult> {
  const cache = new Map<string, FxLookupResult>();
  return resolveRateInternal(
    db,
    normaliseCurrencyCode(from),
    normaliseCurrencyCode(to),
    asOf,
    cache,
    new Set(),
  );
}
