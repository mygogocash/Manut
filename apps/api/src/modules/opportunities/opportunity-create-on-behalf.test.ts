import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { accountRepository } from "@/modules/accounts/accounts.repository";
import { opportunityRepository } from "@/modules/opportunities/opportunities.repository";
import { OpportunityService } from "@/modules/opportunities/opportunities.service";

/**
 * Create-on-behalf-of + provenance — the two fields added for the ARIA
 * Revenue migration.
 *
 * The gate is the whole feature: `ownerId` honoured for a `crm:team-read`
 * holder and SILENTLY ignored for anyone else. Without the silent-ignore
 * half, a rep could park deals on a teammate; without the honour half, the
 * migration's 13 deals end up owned by the admin running it and vanish from
 * the actual owner's scoped views (there is no reassign endpoint to fix
 * that in-app).
 */

vi.mock("@/modules/accounts/accounts.repository", () => ({
  accountRepository: { findById: vi.fn() },
}));
vi.mock("@/modules/contacts/contacts.repository", () => ({
  contactRepository: { findById: vi.fn() },
}));
vi.mock("@/modules/opportunities/opportunities.repository", () => ({
  opportunityRepository: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findStageConfig: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock(
  "@/modules/opportunities/opportunity-business-units.repository",
  () => ({
    ensureBusinessUnitRows: vi.fn(async () => ({
      mode: "seeded",
      added: ["aria"],
      removed: [],
    })),
    listBusinessUnitRows: vi.fn(async () => []),
    pushDealFieldsToBusinessUnits: vi.fn(async () => {}),
    recomputeOpportunityRollup: vi.fn(async () => {}),
  }),
);
vi.mock("@/modules/opportunities/opportunity-business-unit-moves", () => ({
  moveBusinessUnitRow: vi.fn(async () => true),
}));
// Every create fires a best-effort email; keep the unit tests offline.
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: { crmSettings: { findFirst: vi.fn(async () => null) } },
}));
vi.mock("@/infrastructure/email/email.service", () => ({
  deliverEmail: vi.fn(async () => {}),
}));

const ACTOR = "11111111-1111-4111-8111-111111111111";
const VIVEK = "22222222-2222-4222-8222-222222222222";

const service = new OpportunityService();

function arrange() {
  (accountRepository.findById as Mock).mockResolvedValue({
    id: "acc1",
    ownerId: ACTOR,
  });
  (opportunityRepository.create as Mock).mockImplementation(
    async (data: Record<string, unknown>) => ({
      id: "opp1",
      stage: "qualified",
      businessUnits: [],
      ...data,
    }),
  );
  (opportunityRepository.findById as Mock).mockResolvedValue({
    id: "opp1",
    ownerId: ACTOR,
    stage: "qualified",
    probabilityCustom: false,
    businessUnits: [],
    accountId: "acc1",
  });
}

const BASE = { name: "Robi", accountId: "acc1", value: 240000 };

beforeEach(() => {
  vi.clearAllMocks();
  arrange();
});

describe("create on behalf of", () => {
  it("honours ownerId for a crm:team-read holder", async () => {
    await service.create(ACTOR, ["crm:read", "crm:team-read"], {
      ...BASE,
      ownerId: VIVEK,
    } as never);

    const data = (opportunityRepository.create as Mock).mock.calls[0][0];
    expect(data.owner).toEqual({ connect: { id: VIVEK } });
  });

  it("silently ignores ownerId without crm:team-read", async () => {
    // Ignored, not rejected: a 403 would turn a stale UI payload into a hard
    // failure for ordinary reps, and the fallback is what every create did
    // before the field existed.
    await service.create(ACTOR, ["crm:read", "crm:create"], {
      ...BASE,
      ownerId: VIVEK,
    } as never);

    const data = (opportunityRepository.create as Mock).mock.calls[0][0];
    expect(data.owner).toEqual({ connect: { id: ACTOR } });
  });

  it("writes legacyDealId through on create", async () => {
    // Provenance + idempotency: the column is DB-unique, so a re-run of the
    // migration fails loudly instead of duplicating the deal. It was absent
    // from the enumerated field mapping before — the exact silent-drop shape
    // that bit investor tags (#1156).
    await service.create(ACTOR, ["crm:read", "crm:team-read"], {
      ...BASE,
      legacyDealId: "rev_abc123",
    } as never);

    const data = (opportunityRepository.create as Mock).mock.calls[0][0];
    expect(data.legacyDealId).toBe("rev_abc123");
  });
});

describe("update on behalf of (stub transform)", () => {
  it("reassigns owner + stamps legacyDealId for a team-read holder", async () => {
    await service.update("opp1", ACTOR, ["crm:read", "crm:team-read"], {
      ownerId: VIVEK,
      legacyDealId: "rev_abc123",
    } as never);

    const data = (opportunityRepository.update as Mock).mock.calls[0][1];
    expect(data.owner).toEqual({ connect: { id: VIVEK } });
    expect(data.legacyDealId).toBe("rev_abc123");
  });

  it("drops the reassignment without crm:team-read", async () => {
    await service.update("opp1", ACTOR, ["crm:read", "crm:update"], {
      ownerId: VIVEK,
      name: "renamed",
    } as never);

    const data = (opportunityRepository.update as Mock).mock.calls[0][1];
    expect(data.owner).toBeUndefined();
    expect(data.name).toBe("renamed");
  });
});
