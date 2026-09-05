import { describe, expect, it } from "vitest";

import {
  addMonths,
  buildMonthDetail,
  buildMonthlySeries,
  chargeInMonth,
  endMonth,
  lastChargedMonth,
  MAX_WINDOW_MONTHS,
  monthDistance,
  monthKey,
  monthLabel,
  type MonthlySubscription,
  monthRange,
  pickPrimaryCurrency,
  realisedSavings,
  resolveWindow,
  startMonth,
} from "@/modules/it-billing/it-billing-monthly";

/** A Postgres `DATE` as Prisma hands it back: UTC midnight. */
function date(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function sub(over: Partial<MonthlySubscription> = {}): MonthlySubscription {
  return {
    id: "sub-1",
    productName: "Figma",
    vendorId: "vendor-1",
    vendorName: "Figma",
    category: "saas",
    currency: "USD",
    invoiceAmount: 100,
    billingFrequency: "monthly",
    status: "active",
    contractStartDate: date("2026-01-01"),
    renewalDate: null,
    cancelledAt: null,
    renewalDecision: null,
    renewalDecisionAt: null,
    createdAt: date("2026-01-01"),
    updatedAt: date("2026-01-01"),
    ...over,
  };
}

const WINDOW = { from: "2026-01", to: "2026-12", currency: "USD" };

function totals(subs: MonthlySubscription[], window = WINDOW) {
  return Object.fromEntries(
    buildMonthlySeries(subs, window).points.map((p) => [p.month, p.total]),
  );
}

describe("month-key arithmetic", () => {
  it("derives the month in UTC, so a DATE on the 1st stays in its own month", () => {
    // The bug this guards: local getters put 2026-08-01T00:00Z into July for
    // any server west of UTC.
    expect(monthKey(date("2026-08-01"))).toBe("2026-08");
    expect(monthKey(date("2026-08-31"))).toBe("2026-08");
    expect(monthKey(date("2026-01-01"))).toBe("2026-01");
  });

  it("carries the year across December", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-06", 18)).toBe("2027-12");
    expect(addMonths("2026-06", -18)).toBe("2024-12");
  });

  it("measures distance signed", () => {
    expect(monthDistance("2026-01", "2026-12")).toBe(11);
    expect(monthDistance("2026-12", "2026-01")).toBe(-11);
    expect(monthDistance("2026-05", "2026-05")).toBe(0);
  });

  it("builds an inclusive range, empty when reversed", () => {
    expect(monthRange("2026-01", "2026-03")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
    expect(monthRange("2026-03", "2026-01")).toEqual([]);
  });

  it("orders lexicographically the same as chronologically", () => {
    // The property every window check in the module relies on.
    const keys = ["2026-10", "2026-02", "2025-12", "2026-01"];
    expect([...keys].sort()).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-10",
    ]);
  });

  it("labels for display", () => {
    expect(monthLabel("2026-08")).toBe("Aug 2026");
  });
});

describe("resolveWindow", () => {
  const today = date("2026-08-15");

  it("defaults to the trailing 12 months ending this month", () => {
    expect(resolveWindow({}, today)).toEqual({
      from: "2025-09",
      to: "2026-08",
    });
  });

  it("honours an explicit month count", () => {
    expect(resolveWindow({ months: 6 }, today)).toEqual({
      from: "2026-03",
      to: "2026-08",
    });
  });

  it("honours explicit bounds", () => {
    expect(resolveWindow({ from: "2026-01", to: "2026-03" }, today)).toEqual({
      from: "2026-01",
      to: "2026-03",
    });
  });

  it("reads a reversed range the way it was obviously meant", () => {
    expect(resolveWindow({ from: "2026-06", to: "2026-02" }, today).from).toBe(
      "2026-02",
    );
  });

  it("caps the window so a bad param cannot build a huge series", () => {
    const { from, to } = resolveWindow({ from: "2000-01" }, today);
    expect(monthDistance(from, to) + 1).toBe(MAX_WINDOW_MONTHS);
  });

  it("ignores a malformed month key rather than throwing", () => {
    expect(resolveWindow({ from: "nonsense", to: "2026-13" }, today)).toEqual({
      from: "2025-09",
      to: "2026-08",
    });
  });
});

