import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { leaveRepository } from "@/modules/leave/leave.repository";
import { LeaveService } from "@/modules/leave/leave.service";
import { arrayAt, findOrThrow } from "@/test-utils/assertions";

vi.mock("./leave.repository", () => ({
  leaveRepository: {
    findTypes: vi.fn(),
    findAllTypes: vi.fn(),
    findTypeById: vi.fn(),
    findTypeByNameInEntity: vi.fn(),
    findTypeByCodeInEntity: vi.fn(),
    findUserEntityId: vi.fn().mockResolvedValue(null),
    createType: vi.fn(),
    updateType: vi.fn(),
    deleteType: vi.fn(),
    countTypeReferences: vi.fn(),
    findApprovers: vi.fn(),
    replaceApprovers: vi.fn(),
    findBalances: vi.fn(),
    findBalance: vi.fn(),
    findBalanceTransactions: vi.fn(),
    findRequests: vi.fn(),
    findRequestById: vi.fn(),
    findRequestByIdIncludingDeleted: vi.fn(),
    findUserById: vi.fn(),
    createRequest: vi.fn(),
    approveRequestStep: vi.fn(),
    rejectRequestStepAtomically: vi.fn(),
    cancelRequestAtomically: vi.fn(),
    rejectCancellationAtomically: vi.fn(),
    updateRequestStatus: vi.fn(),
    updateBalance: vi.fn(),
    createBalanceTransaction: vi.fn(),
    checkOverlap: vi.fn(),
    findDirectReports: vi.fn(),
    findAllReportees: vi.fn(),
    findBalancesForEmployees: vi.fn(),
    findTypesForEntities: vi.fn(),
    findApprovalSteps: vi.fn(),
    findApprovalStepById: vi.fn(),
    createApprovalStep: vi.fn(),
    updateApprovalStep: vi.fn(),
    deleteApprovalStep: vi.fn(),
    reorderApprovalSteps: vi.fn(),
    nextApprovalStepOrder: vi.fn(),
    initializeApprovalChainAtomically: vi.fn(),
    createDecisions: vi.fn(),
    findDecisions: vi.fn(),
    updateDecision: vi.fn(),
    deleteDecisionsForRequest: vi.fn(),
    updateRequestStepOrder: vi.fn(),
    permanentDeleteRequest: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    leaveBalance: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    leaveRequest: {
      update: vi.fn().mockImplementation((args) => Promise.resolve(args.data)),
    },
    leaveApprovalDecision: {
      update: vi.fn().mockResolvedValue({}),
    },
    user: {
      findMany: vi.fn(),
    },
    // Inline the tx callback so approveRequest's chain-advance block
    // runs against the same mocked client without needing a real
    // transaction.
    $transaction: vi.fn().mockImplementation(async (fn) =>
      fn({
        leaveApprovalDecision: { update: vi.fn().mockResolvedValue({}) },
        leaveRequest: {
          update: vi
            .fn()
            .mockImplementation((args) => Promise.resolve(args.data)),
        },
      }),
    ),
  },
}));

