import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { leadRepository } from "@/modules/leads/leads.repository";
import { LeadService } from "@/modules/leads/leads.service";

vi.mock("@/modules/leads/leads.repository", () => ({
  leadRepository: {
    findById: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Capture every tx call so individual tests can pre-load return values + assert
// what the convert path called and with which payload.
const txState: {
  account: {
    findUnique: Mock;
    findFirst: Mock;
    create: Mock;
  };
  contact: {
    findUnique: Mock;
    count: Mock;
    create: Mock;
  };
  opportunity: {
    create: Mock;
  };
  lead: {
    update: Mock;
  };
  crmActivity: {
    updateMany: Mock;
  };
} = {
  account: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  contact: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
  opportunity: { create: vi.fn() },
  lead: { update: vi.fn() },
  crmActivity: { updateMany: vi.fn() },
};

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(txState)),
  },
}));

const findLeadById = leadRepository.findById as Mock;

const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";

const baseLead = {
  id: "lead-1",
  company: "Acme",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@acme.com",
  phone: null,
  title: null,
  source: "web",
  status: "qualified",
  ownerId: USER_ID,
  notes: null,
  convertedOpportunityId: null,
  convertedAt: null,
  disqualifyReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseOpportunity = {
  id: "opp-new",
  name: "Acme Q3",
  accountId: "acc-new",
  contactId: "contact-new",
  stage: "qualified",
  value: 1000,
  currency: "USD",
  probability: 20,
  probabilityCustom: false,
  ownerId: USER_ID,
};

function resetTxState() {
  for (const table of Object.values(txState)) {
    for (const fn of Object.values(table) as Mock[]) {
      fn.mockReset();
    }
  }
  // Sensible default returns so tests only override what they care about.
  txState.account.findFirst.mockResolvedValue(null);
  txState.account.findUnique.mockResolvedValue(null);
  txState.contact.count.mockResolvedValue(0);
  txState.account.create.mockResolvedValue({ id: "acc-new" });
  txState.contact.create.mockResolvedValue({ id: "contact-new" });
  txState.opportunity.create.mockResolvedValue(baseOpportunity);
  txState.lead.update.mockResolvedValue({
    ...baseLead,
    status: "converted",
    convertedOpportunityId: "opp-new",
    convertedAt: new Date(),
  });
  txState.crmActivity.updateMany.mockResolvedValue({ count: 0 });
}

describe("LeadService.convert", () => {
  let service: LeadService;

  beforeEach(() => {
    service = new LeadService();
    vi.clearAllMocks();
    resetTxState();
  });

  const opportunityBody = {
    name: "Acme Q3",
    stage: "qualified" as const,
    value: 1000,
    currency: "USD",
  };

  it("synthesises Account + Contact from Lead when neither is supplied", async () => {
    findLeadById.mockResolvedValue(baseLead);

    await service.convert("lead-1", USER_ID, ["crm:update"], {
      opportunity: opportunityBody,
    });

    expect(txState.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Acme",
          owner: { connect: { id: USER_ID } },
        }),
      }),
    );
    expect(txState.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: "Jane",
          lastName: "Doe",
          isPrimary: true,
        }),
      }),
    );
    expect(txState.opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Acme Q3",
          probability: 20,
          probabilityCustom: false,
        }),
      }),
    );
    expect(txState.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead-1" },
        data: expect.objectContaining({
          status: "converted",
          convertedOpportunityId: "opp-new",
        }),
      }),
    );
    expect(txState.crmActivity.updateMany).toHaveBeenCalledWith({
      where: { leadId: "lead-1", opportunityId: null },
      data: { opportunityId: "opp-new" },
    });
  });

  it("hard-rejects when newAccount.domain already exists", async () => {
    findLeadById.mockResolvedValue(baseLead);
    txState.account.findUnique.mockResolvedValue({ id: "existing-acc" });

    await expect(
      service.convert("lead-1", USER_ID, ["crm:update"], {
        newAccount: { name: "Acme", domain: "acme.com" },
        opportunity: opportunityBody,
      }),
    ).rejects.toThrow(ConflictException);
    expect(txState.account.create).not.toHaveBeenCalled();
  });

  it("returns 409 candidate on case-insensitive name match without confirmCreate", async () => {
    findLeadById.mockResolvedValue(baseLead);
    txState.account.findFirst.mockResolvedValue({
      id: "existing-acc",
      name: "Acme",
    });

    await expect(
      service.convert("lead-1", USER_ID, ["crm:update"], {
        newAccount: { name: "ACME" },
        opportunity: opportunityBody,
      }),
    ).rejects.toThrow(ConflictException);
    expect(txState.account.create).not.toHaveBeenCalled();
  });

  it("creates a new account when confirmCreate=true overrides the name match", async () => {
    findLeadById.mockResolvedValue(baseLead);
    txState.account.findFirst.mockResolvedValue({
      id: "existing-acc",
      name: "Acme",
    });

    await service.convert("lead-1", USER_ID, ["crm:update"], {
      newAccount: { name: "Acme" },
      confirmCreate: true,
      opportunity: opportunityBody,
    });

    expect(txState.account.create).toHaveBeenCalled();
  });

  it("attaches existing account when accountId is supplied and visible", async () => {
    findLeadById.mockResolvedValue(baseLead);
    txState.account.findUnique.mockResolvedValue({
      id: "acc-existing",
      ownerId: USER_ID,
    });

    await service.convert("lead-1", USER_ID, ["crm:update"], {
      accountId: "acc-existing",
      opportunity: opportunityBody,
    });

    expect(txState.account.create).not.toHaveBeenCalled();
    expect(txState.opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          account: { connect: { id: "acc-existing" } },
        }),
      }),
    );
  });

  it("404s when accountId points at a row the caller cannot see", async () => {
    findLeadById.mockResolvedValue(baseLead);
    txState.account.findUnique.mockResolvedValue({
      id: "acc-existing",
      ownerId: OTHER_USER_ID,
    });

    await expect(
      service.convert("lead-1", USER_ID, ["crm:update"], {
        accountId: "acc-existing",
        opportunity: opportunityBody,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("rejects supplied contactId when it does not belong to the resolved account", async () => {
    findLeadById.mockResolvedValue(baseLead);
    txState.account.findUnique.mockResolvedValue({
      id: "acc-existing",
      ownerId: USER_ID,
    });
    txState.contact.findUnique.mockResolvedValue({
      id: "c-1",
      accountId: "acc-OTHER",
    });

    await expect(
      service.convert("lead-1", USER_ID, ["crm:update"], {
        accountId: "acc-existing",
        contactId: "c-1",
        opportunity: opportunityBody,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects ownerId override without crm:reassign", async () => {
    findLeadById.mockResolvedValue(baseLead);

    await expect(
      service.convert("lead-1", USER_ID, ["crm:update"], {
        ownerId: OTHER_USER_ID,
        opportunity: opportunityBody,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("applies ownerId override when caller has crm:reassign", async () => {
    findLeadById.mockResolvedValue(baseLead);

    await service.convert("lead-1", USER_ID, ["crm:update", "crm:reassign"], {
      ownerId: OTHER_USER_ID,
      opportunity: opportunityBody,
    });

    // Both new account + new opportunity should be owned by the override.
    expect(txState.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          owner: { connect: { id: OTHER_USER_ID } },
        }),
      }),
    );
    expect(txState.opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          owner: { connect: { id: OTHER_USER_ID } },
        }),
      }),
    );
  });

  it("rejects converting an already-converted lead", async () => {
    findLeadById.mockResolvedValue({ ...baseLead, status: "converted" });

    await expect(
      service.convert("lead-1", USER_ID, ["crm:update"], {
        opportunity: opportunityBody,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects converting a disqualified lead", async () => {
    findLeadById.mockResolvedValue({ ...baseLead, status: "disqualified" });

    await expect(
      service.convert("lead-1", USER_ID, ["crm:update"], {
        opportunity: opportunityBody,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("flips probabilityCustom when caller supplies probability on the opportunity", async () => {
    findLeadById.mockResolvedValue(baseLead);

    await service.convert("lead-1", USER_ID, ["crm:update"], {
      opportunity: { ...opportunityBody, probability: 75 },
    });

    expect(txState.opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          probability: 75,
          probabilityCustom: true,
        }),
      }),
    );
  });

  it("auto-promotes the synthesised contact only when account has zero contacts", async () => {
    findLeadById.mockResolvedValue(baseLead);
    txState.contact.count.mockResolvedValue(3);

    await service.convert("lead-1", USER_ID, ["crm:update"], {
      opportunity: opportunityBody,
    });

    expect(txState.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPrimary: false }),
      }),
    );
  });
});