describe("amortisation into months", () => {
  it("spreads an annual invoice evenly across every month", () => {
    const rows = totals([
      sub({ billingFrequency: "annual", invoiceAmount: 12000 }),
    ]);
    expect(rows["2026-01"]).toBe(1000);
    expect(rows["2026-07"]).toBe(1000);
    expect(rows["2026-12"]).toBe(1000);
  });

  it("spreads a quarterly invoice", () => {
    const rows = totals([
      sub({ billingFrequency: "quarterly", invoiceAmount: 300 }),
    ]);
    expect(rows["2026-05"]).toBe(100);
  });

  it("takes a monthly invoice at face value", () => {
    expect(totals([sub({ invoiceAmount: 255 })])["2026-06"]).toBe(255);
  });

  it("puts a one-time charge wholly in its own month and zero elsewhere", () => {
    // toMonthlySpend returns 0 for one-time, which is right for a RUN RATE and
    // wrong for a ledger — the charge has to land somewhere.
    const rows = totals([
      sub({
        billingFrequency: "one-time",
        invoiceAmount: 5000,
        contractStartDate: date("2026-04-10"),
      }),
    ]);
    expect(rows["2026-03"]).toBe(0);
    expect(rows["2026-04"]).toBe(5000);
    expect(rows["2026-05"]).toBe(0);
  });

  it("charges nothing for an unknown frequency", () => {
    expect(
      totals([sub({ billingFrequency: "fortnightly", invoiceAmount: 999 })])[
        "2026-06"
      ],
    ).toBe(0);
  });

  it("charges nothing before the contract starts", () => {
    const rows = totals([sub({ contractStartDate: date("2026-07-01") })]);
    expect(rows["2026-06"]).toBe(0);
    expect(rows["2026-07"]).toBe(100);
  });

  it("falls back to createdAt when there is no contract start date", () => {
    const row = sub({
      contractStartDate: null,
      createdAt: date("2026-05-20"),
    });
    expect(startMonth(row)).toBe("2026-05");
    expect(chargeInMonth(row, "2026-04")).toBe(0);
    expect(chargeInMonth(row, "2026-05")).toBe(100);
  });
});

describe("the step-down when a subscription is cancelled", () => {
  const cancelled = sub({
    productName: "Upstash",
    invoiceAmount: 293.87,
    status: "cancelled",
    cancelledAt: date("2026-06-30"),
  });

  it("charges through the end month, then nothing", () => {
    // This is the whole point of the feature: cancelling a service must show as
    // a fall in the trend, not make the service vanish from history.
    const rows = totals([cancelled]);
    expect(rows["2026-05"]).toBe(293.87);
    expect(rows["2026-06"]).toBe(293.87);
    expect(rows["2026-07"]).toBe(0);
    expect(rows["2026-12"]).toBe(0);
  });

  it("reports the fall in deltaVsPrevious", () => {
    const points = buildMonthlySeries([cancelled], WINDOW).points;
    const july = points.find((p) => p.month === "2026-07");
    expect(july?.deltaVsPrevious).toBe(-293.87);
  });

  it("names the row in ended[] in its last charged month", () => {
    const points = buildMonthlySeries([cancelled], WINDOW).points;
    expect(points.find((p) => p.month === "2026-06")?.ended).toEqual([
      expect.objectContaining({ productName: "Upstash", isOneTime: false }),
    ]);
    expect(points.find((p) => p.month === "2026-07")?.ended).toEqual([]);
  });

  it("stops counting it as active after it ends", () => {
    const points = buildMonthlySeries([cancelled], WINDOW).points;
    expect(points.find((p) => p.month === "2026-06")?.activeCount).toBe(1);
    expect(points.find((p) => p.month === "2026-07")?.activeCount).toBe(0);
  });

  it("honours a future cancelledAt on a still-active row as a schedule", () => {
    const scheduled = sub({
      status: "active",
      cancelledAt: date("2026-09-30"),
    });
    expect(endMonth(scheduled)).toBe("2026-09");
    expect(chargeInMonth(scheduled, "2026-10")).toBe(0);
  });
});

