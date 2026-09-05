import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { qaCrmService } from "@/modules/qa-crm/qa-crm.service";

// Native-clone archive test (mirrors it-crm.archive.test). A qa-crm:read-all
// holder resolves as "admin" in requireMembership WITHOUT a DB lookup, so no
// member mock is needed. Represents the QA/Legal/Accounting/Product family —
// all four share this exact archive shape.
const db = vi.hoisted(() => ({
  qaProject: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: db }));

const ADMIN = [PERMISSIONS.QA_CRM_READ_ALL];
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
  db.qaProject.findMany.mockResolvedValue([]);
  db.qaProject.count.mockResolvedValue(0);
  db.qaProject.update.mockResolvedValue({});
});

describe("qa-crm list — archive filter", () => {
  it("excludes archived rows by default (archivedAt = null)", async () => {
    await qaCrmService.list(ACTOR, ADMIN, baseQuery({ archived: false }));
    expect(db.qaProject.findMany.mock.calls[0][0].where.archivedAt).toBeNull();
    // count uses the same where so pagination totals match the view.
    expect(db.qaProject.count.mock.calls[0][0].where.archivedAt).toBeNull();
  });

  it("returns only archived rows when archived=true", async () => {
    await qaCrmService.list(ACTOR, ADMIN, baseQuery({ archived: true }));
    expect(db.qaProject.findMany.mock.calls[0][0].where.archivedAt).toEqual({
      not: null,
    });
  });
});

describe("qa-crm archive / unarchive", () => {
  it("stamps archivedAt when the project is active", async () => {
    db.qaProject.findUnique.mockResolvedValue({ archivedAt: null });
    await qaCrmService.archive(ID, ACTOR, ADMIN);
    expect(db.qaProject.update.mock.calls[0][0].data.archivedAt).toBeInstanceOf(
      Date,
    );
  });

  it("is idempotent — keeps the original archivedAt when already archived", async () => {
    const original = new Date("2026-06-01T00:00:00.000Z");
    db.qaProject.findUnique.mockResolvedValue({ archivedAt: original });
    await qaCrmService.archive(ID, ACTOR, ADMIN);
    expect(db.qaProject.update.mock.calls[0][0].data.archivedAt).toBe(original);
  });

  it("clears archivedAt on unarchive", async () => {
    db.qaProject.findUnique.mockResolvedValue({ id: ID });
    await qaCrmService.unarchive(ID, ACTOR, ADMIN);
    expect(db.qaProject.update.mock.calls[0][0].data.archivedAt).toBeNull();
  });
});
