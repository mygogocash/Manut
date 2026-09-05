import { afterEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { expenseReportsService } from "@/modules/expenses/expense-reports.service";
import { reportSearchWhere } from "@/modules/expenses/expense-shared";
import { expensesRepository } from "@/modules/expenses/expenses.repository";
import { expenseReportQuerySchema } from "@/modules/expenses/expenses.validation";

/*
 * Searching the Expenses page used to be a browser-side filter over whichever
 * page of reports had already been fetched, so a name only matched when its row
 * happened to be on screen. Picking a month made it "work" purely because
 * `period` IS a server filter: it cut 135 reports to 36 and pulled the row onto
 * page one.
 *
 * These pin the fix — that the term reaches the database — and the two things
 * that fix must not break: the submitter masking on office reports, and the
 * permission scoping.
 */

const HR = [PERMISSIONS.EXPENSE_HR_READ];

afterEach(() => {
  vi.restoreAllMocks();
});

/** The OR branches, for asserting on shape without depending on their order. */
function branches(search: string) {
  const where = reportSearchWhere(search);
  const group = where?.AND;
  if (!Array.isArray(group)) throw new Error("expected an AND group");
  const or = (group[0] as { OR?: unknown[] })?.OR;
  if (!Array.isArray(or)) throw new Error("expected an OR array");
  return or as Record<string, unknown>[];
}

describe("reportSearchWhere", () => {
  it("is nothing at all for an absent or blank term", () => {
    expect(reportSearchWhere(undefined)).toBeNull();
    expect(reportSearchWhere("")).toBeNull();
    expect(reportSearchWhere("   ")).toBeNull();
  });

  it("matches the report title case-insensitively", () => {
    expect(branches("karun")).toEqual(
      expect.arrayContaining([
        { title: { contains: "karun", mode: "insensitive" } },
      ]),
    );
  });

  // The box is labelled "title, period, employee", and people type "2026-07".
  it("matches the period, which is how a month is typed", () => {
    expect(branches("2026-07")).toEqual(
      expect.arrayContaining([{ period: { contains: "2026-07" } }]),
    );
  });

  it("matches the employee name — the case that was broken", () => {
    const or = branches("karun");
    const nameBranch = or.find((b) => "AND" in b);
    expect(nameBranch).toEqual({
      AND: [
        { category: { not: "office" } },
        { employee: { name: { contains: "karun", mode: "insensitive" } } },
      ],
    });
  });

  /*
   * Office reports hide who filed them behind the label "Office Admin". A
   * server-side name match that ignored that would surface those reports under a
   * person's name while the table still showed "Office Admin" — revealing the
   * submitter the masking exists to hide.
   */
  it("never matches an office report by its submitter's name", () => {
    const or = branches("karun");
    const nameBranch = or.find((b) => "AND" in b) as
      { AND: Record<string, unknown>[] } | undefined;
    expect(nameBranch?.AND[0]).toEqual({ category: { not: "office" } });
    expect(or).not.toEqual(expect.arrayContaining([{ category: "office" }]));
  });

  it("surfaces office reports when the term matches their visible label", () => {
    // Mirrors the browser's `"office admin".includes(q)` so the two agree.
    expect(branches("office")).toEqual(
      expect.arrayContaining([{ category: "office" }]),
    );
    expect(branches("admin")).toEqual(
      expect.arrayContaining([{ category: "office" }]),
    );
    expect(branches("OFFICE ADMIN")).toEqual(
      expect.arrayContaining([{ category: "office" }]),
    );
  });

  /*
   * Nested under AND rather than set as a sibling `where.OR`. Prisma ANDs
   * sibling keys, so a sibling OR would also be correct today — but a second
   * filter wanting its own OR would silently overwrite the first. AND-ing a
   * group composes.
   */
  it("nests as an AND group so it intersects other filters", () => {
    const where = reportSearchWhere("karun");
    expect(where).toHaveProperty("AND");
    expect(where).not.toHaveProperty("OR");
  });

  it("trims the term before using it", () => {
    expect(branches("  karun  ")).toEqual(
      expect.arrayContaining([
        { title: { contains: "karun", mode: "insensitive" } },
      ]),
    );
  });
});

describe("expenseReportQuerySchema", () => {
  it("accepts a search term", () => {
    expect(expenseReportQuerySchema.parse({ search: "karun" }).search).toBe(
      "karun",
    );
  });

  it("treats a blank term as absent, so it cannot filter everything out", () => {
    expect(
      expenseReportQuerySchema.parse({ search: "   " }).search,
    ).toBeUndefined();
  });

  it("still parses with no search at all", () => {
    expect(expenseReportQuerySchema.parse({}).search).toBeUndefined();
  });
});

describe("listReports passes the search to the database", () => {
  function mockFindReports() {
    return vi
      .spyOn(expensesRepository, "findReports")
      .mockResolvedValue({ data: [], total: 0 });
  }

  it("forwards the term rather than filtering in the browser", async () => {
    const spy = mockFindReports();
    await expenseReportsService.listReports("hr-user", HR, {
      page: 1,
      limit: 20,
      includeAll: true,
      search: "karun",
    } as never);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ search: "karun" }),
      1,
      20,
    );
  });

  // The whole point of the bug report: a name should find reports in every
  // month, so the search must NOT imply or require a period.
  it("does not require a period to search", async () => {
    const spy = mockFindReports();
    await expenseReportsService.listReports("hr-user", HR, {
      page: 1,
      limit: 20,
      includeAll: true,
      search: "karun",
    } as never);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ period: undefined });
  });

  // Searching must not become a way to read other people's reports.
  it("keeps scoping a non-HR caller to their own reports while searching", async () => {
    const spy = mockFindReports();
    await expenseReportsService.listReports("plain-user", [], {
      page: 1,
      limit: 20,
      search: "karun",
    } as never);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      employeeId: "plain-user",
      search: "karun",
    });
  });
});
