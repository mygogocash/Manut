import { describe, expect, it, vi } from "vitest";

import {
  buildInvestorWhere,
  investorsRepository,
} from "@/modules/investors/investors.repository";

/**
 * These exercise the REAL buildInvestorWhere and the REAL tag-append
 * statement, not the mocked repository `investors.service.test.ts` uses.
 *
 * That distinction is the point. The service tests prove the service CALLS the
 * repository; they cannot catch a wrong predicate inside it. Both things
 * covered here are silent when broken:
 *
 *   * `statusIn` is what stops a board-originated "select all N matching"
 *     reaching rows whose status has no column. If it stopped applying, the
 *     bar would offer 214 and the write would touch 220 — no error, just more
 *     rows than the user agreed to.
 *   * the tag-append guard is what stops a Postgres array accumulating the
 *     same code twice. Without it a re-run silently doubles entries.
 */

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    investor: { updateMany: vi.fn(() => ({ count: 0 })) },
    $transaction: vi.fn((ops: unknown[]) => Promise.resolve(ops)),
  },
}));

describe("buildInvestorWhere — statusIn", () => {
  it("matches the whole configured stage set", () => {
    const where = buildInvestorWhere({ statusIn: ["lead", "dd", "closed"] });
    expect(where.status).toEqual({ in: ["lead", "dd", "closed"] });
  });

  it("takes precedence over a single status", () => {
    // The board sends the set, the list sends the single value. If both ever
    // arrive, the set wins — asserted so the precedence cannot silently flip.
    const where = buildInvestorWhere({ status: "lead", statusIn: ["dd"] });
    expect(where.status).toEqual({ in: ["dd"] });
  });

  it("treats an empty statusIn as NO stage filter, not as match-nothing", () => {
    // A board with no configured stages must not silently resolve to zero
    // rows — that reads as data loss. It falls through to `status`, and with
    // neither present the key is absent entirely.
    expect(buildInvestorWhere({ statusIn: [] }).status).toBeUndefined();
    expect(buildInvestorWhere({ statusIn: [], status: "lead" }).status).toBe(
      "lead",
    );
  });

  it("composes with the other facets rather than replacing them", () => {
    const where = buildInvestorWhere({
      statusIn: ["lead"],
      tag: "seed-checks",
      archived: true,
      fundraisingEntity: "tbl",
    });
    expect(where).toMatchObject({
      status: { in: ["lead"] },
      tags: { has: "seed-checks" },
      archivedAt: { not: null },
      fundraisingEntity: "tbl",
    });
  });

  it("omits the archive filter when archived is undefined", () => {
    // Callers that leave it off see both active and archived rows. This is
    // what pipelineTotals must NOT do, hence its explicit `?? false`.
    expect(buildInvestorWhere({}).archivedAt).toBeUndefined();
  });
});

describe("investorsRepository.addTagCodes", () => {
  it("guards every append on the code being absent", async () => {
    const { prisma } = await import("@/infrastructure/database/prisma");
    const updateMany = prisma.investor.updateMany as unknown as ReturnType<
      typeof vi.fn
    >;
    updateMany.mockClear();

    await investorsRepository.addTagCodes({ id: { in: ["a", "b"] } }, [
      "vc",
      "seed-checks",
    ]);

    expect(updateMany).toHaveBeenCalledTimes(2);
    const [first] = updateMany.mock.calls[0] as [
      { where: { AND: unknown[] }; data: unknown },
    ];
    // Postgres arrays are not sets: without the NOT-has guard, a row that
    // already carries the code ends up with it twice.
    expect(first.where.AND).toEqual([
      { id: { in: ["a", "b"] } },
      { NOT: { tags: { has: "vc" } } },
    ]);
    expect(first.data).toEqual({ tags: { push: "vc" } });
  });

  it("runs every code in ONE transaction", async () => {
    const { prisma } = await import("@/infrastructure/database/prisma");
    const tx = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;
    tx.mockClear();

    await investorsRepository.addTagCodes({ id: { in: ["a"] } }, ["x", "y"]);

    // A loop of independent writes would leave some codes applied and the
    // rest not when one fails mid-batch, with no record of which landed.
    expect(tx).toHaveBeenCalledTimes(1);
    expect(tx.mock.calls[0]?.[0]).toHaveLength(2);
  });
});
