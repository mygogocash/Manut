import { describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { prisma } from "@/infrastructure/database/prisma";
import { performanceRepository } from "@/modules/performance/performance.repository";
import { performanceService } from "@/modules/performance/performance.service";
import { appraisalQuerySchema } from "@/modules/performance/performance.validation";

/*
 * The Appraisals table has always had a "Search by employee" box, and the term
 * never left the component: it was declared, debounced, bound to the input, and
 * used for nothing except resetting the page number. Typing a name jumped to
 * page 1 and showed the same rows.
 */
const HR = [PERMISSIONS.PERFORMANCE_HR_MANAGE];

describe("appraisalQuerySchema", () => {
  it("accepts a search term", () => {
    expect(appraisalQuerySchema.parse({ search: "karun" }).search).toBe(
      "karun",
    );
  });

  it("trims, and treats a blank term as absent", () => {
    expect(appraisalQuerySchema.parse({ search: "  karun " }).search).toBe(
      "karun",
    );
    expect(
      appraisalQuerySchema.parse({ search: "   " }).search,
    ).toBeUndefined();
    expect(appraisalQuerySchema.parse({}).search).toBeUndefined();
  });
});

describe("listAppraisals forwards the search to the database", () => {
  const mockFind = () =>
    vi
      .spyOn(performanceRepository, "findAppraisals")
      .mockResolvedValue({ data: [], total: 0 } as never);

  it("passes the term through for an HR caller", async () => {
    const spy = mockFind();
    await performanceService.listAppraisals("hr-user", HR, {
      page: 1,
      limit: 20,
      search: "karun",
    } as never);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ search: "karun" });
    vi.restoreAllMocks();
  });

  // Searching must narrow what the caller may already see, never widen it.
  it("keeps a plain employee scoped to themselves while searching", async () => {
    const spy = mockFind();
    await performanceService.listAppraisals("plain-user", [], {
      page: 1,
      limit: 20,
      search: "someone else",
    } as never);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      employeeId: "plain-user",
      search: "someone else",
    });
    vi.restoreAllMocks();
  });

  it("keeps a manager scoped to their reports while searching", async () => {
    const spy = mockFind();
    await performanceService.listAppraisals(
      "manager-user",
      [PERMISSIONS.PERFORMANCE_MANAGER_REVIEW],
      { page: 1, limit: 20, search: "karun" } as never,
    );
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      managerId: "manager-user",
      search: "karun",
    });
    vi.restoreAllMocks();
  });
});

/*
 * The service tests above prove the term is handed to the repository. This proves
 * the repository puts it in the query — the step whose absence was the whole bug.
 */
describe("findAppraisals builds a search filter", () => {
  it("matches employee name or email, and intersects the scoping", async () => {
    const findMany = vi
      .spyOn(prisma.appraisal, "findMany")
      .mockResolvedValue([] as never);
    const count = vi.spyOn(prisma.appraisal, "count").mockResolvedValue(0);

    await performanceRepository.findAppraisals(
      { managerId: "mgr-1", search: "karun" },
      1,
      20,
    );

    const where = findMany.mock.calls[0]?.[0]?.where as {
      AND?: Record<string, unknown>[];
    };
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { managerId: "mgr-1" },
        {
          OR: [
            { employee: { name: { contains: "karun", mode: "insensitive" } } },
            { employee: { email: { contains: "karun", mode: "insensitive" } } },
          ],
        },
      ]),
    );
    // Counted with the same object, so the pager agrees with the search.
    expect(count.mock.calls[0]?.[0]?.where).toEqual(where);
    vi.restoreAllMocks();
  });

  it("adds nothing when there is no term", async () => {
    const findMany = vi
      .spyOn(prisma.appraisal, "findMany")
      .mockResolvedValue([] as never);
    vi.spyOn(prisma.appraisal, "count").mockResolvedValue(0);

    await performanceRepository.findAppraisals({ status: "pending" }, 1, 20);

    const where = findMany.mock.calls[0]?.[0]?.where as {
      AND?: Record<string, unknown>[];
    };
    expect(where.AND).toEqual([{ status: "pending" }]);
    vi.restoreAllMocks();
  });
});
