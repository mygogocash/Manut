import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { accountRepository } from "@/modules/accounts/accounts.repository";
import { contactRepository } from "@/modules/contacts/contacts.repository";
import { opportunityRepository } from "@/modules/opportunities/opportunities.repository";
import { OpportunityService } from "@/modules/opportunities/opportunities.service";

vi.mock("@/modules/accounts/accounts.repository", () => ({
  accountRepository: { findById: vi.fn() },
}));

vi.mock("@/modules/contacts/contacts.repository", () => ({
  contactRepository: { findById: vi.fn() },
}));

vi.mock("@/modules/opportunities/opportunities.repository", () => ({
  opportunityRepository: {
    findMany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    pipelineSummary: vi.fn(),
    forecastRows: vi.fn(),
    findStageConfig: vi.fn().mockResolvedValue(null),
    findManyByIds: vi.fn(),
  },
}));

// The per-business-unit child rows are exercised in
// opportunities.write-path-bu.test.ts. Stubbed here so these §11.4
// probability/stage tests don't need a database.
vi.mock(
  "@/modules/opportunities/opportunity-business-units.repository",
  () => ({
    ensureBusinessUnitRows: vi.fn(async () => ({
      mode: "synced",
      added: [],
      removed: [],
    })),
    pushDealFieldsToBusinessUnits: vi.fn(async () => {}),
    recomputeOpportunityRollup: vi.fn(async () => {}),
  }),
);

// Forecast service consults exchange_rates via Prisma. Stub the
// resolveRate helper so unit tests don't need a real DB.
vi.mock("@/modules/exchange-rates/exchange-rates.service", () => ({
  createExchangeRateService: () => ({
    resolveRate: vi.fn(async (from: string, to: string) => {
      if (from === to) return { rate: 1, source: "identity" };
      const rates: Record<string, number> = {
        "THB-USD": 1 / 36,
        "EUR-USD": 1.1,
        "USD-USD": 1,
      };
      const key = `${from}-${to}`;
      if (rates[key] !== undefined) {
        return { rate: rates[key], source: "direct" };
      }
      return { rate: 0, source: "missing" };
    }),
  }),
}));

const findAccount = accountRepository.findById as Mock;
const findContact = contactRepository.findById as Mock;
const findMany = opportunityRepository.findMany as Mock;
const findById = opportunityRepository.findById as Mock;
const create = opportunityRepository.create as Mock;
const update = opportunityRepository.update as Mock;
const remove = opportunityRepository.delete as Mock;
const pipelineSummary = opportunityRepository.pipelineSummary as Mock;
const forecastRows = opportunityRepository.forecastRows as Mock;

const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";

const baseAccount = { id: "acc-1", name: "Acme", ownerId: USER_ID };

