import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import {
  isBotFxConfigured,
  syncBotRates,
} from "@/modules/exchange-rates/bot-fx.service";
import { assertDefined, setTestEnv } from "@/test-utils/assertions";

vi.mock("@/common/utils/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    exchangeRate: { upsert: vi.fn().mockResolvedValue({}) },
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

describe("bot-fx.service", () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL };
    setTestEnv("BOT_API_CLIENT_ID", undefined);
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
    setTestEnv("BOT_API_CLIENT_ID", "test-client-id");
    setTestEnv("BOT_FX_CURRENCIES", "USD,IDR");
    setTestEnv("BOT_FX_UNITS", "IDR:1000");

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

    // Sends the API key in the Authorization header, base=<CUR>, THB.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("currency=USD"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "test-client-id",
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
    setTestEnv("BOT_API_CLIENT_ID", "test-client-id");
    setTestEnv("BOT_FX_CURRENCIES", "USD,XYZ");

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
    setTestEnv("BOT_API_CLIENT_ID", "test-client-id");
    setTestEnv("BOT_FX_CURRENCIES", "USD");
    // A receipt was filed in SGD even though it isn't in the configured
    // list — the sync should pull it anyway.
    vi.mocked(prisma.expense.findMany).mockResolvedValueOnce([
      { currency: "SGD" },
    ] as never);

    const seen: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      const currency = assertDefined(
        new URL(url).searchParams.get("currency"),
        "fallback currency query",
      );
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
    setTestEnv("BOT_API_CLIENT_ID", "test-client-id");
    setTestEnv("BOT_FX_CURRENCIES", "LKR");

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
    setTestEnv("BOT_API_CLIENT_ID", "test-client-id");
    setTestEnv("BOT_FX_CURRENCIES", "LKR");
    setTestEnv("FX_FALLBACK_API_KEY", "key-123");

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
});
