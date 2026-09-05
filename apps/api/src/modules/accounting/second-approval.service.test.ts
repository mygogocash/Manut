import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  ForbiddenException,
} from "@/common/exceptions/http-exception";
import { accountingRepository } from "@/modules/accounting/accounting.repository";
import { accountingService } from "@/modules/accounting/accounting.service";

vi.mock("@/modules/accounting/accounting.repository", () => ({
  accountingRepository: {
    getSecondApprovalSetting: vi.fn(),
    upsertSecondApprovalSetting: vi.fn(),
    countApprovers: vi.fn(),
    findInvoiceById: vi.fn(),
    updateInvoiceApproval: vi.fn(),
    findSameDayDocuments: vi.fn(),
  },
}));

vi.mock("@/modules/exchange-rates/exchange-rates.service", () => ({
  createExchangeRateService: vi.fn(),
}));

const getSetting = accountingRepository.getSecondApprovalSetting as Mock;
const upsertSetting = accountingRepository.upsertSecondApprovalSetting as Mock;
const countApprovers = accountingRepository.countApprovers as Mock;
const findInvoiceById = accountingRepository.findInvoiceById as Mock;
const updateApproval = accountingRepository.updateInvoiceApproval as Mock;

const ADMIN = ["accounting:read-all", "accounting:admin"];

beforeEach(() => {
  vi.resetAllMocks();
  getSetting.mockResolvedValue(null);
  upsertSetting.mockResolvedValue({});
  updateApproval.mockImplementation((id: string, data: object) => ({
    id,
    ...data,
  }));
});

describe("second-approval config", () => {
  // Nothing is configured yet, so the shipped state must be inert.
  it("defaults to disabled when no setting row exists", async () => {
    const config = await accountingService.getSecondApprovalConfig();
    expect(config.enabled).toBe(false);
  });

  // A control that routes documents to a second approver who does not exist
  // does not add oversight, it stops the company invoicing.
  it("refuses to switch on with fewer than two approvers", async () => {
    countApprovers.mockResolvedValue(1);
    await expect(
      accountingService.setSecondApprovalConfig({
        enabled: true,
        thresholds: { invoice: 100000 },
        staleDays: 7,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsertSetting).not.toHaveBeenCalled();
  });

  it("switches on once a second approver exists", async () => {
    countApprovers.mockResolvedValue(2);
    getSetting.mockResolvedValue({
      value: {
        enabled: true,
        thresholds: { invoice: 100000, bill: null, journal: null },
        staleDays: 7,
      },
    });
    const config = await accountingService.setSecondApprovalConfig({
      enabled: true,
      thresholds: { invoice: 100000 },
      staleDays: 7,
    });
    expect(upsertSetting).toHaveBeenCalled();
    expect(config.enabled).toBe(true);
  });

  it("reads a stored config back, ignoring junk in the JSON", async () => {
    getSetting.mockResolvedValue({
      value: { enabled: true, thresholds: { invoice: "nonsense" } },
    });
    const config = await accountingService.getSecondApprovalConfig();
    expect(config.enabled).toBe(true);
    // A non-numeric threshold means "no threshold", not a crash and not zero —
    // zero would silently route every document to a second approver.
    expect(config.thresholds.invoice).toBeNull();
  });
});

describe("second-approval decision", () => {
  const pending = {
    id: "inv-1",
    entityId: "ent-1",
    type: "receivable",
    status: "pending_second_approval",
    approvedById: "user-1",
    createdBy: "user-1",
    amount: 141191,
    exchangeRate: 1,
    issueDate: new Date("2026-08-14"),
    counterparty: "ABC Co",
  };

  it("refuses a document that is not waiting on anything", async () => {
    findInvoiceById.mockResolvedValue({ ...pending, status: "sent" });
    await expect(
      accountingService.decideSecondApproval(
        "inv-1",
        "user-2",
        "approve",
        {},
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // The second signature is worth something only because it belongs to
  // somebody else. Identity, not permission.
  it("refuses the first approver signing a second time", async () => {
    findInvoiceById.mockResolvedValue(pending);
    await expect(
      accountingService.decideSecondApproval(
        "inv-1",
        "user-1",
        "approve",
        {},
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("demands a reason before sending a document back", async () => {
    findInvoiceById.mockResolvedValue(pending);
    await expect(
      accountingService.decideSecondApproval(
        "inv-1",
        "user-2",
        "send-back",
        {},
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // Whatever changes after a send-back has not been seen by anyone, so the
  // first approval must not still be standing.
  it("clears the first approval when sending back to draft", async () => {
    findInvoiceById.mockResolvedValue(pending);
    await accountingService.decideSecondApproval(
      "inv-1",
      "user-2",
      "send-back",
      { reason: "Wrong PO number" },
      ADMIN,
    );
    expect(updateApproval).toHaveBeenCalledWith(
      "inv-1",
      expect.objectContaining({
        status: "draft",
        approvedById: null,
        approvedAt: null,
      }),
    );
  });
});
