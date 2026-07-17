import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { itCrmService } from "@/modules/it-crm/it-crm.service";
import { mockArgument } from "@/test-utils/assertions";

// Mock only the ItProject model methods the archive path touches. An actor
// holding it-crm:read-all resolves as "admin" in requireMembership WITHOUT a
// DB lookup, so no itProjectMember mock is needed. `vi.mock` is hoisted above
// these imports by vitest, so the service sees the mocked prisma.
const db = vi.hoisted(() => ({
  itProject: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: db }));

const ADMIN = [PERMISSIONS.IT_CRM_READ_ALL];
const ACTOR = "user-1";
const ID = "proj-1";

function baseQuery(over: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 20,
    search: undefined,
    status: undefined,
    department: undefined,
    archived: false,
    ...over,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.itProject.findMany.mockResolvedValue([]);
  db.itProject.count.mockResolvedValue(0);
  db.itProject.update.mockResolvedValue({});
});

describe("it-crm list — archive filter", () => {
  it("excludes archived rows by default (archivedAt = null)", async () => {
    await itCrmService.list(ACTOR, ADMIN, baseQuery({ archived: false }));
    const where = mockArgument(db.itProject.findMany.mock.calls, 0, 0).where;
    expect(where.archivedAt).toBeNull();
    // count uses the same where so pagination totals match the view.
    expect(
      mockArgument(db.itProject.count.mock.calls, 0, 0).where.archivedAt,
    ).toBeNull();
  });

  it("returns only archived rows when archived=true (archivedAt not null)", async () => {
    await itCrmService.list(ACTOR, ADMIN, baseQuery({ archived: true }));
    const where = mockArgument(db.itProject.findMany.mock.calls, 0, 0).where;
    expect(where.archivedAt).toEqual({ not: null });
  });

  it("keeps search and owner-scope as SEPARATE ANDed groups for a non read-all caller (no scope bypass)", async () => {
    // Empty perms → canSeeAll is false → ownership must be enforced even with
    // a search term. Merging both into one `where.OR` would let the search
    // alone satisfy the predicate (RBAC leak).
    await itCrmService.list(ACTOR, [], baseQuery({ search: "payroll" }));
    const where = mockArgument(db.itProject.findMany.mock.calls, 0, 0).where;
    expect(where.OR).toBeUndefined();
    expect(Array.isArray(where.AND)).toBe(true);
    const groups = where.AND as Array<{ OR?: Array<Record<string, unknown>> }>;
    const hasSearchGroup = groups.some((g) =>
      (g.OR ?? []).some((c) => "name" in c),
    );
    const hasOwnerGroup = groups.some((g) =>
      (g.OR ?? []).some((c) => c.ownerId === ACTOR),
    );
    expect(hasSearchGroup).toBe(true);
    expect(hasOwnerGroup).toBe(true);
  });
});

describe("it-crm archive / unarchive", () => {
  it("stamps archivedAt when the project is active", async () => {
    db.itProject.findUnique.mockResolvedValue({ archivedAt: null });
    await itCrmService.archive(ID, ACTOR, ADMIN);
    const data = mockArgument(db.itProject.update.mock.calls, 0, 0).data;
    expect(data.archivedAt).toBeInstanceOf(Date);
  });

  it("is idempotent — keeps the original archivedAt when already archived", async () => {
    const original = new Date("2026-06-01T00:00:00.000Z");
    db.itProject.findUnique.mockResolvedValue({ archivedAt: original });
    await itCrmService.archive(ID, ACTOR, ADMIN);
    const data = mockArgument(db.itProject.update.mock.calls, 0, 0).data;
    expect(data.archivedAt).toBe(original);
  });

  it("clears archivedAt on unarchive", async () => {
    db.itProject.findUnique.mockResolvedValue({ id: ID });
    await itCrmService.unarchive(ID, ACTOR, ADMIN);
    const data = mockArgument(db.itProject.update.mock.calls, 0, 0).data;
    expect(data.archivedAt).toBeNull();
  });
});
