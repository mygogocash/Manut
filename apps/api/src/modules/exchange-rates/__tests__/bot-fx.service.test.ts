import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import {
  isBotFxConfigured,
  parseBotQuote,
  syncBotRates,
} from "@/modules/exchange-rates/bot-fx.service";

vi.mock("@/common/utils/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    exchangeRate: {
      // The sync reads the stored row before writing, so it can decline to
      // overwrite a rate a person owns. Default: nothing stored yet.
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    expense: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

function botResponse(currencyId: string, midRate: string) {
  return {
    ok: true,
    json: async () => ({
      result: {
        success: "true",
        data: {
          data_detail: [
            {
              period: "2026-06-03",
              currency_id: currencyId,
              mid_rate: midRate,
            },
          ],
        },
      },
    }),
  };
}

describe("parseBotQuote", () => {
  it("uses buying_transfer and selling when present", () => {
    expect(
      parseBotQuote({
        period: "2026-08-18",
        mid_rate: "32.2",
        buying_transfer: "32.1",
        selling: "32.4",
      }),
    ).toEqual({
      midRate: 32.2,
      buyingRate: 32.1,
      sellingRate: 32.4,
      period: "2026-08-18",
    });
  });

  it("falls back to mid when BOT omits sides", () => {
    expect(parseBotQuote({ period: "2026-08-18", mid_rate: "32.2" })).toEqual({
      midRate: 32.2,
      buyingRate: 32.2,
      sellingRate: 32.2,
      period: "2026-08-18",
    });
  });
});

describe("bot-fx.service", () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps implementations but clears calls; re-arm the resolved
    // values the sync depends on so each test starts from "nothing stored".
    vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.exchangeRate.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([] as never);
    process.env = { ...ORIGINAL };
    delete process.env.BOT_API_CLIENT_ID;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
    vi.unstubAllGlobals();
  });

  it("is not configured without a client id", () => {
    expect(isBotFxConfigured()).toBe(false);
  });

  it("no-ops (configured:false) when BOT_API_CLIENT_ID is absent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncBotRates();

    expect(result.configured).toBe(false);
    expect(result.synced).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.exchangeRate.upsert).not.toHaveBeenCalled();
  });

  it("upserts <CUR>→THB and divides multi-unit currencies (IDR ÷1000)", async () => {
    process.env.BOT_API_CLIENT_ID = "test-client-id";
    process.env.BOT_FX_CURRENCIES = "USD,IDR";
    process.env.BOT_FX_UNITS = "IDR:1000";

    const fetchMock = vi.fn(async (url: string) => {
      const currency = new URL(url).searchParams.get("currency");
      // USD quoted per 1; IDR quoted per 1000 in the BOT bulletin.
      return botResponse(currency!, currency === "USD" ? "36.5" : "1.8296");
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncBotRates();

    expect(result.configured).toBe(true);
    expect(result.errors).toEqual([]);

    const usd = result.synced.find((s) => s.currency === "USD");
    const idr = result.synced.find((s) => s.currency === "IDR");
    expect(usd).toMatchObject({ rate: 36.5, unit: 1 });
    // 1.8296 / 1000 → 0.0018296 THB per 1 IDR (float-safe compare).
    expect(idr?.unit).toBe(1000);
    expect(idr?.rate).toBeCloseTo(0.0018296, 9);

    // Sends the Client ID under both header names (new IBM portal +
    // legacy v2 gateway), base=<CUR>, THB.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("currency=USD"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "test-client-id",
          "X-IBM-Client-Id": "test-client-id",
        }),
      }),
    );
    expect(prisma.exchangeRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          baseCurrency: "IDR",
          currency: "THB",
          rate: expect.closeTo(0.0018296, 9),
          source: "bot",
        }),
      }),
    );
  });

  it("records an error for a currency the API rejects, without aborting others", async () => {
    process.env.BOT_API_CLIENT_ID = "test-client-id";
    process.env.BOT_FX_CURRENCIES = "USD,XYZ";

    const fetchMock = vi.fn(async (url: string) => {
      const currency = new URL(url).searchParams.get("currency");
      if (currency === "XYZ") {
        return {
          ok: true,
          json: async () => ({
            result: {
              success: "false",
              error: { message: "unknown currency" },
            },
          }),
        };
      }
      return botResponse(currency!, "36.5");
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncBotRates();

    expect(result.synced.map((s) => s.currency)).toEqual(["USD"]);
    expect(result.errors).toEqual([
      { currency: "XYZ", message: "unknown currency" },
    ]);
  });

  it("auto-includes currencies used in expenses (union with config)", async () => {
    process.env.BOT_API_CLIENT_ID = "test-client-id";
    process.env.BOT_FX_CURRENCIES = "USD";
    // A receipt was filed in SGD even though it isn't in the configured
    // list — the sync should pull it anyway.
    vi.mocked(prisma.expense.findMany).mockResolvedValueOnce([
      { currency: "SGD" },
    ] as never);

    const seen: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      const currency = new URL(url).searchParams.get("currency")!;
      seen.push(currency);
      return botResponse(currency, "25");
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncBotRates();

    expect(seen).toContain("USD");
    expect(seen).toContain("SGD");
    expect(result.synced.map((s) => s.currency).sort()).toEqual(["SGD", "USD"]);
  });

  it("falls back to the public API for currencies BOT doesn't publish", async () => {
    process.env.BOT_API_CLIENT_ID = "test-client-id";
    process.env.BOT_FX_CURRENCIES = "LKR";

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("DAILY_AVG_EXG_RATE")) {
        // BOT has no LKR row.
        return {
          ok: true,
          json: async () => ({
            result: { success: "true", data: { data_detail: [] } },
          }),
        };
      }
      // open.er-api fallback: 1 THB = 10.1 LKR.
      return {
        ok: true,
        json: async () => ({
          result: "success",
          base_code: "THB",
          rates: { LKR: 10.1 },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncBotRates();

    const lkr = result.synced.find((s) => s.currency === "LKR");
    expect(lkr?.source).toBe("fallback");
    expect(lkr?.rate).toBeCloseTo(1 / 10.1, 6);
    expect(result.skipped).not.toContain("LKR");
  });

  it("uses the keyed exchangerate-api.com provider when FX_FALLBACK_API_KEY is set", async () => {
    process.env.BOT_API_CLIENT_ID = "test-client-id";
    process.env.BOT_FX_CURRENCIES = "LKR";
    process.env.FX_FALLBACK_API_KEY = "key-123";

    let fallbackUrl = "";
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("DAILY_AVG_EXG_RATE")) {
        return {
          ok: true,
          json: async () => ({
            result: { success: "true", data: { data_detail: [] } },
          }),
        };
      }
      fallbackUrl = url;
      // exchangerate-api.com v6 keyed shape uses `conversion_rates`.
      return {
        ok: true,
        json: async () => ({
          result: "success",
          base_code: "THB",
          conversion_rates: { LKR: 10.1 },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncBotRates();

    expect(fallbackUrl).toContain(
      "v6.exchangerate-api.com/v6/key-123/latest/THB",
    );
    const lkr = result.synced.find((s) => s.currency === "LKR");
    expect(lkr?.source).toBe("fallback");
    expect(lkr?.rate).toBeCloseTo(1 / 10.1, 6);
  });

  /*
   * BOT_FX_UNITS used to REPLACE the divisor map, so the documented remedy for one
   * missing divisor removed the others: adding "VND:100" silently dropped IDR
   * ÷1000, making IDR rates a thousand times too high with no sign of a problem.
   */
  it("adding one divisor keeps the built-in ones", async () => {
    process.env.BOT_API_CLIENT_ID = "test-client-id";
    process.env.BOT_FX_CURRENCIES = "IDR,JPY,VND";
    process.env.BOT_FX_UNITS = "VND:100";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const currency = new URL(url).searchParams.get("currency");
        return botResponse(currency!, "100");
      }),
    );

    const result = await syncBotRates();
    const unitFor = (c: string) =>
      result.synced.find((s) => s.currency === c)?.unit;

    expect(unitFor("VND")).toBe(100); // the added one
    expect(unitFor("IDR")).toBe(1000); // still divided
    expect(unitFor("JPY")).toBe(100); // still divided
  });

  it("an explicit divisor still overrides the built-in one", async () => {
    process.env.BOT_API_CLIENT_ID = "test-client-id";
    process.env.BOT_FX_CURRENCIES = "IDR";
    // BOT changing how it quotes IDR is the reason this override exists.
    process.env.BOT_FX_UNITS = "IDR:1";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const currency = new URL(url).searchParams.get("currency");
        return botResponse(currency!, "1.8296");
      }),
    );

    const result = await syncBotRates();
    expect(result.synced[0]).toMatchObject({ unit: 1, rate: 1.8296 });
  });

  /*
   * Both upserts used to write `{ rate, source }` unconditionally, so a rate
   * finance had corrected by hand was reverted by the next cron and relabelled
   * "bot" — losing the value and the provenance the FX dialog displays. The
   * ten-day lookback re-touched up to ten published dates every run.
   */
  it("leaves a hand-corrected rate alone and reports it", async () => {
    process.env.BOT_API_CLIENT_ID = "test-client-id";
    process.env.BOT_FX_CURRENCIES = "USD";
    vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue({
      source: "manual",
    } as never);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const currency = new URL(url).searchParams.get("currency");
        return botResponse(currency!, "36.5");
      }),
    );

    const result = await syncBotRates();

    expect(prisma.exchangeRate.upsert).not.toHaveBeenCalled();
    expect(result.synced).toEqual([]);
    expect(result.preserved).toEqual([{ currency: "USD", source: "manual" }]);
    expect(result.errors).toEqual([]);
  });

  it("still refreshes a rate it wrote itself", async () => {
    process.env.BOT_API_CLIENT_ID = "test-client-id";
    process.env.BOT_FX_CURRENCIES = "USD";
    vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue({
      source: "bot",
    } as never);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const currency = new URL(url).searchParams.get("currency");
        return botResponse(currency!, "36.5");
      }),
    );

    const result = await syncBotRates();

    expect(prisma.exchangeRate.upsert).toHaveBeenCalledTimes(1);
    expect(result.synced).toEqual([
      expect.objectContaining({ currency: "USD", rate: 36.5 }),
    ]);
    expect(result.preserved).toEqual([]);
  });

  // A row whose provenance nobody recorded is the ambiguous case. Leaving it is
  // the safe direction for money: a stale rate someone can see and retag beats
  // overwriting a correction that was never labelled.
  it("leaves a rate of unknown provenance alone", async () => {
    process.env.BOT_API_CLIENT_ID = "test-client-id";
    process.env.BOT_FX_CURRENCIES = "USD";
    vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue({
      source: null,
    } as never);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const currency = new URL(url).searchParams.get("currency");
        return botResponse(currency!, "36.5");
      }),
    );

    const result = await syncBotRates();

    expect(prisma.exchangeRate.upsert).not.toHaveBeenCalled();
    expect(result.preserved).toEqual([{ currency: "USD", source: null }]);
  });
});
