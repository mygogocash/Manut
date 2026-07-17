import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { NotFoundException } from "@/common/exceptions/http-exception";
import { crmActivityRepository } from "@/modules/revenue-activities/crm-activities.repository";
import { CrmActivityService } from "@/modules/revenue-activities/crm-activities.service";
import { mockArgument } from "@/test-utils/assertions";

vi.mock("@/modules/revenue-activities/crm-activities.repository", () => ({
  crmActivityRepository: {
    findMany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const findMany = crmActivityRepository.findMany as Mock;
const findById = crmActivityRepository.findById as Mock;
const create = crmActivityRepository.create as Mock;
const update = crmActivityRepository.update as Mock;
const remove = crmActivityRepository.delete as Mock;

const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";

const baseActivity = {
  id: "act-1",
  type: "call",
  subject: "Intro call",
  body: null,
  occurredAt: new Date("2026-04-01T10:00:00Z"),
  durationMins: 30,
  ownerId: USER_ID,
  leadId: "lead-1",
  opportunityId: null,
  contactId: null,
  accountId: null,
  createdAt: new Date(),
};

describe("CrmActivityService", () => {
  let service: CrmActivityService;

  beforeEach(() => {
    service = new CrmActivityService();
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("scopes to caller without crm:team-read", async () => {
      findMany.mockResolvedValue({ data: [], total: 0 });
      await service.list(USER_ID, ["sales-revenue:read"], {
        page: 1,
        limit: 20,
      });
      expect(findMany).toHaveBeenCalledWith({ ownerScope: [USER_ID] }, 1, 20);
    });

    it("forwards parent-ref filters", async () => {
      findMany.mockResolvedValue({ data: [], total: 0 });
      await service.list(
        USER_ID,
        ["sales-revenue:read", "sales-revenue:team-read"],
        {
          page: 1,
          limit: 20,
          leadId: "lead-1",
          type: "call",
        },
      );
      expect(findMany).toHaveBeenCalledWith(
        { leadId: "lead-1", type: "call", ownerScope: undefined },
        1,
        20,
      );
    });
  });

  describe("getById", () => {
    it("hides activities owned by other reps", async () => {
      findById.mockResolvedValue({ ...baseActivity, ownerId: OTHER_USER_ID });
      await expect(
        service.getById("act-1", USER_ID, ["sales-revenue:read"]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("connects exactly one parent reference", async () => {
      create.mockResolvedValue(baseActivity);

      await service.create(USER_ID, {
        type: "call",
        subject: "Intro",
        occurredAt: "2026-04-01T10:00:00Z",
        leadId: "lead-1",
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          lead: { connect: { id: "lead-1" } },
          owner: { connect: { id: USER_ID } },
          type: "call",
        }),
      );
      const args = mockArgument(create.mock.calls, 0, 0) as Record<
        string,
        unknown
      >;
      expect(args).not.toHaveProperty("opportunity");
      expect(args).not.toHaveProperty("contact");
      expect(args).not.toHaveProperty("account");
    });
  });

  describe("update", () => {
    it("nulls cleared body", async () => {
      findById.mockResolvedValue(baseActivity);
      update.mockResolvedValue(baseActivity);

      await service.update("act-1", USER_ID, ["sales-revenue:update"], {
        body: "",
      });

      expect(update).toHaveBeenCalledWith(
        "act-1",
        expect.objectContaining({ body: null }),
      );
    });
  });

  describe("delete", () => {
    it("blocks delete when caller does not own the row", async () => {
      findById.mockResolvedValue({ ...baseActivity, ownerId: OTHER_USER_ID });

      await expect(
        service.delete("act-1", USER_ID, ["sales-revenue:delete"]),
      ).rejects.toThrow(NotFoundException);
      expect(remove).not.toHaveBeenCalled();
    });
  });
});