describe("LeaveService", () => {
  let leaveService: LeaveService;

  beforeEach(() => {
    leaveService = new LeaveService();
    vi.clearAllMocks();
    // Default to empty approver chain so legacy tests fall back to the
    // direct-manager path. Tests that need a chain override this.
    (leaveRepository.findApprovers as Mock).mockResolvedValue([]);
    // Org-wide approval-chain defaults: no steps, no decisions, no-op
    // step-order updates. Tests that exercise the chain override these.
    (leaveRepository.findApprovalSteps as Mock).mockResolvedValue([]);
    (leaveRepository.findDecisions as Mock).mockResolvedValue([]);
    (
      leaveRepository.initializeApprovalChainAtomically as Mock
    ).mockResolvedValue(true);
    (leaveRepository.createDecisions as Mock).mockResolvedValue({ count: 0 });
    (leaveRepository.deleteDecisionsForRequest as Mock).mockResolvedValue({
      count: 0,
    });
    (leaveRepository.updateDecision as Mock).mockResolvedValue({});
    (leaveRepository.updateRequestStepOrder as Mock).mockResolvedValue({});
    // Default to no virtual leave types so existing balance-shape
    // assertions are not perturbed; team-balance tests override this.
    (leaveRepository.findTypesForEntities as Mock).mockResolvedValue([]);
  });

  describe("getTypes", () => {
    it("should return all leave types", async () => {
      const mockTypes = [
        { id: "type-1", name: "Annual Leave", daysPerYear: 20 },
        { id: "type-2", name: "Sick Leave", daysPerYear: 10 },
      ];

      (leaveRepository.findTypes as Mock).mockResolvedValue(mockTypes);

      const result = await leaveService.getTypes();

      expect(result).toHaveLength(2);
      expect(arrayAt(result, 0, "first leave type").name).toBe("Annual Leave");
    });
  });

  describe("createType", () => {
    const baseInput = {
      name: "Annual Leave",
      code: "annual",
      description: "Earned annual leave",
      category: "earned" as const,
      daysPerYear: 20,
      requiresApproval: true,
      isPaid: true,
      isActive: true,
    };

    it("creates a new leave type with uppercase code", async () => {
      (leaveRepository.findTypeByNameInEntity as Mock).mockResolvedValue(null);
      (leaveRepository.findTypeByCodeInEntity as Mock).mockResolvedValue(null);
      (leaveRepository.createType as Mock).mockResolvedValue({
        id: "type-1",
        ...baseInput,
        code: "ANNUAL",
      });

      const result = await leaveService.createType(baseInput);

      expect(result.code).toBe("ANNUAL");
      expect(leaveRepository.createType).toHaveBeenCalledWith(
        expect.objectContaining({ code: "ANNUAL", daysPerYear: 20 }),
      );
    });

    it("throws ConflictException when name is taken", async () => {
      (leaveRepository.findTypeByNameInEntity as Mock).mockResolvedValue({
        id: "other",
      });
      (leaveRepository.findTypeByCodeInEntity as Mock).mockResolvedValue(null);

      await expect(leaveService.createType(baseInput)).rejects.toThrow(
        ConflictException,
      );
    });

    it("throws ConflictException when code is taken", async () => {
      (leaveRepository.findTypeByNameInEntity as Mock).mockResolvedValue(null);
      (leaveRepository.findTypeByCodeInEntity as Mock).mockResolvedValue({
        id: "other",
      });

      await expect(leaveService.createType(baseInput)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("updateType", () => {
    const existing = {
      id: "type-1",
      name: "Annual Leave",
      code: "ANNUAL",
      description: null,
      category: "earned",
      daysPerYear: 20,
      requiresApproval: true,
      isPaid: true,
      isActive: true,
    };

    it("updates only provided fields", async () => {
      (leaveRepository.findTypeById as Mock).mockResolvedValue(existing);
      (leaveRepository.updateType as Mock).mockResolvedValue({
        ...existing,
        daysPerYear: 25,
        description: "Updated",
      });

      const result = await leaveService.updateType("type-1", {
        daysPerYear: 25,
        description: "Updated",
      });

      expect(result.daysPerYear).toBe(25);
      expect(leaveRepository.updateType).toHaveBeenCalledWith("type-1", {
        daysPerYear: 25,
        description: "Updated",
      });
    });

    it("throws NotFound when policy is missing", async () => {
      (leaveRepository.findTypeById as Mock).mockResolvedValue(null);

      await expect(
        leaveService.updateType("missing", { daysPerYear: 5 }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects rename to a code already used by another policy", async () => {
      (leaveRepository.findTypeById as Mock).mockResolvedValue(existing);
      (leaveRepository.findTypeByCodeInEntity as Mock).mockResolvedValue({
        id: "other",
      });

      await expect(
        leaveService.updateType("type-1", { code: "TAKEN" }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("deleteType", () => {
    it("hard-deletes a policy with no references", async () => {
      (leaveRepository.findTypeById as Mock).mockResolvedValue({
        id: "t1",
        name: "Bereavement",
      });
      (leaveRepository.countTypeReferences as Mock).mockResolvedValue({
        balances: 0,
        requests: 0,
        transactions: 0,
      });
      (leaveRepository.deleteType as Mock).mockResolvedValue({});

      const result = await leaveService.deleteType("t1");

      expect(result.id).toBe("t1");
      expect(leaveRepository.deleteType).toHaveBeenCalledWith("t1");
    });

    it("blocks delete when balances/requests/transactions reference the policy", async () => {
      (leaveRepository.findTypeById as Mock).mockResolvedValue({
        id: "t1",
        name: "Annual",
      });
      (leaveRepository.countTypeReferences as Mock).mockResolvedValue({
        balances: 5,
        requests: 0,
        transactions: 0,
      });

      await expect(leaveService.deleteType("t1")).rejects.toThrow(
        ConflictException,
      );
      expect(leaveRepository.deleteType).not.toHaveBeenCalled();
    });

    it("throws NotFound when the policy does not exist", async () => {
      (leaveRepository.findTypeById as Mock).mockResolvedValue(null);

      await expect(leaveService.deleteType("missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("setApprovers", () => {
    it("replaces the chain with sequential order", async () => {
      (leaveRepository.findTypeById as Mock).mockResolvedValue({
        id: "t1",
      });
      (leaveRepository.replaceApprovers as Mock).mockResolvedValue([]);

      await leaveService.setApprovers("t1", {
        approvers: [
          { approverType: "manager" },
          {
            approverType: "user",
            approverUserId: "00000000-0000-0000-0000-000000000001",
          },
        ],
      });

      expect(leaveRepository.replaceApprovers).toHaveBeenCalledWith("t1", [
        expect.objectContaining({
          order: 1,
          approverType: "manager",
          approverUserId: null,
        }),
        expect.objectContaining({
          order: 2,
          approverType: "user",
          approverUserId: "00000000-0000-0000-0000-000000000001",
        }),
      ]);
    });
  });

  describe("getBalances", () => {
    it("returns stored balances enriched with `remaining`", async () => {
      const annualType = {
        id: "type-1",
        name: "Annual",
        code: "AL",
        category: "earned",
        entityId: null,
      };
      (leaveRepository.findBalances as Mock).mockResolvedValue([
        {
          id: "bal-1",
          leaveType: annualType,
          year: 2026,
          entitled: 14,
          used: 4,
          carried: 0,
          adjustment: 0,
        },
      ]);
      (leaveRepository.findTypes as Mock).mockResolvedValue([
        { ...annualType, daysPerYear: 14 },
      ]);

      const result = await leaveService.getBalances("user-123", [], {});

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        leaveType: {
          id: annualType.id,
          name: annualType.name,
          code: annualType.code,
          category: annualType.category,
        },
        entitled: 14,
        used: 4,
        remaining: 10,
      });
      expect(result[0]?.leaveType).not.toHaveProperty("entityId");
    });

    it("synthesises a zero-used entry for active policies without a balance row", async () => {
      (leaveRepository.findBalances as Mock).mockResolvedValue([]);
      (leaveRepository.findTypes as Mock).mockResolvedValue([
        {
          id: "type-1",
          name: "Annual",
          code: "AL",
          category: "earned",
          daysPerYear: 14,
        },
        {
          id: "type-2",
          name: "Sick",
          code: "SL",
          category: "sick",
          daysPerYear: 30,
        },
      ]);

      const result = await leaveService.getBalances("user-123", [], {
        year: 2026,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        leaveType: { id: "type-1", name: "Annual" },
        entitled: 14,
        used: 0,
        remaining: 14,
      });
      expect(result[1]).toMatchObject({
        leaveType: { id: "type-2", name: "Sick" },
        entitled: 30,
        remaining: 30,
      });
    });

    it("drops balance rows whose leave type belongs to a different entity", async () => {
      // Legacy seeds and earlier imports created LeaveBalance rows for
      // every leave type regardless of the employee's entity. Combined
      // with synthesised rows, those leaked into the UI as duplicate
      // cards (e.g. one Personal Leave at 0/0 next to the real one).
      (leaveRepository.findUserEntityId as Mock).mockResolvedValueOnce(
        "ent-th",
      );
      (leaveRepository.findBalances as Mock).mockResolvedValue([
        {
          id: "bal-th",
          leaveType: {
            id: "type-th-pl",
            name: "Personal Leave",
            code: "PL",
            category: "casual",
            entityId: "ent-th",
          },
          year: 2026,
          entitled: 3,
          used: 0,
          carried: 0,
          adjustment: 0,
        },
        {
          id: "bal-in-stale",
          leaveType: {
            id: "type-in-pl",
            name: "Personal Leave",
            code: "PL",
            category: "casual",
            entityId: "ent-in",
          },
          year: 2026,
          entitled: 0,
          used: 0,
          carried: 0,
          adjustment: 0,
        },
      ]);
      (leaveRepository.findTypes as Mock).mockResolvedValue([
        {
          id: "type-th-pl",
          name: "Personal Leave",
          code: "PL",
          category: "casual",
          entityId: "ent-th",
          daysPerYear: 3,
        },
      ]);

      const result = await leaveService.getBalances("user-123", [], {
        year: 2026,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "bal-th",
        entitled: 3,
        remaining: 3,
      });
    });

    it("should allow HR to view other employee balances", async () => {
      (leaveRepository.findBalances as Mock).mockResolvedValue([]);
      (leaveRepository.findTypes as Mock).mockResolvedValue([]);

      await leaveService.getBalances("hr-user", [PERMISSIONS.LEAVE_HR_READ], {
        employeeId: "other-user",
        year: 2024,
      });

      expect(leaveRepository.findBalances).toHaveBeenCalledWith(
        "other-user",
        2024,
      );
    });

    it("should throw ForbiddenException when viewing other employee balances without permission", async () => {
      await expect(
        leaveService.getBalances("user-123", [], { employeeId: "other-user" }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("getTeamBalances", () => {
    const reports = [
      {
        id: "rep-1",
        name: "Alice",
        email: "a@x.com",
        avatarUrl: null,
        department: "Eng",
        jobTitle: "Engineer",
        entityId: "ent-th",
        entity: { id: "ent-th", code: "TH", name: "Manut Thailand" },
      },
      {
        id: "rep-2",
        name: "Bob",
        email: "b@x.com",
        avatarUrl: null,
        department: "Eng",
        jobTitle: "Designer",
        entityId: "ent-vn",
        entity: { id: "ent-vn", code: "VN", name: "Manut Vietnam" },
      },
    ];

    it("returns direct reports + their balances for line manager", async () => {
      (leaveRepository.findDirectReports as Mock).mockResolvedValue(reports);
      (leaveRepository.findBalancesForEmployees as Mock).mockResolvedValue([
        {
          id: "bal-1",
          employeeId: "rep-1",
          year: 2026,
          entitled: 15,
          used: 3,
          carried: 0,
          adjustment: 0,
          leaveType: {
            id: "type-1",
            name: "Annual",
            code: "ANN",
            category: "earned",
            entityId: null,
          },
        },
      ]);

      const result = await leaveService.getTeamBalances(
        "manager-1",
        [PERMISSIONS.LEAVE_APPROVE],
        { year: 2026 },
      );

      expect(result).toHaveLength(2);
      const alice = arrayAt(result, 0, "Alice team balance");
      const bob = arrayAt(result, 1, "Bob team balance");
      expect(alice.employee.name).toBe("Alice");
      expect(alice.balances).toHaveLength(1);
      expect(arrayAt(alice.balances, 0, "Alice annual balance").remaining).toBe(
        12,
      );
      expect(bob.balances).toHaveLength(0);
      expect(leaveRepository.findDirectReports).toHaveBeenCalledWith(
        "manager-1",
      );
      expect(leaveRepository.findAllReportees).not.toHaveBeenCalled();
    });

    it("HR sees all reportees, not just own direct reports", async () => {
      (leaveRepository.findAllReportees as Mock).mockResolvedValue(reports);
      (leaveRepository.findBalancesForEmployees as Mock).mockResolvedValue([]);

      await leaveService.getTeamBalances(
        "hr-1",
        [PERMISSIONS.LEAVE_HR_READ],
        {},
      );

      expect(leaveRepository.findAllReportees).toHaveBeenCalled();
      expect(leaveRepository.findDirectReports).not.toHaveBeenCalled();
    });

    it("defaults to current year when query omits year", async () => {
      (leaveRepository.findDirectReports as Mock).mockResolvedValue([]);
      (leaveRepository.findBalancesForEmployees as Mock).mockResolvedValue([]);

      const result = await leaveService.getTeamBalances(
        "manager-1",
        [PERMISSIONS.LEAVE_APPROVE],
        {},
      );

      expect(result).toEqual([]);
      expect(leaveRepository.findBalancesForEmployees).toHaveBeenCalledWith(
        [],
        new Date().getFullYear(),
      );
    });

    it("synthesizes zero-used balances from leave types when no row exists", async () => {
      (leaveRepository.findDirectReports as Mock).mockResolvedValue(reports);
      (leaveRepository.findBalancesForEmployees as Mock).mockResolvedValue([]);
      (leaveRepository.findTypesForEntities as Mock).mockResolvedValue([
        {
          id: "t-al",
          name: "Annual Leave",
          code: "AL",
          category: "earned",
          entityId: null,
          daysPerYear: 14,
        },
        {
          id: "t-wfh",
          name: "Work From Home",
          code: "WFH",
          category: "casual",
          entityId: "ent-th",
          daysPerYear: 30,
        },
      ]);

      const result = await leaveService.getTeamBalances(
        "manager-1",
        [PERMISSIONS.LEAVE_APPROVE],
        { year: 2026 },
      );

      // Alice (TH) sees both global AL + TH-scoped WFH.
      const alice = arrayAt(result, 0, "Alice team balance");
      const bob = arrayAt(result, 1, "Bob team balance");
      expect(alice.balances).toHaveLength(2);
      expect(alice.balances.every((b) => b.synthesized)).toBe(true);
      expect(
        findOrThrow(
          alice.balances,
          (balance) => balance.leaveType.code === "WFH",
          "Alice WFH balance",
        ).entitled,
      ).toBe(30);
      // Bob (VN) only sees the global AL, not TH's WFH.
      expect(bob.balances).toHaveLength(1);
      const bobAnnual = arrayAt(bob.balances, 0, "Bob annual balance");
      expect(bobAnnual.leaveType.code).toBe("AL");
      expect(bobAnnual.entitled).toBe(14);
      expect(bobAnnual.remaining).toBe(14);
    });

    it("returns empty balances when no types apply to the employee's entity", async () => {
      (leaveRepository.findDirectReports as Mock).mockResolvedValue(reports);
      (leaveRepository.findBalancesForEmployees as Mock).mockResolvedValue([]);
      // Only TH-scoped types — Bob (VN) gets nothing, no global fallback exists.
      (leaveRepository.findTypesForEntities as Mock).mockResolvedValue([
        {
          id: "t-al",
          name: "Annual Leave",
          code: "AL",
          category: "earned",
          entityId: "ent-th",
          daysPerYear: 14,
        },
      ]);

      const result = await leaveService.getTeamBalances(
        "manager-1",
        [PERMISSIONS.LEAVE_APPROVE],
        { year: 2026 },
      );

      const alice = arrayAt(result, 0, "Alice team balance");
      const bob = arrayAt(result, 1, "Bob team balance");
      expect(alice.balances).toHaveLength(1);
      expect(bob.balances).toEqual([]);
      // UI uses employee.entity to compose the empty-state message.
      expect(bob.employee.entity).toEqual({
        id: "ent-vn",
        code: "VN",
        name: "Manut Vietnam",
      });
    });

    it("drops cross-entity balance rows so they don't duplicate synthesised cards", async () => {
      (leaveRepository.findDirectReports as Mock).mockResolvedValue([
        reports[0],
      ]);
      (leaveRepository.findBalancesForEmployees as Mock).mockResolvedValue([
        // Stale India PL row attached to a Thailand employee — must be
        // hidden so the synthesised Thailand PL is the only card surfaced.
        {
          id: "bal-stale",
          employeeId: "rep-1",
          leaveTypeId: "t-in-pl",
          year: 2026,
          entitled: 0,
          used: 0,
          carried: 0,
          adjustment: 0,
          leaveType: {
            id: "t-in-pl",
            name: "Personal Leave",
            code: "PL",
            category: "casual",
            entityId: "ent-in",
          },
        },
      ]);
      (leaveRepository.findTypesForEntities as Mock).mockResolvedValue([
        {
          id: "t-th-pl",
          name: "Personal Leave",
          code: "PL",
          category: "casual",
          entityId: "ent-th",
          daysPerYear: 3,
        },
      ]);

      const result = await leaveService.getTeamBalances(
        "manager-1",
        [PERMISSIONS.LEAVE_APPROVE],
        { year: 2026 },
      );

      const alice = arrayAt(result, 0, "Alice team balance");
      expect(alice.balances).toHaveLength(1);
      expect(
        arrayAt(alice.balances, 0, "Alice personal leave balance"),
      ).toMatchObject({
        leaveType: { id: "t-th-pl" },
        entitled: 3,
        synthesized: true,
      });
    });

    it("merges real balances with synthesized rows for missing types", async () => {
      (leaveRepository.findDirectReports as Mock).mockResolvedValue([
        reports[0],
      ]);
      (leaveRepository.findBalancesForEmployees as Mock).mockResolvedValue([
        {
          id: "bal-al",
          employeeId: "rep-1",
          leaveTypeId: "t-al",
          year: 2026,
          entitled: 14,
          used: 2,
          carried: 0,
          adjustment: 0,
          leaveType: {
            id: "t-al",
            name: "Annual Leave",
            code: "AL",
            category: "earned",
            entityId: null,
          },
        },
      ]);
      (leaveRepository.findTypesForEntities as Mock).mockResolvedValue([
        {
          id: "t-al",
          name: "Annual Leave",
          code: "AL",
          category: "earned",
          entityId: null,
          daysPerYear: 14,
        },
        {
          id: "t-sl",
          name: "Sick Leave",
          code: "SL",
          category: "sick",
          entityId: null,
          daysPerYear: 30,
        },
      ]);

      const result = await leaveService.getTeamBalances(
        "manager-1",
        [PERMISSIONS.LEAVE_APPROVE],
        { year: 2026 },
      );

      const alice = arrayAt(result, 0, "Alice team balance");
      expect(alice.balances).toHaveLength(2);
      const al = findOrThrow(
        alice.balances,
        (balance) => balance.leaveType.code === "AL",
        "Alice annual balance",
      );
      const sl = findOrThrow(
        alice.balances,
        (balance) => balance.leaveType.code === "SL",
        "Alice sick balance",
      );
      expect(al.synthesized).toBe(false);
      expect(al.remaining).toBe(12);
      expect(sl.synthesized).toBe(true);
      expect(sl.remaining).toBe(30);
    });
  });

  describe("getRequests", () => {
    it("should return filtered requests with pagination", async () => {
      const mockRequests = [
        { id: "req-1", employeeId: "user-123", status: "pending" },
      ];

      (leaveRepository.findRequests as Mock).mockResolvedValue({
        data: mockRequests,
        total: 1,
      });

      const result = await leaveService.getRequests("user-123", [], {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it("should filter by own requests when no HR permission", async () => {
      (leaveRepository.findRequests as Mock).mockResolvedValue({
        data: [],
        total: 0,
      });

      await leaveService.getRequests("user-123", [], { page: 1, limit: 10 });

      expect(leaveRepository.findRequests).toHaveBeenCalledWith(
        expect.objectContaining({ managerScopeUserId: "user-123" }),
        1,
        10,
      );
    });
  });

  describe("createRequest", () => {
    const annualType = {
      id: "type-1",
      name: "Annual Leave",
      code: "AL",
      entityId: null,
      daysPerYear: 20,
      requiresApproval: true,
    };
    const createInput = {
      leaveTypeId: "type-1",
      startDate: "2024-06-10",
      endDate: "2024-06-14",
      durationType: "full_day" as const,
      source: "entitled" as const,
      reason: "Vacation",
    };

    beforeEach(() => {
      (leaveRepository.findUserById as Mock).mockResolvedValue({
        id: "user-123",
        name: "Employee",
        email: null,
        entityId: "entity-1",
        isActive: true,
        reportingTo: null,
      });
    });

    it("should create leave request successfully", async () => {
      (leaveRepository.findTypes as Mock).mockResolvedValue([annualType]);
      (leaveRepository.findBalance as Mock).mockResolvedValue({
        entitled: 20,
        carried: 0,
        adjustment: 0,
        used: 5,
      });
      (leaveRepository.checkOverlap as Mock).mockResolvedValue(null);
      (leaveRepository.findUserById as Mock).mockResolvedValue({
        id: "user-123",
        entityId: "entity-1",
        isActive: true,
      });
      (leaveRepository.createRequest as Mock).mockResolvedValue({
        id: "new-request",
        status: "pending",
        days: 5,
      });

      const result = await leaveService.createRequest(
        "user-123",
        [PERMISSIONS.LEAVE_REQUEST],
        createInput,
      );

      expect(result.id).toBe("new-request");
      expect(leaveRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultEntitlement: 20,
          requiresApproval: true,
        }),
      );
    });

    it("should throw NotFoundException when leave type not found", async () => {
      (leaveRepository.findTypes as Mock).mockResolvedValue([]);

      await expect(
        leaveService.createRequest(
          "user-123",
          [PERMISSIONS.LEAVE_REQUEST],
          createInput,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when insufficient balance", async () => {
      (leaveRepository.findTypes as Mock).mockResolvedValue([annualType]);
      (leaveRepository.findBalance as Mock).mockResolvedValue({
        entitled: 10,
        carried: 0,
        adjustment: 0,
        used: 8,
      });
      (leaveRepository.checkOverlap as Mock).mockResolvedValue(null);

      await expect(
        leaveService.createRequest(
          "user-123",
          [PERMISSIONS.LEAVE_REQUEST],
          createInput,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create half-day leave request with 0.5 days", async () => {
      (leaveRepository.findTypes as Mock).mockResolvedValue([
        { ...annualType, name: "Sick Leave", code: "SL" },
      ]);
      (leaveRepository.findBalance as Mock).mockResolvedValue({
        entitled: 10,
        carried: 0,
        adjustment: 0,
        used: 0,
      });
      (leaveRepository.checkOverlap as Mock).mockResolvedValue(null);
      (leaveRepository.findUserById as Mock).mockResolvedValue({
        id: "user-123",
        entityId: "entity-1",
        isActive: true,
        name: "Test User",
      });
      (leaveRepository.createRequest as Mock).mockResolvedValue({
        id: "half-day-req",
        status: "pending",
        days: 0.5,
      });

      await leaveService.createRequest(
        "user-123",
        [PERMISSIONS.LEAVE_REQUEST],
        {
          leaveTypeId: "type-1",
          startDate: "2024-06-12",
          endDate: "2024-06-12",
          durationType: "half_day",
          source: "entitled",
          halfDayPeriod: "am",
        },
      );

      expect(leaveRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          days: 0.5,
          durationType: "half_day",
          halfDayPeriod: "am",
        }),
      );
    });

    it("should throw ConflictException when dates overlap", async () => {
      (leaveRepository.findTypes as Mock).mockResolvedValue([annualType]);
      (leaveRepository.findBalance as Mock).mockResolvedValue({
        entitled: 20,
        carried: 0,
        adjustment: 0,
        used: 0,
      });
      (leaveRepository.checkOverlap as Mock).mockResolvedValue({
        id: "existing-req",
      });

      await expect(
        leaveService.createRequest(
          "user-123",
          [PERMISSIONS.LEAVE_REQUEST],
          createInput,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ForbiddenException when creating for another user without on-behalf", async () => {
      await expect(
        leaveService.createRequest(
          "11111111-1111-1111-1111-111111111111",
          [PERMISSIONS.LEAVE_REQUEST],
          {
            ...createInput,
            employeeId: "22222222-2222-2222-2222-222222222222",
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should create on behalf when HR has leave:hr-on-behalf", async () => {
      (leaveRepository.findTypes as Mock).mockResolvedValue([annualType]);
      (leaveRepository.findBalance as Mock).mockResolvedValue({
        entitled: 20,
        carried: 0,
        adjustment: 0,
        used: 0,
      });
      (leaveRepository.checkOverlap as Mock).mockResolvedValue(null);
      (leaveRepository.findUserById as Mock).mockImplementation((id: string) =>
        Promise.resolve({
          id,
          entityId: "entity-1",
          isActive: true,
        }),
      );
      (leaveRepository.createRequest as Mock).mockResolvedValue({
        id: "new-request",
        status: "pending",
        days: 5,
      });

      const result = await leaveService.createRequest(
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        [PERMISSIONS.LEAVE_HR_ON_BEHALF],
        {
          ...createInput,
          employeeId: "33333333-3333-3333-3333-333333333333",
        },
      );

      expect(result.id).toBe("new-request");
      expect(leaveRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: "33333333-3333-3333-3333-333333333333",
        }),
      );
    });

    it("materializes a synthesized policy balance before creating a request", async () => {
      (leaveRepository.findTypes as Mock).mockResolvedValue([annualType]);
      (leaveRepository.findBalance as Mock).mockResolvedValue(null);
      (leaveRepository.checkOverlap as Mock).mockResolvedValue(null);
      (leaveRepository.findUserById as Mock).mockResolvedValue({
        id: "user-123",
        entityId: "entity-1",
        isActive: true,
      });
      (leaveRepository.createRequest as Mock).mockResolvedValue({
        id: "materialized-request",
        status: "pending",
      });

      await leaveService.createRequest(
        "user-123",
        [PERMISSIONS.LEAVE_REQUEST],
        createInput,
      );

      expect(leaveRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultEntitlement: annualType.daysPerYear,
          employeeId: "user-123",
          leaveTypeId: annualType.id,
        }),
      );
    });

    it("enforces the policy entitlement when the balance is synthesized", async () => {
      (leaveRepository.findTypes as Mock).mockResolvedValue([
        { ...annualType, daysPerYear: 2 },
      ]);
      (leaveRepository.findBalance as Mock).mockResolvedValue(null);

      await expect(
        leaveService.createRequest(
          "user-123",
          [PERMISSIONS.LEAVE_REQUEST],
          createInput,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(leaveRepository.createRequest).not.toHaveBeenCalled();
    });

    it("rejects an entity-scoped leave type for an employee in another entity", async () => {
      (leaveRepository.findTypes as Mock).mockResolvedValue([
        { ...annualType, entityId: "entity-other" },
      ]);
      (leaveRepository.findUserById as Mock).mockResolvedValue({
        id: "user-123",
        entityId: "entity-target",
        isActive: true,
      });

      await expect(
        leaveService.createRequest(
          "user-123",
          [PERMISSIONS.LEAVE_REQUEST],
          createInput,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(leaveRepository.createRequest).not.toHaveBeenCalled();
    });

    it("auto-approves a policy that does not require approval", async () => {
      (leaveRepository.findTypes as Mock).mockResolvedValue([
        { ...annualType, requiresApproval: false },
      ]);
      (leaveRepository.findBalance as Mock).mockResolvedValue(null);
      (leaveRepository.checkOverlap as Mock).mockResolvedValue(null);
      (leaveRepository.findUserById as Mock).mockResolvedValue({
        id: "user-123",
        name: "Employee",
        email: null,
        entityId: "entity-1",
        isActive: true,
        reportingTo: null,
      });
      (leaveRepository.createRequest as Mock).mockResolvedValue({
        id: "auto-request",
        status: "approved",
        days: 5,
      });

      const result = await leaveService.createRequest(
        "user-123",
        [PERMISSIONS.LEAVE_REQUEST],
        createInput,
      );

      expect(result.status).toBe("approved");
      expect(leaveRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ requiresApproval: false }),
      );
      expect(leaveRepository.createDecisions).not.toHaveBeenCalled();
      expect(leaveRepository.updateRequestStepOrder).not.toHaveBeenCalled();
      expect(
        leaveRepository.initializeApprovalChainAtomically,
      ).not.toHaveBeenCalled();
    });
  });

  describe("getBalanceTransactions", () => {
    it("serializes decimal audit amounts as exact API numbers", async () => {
      (leaveRepository.findBalanceTransactions as Mock).mockResolvedValue([
        {
          id: "transaction-1",
          amount: { toString: () => "0.5" },
        },
      ]);

      const result = await leaveService.getBalanceTransactions(
        "employee-1",
        [],
        "employee-1",
        2026,
      );

      expect(result.data).toEqual([{ id: "transaction-1", amount: 0.5 }]);
    });
  });

  describe("approveRequest", () => {
    const pendingRequestBase = {
      id: "req-1",
      status: "pending" as const,
      employeeId: "user-123",
      leaveTypeId: "type-1",
      startDate: new Date("2024-06-10"),
      endDate: new Date("2024-06-14"),
      days: 5,
      employee: {
        id: "user-123",
        name: "Employee",
        email: "emp@test.com",
        department: "Eng",
        reportingTo: "approver-123",
      },
      leaveType: {
        id: "type-1",
        name: "Annual",
        code: "AN",
        daysPerYear: 20,
      },
      delegatedToId: null as string | null,
    };

    it("should approve pending request when actor is direct manager", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue(
        pendingRequestBase,
      );
      (leaveRepository.approveRequestStep as Mock).mockResolvedValue({
        id: "req-1",
        status: "approved",
      });
      (leaveRepository.findUserById as Mock).mockResolvedValue({
        id: "approver-123",
        name: "Manager",
        email: "mgr@test.com",
        entityId: null,
        isActive: true,
        reportingTo: null,
      });

      const result = await leaveService.approveRequest(
        "req-1",
        "approver-123",
        [],
      );

      expect(result.status).toBe("approved");
      expect(leaveRepository.approveRequestStep).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "req-1",
          days: 5,
          defaultEntitlement: 20,
          nextStepOrder: null,
        }),
      );
    });

    it("keeps a half-day approval amount exact in the atomic mutation", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue({
        ...pendingRequestBase,
        days: 0.5,
      });
      (leaveRepository.approveRequestStep as Mock).mockResolvedValue({
        id: "req-1",
        status: "approved",
      });
      (leaveRepository.findUserById as Mock).mockResolvedValue({
        id: "approver-123",
        name: "Manager",
        email: null,
        entityId: null,
        isActive: true,
        reportingTo: null,
      });

      await leaveService.approveRequest("req-1", "approver-123", []);

      expect(leaveRepository.approveRequestStep).toHaveBeenCalledWith(
        expect.objectContaining({ days: 0.5 }),
      );
    });

    it("should throw NotFoundException when request not found", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue(null);

      await expect(
        leaveService.approveRequest("non-existent", "approver-123", []),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when request is not pending", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue({
        id: "req-1",
        status: "approved",
      });

      await expect(
        leaveService.approveRequest("req-1", "approver-123", []),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("rejectRequest", () => {
    it("should reject pending request when actor is direct manager", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue({
        id: "req-1",
        status: "pending",
        employeeId: "user-123",
        startDate: new Date("2024-06-10"),
        endDate: new Date("2024-06-14"),
        employee: {
          id: "user-123",
          name: "Employee",
          email: "emp@test.com",
          department: "Eng",
          reportingTo: "approver-123",
        },
        leaveType: { id: "t1", name: "Annual", code: "AN" },
        delegatedToId: null,
      });
      (leaveRepository.rejectRequestStepAtomically as Mock).mockResolvedValue({
        id: "req-1",
        status: "rejected",
      });
      (leaveRepository.findUserById as Mock).mockResolvedValue({
        id: "approver-123",
        name: "Manager",
        email: "mgr@test.com",
        entityId: null,
        isActive: true,
        reportingTo: null,
      });

      const result = await leaveService.rejectRequest(
        "req-1",
        "approver-123",
        "Not enough coverage",
        [],
      );

      expect(result.status).toBe("rejected");
      expect(leaveRepository.rejectRequestStepAtomically).toHaveBeenCalledWith({
        requestId: "req-1",
        approverId: "approver-123",
        currentDecisionId: null,
        expectedStepOrder: 1,
        reason: "Not enough coverage",
      });
    });

    it("should throw NotFoundException when request not found", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue(null);

      await expect(
        leaveService.rejectRequest(
          "non-existent",
          "approver-123",
          "reason",
          [],
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("fails closed when approval wins the concurrent status transition", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue({
        id: "req-1",
        status: "pending",
        employeeId: "user-123",
        currentStepOrder: 1,
        employee: {
          id: "user-123",
          reportingTo: "approver-123",
        },
        leaveType: { code: "AN" },
        delegatedToId: null,
      });
      (leaveRepository.findDecisions as Mock).mockResolvedValue([
        { id: "decision-1", order: 1, status: "pending" },
      ]);
      (leaveRepository.rejectRequestStepAtomically as Mock).mockResolvedValue(
        null,
      );

      await expect(
        leaveService.rejectRequest("req-1", "approver-123", "No coverage", []),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("cancelRequest", () => {
    beforeEach(() => {
      (leaveRepository.cancelRequestAtomically as Mock).mockResolvedValue({
        id: "req-1",
        status: "cancelled",
      });
    });

    it("should cancel own pending request", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue({
        id: "req-1",
        employeeId: "user-123",
        status: "pending",
      });
      const result = await leaveService.cancelRequest("req-1", "user-123");

      expect(result.status).toBe("cancelled");
      expect(leaveRepository.cancelRequestAtomically).toHaveBeenCalledWith({
        requestId: "req-1",
        expectedStatus: "pending",
        approvedBy: undefined,
        refund: null,
      });
    });

    it("atomically refunds a half-day balance when cancelling an approved request", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue({
        id: "req-1",
        employeeId: "user-123",
        leaveTypeId: "lt-1",
        status: "approved",
        source: "entitled",
        days: 0.5,
        startDate: new Date("2026-06-04"),
        endDate: new Date("2026-06-05"),
        employee: { name: "Benjaporn" },
        leaveType: { name: "Annual Leave", daysPerYear: 20 },
      });
      // No reporting manager -> skip the notification email path.
      (leaveRepository.findUserById as Mock).mockResolvedValue(null);

      const result = await leaveService.cancelRequest("req-1", "user-123");

      expect(leaveRepository.cancelRequestAtomically).toHaveBeenCalledWith({
        requestId: "req-1",
        expectedStatus: "approved",
        approvedBy: undefined,
        refund: {
          employeeId: "user-123",
          leaveTypeId: "lt-1",
          year: 2026,
          days: 0.5,
          source: "entitled",
          defaultEntitlement: 20,
          description: expect.stringContaining("Leave cancelled"),
        },
      });
      expect(result.status).toBe("cancelled");
    });

    it("does not refund balance when cancelling a pending request", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue({
        id: "req-2",
        employeeId: "user-123",
        leaveTypeId: "lt-1",
        status: "pending",
        source: "entitled",
        days: 1,
        startDate: new Date("2026-06-04"),
        endDate: new Date("2026-06-04"),
        employee: { name: "Benjaporn" },
        leaveType: { name: "Annual Leave" },
      });
      (leaveRepository.cancelRequestAtomically as Mock).mockResolvedValue({
        id: "req-2",
        status: "cancelled",
      });
      (leaveRepository.findUserById as Mock).mockResolvedValue(null);

      await leaveService.cancelRequest("req-2", "user-123");

      expect(leaveRepository.cancelRequestAtomically).toHaveBeenCalledWith(
        expect.objectContaining({ refund: null }),
      );
    });

    it("should throw ForbiddenException when cancelling other's request", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue({
        id: "req-1",
        employeeId: "other-user",
        status: "pending",
      });

      await expect(
        leaveService.cancelRequest("req-1", "user-123"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException when request cannot be cancelled", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue({
        id: "req-1",
        employeeId: "user-123",
        status: "rejected",
      });

      await expect(
        leaveService.cancelRequest("req-1", "user-123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("fails closed when a concurrent retry already changed the request", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue({
        id: "req-1",
        employeeId: "user-123",
        leaveTypeId: "lt-1",
        status: "approved",
        source: "entitled",
        days: 1,
        startDate: new Date("2026-06-04"),
        endDate: new Date("2026-06-04"),
        employee: { name: "Employee" },
        leaveType: { name: "Annual Leave", daysPerYear: 20 },
      });
      (leaveRepository.cancelRequestAtomically as Mock).mockResolvedValue(null);

      await expect(
        leaveService.cancelRequest("req-1", "user-123"),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("approveCancellation", () => {
    it("atomically refunds a legacy pending cancellation exactly once", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue({
        id: "req-legacy",
        employeeId: "employee-1",
        leaveTypeId: "type-1",
        status: "pending_cancellation",
        source: "entitled",
        days: 0.5,
        startDate: new Date("2026-07-17"),
        endDate: new Date("2026-07-17"),
        employee: { reportingTo: "manager-1" },
        leaveType: {
          code: "AL",
          name: "Annual Leave",
          daysPerYear: 10,
        },
        delegatedToId: null,
      });
      (leaveRepository.cancelRequestAtomically as Mock).mockResolvedValue({
        id: "req-legacy",
        status: "cancelled",
      });

      const result = await leaveService.approveCancellation(
        "req-legacy",
        "hr-1",
        [PERMISSIONS.LEAVE_HR_READ],
      );

      expect(leaveRepository.cancelRequestAtomically).toHaveBeenCalledWith({
        requestId: "req-legacy",
        expectedStatus: "pending_cancellation",
        approvedBy: "hr-1",
        refund: expect.objectContaining({ days: 0.5 }),
      });
      expect(result.status).toBe("cancelled");
    });
  });

  describe("rejectCancellation", () => {
    const pendingCancellation = {
      id: "req-cancel",
      employeeId: "employee-1",
      status: "pending_cancellation",
      employee: { reportingTo: "manager-1" },
      leaveType: { code: "AN" },
      delegatedToId: null,
    };

    it("guards the pending-cancellation to approved transition", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue(
        pendingCancellation,
      );
      (leaveRepository.rejectCancellationAtomically as Mock).mockResolvedValue({
        id: "req-cancel",
        status: "approved",
      });

      const result = await leaveService.rejectCancellation(
        "req-cancel",
        "manager-1",
        [],
      );

      expect(result.status).toBe("approved");
      expect(leaveRepository.rejectCancellationAtomically).toHaveBeenCalledWith(
        "req-cancel",
      );
    });

    it("fails closed when a refund commits before cancellation rejection", async () => {
      (leaveRepository.findRequestById as Mock).mockResolvedValue(
        pendingCancellation,
      );
      (leaveRepository.rejectCancellationAtomically as Mock).mockResolvedValue(
        null,
      );

      await expect(
        leaveService.rejectCancellation("req-cancel", "manager-1", []),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("updateBalance", () => {
    it("writes new values and creates a manual_adjustment transaction", async () => {
      (prisma.leaveBalance.findUnique as Mock).mockResolvedValue({
        id: "bal-1",
        employeeId: "emp-1",
        leaveTypeId: "type-1",
        year: 2026,
        entitled: 10,
        used: 0,
        carried: 0,
        carriedUsed: 0,
        carriedExpiry: null,
        adjustment: 0,
      });
      (prisma.leaveBalance.update as Mock).mockResolvedValue({
        id: "bal-1",
        entitled: 10.5,
        used: 1.5,
        carried: 0,
        carriedUsed: 0,
        carriedExpiry: null,
        adjustment: 0,
      });
      (leaveRepository.createBalanceTransaction as Mock).mockResolvedValue({});

      const result = await leaveService.updateBalance(
        "bal-1",
        { entitled: 10.5, used: 1.5, reason: "HR correction" },
        "actor-1",
      );

      expect(result.entitled).toBe(10.5);
      expect(prisma.leaveBalance.update).toHaveBeenCalledWith({
        where: { id: "bal-1" },
        data: {
          entitled: 10.5,
          used: 1.5,
          carried: 0,
          carriedUsed: 0,
          carriedExpiry: null,
          adjustment: 0,
        },
      });
      expect(leaveRepository.createBalanceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: "emp-1",
          leaveTypeId: "type-1",
          year: 2026,
          type: "manual_adjustment",
          amount: 0.5,
          description: expect.stringContaining("HR correction"),
        }),
      );
    });

    it("throws NotFoundException when the balance id does not exist", async () => {
      (prisma.leaveBalance.findUnique as Mock).mockResolvedValue(null);

      await expect(
        leaveService.updateBalance("missing", { entitled: 5 }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("commitBulkImport", () => {
    it("accepts half-day entries (0.5) without truncation", async () => {
      (leaveRepository.findAllTypes as Mock).mockResolvedValue([
        { id: "type-1", code: "AL", entityId: null, isActive: true },
      ]);
      (prisma.user.findMany as Mock).mockResolvedValue([
        { id: "emp-1", email: "alice@example.com", entityId: null },
      ]);
      (leaveRepository.findBalance as Mock).mockResolvedValue(null);
      (prisma.leaveBalance.create as Mock).mockResolvedValue({});
      (leaveRepository.createBalanceTransaction as Mock).mockResolvedValue({});

      const result = await leaveService.commitBulkImport([
        {
          employeeEmail: "alice@example.com",
          leaveTypeCode: "AL",
          year: 2026,
          entitled: 10,
          carried: 0,
          adjustment: 0,
          used: 0.5,
        },
      ]);

      expect(result.data.created).toBe(1);
      expect(prisma.leaveBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ used: 0.5, entitled: 10 }),
        }),
      );
    });

    it("preserves existing entitled when row omits the field", async () => {
      (leaveRepository.findAllTypes as Mock).mockResolvedValue([
        { id: "type-1", code: "SL", entityId: null, isActive: true },
      ]);
      (prisma.user.findMany as Mock).mockResolvedValue([
        { id: "emp-1", email: "alice@example.com", entityId: null },
      ]);
      (leaveRepository.findBalance as Mock).mockResolvedValue({
        id: "bal-1",
        entitled: 30,
        used: 0,
      });
      (prisma.leaveBalance.update as Mock).mockResolvedValue({});
      (leaveRepository.createBalanceTransaction as Mock).mockResolvedValue({});

      const result = await leaveService.commitBulkImport([
        {
          employeeEmail: "alice@example.com",
          leaveTypeCode: "SL",
          year: 2026,
          carried: 0,
          adjustment: 0,
          used: 4,
        },
      ]);

      expect(result.data.updated).toBe(1);
      const updateCall = (prisma.leaveBalance.update as Mock).mock
        .calls[0]?.[0];
      // entitled key MUST NOT be present when the row didn't set it,
      // otherwise the prod policy gets wiped to 0 / undefined.
      expect(updateCall.data).not.toHaveProperty("entitled");
      expect(updateCall.data).toMatchObject({ used: 4 });
    });

    it("resolves leave type for the employee's entity, not just the code", async () => {
      (leaveRepository.findAllTypes as Mock).mockResolvedValue([
        { id: "sl-global", code: "SL", entityId: null, isActive: true },
        { id: "sl-th", code: "SL", entityId: "ent-th", isActive: true },
      ]);
      (prisma.user.findMany as Mock).mockResolvedValue([
        { id: "emp-1", email: "alice@example.com", entityId: "ent-th" },
      ]);
      (leaveRepository.findBalance as Mock).mockResolvedValue(null);
      (prisma.leaveBalance.create as Mock).mockResolvedValue({});
      (leaveRepository.createBalanceTransaction as Mock).mockResolvedValue({});

      await leaveService.commitBulkImport([
        {
          employeeEmail: "alice@example.com",
          leaveTypeCode: "SL",
          year: 2026,
          entitled: 30,
          carried: 0,
          adjustment: 0,
          used: 0,
        },
      ]);

      const createCall = (prisma.leaveBalance.create as Mock).mock
        .calls[0]?.[0];
      expect(createCall.data.leaveTypeId).toBe("sl-th");
    });
  });

  describe("permanentDeleteRequest", () => {
    it("purges a soft-deleted request", async () => {
      const deletedRequest = { id: "leave-1", deletedAt: new Date() };
      (
        leaveRepository.findRequestByIdIncludingDeleted as Mock
      ).mockResolvedValue(deletedRequest);
      (leaveRepository.permanentDeleteRequest as Mock).mockResolvedValue(
        deletedRequest,
      );

      await expect(
        leaveService.permanentDeleteRequest("leave-1"),
      ).resolves.toBe(deletedRequest);
      expect(leaveRepository.permanentDeleteRequest).toHaveBeenCalledWith(
        "leave-1",
      );
    });

    it("rejects an active request with conflict", async () => {
      (
        leaveRepository.findRequestByIdIncludingDeleted as Mock
      ).mockResolvedValue({ id: "leave-1", deletedAt: null });

      await expect(
        leaveService.permanentDeleteRequest("leave-1"),
      ).rejects.toThrow(ConflictException);
      expect(leaveRepository.permanentDeleteRequest).not.toHaveBeenCalled();
    });

    it("returns not found when the request does not exist", async () => {
      (
        leaveRepository.findRequestByIdIncludingDeleted as Mock
      ).mockResolvedValue(null);

      await expect(
        leaveService.permanentDeleteRequest("missing"),
      ).rejects.toThrow(NotFoundException);
      expect(leaveRepository.permanentDeleteRequest).not.toHaveBeenCalled();
    });
  });
});
