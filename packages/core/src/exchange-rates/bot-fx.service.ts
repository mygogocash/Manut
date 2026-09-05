import { FX_DEFAULT_CURRENCY_CODES, normaliseCurrencyCode } from "@nexora/utils";
import type { Db } from "@nexora/db";
import * as repo from "./exchange-rates.repository";

const DEFAULT_BASE_URL = "https://gateway.api.bot.or.th/Stat-ExchangeRate/v2";
const DEFAULT_FALLBACK_BASE_URL = "https://open.er-api.com/v6/latest";
const DEFAULT_FALLBACK_KEYED_BASE_URL = "https://v6.exchangerate-api.com/v6";
const DEFAULT_CURRENCIES = [...FX_DEFAULT_CURRENCY_CODES];
const DEFAULT_UNITS: Record<string, number> = { IDR: 1000, JPY: 100, KRW: 100 };
const SYNC_OWNED_SOURCES = new Set(["bot", "fallback"]);

export type BotFxEnv = {
  BOT_API_CLIENT_ID?: string;
  BOT_API_BASE_URL?: string;
  BOT_FX_CURRENCIES?: string;
  BOT_FX_UNITS?: string;
  FX_FALLBACK_ENABLED?: string;
  FX_FALLBACK_API_KEY?: string;
  FX_FALLBACK_BASE_URL?: string;
};

export interface BotSyncResult {
  configured: boolean;
  synced: Array<{
    currency: string;
    rate: number;
    buyingRate: number;
    sellingRate: number;
    unit: number;
    period: string;
    source: string;
  }>;
  skipped: string[];
  preserved: Array<{ currency: string; source: string | null }>;
  errors: Array<{ currency: string; message: string }>;
}

function parseCsv(value: string | undefined, fallback: string[]): string[] {
  const raw = value?.trim();
  const list = raw ? raw.split(",") : fallback;
  return list.map((c) => c.trim().toUpperCase()).filter(Boolean);
}

function parseUnits(value: string | undefined): Record<string, number> {
  const units: Record<string, number> = { ...DEFAULT_UNITS };
  const raw = value?.trim();
  if (!raw) return units;
  for (const pair of raw.split(",")) {
    const [cur, div] = pair.split(":").map((s) => s.trim());
    const n = Number(div);
    if (cur && Number.isFinite(n) && n > 0) units[cur.toUpperCase()] = n;
  }
  return units;
}

function config(env: BotFxEnv = {}) {
  return {
    clientId: env.BOT_API_CLIENT_ID?.trim(),
    baseUrl: (env.BOT_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, ""),
    currencies: parseCsv(env.BOT_FX_CURRENCIES, DEFAULT_CURRENCIES),
    units: parseUnits(env.BOT_FX_UNITS),
    fallbackEnabled: env.FX_FALLBACK_ENABLED?.trim() !== "false",
    fallbackApiKey: env.FX_FALLBACK_API_KEY?.trim(),
    fallbackBaseUrl: (
      env.FX_FALLBACK_BASE_URL?.trim() ||
      (env.FX_FALLBACK_API_KEY?.trim() ? DEFAULT_FALLBACK_KEYED_BASE_URL : DEFAULT_FALLBACK_BASE_URL)
    ).replace(/\/$/, ""),
  };
}

interface BotDetail {
  period?: string;
  currency_id?: string;
  mid_rate?: string;
  buying_transfer?: string;
  buying_sight?: string;
  selling?: string;
}

