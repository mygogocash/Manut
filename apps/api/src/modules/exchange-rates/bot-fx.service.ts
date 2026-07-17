import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * Bank of Thailand FX auto-fetch (Phase 2 of the expense multi-currency
 * work). Pulls the daily average exchange rate (THB per foreign unit)
 * from the BOT statistics API and upserts `ExchangeRate` rows
 * (`base = <CUR>`, `currency = "THB"`, `source = "bot"`) so the expense
 * total can convert mixed-currency reports to THB.
 *
 * Ships safe when unconfigured: with no `BOT_API_CLIENT_ID` the sync is
 * a no-op (`configured: false`), rates stay missing, and the expense
 * module blocks submit/approve (the Phase-1 behaviour) rather than
 * guessing.
 *
 * Config (all optional except the client id):
 * - `BOT_API_CLIENT_ID`  — required. The app's Client ID from the new
 *   BOT API portal (portal.api.bot.or.th; the old apiportal shut down
 *   2025-12-31), sent in the `Authorization` header. Without it the
 *   sync no-ops.
 * - `BOT_API_BASE_URL`   — override the API base (defaults to the v2
 *   gateway path) if the new portal issues a different host.
 * - `BOT_FX_CURRENCIES`  — comma-separated ISO codes to always pull.
 *   The sync also auto-unions every currency found in expenses, so new
 *   currencies are covered without editing this; the var is just a
 *   baseline/warm-up set.
 * - `BOT_FX_UNITS`       — per-currency divisors as `CUR:N` pairs (e.g.
 *   "IDR:1000,JPY:100,KRW:100"). BOT quotes low-value currencies in
 *   multiples despite the spec's generic "per 1 Unit" label, so we
 *   divide to store THB-per-1. Defaults cover IDR/JPY/KRW; unlisted
 *   currencies are per 1. The result reports the unit applied per row.
 * - `FX_FALLBACK_ENABLED` — public-rate fallback for currencies BOT
 *   doesn't publish (default on; "false" disables).
 * - `FX_FALLBACK_API_KEY` — optional. When set, uses the keyed
 *   exchangerate-api.com v6 provider; otherwise the keyless open.er-api.
 * - `FX_FALLBACK_BASE_URL` — override the fallback host if needed.
 */

// Live server from the BOT v2 OpenAPI spec. Auth is an API key in the
// `Authorization` header (securityScheme `clientIdHeader`).
const DEFAULT_BASE_URL = "https://gateway.api.bot.or.th/Stat-ExchangeRate/v2";

// Public-rate fallback for currencies BOT doesn't publish.
// - keyless: open.er-api.com (response field `rates`).
// - keyed:   exchangerate-api.com v6 when FX_FALLBACK_API_KEY is set
//            (URL embeds the key; response field `conversion_rates`).
const DEFAULT_FALLBACK_BASE_URL = "https://open.er-api.com/v6/latest";
const DEFAULT_FALLBACK_KEYED_BASE_URL = "https://v6.exchangerate-api.com/v6";

const DEFAULT_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "SGD",
  "AUD",
  "CNY",
  "HKD",
  "INR",
  "IDR",
  "MYR",
  "KRW",
];

// Despite the spec's generic "Baht / 1 Unit" label, BOT quotes
// low-value currencies in MULTIPLES in the API: IDR per 1000, JPY/KRW
// per 100 (confirmed — BOT returned IDR 1.8296 while the real rate is
// ~0.0018 THB/IDR, i.e. per 1000). We divide by the unit to store
// THB-per-1. Everything else is per 1. Override via BOT_FX_UNITS
// (e.g. "IDR:1000,JPY:100,KRW:100,VND:100").
const DEFAULT_UNITS: Record<string, number> = {
  IDR: 1000,
  JPY: 100,
  KRW: 100,
};

function parseCsv(value: string | undefined, fallback: string[]): string[] {
  const raw = value?.trim();
  const list = raw ? raw.split(",") : fallback;
  return list.map((c) => c.trim().toUpperCase()).filter(Boolean);
}

function parseUnits(value: string | undefined): Record<string, number> {
  const raw = value?.trim();
  if (!raw) return DEFAULT_UNITS;
  const units: Record<string, number> = {};
  for (const pair of raw.split(",")) {
    const [cur, div] = pair.split(":").map((s) => s.trim());
    const n = Number(div);
    if (cur && Number.isFinite(n) && n > 0) units[cur.toUpperCase()] = n;
  }
  return units;
}