describe("endMonth fallback for rows cancelled before cancelledAt existed", () => {
  // No backfill ships with the migration, so legacy rows arrive with a NULL
  // column. If the fallback did not work, every historic cancellation would
  // read as still running — and staging (db:push, no data migrations) would
  // disagree with prod forever.
  it("prefers the paid-through renewal date", () => {
    expect(
      endMonth(
        sub({
          status: "cancelled",
          cancelledAt: null,
          renewalDate: date("2026-06-30"),
          renewalDecisionAt: date("2026-03-05"),
          updatedAt: date("2026-03-05"),
        }),
      ),
    ).toBe("2026-06");
  });

  it("falls back to the decision stamp when there is no renewal date", () => {
    expect(
      endMonth(
        sub({
          status: "cancelled",
          cancelledAt: null,
          renewalDate: null,
          renewalDecisionAt: date("2026-03-05"),
          updatedAt: date("2026-08-01"),
        }),
      ),
    ).toBe("2026-03");
  });

  it("falls back to updatedAt as the last resort", () => {
    expect(
      endMonth(
        sub({
          status: "cancelled",
          cancelledAt: null,
          renewalDate: null,
          renewalDecisionAt: null,
          updatedAt: date("2026-04-11"),
        }),
      ),
    ).toBe("2026-04");
  });

  it("returns null for a live row, whatever its other dates say", () => {
    expect(
      endMonth(sub({ status: "active", renewalDate: date("2026-02-01") })),
    ).toBeNull();
  });

  it("still places the step-down with a NULL column", () => {
    const legacy = sub({
      status: "cancelled",
      cancelledAt: null,
      renewalDate: date("2026-05-31"),
    });
    const rows = totals([legacy]);
    expect(rows["2026-05"]).toBe(100);
    expect(rows["2026-06"]).toBe(0);
  });
});

describe("one-time vs cancellation, in lastChargedMonth", () => {
  it("ends a one-time purchase after its single month without a cancellation", () => {
    const purchase = sub({
      billingFrequency: "one-time",
      contractStartDate: date("2026-04-01"),
    });
    expect(endMonth(purchase)).toBeNull();
    expect(lastChargedMonth(purchase)).toBe("2026-04");
  });

  it("flags it as one-time in ended[] so the UI does not call it a cancellation", () => {
    const points = buildMonthlySeries(
      [
        sub({
          billingFrequency: "one-time",
          invoiceAmount: 5000,
          contractStartDate: date("2026-04-01"),
        }),
      ],
      WINDOW,
    ).points;
    expect(points.find((p) => p.month === "2026-04")?.ended).toEqual([
      expect.objectContaining({ isOneTime: true, monthlyAmount: 5000 }),
    ]);
  });
});

describe("started[]", () => {
  it("names a row in the month it first charges", () => {
    const points = buildMonthlySeries(
      [sub({ productName: "Sentry", contractStartDate: date("2026-03-15") })],
      WINDOW,
    ).points;
    expect(points.find((p) => p.month === "2026-03")?.started).toEqual([
      expect.objectContaining({ productName: "Sentry" }),
    ]);
    expect(points.find((p) => p.month === "2026-04")?.started).toEqual([]);
  });

  it("is empty in a month a row merely continues", () => {
    const points = buildMonthlySeries([sub()], WINDOW).points;
    expect(points.find((p) => p.month === "2026-06")?.started).toEqual([]);
  });
});

describe("deltaVsPrevious", () => {
  it("is null on the first point, because there is nothing to compare to", () => {
    const points = buildMonthlySeries([sub()], WINDOW).points;
    expect(points[0]?.deltaVsPrevious).toBeNull();
    expect(points[1]?.deltaVsPrevious).toBe(0);
  });
});

describe("currency isolation", () => {
  const mixed = [
    sub({ id: "a", currency: "USD", invoiceAmount: 100 }),
    sub({ id: "b", currency: "THB", invoiceAmount: 3500 }),
  ];

  it("never blends two currencies into one total", () => {
    expect(totals(mixed)["2026-06"]).toBe(100);
    expect(totals(mixed, { ...WINDOW, currency: "THB" })["2026-06"]).toBe(3500);
  });

  it("reports every currency present, not just the one requested", () => {
    expect(buildMonthlySeries(mixed, WINDOW).currenciesPresent).toEqual([
      "THB",
      "USD",
    ]);
  });

  it("counts only the requested currency as active", () => {
    const points = buildMonthlySeries(mixed, WINDOW).points;
    expect(points.find((p) => p.month === "2026-06")?.activeCount).toBe(1);
  });

  it("picks the largest current run-rate as the default, ties by code", () => {
    const today = date("2026-06-15");
    expect(pickPrimaryCurrency(mixed, today)).toBe("THB");
    expect(
      pickPrimaryCurrency(
        [
          sub({ id: "a", currency: "USD", invoiceAmount: 50 }),
          sub({ id: "b", currency: "EUR", invoiceAmount: 50 }),
        ],
        today,
      ),
    ).toBe("EUR");
  });

  it("falls back to USD with no data rather than undefined", () => {
    expect(pickPrimaryCurrency([], date("2026-06-15"))).toBe("USD");
  });
});

