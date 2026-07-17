import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { NotFoundException } from "@/common/exceptions/http-exception";
import { accountRepository } from "@/modules/revenue-accounts/accounts.repository";
import { contactRepository } from "@/modules/revenue-contacts/contacts.repository";
import { ContactService } from "@/modules/revenue-contacts/contacts.service";

vi.mock("@/modules/revenue-accounts/accounts.repository", () => ({
  accountRepository: { findById: vi.fn() },
}));

vi.mock("@/modules/revenue-contacts/contacts.repository", () => ({
  contactRepository: {
    findMany: vi.fn(),
    findById: vi.fn(),
    countForAccount: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    clearPrimaryForAccount: vi.fn(),
    delete: vi.fn(),
  },
}));

// $transaction is exercised by the promote-to-primary paths. Stub it to call
// the callback with a thin tx whose contact methods proxy to the repository
// mocks — we only need to assert that the path runs, not Prisma internals.
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        revenueContact: {
          create: vi.fn(async (args: { data: unknown }) => ({
            id: "contact-new",
            accountId: "acc-1",
            firstName: "Jane",
            lastName: "Doe",
            email: null,
            phone: null,
            title: null,
            notes: null,
            isPrimary: true,
            account: { id: "acc-1", name: "Acme", ownerId: USER_ID },
            ...((args.data as Record<string, unknown>) ?? {}),
          })),
          update: vi.fn(
            async (args: { where: { id: string }; data: unknown }) => ({
              id: args.where.id,
              isPrimary: true,
              account: { id: "acc-1", name: "Acme", ownerId: USER_ID },
              ...((args.data as Record<string, unknown>) ?? {}),
            }),
          ),
        },
      };
      return fn(tx);
    }),
  },
}));

const findAccountById = accountRepository.findById as Mock;
const countForAccount = contactRepository.countForAccount as Mock;
const findContactById = contactRepository.findById as Mock;
const createContact = contactRepository.create as Mock;
const updateContact = contactRepository.update as Mock;
const clearPrimary = contactRepository.clearPrimaryForAccount as Mock;
const removeContact = contactRepository.delete as Mock;

const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";

const baseAccount = {
  id: "acc-1",
  name: "Acme",
  domain: "acme.com",
  ownerId: USER_ID,
};

const baseContact = {
  id: "contact-1",
  accountId: "acc-1",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@acme.com",
  phone: null,
  title: null,
  isPrimary: false,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  account: { id: "acc-1", name: "Acme", ownerId: USER_ID },
};

describe("ContactService", () => {
  let service: ContactService;

  beforeEach(() => {
    service = new ContactService();
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("rejects when caller cannot see the parent account", async () => {
      findAccountById.mockResolvedValue({
        ...baseAccount,
        ownerId: OTHER_USER_ID,
      });

      await expect(
        service.create(USER_ID, ["sales-revenue:create"], {
          accountId: "acc-1",
          firstName: "Jane",
          lastName: "Doe",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("auto-promotes the first contact to primary even without isPrimary flag", async () => {
      findAccountById.mockResolvedValue(baseAccount);
      countForAccount.mockResolvedValue(0);
      clearPrimary.mockResolvedValue({ count: 0 });

      const result = await service.create(USER_ID, ["sales-revenue:create"], {
        accountId: "acc-1",
        firstName: "Jane",
        lastName: "Doe",
      });

      expect(result.isPrimary).toBe(true);
      expect(clearPrimary).toHaveBeenCalled();
    });

    it("creates a non-primary contact when account already has one", async () => {
      findAccountById.mockResolvedValue(baseAccount);
      countForAccount.mockResolvedValue(2);
      createContact.mockResolvedValue({ ...baseContact, isPrimary: false });

      await service.create(USER_ID, ["sales-revenue:create"], {
        accountId: "acc-1",
        firstName: "John",
        lastName: "Smith",
      });

      expect(createContact).toHaveBeenCalledWith(
        expect.objectContaining({ isPrimary: false }),
      );
      expect(clearPrimary).not.toHaveBeenCalled();
    });

    it("explicit isPrimary=true demotes existing primary even on a populated account", async () => {
      findAccountById.mockResolvedValue(baseAccount);
      countForAccount.mockResolvedValue(2);
      clearPrimary.mockResolvedValue({ count: 1 });

      const result = await service.create(USER_ID, ["sales-revenue:create"], {
        accountId: "acc-1",
        firstName: "Jane",
        lastName: "Doe",
        isPrimary: true,
      });

      expect(result.isPrimary).toBe(true);
      expect(clearPrimary).toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("hides contacts on accounts owned by other reps", async () => {
      findContactById.mockResolvedValue({
        ...baseContact,
        account: { ...baseContact.account, ownerId: OTHER_USER_ID },
      });

      await expect(
        service.getById("contact-1", USER_ID, ["sales-revenue:read"]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("clears primary on siblings when promoting", async () => {
      findContactById.mockResolvedValue(baseContact);
      clearPrimary.mockResolvedValue({ count: 1 });

      await service.update("contact-1", USER_ID, ["sales-revenue:update"], {
        isPrimary: true,
      });

      expect(clearPrimary).toHaveBeenCalled();
    });

    it("uses the non-tx path when isPrimary is unchanged", async () => {
      findContactById.mockResolvedValue({ ...baseContact, isPrimary: true });
      updateContact.mockResolvedValue({ ...baseContact, isPrimary: true });

      await service.update("contact-1", USER_ID, ["sales-revenue:update"], {
        firstName: "Janet",
      });

      expect(updateContact).toHaveBeenCalledWith(
        "contact-1",
        expect.objectContaining({ firstName: "Janet" }),
      );
      expect(clearPrimary).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("rejects when caller cannot see the parent account", async () => {
      findContactById.mockResolvedValue({
        ...baseContact,
        account: { ...baseContact.account, ownerId: OTHER_USER_ID },
      });

      await expect(
        service.delete("contact-1", USER_ID, ["sales-revenue:delete"]),
      ).rejects.toThrow(NotFoundException);
      expect(removeContact).not.toHaveBeenCalled();
    });
  });
});
