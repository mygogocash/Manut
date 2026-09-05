import type {
  CreateExchangeRateInput,
  ListExchangeRatesQuery,
  UpdateExchangeRateInput,
} from "@nexora/contracts/modules/exchange-rates/exchange-rates.validation";
import type { Db } from "@nexora/db";
import { ConflictException, NotFoundException } from "../http-exception";
import { syncBotRates, type BotFxEnv } from "./bot-fx.service";
import * as repo from "./exchange-rates.repository";

export async function list(db: Db, query: ListExchangeRatesQuery) {
  const rows = await repo.findMany(db, {
    baseCurrency: query.baseCurrency,
    currency: query.currency,
  });
  if (!query.latestOnly) return { data: rows };
  const seen = new Set<string>();
  const latest = [] as typeof rows;
  for (const r of rows) {
    const key = `${r.baseCurrency}-${r.currency}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(r);
  }
  return { data: latest };
}

export async function create(db: Db, input: CreateExchangeRateInput) {
  const dup = await repo.findByPairDate(
    db,
    input.baseCurrency,
    input.currency,
    input.effectiveDate,
  );
  if (dup) {
    throw new ConflictException(
      `A rate for ${input.baseCurrency} → ${input.currency} on ${input.effectiveDate} already exists.`,
    );
  }
  return repo.create(db, {
    baseCurrency: input.baseCurrency,
    currency: input.currency,
    rate: input.rate,
    effectiveDate: input.effectiveDate,
    source: input.source ?? "manual",
  });
}

export async function update(db: Db, id: string, input: UpdateExchangeRateInput) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Exchange rate not found");
  return repo.update(db, id, {
    ...(input.rate !== undefined && { rate: input.rate }),
    ...(input.source !== undefined && { source: input.source }),
  });
}

export async function remove(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Exchange rate not found");
  await repo.remove(db, id);
}

export { syncBotRates, type BotFxEnv };
