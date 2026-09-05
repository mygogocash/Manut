import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
} from "@/common/exceptions/http-exception";
import { itAccessRepository } from "@/modules/it-access/it-access.repository";
import { ItAccessService } from "@/modules/it-access/it-access.service";

vi.mock("@/infrastructure/audit/audit.service", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/infrastructure/email/email.service", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./it-access.repository", () => ({
  itAccessRepository: {
    findRequest: vi.fn(),
    updateRequest: vi.fn(),
    replaceDecisions: vi.fn(),
    findDecisions: vi.fn(),
    updateDecision: vi.fn(),
    writeAudit: vi.fn(),
    findUserById: vi.fn(),
  },
}));

const findRequest = itAccessRepository.findRequest as Mock;
const updateRequest = itAccessRepository.updateRequest as Mock;
const replaceDecisions = itAccessRepository.replaceDecisions as Mock;
const findDecisions = itAccessRepository.findDecisions as Mock;
const updateDecision = itAccessRepository.updateDecision as Mock;
const findUserById = itAccessRepository.findUserById as Mock;

const service = new ItAccessService();

const EMP = "10000000-0000-0000-0000-000000000001";
const MGR = "20000000-0000-0000-0000-000000000002";
const IT = "30000000-0000-0000-0000-000000000003";

function baseRequest(over: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    requestNumber: 1,
    employeeId: EMP,
    employee: { id: EMP, name: "Emp", email: "emp@x.com", reportingTo: MGR },
    systemId: "sys-1",
    system: { id: "sys-1", name: "GitHub", category: "eng" },
    requestType: "new",
    requestedAccessLevel: "write",
    businessJustification: "need it",
    startDate: null,
    endDate: null,
    status: "draft",
    currentStepOrder: null,
    managerComments: null,
    itComments: null,
    rejectReason: null,
    submittedAt: null,
    grantedBy: null,
    grantedById: null,
    grantedAt: null,
    decisions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateRequest.mockImplementation(async (_id, data) =>
    baseRequest({ ...data }),
  );
});

describe("submitRequest", () => {
  it("builds a Manager -> IT chain and starts at pending-manager", async () => {
    findRequest.mockResolvedValue(baseRequest());
    findUserById.mockResolvedValue({ id: EMP, reportingTo: MGR });
    findDecisions.mockResolvedValue([
      {
        id: "d1",
        order: 1,
        name: "Manager Approval",
        approverType: "manager",
        approverUserId: MGR,
      },
    ]);

    await service.submitRequest("req-1", EMP, [PERMISSIONS.IT_ACCESS_REQUEST]);

    const chain = replaceDecisions.mock.calls[0][1];
    expect(chain.map((c: { approverType: string }) => c.approverType)).toEqual([
      "manager",
      "it",
    ]);
    expect(updateRequest).toHaveBeenCalledWith(
      "req-1",
      expect.objectContaining({
        status: "pending-manager",
        currentStepOrder: 1,
      }),
    );
  });

  it("skips the manager step when the employee has no manager", async () => {
    findRequest.mockResolvedValue(
      baseRequest({
        employee: { id: EMP, name: "Emp", email: "e@x.com", reportingTo: null },
      }),
    );
    findUserById.mockResolvedValue({ id: EMP, reportingTo: null });
    findDecisions.mockResolvedValue([
      {
        id: "d1",
        order: 1,
        name: "IT Approval",
        approverType: "it",
        approverUserId: null,
      },
    ]);

    await service.submitRequest("req-1", EMP, [PERMISSIONS.IT_ACCESS_REQUEST]);

    const chain = replaceDecisions.mock.calls[0][1];
    expect(chain).toHaveLength(1);
    expect(chain[0].approverType).toBe("it");
    expect(updateRequest).toHaveBeenCalledWith(
      "req-1",
      expect.objectContaining({ status: "pending-it" }),
    );
  });
});

describe("approveRequest authorization", () => {
  it("blocks a non-manager from acting on the manager step", async () => {
    findRequest.mockResolvedValue(
      baseRequest({ status: "pending-manager", currentStepOrder: 1 }),
    );
    findDecisions.mockResolvedValue([
      {
        id: "d1",
        order: 1,
        approverType: "manager",
        approverUserId: MGR,
        status: "pending",
      },
      {
        id: "d2",
        order: 2,
        approverType: "it",
        approverUserId: null,
        status: "pending",
      },
    ]);

    await expect(
      service.approveRequest(
        "req-1",
        {},
        "99999999-9999-9999-9999-999999999999",
        [PERMISSIONS.IT_ACCESS_REQUEST],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets the manager approve and advances to the IT step", async () => {
    findRequest.mockResolvedValue(
      baseRequest({ status: "pending-manager", currentStepOrder: 1 }),
    );
    findDecisions.mockResolvedValue([
      {
        id: "d1",
        order: 1,
        approverType: "manager",
        approverUserId: MGR,
        status: "pending",
      },
      {
        id: "d2",
        order: 2,
        approverType: "it",
        approverUserId: null,
        status: "pending",
      },
    ]);

    await service.approveRequest("req-1", { notes: "ok" }, MGR, [
      PERMISSIONS.IT_ACCESS_REQUEST,
    ]);

    expect(updateDecision).toHaveBeenCalledWith(
      "d1",
      expect.objectContaining({ status: "approved", decidedById: MGR }),
    );
    expect(updateRequest).toHaveBeenCalledWith(
      "req-1",
      expect.objectContaining({ status: "pending-it", currentStepOrder: 2 }),
    );
  });

  it("finalizes to approved when IT approves the last step", async () => {
    findRequest.mockResolvedValue(
      baseRequest({ status: "pending-it", currentStepOrder: 2 }),
    );
    findDecisions.mockResolvedValue([
      {
        id: "d1",
        order: 1,
        approverType: "manager",
        approverUserId: MGR,
        status: "approved",
      },
      {
        id: "d2",
        order: 2,
        approverType: "it",
        approverUserId: null,
        status: "pending",
      },
    ]);

    await service.approveRequest("req-1", {}, IT, [
      PERMISSIONS.IT_ACCESS_APPROVE,
    ]);

    expect(updateRequest).toHaveBeenCalledWith(
      "req-1",
      expect.objectContaining({ status: "approved", currentStepOrder: null }),
    );
  });

  it("rejects approval when the request is not pending", async () => {
    findRequest.mockResolvedValue(baseRequest({ status: "draft" }));
    await expect(
      service.approveRequest("req-1", {}, IT, [PERMISSIONS.IT_ACCESS_APPROVE]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
