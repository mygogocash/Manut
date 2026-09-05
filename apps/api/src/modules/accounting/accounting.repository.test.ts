import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { accountingRepository } from "@/modules/accounting/accounting.repository";

// Mock the Prisma client so we can assert the exact query shapes the
// repository builds — this is where soft-delete exclusion lives. `vi.mock`
// is hoisted above the imports above, so `prisma` resolves to this mock.
vi.mock("@/infrastructure/database/prisma", () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  });
  const journalEntry = model();
  const invoice = model();
  return {
    prisma: {
      journalEntry,
      invoice,
      $queryRaw: vi.fn(),
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          $queryRaw: vi.fn(),
          journalEntry,
          invoice,
        }),
      ),
    },
  };
});

const je = prisma.journalEntry as unknown as Record<string, Mock>;
const inv = prisma.invoice as unknown as Record<string, Mock>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AccountingRepository journal soft-delete filtering", () => {
  it("keeps deleted drafts on the unfiltered journal list", async () => {
    await accountingRepository.findJournals({}, 1, 20);

    expect(je.findMany).toHaveBeenCalledTimes(1);
    expect(je.count).toHaveBeenCalledTimes(1);
    expect(je.findMany.mock.calls[0][0].where.deletedAt).toBeUndefined();
    expect(je.count.mock.calls[0][0].where.deletedAt).toBeUndefined();
  });

  it("excludes deleted rows when filtering by a live journal status", async () => {
    await accountingRepository.findJournals({ status: "posted" }, 1, 20);
    expect(je.findMany.mock.calls[0][0].where).toMatchObject({
      deletedAt: null,
      status: "posted",
    });
  });

  it("excludes soft-deleted rows from get-by-id", async () => {
    await accountingRepository.findJournalById("j1");
    expect(je.findUnique.mock.calls[0][0].where).toMatchObject({
      id: "j1",
      deletedAt: null,
    });
  });

  it("includes deleted rows ONLY through the restore lookup", async () => {
    await accountingRepository.findJournalByIdIncludingDeleted("j1");
    expect(je.findUnique.mock.calls[0][0].where).toEqual({ id: "j1" });
  });

  it("soft-deletes by stamping deletedAt via update, never delete", async () => {
    je.findUnique.mockResolvedValue({ status: "draft" });
    await accountingRepository.softDeleteJournal("j1");

    expect(je.update).toHaveBeenCalledTimes(1);
    expect(je.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(je.delete).not.toHaveBeenCalled();
    expect(je.deleteMany).not.toHaveBeenCalled();
  });

  it("restore clears deletedAt so the row reappears", async () => {
    await accountingRepository.restoreJournal("j1");
    expect(je.update.mock.calls[0][0].data.deletedAt).toBeNull();
  });

  it("bulk soft-delete sets deletedAt on the matched live id set", async () => {
    await accountingRepository.bulkSoftDeleteJournals(["a", "b"]);

    const call = je.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({
      id: { in: ["a", "b"] },
      deletedAt: null,
    });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
    expect(je.deleteMany).not.toHaveBeenCalled();
  });

  it("delete-all soft-deletes every live journal, never hard-deletes", async () => {
    await accountingRepository.softDeleteAllJournals();

    const call = je.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ deletedAt: null });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
    expect(je.deleteMany).not.toHaveBeenCalled();
  });
});

describe("AccountingRepository invoice soft-delete filtering", () => {
  it("keeps deleted drafts on the unfiltered invoice list", async () => {
    await accountingRepository.findInvoices({}, 1, 20);

    expect(inv.findMany.mock.calls[0][0].where.deletedAt).toBeUndefined();
    expect(inv.count.mock.calls[0][0].where.deletedAt).toBeUndefined();
  });

  it("excludes deleted rows when filtering by a live invoice status", async () => {
    await accountingRepository.findInvoices({ status: "sent" }, 1, 20);
    expect(inv.findMany.mock.calls[0][0].where).toMatchObject({
      deletedAt: null,
      status: "sent",
    });
  });

  it("excludes soft-deleted rows from get-by-id", async () => {
    await accountingRepository.findInvoiceById("i1");
    expect(inv.findUnique.mock.calls[0][0].where).toMatchObject({
      id: "i1",
      deletedAt: null,
    });
  });

  it("includes deleted rows ONLY through the restore lookup", async () => {
    await accountingRepository.findInvoiceByIdIncludingDeleted("i1");
    expect(inv.findUnique.mock.calls[0][0].where).toEqual({ id: "i1" });
  });

  it("soft-deletes by stamping deletedAt via update, never delete", async () => {
    await accountingRepository.softDeleteInvoice("i1");

    expect(inv.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(inv.delete).not.toHaveBeenCalled();
  });

  it("restore clears deletedAt so the row reappears", async () => {
    await accountingRepository.restoreInvoice("i1");
    expect(inv.update.mock.calls[0][0].data.deletedAt).toBeNull();
  });
});
