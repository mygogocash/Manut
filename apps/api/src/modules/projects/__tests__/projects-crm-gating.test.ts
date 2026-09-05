import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { projectRepository } from "@/modules/projects/projects.repository";

// projectRepository.findMany builds its WHERE as an AND of independent
// clauses (status / team / department / agreement / archived / search /
// ownership). These tests assert the caller's filters survive into that
// AND and that optional filters are only applied when supplied.
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    project: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

const findMany = prisma.project.findMany as unknown as ReturnType<typeof vi.fn>;

/** Flatten the AND clauses of the where Prisma actually received. */
function whereClauses() {
  const arg = findMany.mock.calls[0]?.[0] as
    | { where?: { AND?: unknown[] } }
    | undefined;
  return (arg?.where?.AND ?? []) as Array<Record<string, unknown>>;
}

describe("projectRepository.findMany filters", () => {
  beforeEach(() => findMany.mockClear());

  it("keeps the caller's own filters alongside the archive gate", async () => {
    await projectRepository.findMany(
      { team: "general", status: "active" },
      1,
      20,
    );
    const clauses = whereClauses();
    expect(clauses).toContainEqual({ team: "general" });
    expect(clauses).toContainEqual({ status: "active" });
  });

  it("hides archived projects on the active board, shows only them on Archived", async () => {
    findMany.mockClear();
    await projectRepository.findMany({}, 1, 20); // active (archived undefined)
    expect(whereClauses()).toContainEqual({ archivedAt: null });

    findMany.mockClear();
    await projectRepository.findMany({ archived: true }, 1, 20);
    expect(whereClauses()).toContainEqual({ archivedAt: { not: null } });
  });

  it("applies the agreement filter only when set", async () => {
    await projectRepository.findMany({ agreement: "not_signed" }, 1, 20);
    expect(whereClauses()).toContainEqual({ agreement: "not_signed" });

    // Absent agreement → no agreement clause added to the where.
    findMany.mockClear();
    await projectRepository.findMany({ team: "general" }, 1, 20);
    expect(
      whereClauses().some((c) =>
        Object.prototype.hasOwnProperty.call(c, "agreement"),
      ),
    ).toBe(false);
  });
});