describe("buildMonthDetail", () => {
  const rows = [
    sub({ id: "a", productName: "Supabase", invoiceAmount: 2142 }),
    sub({
      id: "b",
      productName: "Vercel",
      billingFrequency: "annual",
      invoiceAmount: 12000,
    }),
    sub({
      id: "c",
      productName: "Gone",
      status: "cancelled",
      cancelledAt: date("2026-02-28"),
    }),
    sub({ id: "d", productName: "Baht", currency: "THB", invoiceAmount: 900 }),
  ];

  it("returns the rows live in the month, largest first", () => {
    const detail = buildMonthDetail(rows, "2026-06", "USD");
    expect(detail.rows.map((r) => r.productName)).toEqual([
      "Supabase",
      "Vercel",
    ]);
    expect(detail.label).toBe("Jun 2026");
  });

  it("totals exactly the sum of the rows it returns", () => {
    // The group header must never contradict what expanding it shows.
    const detail = buildMonthDetail(rows, "2026-06", "USD");
    const summed = detail.rows.reduce((acc, r) => acc + r.monthlyAmount, 0);
    expect(detail.total).toBe(Math.round(summed * 100) / 100);
    expect(detail.total).toBe(3142);
  });

  it("includes a cancelled row in a month it was still live", () => {
    const detail = buildMonthDetail(rows, "2026-02", "USD");
    expect(detail.rows.map((r) => r.productName)).toContain("Gone");
    expect(
      detail.rows.find((r) => r.productName === "Gone")?.endedThisMonth,
    ).toBe(true);
  });

  it("excludes other currencies", () => {
    const detail = buildMonthDetail(rows, "2026-06", "USD");
    expect(detail.rows.map((r) => r.productName)).not.toContain("Baht");
  });

  it("carries the invoiced amount alongside the monthly equivalent", () => {
    const detail = buildMonthDetail(rows, "2026-06", "USD");
    const vercel = detail.rows.find((r) => r.productName === "Vercel");
    expect(vercel?.invoiceAmount).toBe(12000);
    expect(vercel?.monthlyAmount).toBe(1000);
  });
});

describe("realisedSavings", () => {
  it("sums the run-rate removed and the spend avoided since", () => {
    const savings = realisedSavings(
      [
        sub({
          id: "a",
          productName: "Upstash",
          invoiceAmount: 300,
          status: "cancelled",
          cancelledAt: date("2026-06-30"),
        }),
      ],
      { ...WINDOW, today: "2026-12" },
    );
    expect(savings.monthlyRunRateRemoved).toBe(300);
    // Jul..Dec inclusive = 6 months at 300.
    expect(savings.cumulativeAvoided).toBe(1800);
    expect(savings.endedCount).toBe(1);
  });

  it("excludes one-time purchases, which were never going to recur", () => {
    const savings = realisedSavings(
      [
        sub({
          billingFrequency: "one-time",
          invoiceAmount: 5000,
          contractStartDate: date("2026-04-01"),
        }),
      ],
      { ...WINDOW, today: "2026-12" },
    );
    expect(savings.endedCount).toBe(0);
    expect(savings.cumulativeAvoided).toBe(0);
  });

  it("ignores rows that ended outside the window", () => {
    const savings = realisedSavings(
      [
        sub({
          status: "cancelled",
          cancelledAt: date("2025-06-30"),
          contractStartDate: date("2025-01-01"),
        }),
      ],
      { ...WINDOW, today: "2026-12" },
    );
    expect(savings.endedCount).toBe(0);
  });

  it("ignores live rows", () => {
    expect(
      realisedSavings([sub()], { ...WINDOW, today: "2026-12" }).endedCount,
    ).toBe(0);
  });

  it("credits nothing yet for a cancellation in the final month", () => {
    const savings = realisedSavings(
      [sub({ status: "cancelled", cancelledAt: date("2026-12-31") })],
      { ...WINDOW, today: "2026-12" },
    );
    expect(savings.monthlyRunRateRemoved).toBe(100);
    expect(savings.cumulativeAvoided).toBe(0);
  });

  it("stays in one currency", () => {
    const savings = realisedSavings(
      [
        sub({
          id: "a",
          currency: "THB",
          invoiceAmount: 700,
          status: "cancelled",
          cancelledAt: date("2026-06-30"),
        }),
      ],
      { ...WINDOW, today: "2026-12" },
    );
    expect(savings.endedCount).toBe(0);
  });
});