function config() {
  return {
    clientId: process.env.BOT_API_CLIENT_ID?.trim(),
    baseUrl: (process.env.BOT_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(
      /\/$/,
      "",
    ),
    currencies: parseCsv(process.env.BOT_FX_CURRENCIES, DEFAULT_CURRENCIES),
    units: parseUnits(process.env.BOT_FX_UNITS),
    // Public-rate fallback for currencies BOT doesn't publish. On by
    // default; set FX_FALLBACK_ENABLED=false to disable. A keyed
    // provider (exchangerate-api.com v6) kicks in when
    // FX_FALLBACK_API_KEY is set, else the keyless open.er-api is used.
    fallbackEnabled: process.env.FX_FALLBACK_ENABLED?.trim() !== "false",
    fallbackApiKey: process.env.FX_FALLBACK_API_KEY?.trim(),
    fallbackBaseUrl: (
      process.env.FX_FALLBACK_BASE_URL?.trim() ||
      (process.env.FX_FALLBACK_API_KEY?.trim()
        ? DEFAULT_FALLBACK_KEYED_BASE_URL
        : DEFAULT_FALLBACK_BASE_URL)
    ).replace(/\/$/, ""),
  };
}

// THB-based rate map { <CUR>: <THB→CUR> }. CUR→THB = 1 / rates[CUR].
// - keyed (exchangerate-api.com v6): GET {base}/{key}/latest/THB →
//   { result, conversion_rates }.
// - keyless (open.er-api.com):        GET {base}/THB → { result, rates }.
async function fetchFallbackThbRates(
  baseUrl: string,
  apiKey?: string,
): Promise<Record<string, number> | null> {
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

export function isBotFxConfigured(): boolean {
  return Boolean(process.env.BOT_API_CLIENT_ID?.trim());
}

interface BotDetail {
  period?: string;
  currency_id?: string;
  mid_rate?: string;
}

interface BotResponse {
  result?: {
    success?: string;
    data?: { data_detail?: BotDetail[] };
    error?: { code?: string; message?: string };
  };
}

export interface BotSyncResult {
  configured: boolean;
  synced: Array<{
    currency: string;
    rate: number;
    /** Divisor applied to BOT's quote (e.g. 1000 for IDR, else 1). */
    unit: number;
    period: string;
    /** "bot" (official) or "fallback" (public API for non-BOT currencies). */
    source: string;
  }>;
  /** Currencies BOT returned no usable rate for (left missing → blocked). */
  skipped: string[];
  errors: Array<{ currency: string; message: string }>;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Most-recent numeric `mid_rate` in the BOT response, or null. */
async function fetchLatestMidRate(
  baseUrl: string,
  clientId: string,
  currency: string,
  startPeriod: string,
  endPeriod: string,
): Promise<{ midRate: number; period: string } | null> {
  const url =
    `${baseUrl}/DAILY_AVG_EXG_RATE/?currency=${encodeURIComponent(currency)}` +
    `&start_period=${startPeriod}&end_period=${endPeriod}`;
  const res = await fetch(url, {
    // BOT v2 spec: API key goes in the `Authorization` header (raw key,
    // not "Bearer"). `clientId` is the app's Client ID from the portal.
    headers: { Authorization: clientId, accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`BOT API ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as BotResponse;
  if (body.result?.success === "false") {
    throw new Error(
      body.result.error?.message ?? "BOT API returned success=false",
    );
  }
  const details = body.result?.data?.data_detail ?? [];
  let best: { midRate: number; period: string } | null = null;
  for (const detail of details) {
    const rate = Number(detail.mid_rate);
    if (!detail.mid_rate || Number.isNaN(rate) || rate <= 0) continue;
    const period = detail.period ?? endPeriod;
    if (!best || period >= best.period) best = { midRate: rate, period };
  }
  return best;
}

/**
 * Pull the latest BOT rate for each configured currency and upsert it
 * as `<CUR> → THB`. Per-currency failures are isolated (logged + in the
 * `errors` list) so one bad currency never aborts the whole sync.
 */
export async function syncBotRates(): Promise<BotSyncResult> {
  const {
    clientId,
    baseUrl,
    currencies,
    units,
    fallbackEnabled,
    fallbackApiKey,
    fallbackBaseUrl,
  } = config();
  if (!clientId) {
    logger.warn("BOT FX sync skipped — BOT_API_CLIENT_ID not set");
    return { configured: false, synced: [], skipped: [], errors: [] };
  }

  const end = new Date();
  const start = new Date(end);
  // 10-day window so a run on a Monday / after a holiday still catches a
  // published rate; we keep only the most recent row per currency.
  start.setDate(start.getDate() - 10);
  const startPeriod = ymd(start);
  const endPeriod = ymd(end);

  const result: BotSyncResult = {
    configured: true,
    synced: [],
    skipped: [],
    errors: [],
  };

  // Auto-cover any currency actually used in expenses (union with the
  // configured defaults) — so a brand-new currency on a receipt gets a
  // rate on the next sync without editing a list. Currencies BOT doesn't
  // publish (e.g. LKR) still land in `skipped` for a manual rate.
  const expenseRows = await prisma.expense.findMany({
    distinct: ["currency"],
    select: { currency: true },
  });
  const expenseCurrencies = expenseRows
    .map((e) => e.currency?.trim().toUpperCase())
    .filter((c): c is string => !!c);
  const allCurrencies = Array.from(
    new Set([...currencies, ...expenseCurrencies]),
  );

  for (const currency of allCurrencies) {
    if (currency === "THB") continue;
    try {
      const latest = await fetchLatestMidRate(
        baseUrl,
        clientId,
        currency,
        startPeriod,
        endPeriod,
      );
      if (!latest) {
        result.skipped.push(currency);
        continue;
      }
      // BOT quotes IDR per 1000, JPY/KRW per 100, etc. — divide to get
      // THB per 1 unit. Unlisted currencies are per 1.
      const unit = units[currency] ?? 1;
      const rate = latest.midRate / unit;
      const effectiveDate = new Date(`${latest.period}T00:00:00.000Z`);
      await prisma.exchangeRate.upsert({
        where: {
          baseCurrency_currency_effectiveDate: {
            baseCurrency: currency,
            currency: "THB",
            effectiveDate,
          },
        },
        create: {
          baseCurrency: currency,
          currency: "THB",
          rate,
          effectiveDate,
          source: "bot",
        },
        update: { rate, source: "bot" },
      });
      result.synced.push({
        currency,
        rate,
        unit,
        period: latest.period,
        source: "bot",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`BOT FX sync failed for ${currency}: ${message}`);
      result.errors.push({ currency, message });
    }
  }

  // Fallback for currencies BOT doesn't publish (e.g. LKR). Pull a free,
  // keyless public rate so even non-BOT currencies auto-resolve; tagged
  // source="fallback" so finance can spot/override it. BOT rows always
  // win (already upserted above; we only touch what's still skipped).
  if (fallbackEnabled && result.skipped.length > 0) {
    try {
      const rates = await fetchFallbackThbRates(
        fallbackBaseUrl,
        fallbackApiKey,
      );
      if (rates) {
        const stillSkipped: string[] = [];
        for (const currency of result.skipped) {
          const perThb = rates[currency]; // 1 THB = perThb <currency>
          if (!perThb || perThb <= 0) {
            stillSkipped.push(currency);
            continue;
          }
          const rate = 1 / perThb; // → THB per 1 <currency>
          const effectiveDate = new Date(`${endPeriod}T00:00:00.000Z`);
          await prisma.exchangeRate.upsert({
            where: {
              baseCurrency_currency_effectiveDate: {
                baseCurrency: currency,
                currency: "THB",
                effectiveDate,
              },
            },
            create: {
              baseCurrency: currency,
              currency: "THB",
              rate,
              effectiveDate,
              source: "fallback",
            },
            update: { rate, source: "fallback" },
          });
          result.synced.push({
            currency,
            rate,
            unit: 1,
            period: endPeriod,
            source: "fallback",
          });
        }
        result.skipped = stillSkipped;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`FX fallback sync failed: ${message}`);
    }
  }

  logger.info(
    `BOT FX sync complete — synced ${result.synced.length}, ` +
      `skipped ${result.skipped.length}, errors ${result.errors.length}`,
  );
  return result;
}

export const botFxService = { isBotFxConfigured, syncBotRates };
