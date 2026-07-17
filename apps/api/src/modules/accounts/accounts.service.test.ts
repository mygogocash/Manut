import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { accountRepository } from "@/modules/accounts/accounts.repository";
import { AccountService } from "@/modules/accounts/accounts.service";
import { mockArgument } from "@/test-utils/assertions";

vi.mock("./accounts.repository", () => ({
  accountRepository: {
    findMany: vi.fn(),
    findById: vi.fn(),
    findByDomain: vi.fn(),
    findByNameInsensitive: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("./account-deal.sync", () => ({
  syncAccountDeal: vi.fn().mockResolvedValue(undefined),
}));

const findMany = accountRepository.findMany as Mock;
const findById = accountRepository.findById as Mock;
const findByDomain = accountRepository.findByDomain as Mock;
const findByNameInsensitive = accountRepository.findByNameInsensitive as Mock;
const create = accountRepository.create as Mock;
const update = accountRepository.update as Mock;
const remove = accountRepository.delete as Mock;

const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";

const baseAccount = {
  id: "acc-1",
  name: "Acme",
  domain: "acme.com",
  industry: null,
  size: null,
  country: null,
  website: null,
  notes: null,
  ownerId: USER_ID,
  partnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("AccountService", () => {
  let service: AccountService;

  beforeEach(() => {
    service = new AccountService();
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("scopes to caller without crm:team-read", async () => {
      findMany.mockResolvedValue({ data: [], total: 0 });

      await service.list(USER_ID, ["crm:read"], { page: 1, limit: 20 });

      expect(findMany).toHaveBeenCalledWith({ ownerScope: [USER_ID] }, 1, 20);
    });

    it("widens scope when caller has crm:team-read", async () => {
      findMany.mockResolvedValue({ data: [], total: 0 });

      await service.list(USER_ID, ["crm:read", "crm:team-read"], {
        page: 1,
        limit: 20,
      });

      expect(findMany).toHaveBeenCalledWith({ ownerScope: undefined }, 1, 20);
    });
  });

  describe("getById", () => {
    it("hides accounts owned by other reps", async () => {
      findById.mockResolvedValue({ ...baseAccount, ownerId: OTHER_USER_ID });
      await expect(
        service.getById("acc-1", USER_ID, ["crm:read"]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("create — account dedupe", () => {
    it("hard-rejects when domain already exists", async () => {
      findByDomain.mockResolvedValue({
        id: "existing",
        name: "Acme",
        domain: "acme.com",
      });

      await expect(
        service.create(USER_ID, ["crm:create"], {
          name: "Acme",
          domain: "acme.com",
        }),
      ).rejects.toThrow(ConflictException);
      expect(create).not.toHaveBeenCalled();
    });

    it("returns 409 candidate on case-insensitive name match without confirmCreate", async () => {
      findByNameInsensitive.mockResolvedValue({
        id: "existing",
        name: "Acme",
        domain: null,
      });

      await expect(
        service.create(USER_ID, ["crm:create"], { name: "ACME" }),
      ).rejects.toThrow(ConflictException);
      expect(create).not.toHaveBeenCalled();
    });

    it("creates a new row when confirmCreate=true overrides the name match", async () => {
      findByNameInsensitive.mockResolvedValue({
        id: "existing",
        name: "Acme",
        domain: null,
      });
      create.mockResolvedValue(baseAccount);
      findById.mockResolvedValue(baseAccount);

      await service.create(USER_ID, ["crm:create"], {
        name: "Acme",
        confirmCreate: true,
      });

      expect(create).toHaveBeenCalled();
      // confirmCreate should never be persisted as a column.
      const args = mockArgument(create.mock.calls, 0, 0) as Record<
        string,
        unknown
      >;
      expect(args).not.toHaveProperty("confirmCreate");
    });

    it("creates when neither domain nor name conflict", async () => {
      findByDomain.mockResolvedValue(null);
      create.mockResolvedValue(baseAccount);
      findById.mockResolvedValue(baseAccount);

      await service.create(USER_ID, ["crm:create"], {
        name: "Globex",
        domain: "globex.com",
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Globex",
          domain: "globex.com",
          owner: { connect: { id: USER_ID } },
        }),
      );
    });
  });

  describe("update", () => {
    it("rejects when domain collides with a different account", async () => {
      findById.mockResolvedValue(baseAccount);
      findByDomain.mockResolvedValue({
        id: "other",
        name: "Other",
        domain: "acme.com",
      });

      await expect(
        service.update("acc-1", USER_ID, ["crm:update"], {
          domain: "acme.com",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("allows the same domain on the same account", async () => {
      findById.mockResolvedValue(baseAccount);
      findByDomain.mockResolvedValue({
        id: "acc-1",
        name: "Acme",
        domain: "acme.com",
      });
      update.mockResolvedValue(baseAccount);

      await service.update("acc-1", USER_ID, ["crm:update"], {
        domain: "acme.com",
      });

      expect(update).toHaveBeenCalled();
      expect(findById).toHaveBeenCalled();
    });

    it("nulls cleared optional fields", async () => {
      findById.mockResolvedValue(baseAccount);
      update.mockResolvedValue(baseAccount);

      await service.update("acc-1", USER_ID, ["crm:update"], {
        industry: "",
        notes: undefined,
      });

      expect(update).toHaveBeenCalledWith(
        "acc-1",
        expect.objectContaining({ industry: null }),
      );
      expect(findById).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("blocks delete when caller does not own the row", async () => {
      findById.mockResolvedValue({ ...baseAccount, ownerId: OTHER_USER_ID });

      await expect(
        service.delete("acc-1", USER_ID, ["crm:delete"]),
      ).rejects.toThrow(NotFoundException);
      expect(remove).not.toHaveBeenCalled();
    });

    // Regression — PR #562 made `crm_opportunities.account_id` ON DELETE
    // CASCADE so a stale env / partial migration is the only way to hit
    // a P2003. If we get one, the service must surface it as a 400 with
    // a human-readable message rather than a generic 500.
    it("maps P2003 from the repository to BadRequestException", async () => {
      findById.mockResolvedValue(baseAccount);
      const fkError = Object.assign(new Error("FK violation"), {
        code: "P2003",
      });
      remove.mockRejectedValue(fkError);

      await expect(
        service.delete("acc-1", USER_ID, ["crm:delete"]),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws unknown errors so the global handler surfaces 500", async () => {
      findById.mockResolvedValue(baseAccount);
      remove.mockRejectedValue(new Error("boom"));

      await expect(
        service.delete("acc-1", USER_ID, ["crm:delete"]),
      ).rejects.toThrow(/boom/);
    });
  });
});