describe("a one-time purchase cancelled before it starts", () => {
  // Found by adversarial review. `lastChargedMonth` returned `startMonth`
  // unconditionally for one-time rows and never consulted `endMonth`, so this
  // row billed its whole invoice anyway — and landed in `started` AND `ended`
  // in the same month. Reachable from the shipping UI: create a future-dated
  // one-time purchase, then click Cancel, which stamps today.
  const cancelledBeforeStart = sub({
    billingFrequency: "one-time",
    invoiceAmount: 5000,
    contractStartDate: date("2026-09-01"),
    status: "cancelled",
    cancelledAt: date("2026-08-10"),
  });

  it("charges nothing, in any month", () => {
    const rows = totals([cancelledBeforeStart], {
      from: "2026-06",
      to: "2026-12",
      currency: "USD",
    });
    expect(Object.values(rows).every((v) => v === 0)).toBe(true);
  });

  it("appears in neither started[] nor ended[], and is never active", () => {
    const points = buildMonthlySeries([cancelledBeforeStart], {
      from: "2026-06",
      to: "2026-12",
      currency: "USD",
    }).points;
    expect(points.every((p) => p.started.length === 0)).toBe(true);
    expect(points.every((p) => p.ended.length === 0)).toBe(true);
    expect(points.every((p) => p.activeCount === 0)).toBe(true);
  });

  it("still charges when the cancellation is in or after its own month", () => {
    // The money WAS spent — a later cancellation cannot un-buy it.
    const spent = sub({
      billingFrequency: "one-time",
      invoiceAmount: 5000,
      contractStartDate: date("2026-04-01"),
      status: "cancelled",
      cancelledAt: date("2026-04-30"),
    });
    expect(chargeInMonth(spent, "2026-04")).toBe(5000);
    expect(lastChargedMonth(spent)).toBe("2026-04");
  });
});

describe("realisedSavings does not bank money that is still unspent", () => {
  it("never counts months past today, even when the window ends later", () => {
    // Picking a future end month used to report savings nobody had made yet.
    const savings = realisedSavings(
      [
        sub({
          invoiceAmount: 300,
          status: "cancelled",
          cancelledAt: date("2026-06-30"),
        }),
      ],
      { from: "2026-01", to: "2026-12", currency: "USD", today: "2026-08" },
    );
    // Jul + Aug only, not Jul..Dec.
    expect(savings.cumulativeAvoided).toBe(600);
    expect(savings.monthlyRunRateRemoved).toBe(300);
  });

  it("still counts the whole window when it is entirely in the past", () => {
    const savings = realisedSavings(
      [
        sub({
          invoiceAmount: 300,
          status: "cancelled",
          cancelledAt: date("2026-06-30"),
        }),
      ],
      { from: "2026-01", to: "2026-12", currency: "USD", today: "2027-05" },
    );
    expect(savings.cumulativeAvoided).toBe(1800);
  });

  it("ignores a row that removed no run-rate rather than reporting 1 ended, 0.00", () => {
    const savings = realisedSavings(
      [
        sub({
          billingFrequency: "fortnightly",
          invoiceAmount: 999,
          status: "cancelled",
          cancelledAt: date("2026-06-30"),
        }),
      ],
      { from: "2026-01", to: "2026-12", currency: "USD", today: "2026-12" },
    );
    expect(savings.endedCount).toBe(0);
    expect(savings.monthlyRunRateRemoved).toBe(0);
  });
});
