import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { leadRepository } from "@/modules/leads/leads.repository";
import { LeadService } from "@/modules/leads/leads.service";
import { mockArgument, mockCall } from "@/test-utils/assertions";

vi.mock("./leads.repository", () => ({
  leadRepository: {
    findMany: vi.fn(),
    findStale: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// LeadService.create / update consult the lead_sources table to verify
// the supplied code is active. Mock that to a permissive default; tests
// that exercise the new behaviour can override per-case.
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    leadSource: { findUnique: vi.fn() },
    lead: { findMany: vi.fn() },
  },
}));

// Stub email sender so digest tests don't require the external email service.
vi.mock("@/infrastructure/email/email.service", () => ({
  sendEmail: vi.fn(),
}));

const findLeadSource = prisma.leadSource.findUnique as Mock;
const findLeadsRaw = prisma.lead.findMany as Mock;
const sendEmailMock = sendEmail as Mock;

const findMany = leadRepository.findMany as Mock;
const findStale = leadRepository.findStale as Mock;
const findById = leadRepository.findById as Mock;
const create = leadRepository.create as Mock;
const update = leadRepository.update as Mock;
const remove = leadRepository.delete as Mock;

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
  status: "new",
  ownerId: USER_ID,
  notes: null,
  convertedOpportunityId: null,
  convertedAt: null,
  disqualifyReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("LeadService", () => {
  let service: LeadService;

  beforeEach(() => {
    service = new LeadService();
    vi.clearAllMocks();
    // Default: every source resolves to an active row. Tests that need
    // the rejection path override this per-case.
    findLeadSource.mockResolvedValue({ isActive: true });
  });

  describe("list", () => {
    it("scopes to caller without crm:team-read", async () => {
      findMany.mockResolvedValue({ data: [baseLead], total: 1 });

      const result = await service.list(USER_ID, ["crm:read"], {
        page: 1,
        limit: 20,
      });

      expect(findMany).toHaveBeenCalledWith({ ownerScope: [USER_ID] }, 1, 20);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it("returns all rows when caller has crm:team-read", async () => {
      findMany.mockResolvedValue({ data: [], total: 0 });

      await service.list(USER_ID, ["crm:read", "crm:team-read"], {
        page: 1,
        limit: 20,
      });

      expect(findMany).toHaveBeenCalledWith({ ownerScope: undefined }, 1, 20);
    });

    it("forwards filter params to the repository", async () => {
      findMany.mockResolvedValue({ data: [], total: 0 });

      await service.list(USER_ID, ["crm:read", "crm:team-read"], {
        page: 2,
        limit: 50,
        search: "acme",
        status: "new",
        source: "web",
        ownerId: OTHER_USER_ID,
      });

      expect(findMany).toHaveBeenCalledWith(
        {
          search: "acme",
          status: "new",
          source: "web",
          ownerId: OTHER_USER_ID,
          ownerScope: undefined,
        },
        2,
        50,
      );
    });
  });

  describe("listStale", () => {
    it("scopes to caller without crm:team-read and forwards 14d cutoff", async () => {
      findStale.mockResolvedValue({ data: [], total: 0 });

      const before = Date.now();
      const result = await service.listStale(USER_ID, ["crm:read"], {
        page: 1,
        limit: 20,
      });
      const after = Date.now();

      expect(findStale).toHaveBeenCalledOnce();
      const call = mockArgument(findStale.mock.calls, 0, 0) as {
        ownerScope: string[];
        cutoff: Date;
      };
      expect(call.ownerScope).toEqual([USER_ID]);

      // Cutoff should be ~14 days before "now". Window the assertion to the
      // wall clock surrounding the call so this stays robust.
      const fourteen = 14 * 86_400_000;
      expect(call.cutoff.getTime()).toBeGreaterThanOrEqual(before - fourteen);
      expect(call.cutoff.getTime()).toBeLessThanOrEqual(after - fourteen);

      expect(result.thresholdDays).toBe(14);
    });

    it("widens scope when caller has crm:team-read", async () => {
      findStale.mockResolvedValue({ data: [], total: 0 });

      await service.listStale(USER_ID, ["crm:read", "crm:team-read"], {
        page: 1,
        limit: 20,
      });

      const call = mockArgument(findStale.mock.calls, 0, 0) as {
        ownerScope: undefined;
      };
      expect(call.ownerScope).toBeUndefined();
    });

    it("forwards search + ownerId filters to the repository", async () => {
      findStale.mockResolvedValue({ data: [], total: 0 });

      await service.listStale(USER_ID, ["crm:read", "crm:team-read"], {
        page: 2,
        limit: 50,
        search: "acme",
        ownerId: OTHER_USER_ID,
      });

      expect(findStale).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "acme",
          ownerId: OTHER_USER_ID,
          ownerScope: undefined,
        }),
        2,
        50,
      );
    });
  });

  describe("getById", () => {
    it("throws NotFound when row missing", async () => {
      findById.mockResolvedValue(null);
      await expect(service.getById("x", USER_ID, ["crm:read"])).rejects.toThrow(
        NotFoundException,
      );
    });

    it("hides leads owned by other users from non-team-read callers", async () => {
      findById.mockResolvedValue({ ...baseLead, ownerId: OTHER_USER_ID });
      await expect(
        service.getById("lead-1", USER_ID, ["crm:read"]),
      ).rejects.toThrow(NotFoundException);
    });

    it("returns leads owned by other users to team-read callers", async () => {
      findById.mockResolvedValue({ ...baseLead, ownerId: OTHER_USER_ID });
      const lead = await service.getById("lead-1", USER_ID, [
        "crm:read",
        "crm:team-read",
      ]);
      expect(lead.id).toBe("lead-1");
    });
  });

  describe("create", () => {
    it("connects the caller as owner", async () => {
      create.mockResolvedValue(baseLead);

      await service.create(USER_ID, {
        company: "Acme",
        firstName: "Jane",
        lastName: "Doe",
        source: "web",
        status: "new",
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          company: "Acme",
          source: "web",
          status: "new",
          owner: { connect: { id: USER_ID } },
        }),
      );
    });

    it("rejects an unknown lead source code", async () => {
      findLeadSource.mockResolvedValue(null);

      await expect(
        service.create(USER_ID, {
          company: "Acme",
          firstName: "Jane",
          lastName: "Doe",
          source: "made-up",
          status: "new",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects a deactivated lead source code", async () => {
      findLeadSource.mockResolvedValue({ isActive: false });

      await expect(
        service.create(USER_ID, {
          company: "Acme",
          firstName: "Jane",
          lastName: "Doe",
          source: "retired",
          status: "new",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("rejects edits on a converted lead", async () => {
      findById.mockResolvedValue({ ...baseLead, status: "converted" });
      await expect(
        service.update("lead-1", USER_ID, ["crm:update"], { notes: "x" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects edits on a disqualified lead", async () => {
      findById.mockResolvedValue({ ...baseLead, status: "disqualified" });
      await expect(
        service.update("lead-1", USER_ID, ["crm:update"], { notes: "x" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("nulls cleared optional fields", async () => {
      findById.mockResolvedValue(baseLead);
      update.mockResolvedValue({ ...baseLead, email: null });

      await service.update("lead-1", USER_ID, ["crm:update"], {
        email: undefined,
        phone: "",
      });

      expect(update).toHaveBeenCalledWith(
        "lead-1",
        expect.objectContaining({ phone: null }),
      );
    });
  });

  describe("disqualify", () => {
    it("flips status and stores reason", async () => {
      findById.mockResolvedValue(baseLead);
      update.mockResolvedValue({
        ...baseLead,
        status: "disqualified",
        disqualifyReason: "no budget",
      });

      const result = await service.disqualify(
        "lead-1",
        USER_ID,
        ["crm:update"],
        { reason: "no budget" },
      );

      expect(update).toHaveBeenCalledWith("lead-1", {
        status: "disqualified",
        disqualifyReason: "no budget",
      });
      expect(result.status).toBe("disqualified");
    });

    it("rejects disqualifying a converted lead", async () => {
      findById.mockResolvedValue({ ...baseLead, status: "converted" });
      await expect(
        service.disqualify("lead-1", USER_ID, ["crm:update"], {
          reason: "x",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects disqualifying an already-disqualified lead", async () => {
      findById.mockResolvedValue({ ...baseLead, status: "disqualified" });
      await expect(
        service.disqualify("lead-1", USER_ID, ["crm:update"], {
          reason: "x",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("delete", () => {
    it("looks up the lead first to enforce ownership", async () => {
      findById.mockResolvedValue(baseLead);
      remove.mockResolvedValue(baseLead);

      await service.delete("lead-1", USER_ID, ["crm:delete"]);

      expect(findById).toHaveBeenCalledWith("lead-1");
      expect(remove).toHaveBeenCalledWith("lead-1");
    });

    it("throws NotFound when caller does not own the row", async () => {
      findById.mockResolvedValue({ ...baseLead, ownerId: OTHER_USER_ID });
      await expect(
        service.delete("lead-1", USER_ID, ["crm:delete"]),
      ).rejects.toThrow(NotFoundException);
      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe("processStaleLeadDigest", () => {
    beforeEach(() => {
      sendEmailMock.mockReset();
      findLeadsRaw.mockReset();
    });

    it("sends one email per owner with at least one stale lead", async () => {
      findLeadsRaw.mockResolvedValue([
        {
          id: "l1",
          company: "Acme",
          firstName: "Jane",
          lastName: "Doe",
          status: "new",
          createdAt: new Date(Date.now() - 30 * 86_400_000),
          owner: {
            id: USER_ID,
            name: "Alice",
            email: "alice@example.com",
          },
        },
        {
          id: "l2",
          company: "Beta",
          firstName: "John",
          lastName: "Smith",
          status: "contacted",
          createdAt: new Date(Date.now() - 20 * 86_400_000),
          owner: {
            id: USER_ID,
            name: "Alice",
            email: "alice@example.com",
          },
        },
        {
          id: "l3",
          company: "Gamma",
          firstName: "Sam",
          lastName: "Lee",
          status: "new",
          createdAt: new Date(Date.now() - 25 * 86_400_000),
          owner: {
            id: OTHER_USER_ID,
            name: "Bob",
            email: "bob@example.com",
          },
        },
      ]);

      const result = await service.processStaleLeadDigest();

      expect(result.ownersNotified).toBe(2);
      expect(result.emailsSent).toBe(2);
      expect(result.totalLeads).toBe(3);
      expect(sendEmailMock).toHaveBeenCalledTimes(2);

      const recipients = sendEmailMock.mock.calls.map(
        (c) => (c[0] as { to: string }).to,
      );
      expect(recipients).toContain("alice@example.com");
      expect(recipients).toContain("bob@example.com");
    });

    it("returns zero counters when no stale leads exist", async () => {
      findLeadsRaw.mockResolvedValue([]);

      const result = await service.processStaleLeadDigest();

      expect(result).toEqual({
        ownersNotified: 0,
        emailsSent: 0,
        totalLeads: 0,
      });
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("caps inline rows per email at the configured limit", async () => {
      // 12 stale leads under one owner; default rowsPerEmail = 10.
      const owner = {
        id: USER_ID,
        name: "Alice",
        email: "alice@example.com",
      };
      findLeadsRaw.mockResolvedValue(
        Array.from({ length: 12 }, (_, i) => ({
          id: `l${i}`,
          company: `Co ${i}`,
          firstName: "F",
          lastName: "L",
          status: "new",
          createdAt: new Date(Date.now() - 20 * 86_400_000),
          owner,
        })),
      );

      const result = await service.processStaleLeadDigest();

      expect(result.totalLeads).toBe(12);
      expect(result.emailsSent).toBe(1);
      const html = (
        mockCall(sendEmailMock.mock.calls, 0)[0] as { html: string }
      ).html;
      // Exactly 10 visible rows, 2 in the "+ N more" tail.
      expect((html.match(/<strong>Co \d+<\/strong>/g) ?? []).length).toBe(10);
      expect(html).toContain("+2 more");
    });
  });
});