function positiveRate(value?: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseBotQuote(detail: BotDetail) {
  const mid = positiveRate(detail.mid_rate);
  const buying =
    positiveRate(detail.buying_transfer) ?? positiveRate(detail.buying_sight) ?? mid;
  const selling = positiveRate(detail.selling) ?? mid;
  if (mid == null || buying == null || selling == null) return null;
  return { midRate: mid, buyingRate: buying, sellingRate: selling, period: detail.period ?? "" };
}

async function fetchLatestMidRate(
  baseUrl: string,
  clientId: string,
  currency: string,
  startPeriod: string,
  endPeriod: string,
) {
  const url =
    `${baseUrl}/DAILY_AVG_EXG_RATE/?currency=${encodeURIComponent(currency)}` +
    `&start_period=${startPeriod}&end_period=${endPeriod}`;
  const res = await fetch(url, {
    headers: {
      Authorization: clientId,
      "X-IBM-Client-Id": clientId,
      accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`BOT API ${res.status} ${res.statusText}`);
  const body = (await res.json()) as {
    result?: {
      success?: string;
      data?: { data_detail?: BotDetail[] };
      error?: { message?: string };
    };
  };
  if (body.result?.success === "false") {
    throw new Error(body.result.error?.message ?? "BOT API returned success=false");
  }
  const details = body.result?.data?.data_detail ?? [];
  let best: ReturnType<typeof parseBotQuote> = null;
  for (const detail of details) {
    const quote = parseBotQuote(detail);
    if (!quote) continue;
    const period = quote.period || endPeriod;
    if (!best || period >= best.period) best = { ...quote, period };
  }
  return best;
}

async function fetchFallbackThbRates(baseUrl: string, apiKey?: string) {
  const url = apiKey ? `${baseUrl}/${apiKey}/latest/THB` : `${baseUrl}/THB`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`FX fallback ${res.status} ${res.statusText}`);
  const body = (await res.json()) as {
    result?: string;
    rates?: Record<string, number>;
    conversion_rates?: Record<string, number>;
  };
  if (body.result !== "success") return null;
  return body.conversion_rates ?? body.rates ?? null;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isBotFxConfigured(env: BotFxEnv = {}): boolean {
  return Boolean(env.BOT_API_CLIENT_ID?.trim());
}

export async function syncBotRates(db: Db, env: BotFxEnv = {}): Promise<BotSyncResult> {
  const cfg = config(env);
  if (!cfg.clientId) {
    return { configured: false, synced: [], skipped: [], preserved: [], errors: [] };
  }

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 10);
  const startPeriod = ymd(start);
  const endPeriod = ymd(end);

  const result: BotSyncResult = {
    configured: true,
    synced: [],
    skipped: [],
    preserved: [],
    errors: [],
  };

  const expenseCurrencies = (await repo.distinctExpenseCurrencies(db))
    .map((c) => normaliseCurrencyCode(c))
    .filter((c): c is string => !!c);
  const allCurrencies = Array.from(new Set([...cfg.currencies, ...expenseCurrencies]));

  for (const currency of allCurrencies) {
    if (currency === "THB") continue;
    try {
      const latest = await fetchLatestMidRate(
        cfg.baseUrl,
        cfg.clientId,
        currency,
        startPeriod,
        endPeriod,
      );
      if (!latest) {
        result.skipped.push(currency);
        continue;
      }
      const unit = cfg.units[currency] ?? 1;
      const rate = latest.midRate / unit;
      const write = await repo.upsertSyncedRate(db, {
        currency,
        rate,
        effectiveDate: latest.period,
        source: "bot",
      });
      if (!write.written) {
        result.preserved.push({ currency, source: write.keptSource ?? null });
        continue;
      }
      result.synced.push({
        currency,
        rate,
        buyingRate: latest.buyingRate / unit,
        sellingRate: latest.sellingRate / unit,
        unit,
        period: latest.period,
        source: "bot",
      });
    } catch (err) {
      result.errors.push({
        currency,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (cfg.fallbackEnabled && result.skipped.length > 0) {
    try {
      const rates = await fetchFallbackThbRates(cfg.fallbackBaseUrl, cfg.fallbackApiKey);
      if (rates) {
        const stillSkipped: string[] = [];
        for (const currency of result.skipped) {
          const perThb = rates[currency];
          if (!perThb || perThb <= 0) {
            stillSkipped.push(currency);
            continue;
          }
          const rate = 1 / perThb;
          const write = await repo.upsertSyncedRate(db, {
            currency,
            rate,
            effectiveDate: endPeriod,
            source: "fallback",
          });
          if (!write.written) {
            result.preserved.push({ currency, source: write.keptSource ?? null });
            continue;
          }
          result.synced.push({
            currency,
            rate,
            buyingRate: rate,
            sellingRate: rate,
            unit: 1,
            period: endPeriod,
            source: "fallback",
          });
        }
        result.skipped = stillSkipped;
      }
    } catch {
      // fallback failure is non-fatal
    }
  }

  return result;
}