const baseOpp = {
  id: "opp-1",
  name: "Acme Q3",
  accountId: "acc-1",
  contactId: null,
  stage: "qualified",
  value: 1000,
  currency: "USD",
  probability: 20,
  probabilityCustom: false,
  closeDate: null,
  type: null,
  notes: null,
  ownerId: USER_ID,
  lostReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("OpportunityService", () => {
  let service: OpportunityService;

  beforeEach(() => {
    service = new OpportunityService();
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("scopes to caller without crm:team-read", async () => {
      findMany.mockResolvedValue({ data: [], total: 0 });
      await service.list(USER_ID, ["crm:read"], {
        page: 1,
        limit: 20,
        archived: false,
      });
      expect(findMany).toHaveBeenCalledWith(
        { archived: false, ownerScope: [USER_ID] },
        1,
        20,
      );
    });
  });

  describe("pipeline", () => {
    it("delegates to repo with proper scope", async () => {
      pipelineSummary.mockResolvedValue([]);
      await service.pipeline(USER_ID, ["crm:read", "crm:team-read"]);
      expect(pipelineSummary).toHaveBeenCalledWith(
        { ownerScope: undefined },
        {},
      );
    });

    it("forwards the board filters so headers match the filtered cards", async () => {
      pipelineSummary.mockResolvedValue([]);
      await service.pipeline(USER_ID, ["crm:read", "crm:team-read"], {
        businessUnit: "onewave",
        region: "APAC",
      });
      expect(pipelineSummary).toHaveBeenCalledWith(
        { ownerScope: undefined },
        { businessUnit: "onewave", region: "APAC" },
      );
    });
  });

  describe("create — §11.4 probability defaults", () => {
    it("snaps probability to stage default when omitted", async () => {
      findAccount.mockResolvedValue(baseAccount);
      create.mockResolvedValue(baseOpp);

      await service.create(USER_ID, ["crm:create"], {
        name: "Acme Q3",
        accountId: "acc-1",
        stage: "negotiation",
        value: 5000,
        currency: "USD",
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          probability: 60,
          probabilityCustom: false,
          stage: "negotiation",
        }),
      );
    });

    it("flips probabilityCustom when caller supplies probability", async () => {
      findAccount.mockResolvedValue(baseAccount);
      create.mockResolvedValue(baseOpp);

      await service.create(USER_ID, ["crm:create"], {
        name: "Acme Q3",
        accountId: "acc-1",
        stage: "qualified",
        value: 5000,
        currency: "USD",
        probability: 75,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          probability: 75,
          probabilityCustom: true,
        }),
      );
    });

    it("rejects when account is not visible to caller", async () => {
      findAccount.mockResolvedValue({
        ...baseAccount,
        ownerId: OTHER_USER_ID,
      });

      await expect(
        service.create(USER_ID, ["crm:create"], {
          name: "X",
          accountId: "acc-1",
          stage: "qualified",
          value: 1,
          currency: "USD",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects when contact does not belong to account", async () => {
      findAccount.mockResolvedValue(baseAccount);
      findContact.mockResolvedValue({ id: "c-1", accountId: "OTHER" });

      await expect(
        service.create(USER_ID, ["crm:create"], {
          name: "X",
          accountId: "acc-1",
          contactId: "c-1",
          stage: "qualified",
          value: 1,
          currency: "USD",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("update — §11.4 stage / probability interplay", () => {
    it("re-arms the close-date reminder ladder when closeDate changes", async () => {
      findById.mockResolvedValue(baseOpp);
      update.mockResolvedValue(baseOpp);

      await service.update("opp-1", USER_ID, ["crm:update"], {
        closeDate: "2026-08-15",
      });

      expect(update).toHaveBeenCalledWith(
        "opp-1",
        expect.objectContaining({
          remindersSent: [],
          lastReminderSentAt: null,
        }),
      );
    });

    it("does NOT reset the reminder ladder when closeDate is untouched", async () => {
      findById.mockResolvedValue(baseOpp);
      update.mockResolvedValue(baseOpp);

      await service.update("opp-1", USER_ID, ["crm:update"], {
        notes: "called them",
      });

      const args = update.mock.calls[0][1] as Record<string, unknown>;
      expect(args.remindersSent).toBeUndefined();
    });

    it("snaps probability on stage change when probabilityCustom = false", async () => {
      findById.mockResolvedValue({
        ...baseOpp,
        stage: "qualified",
        probability: 20,
        probabilityCustom: false,
      });
      update.mockResolvedValue(baseOpp);

      await service.update("opp-1", USER_ID, ["crm:update"], {
        stage: "proposal",
      });

      expect(update).toHaveBeenCalledWith(
        "opp-1",
        expect.objectContaining({ stage: "proposal", probability: 40 }),
      );
    });

    it("preserves manual probability on stage change when probabilityCustom = true", async () => {
      findById.mockResolvedValue({
        ...baseOpp,
        stage: "qualified",
        probability: 75,
        probabilityCustom: true,
      });
      update.mockResolvedValue(baseOpp);

      await service.update("opp-1", USER_ID, ["crm:update"], {
        stage: "proposal",
      });

      const args = update.mock.calls[0][1] as Record<string, unknown>;
      expect(args).not.toHaveProperty("probability");
      expect(args.stage).toBe("proposal");
    });

    it("flips probabilityCustom when rep supplies probability directly", async () => {
      findById.mockResolvedValue({
        ...baseOpp,
        probabilityCustom: false,
      });
      update.mockResolvedValue(baseOpp);

      await service.update("opp-1", USER_ID, ["crm:update"], {
        probability: 55,
      });

      expect(update).toHaveBeenCalledWith(
        "opp-1",
        expect.objectContaining({ probability: 55, probabilityCustom: true }),
      );
    });

    it("allows field edits on a closed_won opportunity (BD-feedback)", async () => {
      findById.mockResolvedValue({ ...baseOpp, stage: "closed_won" });
      update.mockResolvedValue({ ...baseOpp, stage: "closed_won", value: 999 });

      await service.update("opp-1", USER_ID, ["crm:update"], { value: 999 });

      expect(update).toHaveBeenCalledWith(
        "opp-1",
        expect.objectContaining({ value: 999 }),
      );
    });

    it("allows field edits on a closed_lost opportunity (BD-feedback)", async () => {
      findById.mockResolvedValue({ ...baseOpp, stage: "closed_lost" });
      update.mockResolvedValue({
        ...baseOpp,
        stage: "closed_lost",
        value: 999,
      });

      await service.update("opp-1", USER_ID, ["crm:update"], { value: 999 });

      expect(update).toHaveBeenCalledWith(
        "opp-1",
        expect.objectContaining({ value: 999 }),
      );
    });
  });

  describe("closeLost", () => {
    it("flips stage and zeroes probability even when probabilityCustom was true", async () => {
      findById.mockResolvedValue({
        ...baseOpp,
        stage: "negotiation",
        probability: 60,
        probabilityCustom: true,
      });
      update.mockResolvedValue(baseOpp);

      await service.closeLost("opp-1", USER_ID, ["crm:update"], {
        lostReason: "no budget",
      });

      expect(update).toHaveBeenCalledWith("opp-1", {
        stage: "closed_lost",
        lostReason: "no budget",
        sortOrderWithinStage: 0,
        probability: 0,
      });
    });

    it("rejects when already closed_lost", async () => {
      findById.mockResolvedValue({ ...baseOpp, stage: "closed_lost" });

      await expect(
        service.closeLost("opp-1", USER_ID, ["crm:update"], {}),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects closing a live deal as lost — reopen first", async () => {
      findById.mockResolvedValue({ ...baseOpp, stage: "live" });

      await expect(
        service.closeLost("opp-1", USER_ID, ["crm:update"], {}),
      ).rejects.toThrow(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe("reopen — §11.4", () => {
    it("flips closed_lost back to qualified and snaps probability when not custom", async () => {
      findById.mockResolvedValue({
        ...baseOpp,
        stage: "closed_lost",
        probability: 0,
        probabilityCustom: false,
        lostReason: "no budget",
      });
      update.mockResolvedValue(baseOpp);

      await service.reopen("opp-1", USER_ID, ["crm:update"], {
        stage: "qualified",
      });

      expect(update).toHaveBeenCalledWith("opp-1", {
        stage: "qualified",
        lostReason: null,
        sortOrderWithinStage: 0,
        probability: 20,
      });
    });

    it("reopens a live deal back into the active pipeline", async () => {
      findById.mockResolvedValue({
        ...baseOpp,
        stage: "live",
        probability: 100,
        probabilityCustom: false,
      });
      update.mockResolvedValue(baseOpp);

      await service.reopen("opp-1", USER_ID, ["crm:update"], {
        stage: "negotiation",
      });

      expect(update).toHaveBeenCalledWith("opp-1", {
        stage: "negotiation",
        lostReason: null,
        sortOrderWithinStage: 0,
        probability: 60,
      });
    });

    it("preserves rep-set probability when probabilityCustom = true", async () => {
      findById.mockResolvedValue({
        ...baseOpp,
        stage: "closed_won",
        probability: 88,
        probabilityCustom: true,
        lostReason: null,
      });
      update.mockResolvedValue(baseOpp);

      await service.reopen("opp-1", USER_ID, ["crm:update"], {
        stage: "negotiation",
      });

      const args = update.mock.calls[0][1] as Record<string, unknown>;
      expect(args).not.toHaveProperty("probability");
      expect(args.stage).toBe("negotiation");
      expect(args.lostReason).toBeNull();
    });

    it("rejects when opportunity is still in the live pipeline", async () => {
      findById.mockResolvedValue({ ...baseOpp, stage: "qualified" });

      await expect(
        service.reopen("opp-1", USER_ID, ["crm:update"], {
          stage: "qualified",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });

    it("hides reopen target owned by another rep", async () => {
      findById.mockResolvedValue({
        ...baseOpp,
        stage: "closed_lost",
        ownerId: OTHER_USER_ID,
      });

      await expect(
        service.reopen("opp-1", USER_ID, ["crm:update"], {
          stage: "qualified",
        }),
      ).rejects.toThrow(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe("getById / delete ownership", () => {
    it("hides opportunities owned by other reps", async () => {
      findById.mockResolvedValue({ ...baseOpp, ownerId: OTHER_USER_ID });

      await expect(
        service.getById("opp-1", USER_ID, ["crm:read"]),
      ).rejects.toThrow(NotFoundException);
    });

    it("blocks delete when caller does not own the row", async () => {
      findById.mockResolvedValue({ ...baseOpp, ownerId: OTHER_USER_ID });

      await expect(
        service.delete("opp-1", USER_ID, ["crm:delete"]),
      ).rejects.toThrow(NotFoundException);
      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe("forecast — §11.5", () => {
    it("aggregates active opportunities into the report currency", async () => {
      forecastRows.mockResolvedValue([
        // 10000 USD @ 40% probability  → unweighted 10000, weighted 4000
        {
          id: "1",
          stage: "qualified",
          currency: "USD",
          value: 10_000,
          probability: 40,
        },
        // 360000 THB @ 20% probability → 1/36 USD/THB → unweighted 10000,
        // weighted 2000
        {
          id: "2",
          stage: "qualified",
          currency: "THB",
          value: 360_000,
          probability: 20,
        },
        // 5000 EUR @ 60% → 1.1 USD/EUR → unweighted 5500, weighted 3300
        {
          id: "3",
          stage: "negotiation",
          currency: "EUR",
          value: 5_000,
          probability: 60,
        },
      ]);

      const result = await service.forecast(USER_ID, ["crm:read"], "USD");

      expect(result.reportCurrency).toBe("USD");
      expect(result.totalOpportunities).toBe(3);
      expect(result.convertedCount).toBe(3);
      expect(result.unweighted).toBeCloseTo(25_500, 0);
      expect(result.weighted).toBeCloseTo(9_300, 0);
      expect(result.byStage).toHaveLength(2);
      expect(result.missingRates).toEqual([]);
    });

    it("flags opportunities with no rate path to the report currency", async () => {
      forecastRows.mockResolvedValue([
        {
          id: "1",
          stage: "qualified",
          currency: "USD",
          value: 1_000,
          probability: 50,
        },
        // No rate seeded for SGD-USD in the test stub.
        {
          id: "2",
          stage: "proposal",
          currency: "SGD",
          value: 5_000,
          probability: 40,
        },
      ]);

      const result = await service.forecast(USER_ID, ["crm:read"], "USD");

      expect(result.totalOpportunities).toBe(2);
      expect(result.convertedCount).toBe(1);
      expect(result.unweighted).toBe(1_000);
      expect(result.weighted).toBe(500);
      expect(result.missingRates).toEqual([{ currency: "SGD", count: 1 }]);
    });

    it("scopes to caller without crm:team-read", async () => {
      forecastRows.mockResolvedValue([]);

      await service.forecast(USER_ID, ["crm:read"], "USD");

      expect(forecastRows).toHaveBeenCalledWith({ ownerScope: [USER_ID] });
    });
  });
});
