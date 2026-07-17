import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ConflictException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { LeaveRepository } from "@/modules/leave/leave.repository";

const tx = vi.hoisted(() => ({
  leaveApprovalDecision: {
    update: vi.fn(),
    updateMany: vi.fn(),
    createMany: vi.fn(),
  },
  leaveBalance: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  leaveRequest: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  balanceTransaction: {
    create: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

describe("LeaveRepository financial transitions", () => {
  let repository: LeaveRepository;

  beforeEach(() => {
    repository = new LeaveRepository();
    vi.clearAllMocks();
    (prisma.$transaction as Mock).mockImplementation((callback) =>
      callback(tx),
    );
    tx.leaveBalance.upsert.mockResolvedValue({
      id: "balance-1",
      entitled: 10,
      adjustment: 0,
      carried: 0,
      used: 0,
      carriedUsed: 0,
    });
    tx.leaveBalance.updateMany.mockResolvedValue({ count: 1 });
    tx.leaveRequest.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: "request-1", ...data }),
    );
    tx.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.leaveRequest.findUniqueOrThrow.mockResolvedValue({
      id: "request-1",
      status: "cancelled",
    });
    tx.leaveApprovalDecision.update.mockResolvedValue({});
    tx.leaveApprovalDecision.updateMany.mockResolvedValue({ count: 1 });
    tx.leaveApprovalDecision.createMany.mockResolvedValue({ count: 1 });
    tx.balanceTransaction.create.mockResolvedValue({});
  });

  it("materializes and audits an auto-approved half-day in one transaction", async () => {
    const result = await repository.createRequest({
      employeeId: "employee-1",
      leaveTypeId: "type-1",
      entityId: null,
      startDate: new Date("2026-07-17T00:00:00.000Z"),
      endDate: new Date("2026-07-17T00:00:00.000Z"),
      days: 0.5,
      durationType: "half_day",
      halfDayPeriod: "am",
      source: "entitled",
      defaultEntitlement: 10,
      requiresApproval: false,
      approvalDescription: "Auto-approved half-day",
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.leaveBalance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ entitled: 10, used: 0 }),
      }),
    );
    expect(tx.leaveBalance.updateMany).toHaveBeenCalledWith({
      where: { id: "balance-1", used: { lte: 9.5 } },
      data: { used: { increment: 0.5 } },
    });
    expect(tx.balanceTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 0.5,
        referenceId: "request-1",
        type: "used",
      }),
    });
    expect(result.status).toBe("approved");
  });

  it("commits final approval, balance materialization, and decimal audit together", async () => {
    tx.leaveRequest.findUniqueOrThrow.mockResolvedValue({
      id: "request-1",
      status: "approved",
    });

    const result = await repository.approveRequestStep({
      requestId: "request-1",
      approverId: "approver-1",
      currentDecisionId: null,
      expectedStepOrder: 1,
      nextStepOrder: null,
      employeeId: "employee-1",
      leaveTypeId: "type-1",
      year: 2026,
      days: 0.5,
      source: "entitled",
      defaultEntitlement: 10,
      description: "Approved half-day",
    });

    expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "pending" }),
      }),
    );
    expect(tx.leaveBalance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ used: 0 }),
        update: {},
      }),
    );
    expect(tx.leaveBalance.updateMany).toHaveBeenCalledWith({
      where: { id: "balance-1", used: { lte: 9.5 } },
      data: { used: { increment: 0.5 } },
    });
    expect(tx.balanceTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 0.5, type: "used" }),
    });
    expect(result?.status).toBe("approved");
  });

  it("refunds and audits an approved half-day in the guarded cancellation transaction", async () => {
    tx.leaveBalance.upsert.mockResolvedValue({
      id: "balance-1",
      used: 0.5,
      carriedUsed: 0,
    });

    const result = await repository.cancelRequestAtomically({
      requestId: "request-1",
      expectedStatus: "approved",
      refund: {
        employeeId: "employee-1",
        leaveTypeId: "type-1",
        year: 2026,
        days: 0.5,
        source: "entitled",
        defaultEntitlement: 10,
        description: "Cancelled half-day",
      },
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "request-1",
          status: "approved",
        },
      }),
    );
    expect(tx.leaveBalance.updateMany).toHaveBeenCalledWith({
      where: { id: "balance-1", used: { gte: 0.5 } },
      data: { used: { decrement: 0.5 } },
    });
    expect(tx.balanceTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: -0.5,
        referenceId: "request-1",
        type: "cancellation_refund",
      }),
    });
    expect(result?.status).toBe("cancelled");
  });

  it("does not refund or audit when the expected status was already changed", async () => {
    tx.leaveRequest.updateMany.mockResolvedValue({ count: 0 });

    const result = await repository.cancelRequestAtomically({
      requestId: "request-1",
      expectedStatus: "approved",
      refund: {
        employeeId: "employee-1",
        leaveTypeId: "type-1",
        year: 2026,
        days: 1,
        source: "entitled",
        defaultEntitlement: 10,
        description: "Retry",
      },
    });

    expect(result).toBeNull();
    expect(tx.leaveBalance.upsert).not.toHaveBeenCalled();
    expect(tx.balanceTransaction.create).not.toHaveBeenCalled();
  });

  it("rolls back auto-approval when another request consumes the entitlement first", async () => {
    tx.leaveBalance.upsert.mockResolvedValue({
      id: "balance-1",
      entitled: 1,
      adjustment: 0,
      carried: 0,
      used: 1,
      carriedUsed: 0,
    });
    tx.leaveBalance.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.createRequest({
        employeeId: "employee-1",
        leaveTypeId: "type-1",
        startDate: new Date("2026-07-17T00:00:00.000Z"),
        endDate: new Date("2026-07-17T00:00:00.000Z"),
        days: 0.5,
        source: "entitled",
        defaultEntitlement: 1,
        requiresApproval: false,
        approvalDescription: "Auto-approved half-day",
      }),
    ).rejects.toThrow(ConflictException);

    expect(tx.leaveRequest.create).not.toHaveBeenCalled();
    expect(tx.balanceTransaction.create).not.toHaveBeenCalled();
  });

  it("rolls back final approval when the shared entitlement is exhausted", async () => {
    tx.leaveBalance.upsert.mockResolvedValue({
      id: "balance-1",
      entitled: 1,
      adjustment: 0,
      carried: 0,
      used: 1,
      carriedUsed: 0,
    });
    tx.leaveBalance.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.approveRequestStep({
        requestId: "request-1",
        approverId: "approver-1",
        currentDecisionId: null,
        expectedStepOrder: 1,
        nextStepOrder: null,
        employeeId: "employee-1",
        leaveTypeId: "type-1",
        year: 2026,
        days: 0.5,
        source: "entitled",
        defaultEntitlement: 1,
        description: "Approved half-day",
      }),
    ).rejects.toThrow(ConflictException);

    expect(tx.balanceTransaction.create).not.toHaveBeenCalled();
  });

  it("rejects an inconsistent cancellation instead of overstating its refund", async () => {
    tx.leaveBalance.upsert.mockResolvedValue({
      id: "balance-1",
      entitled: 10,
      adjustment: 0,
      carried: 0,
      used: 0,
      carriedUsed: 0,
    });
    tx.leaveBalance.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.cancelRequestAtomically({
        requestId: "request-1",
        expectedStatus: "approved",
        refund: {
          employeeId: "employee-1",
          leaveTypeId: "type-1",
          year: 2026,
          days: 1,
          source: "entitled",
          defaultEntitlement: 10,
          description: "Cancellation",
        },
      }),
    ).rejects.toThrow(ConflictException);

    expect(tx.balanceTransaction.create).not.toHaveBeenCalled();
  });

  it("guards approval rejection and its decision audit in one transaction", async () => {
    tx.leaveRequest.findUniqueOrThrow.mockResolvedValue({
      id: "request-1",
      status: "rejected",
    });

    const result = await repository.rejectRequestStepAtomically({
      requestId: "request-1",
      approverId: "approver-1",
      currentDecisionId: "decision-1",
      expectedStepOrder: 1,
      reason: "No coverage",
    });

    expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "request-1",
          status: "pending",
          currentStepOrder: 1,
        },
      }),
    );
    expect(tx.leaveApprovalDecision.updateMany).toHaveBeenCalledWith({
      where: { id: "decision-1", status: "pending" },
      data: expect.objectContaining({ status: "rejected" }),
    });
    expect(result?.status).toBe("rejected");
  });

  it("does not overwrite an approved request with a late rejection", async () => {
    tx.leaveRequest.updateMany.mockResolvedValue({ count: 0 });

    const result = await repository.rejectRequestStepAtomically({
      requestId: "request-1",
      approverId: "approver-1",
      currentDecisionId: "decision-1",
      expectedStepOrder: 1,
      reason: "No coverage",
    });

    expect(result).toBeNull();
    expect(tx.leaveApprovalDecision.updateMany).not.toHaveBeenCalled();
  });

  it("does not overwrite a committed cancellation refund with a late rejection", async () => {
    tx.leaveRequest.updateMany.mockResolvedValue({ count: 0 });

    const result = await repository.rejectCancellationAtomically("request-1");

    expect(result).toBeNull();
    expect(tx.leaveRequest.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("claims legacy approval-chain initialization before writing decisions", async () => {
    const initialized = await repository.initializeApprovalChainAtomically(
      "request-1",
      [
        {
          order: 1,
          name: "Manager approval",
          approverType: "manager",
          approverUserId: null,
        },
      ],
    );

    expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "request-1",
        status: "pending",
        currentStepOrder: null,
      },
      data: { currentStepOrder: 1 },
    });
    expect(tx.leaveApprovalDecision.createMany).toHaveBeenCalledWith({
      data: [
        {
          leaveRequestId: "request-1",
          order: 1,
          name: "Manager approval",
          approverType: "manager",
          approverUserId: null,
        },
      ],
    });
    expect(initialized).toBe(true);
  });

  it("does not rewrite legacy decisions when another transition claimed the request", async () => {
    tx.leaveRequest.updateMany.mockResolvedValue({ count: 0 });

    const initialized = await repository.initializeApprovalChainAtomically(
      "request-1",
      [
        {
          order: 1,
          name: "Manager approval",
          approverType: "manager",
        },
      ],
    );

    expect(initialized).toBe(false);
    expect(tx.leaveApprovalDecision.createMany).not.toHaveBeenCalled();
  });
});
