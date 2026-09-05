import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { LeadService } from "@/modules/leads/leads.service";

// Full-stack archive test for the secondary Sales-CRM lists. Unlike the
// native-clone CRMs (qa/legal/…), the leads-family service delegates to a
// real repository, so we mock prisma.lead directly and let the real
// repository + service run — that way the assertion covers the actual
// `where.archivedAt` the repository builds AND the service archive/unarchive
// idempotency. Representative for the 9 secondary records (Account / Contact /
// Lead × Sales, Sales Revenue, Investor) which all share this exact shape.
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    lead: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    leadSource: { findUnique: vi.fn() },
  },
}));

// Imported at module load by leads.service; stub so the import is side-effect
// free (archive/list paths never send email).
vi.mock("@/infrastructure/email/email.service", () => ({ sendEmail: vi.fn() }));

const service = new LeadService();

// `crm:team-read` ⇒ canSeeAll ⇒ getById skips the owner check, so no per-row
// ownership plumbing is needed to reach the archive/list logic under test.
const TEAM = ["crm:team-read"];
const USER = "11111111-1111-1111-1111-111111111111";
const ID = "lead-1";

function listQuery(over: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 20,
    search: undefined,
    status: undefined,
    source: undefined,
    ownerId: undefined,
    archived: false,
    ...over,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.lead.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.lead.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
  (prisma.lead.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
});

describe("leads list — archive filter", () => {
  it("excludes archived rows by default (archivedAt = null)", async () => {
    await service.list(USER, TEAM, listQuery({ archived: false }));
    const findWhere = (prisma.lead.findMany as ReturnType<typeof vi.fn>).mock
      .calls[0][0].where;
    const countWhere = (prisma.lead.count as ReturnType<typeof vi.fn>).mock
      .calls[0][0].where;
    // findMany + count must share the same where so pagination totals match.
    expect(findWhere.archivedAt).toBeNull();
    expect(countWhere.archivedAt).toBeNull();
  });

  it("returns only archived rows when archived=true", async () => {
    await service.list(USER, TEAM, listQuery({ archived: true }));
    const where = (prisma.lead.findMany as ReturnType<typeof vi.fn>).mock
      .calls[0][0].where;
    expect(where.archivedAt).toEqual({ not: null });
  });
});

describe("leads archive / unarchive", () => {
  it("stamps archivedAt when the lead is active", async () => {
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: ID,
      ownerId: USER,
      archivedAt: null,
    });
    await service.archive(ID, USER, TEAM);
    const data = (prisma.lead.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0].data;
    expect(data.archivedAt).toBeInstanceOf(Date);
  });

  it("is idempotent — keeps the original archivedAt when already archived", async () => {
    const original = new Date("2026-06-01T00:00:00.000Z");
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: ID,
      ownerId: USER,
      archivedAt: original,
    });
    await service.archive(ID, USER, TEAM);
    const data = (prisma.lead.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0].data;
    expect(data.archivedAt).toBe(original);
  });

  it("clears archivedAt on unarchive", async () => {
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: ID,
      ownerId: USER,
      archivedAt: new Date(),
    });
    await service.unarchive(ID, USER, TEAM);
    const data = (prisma.lead.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0].data;
    expect(data.archivedAt).toBeNull();
  });
});
