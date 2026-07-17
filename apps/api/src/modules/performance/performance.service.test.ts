import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { performanceRepository } from "@/modules/performance/performance.repository";
import { PerformanceService } from "@/modules/performance/performance.service";

vi.mock("@/modules/performance/performance.repository", () => ({
  performanceRepository: {
    findAppraisals: vi.fn(),
    findGoalById: vi.fn(),
    updateGoal: vi.fn(),
  },
}));

const findAppraisals = performanceRepository.findAppraisals as Mock;
const findGoalById = performanceRepository.findGoalById as Mock;
const updateGoal = performanceRepository.updateGoal as Mock;

const EMPLOYEE_ID = "11111111-1111-1111-1111-111111111111";
const MANAGER_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_USER_ID = "33333333-3333-3333-3333-333333333333";

describe("PerformanceService.listAppraisals", () => {
  let service: PerformanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    findAppraisals.mockResolvedValue({ data: [], total: 0 });
    service = new PerformanceService();
  });

  it("overwrites employee-controlled scope filters with the caller", async () => {
    await service.listAppraisals(EMPLOYEE_ID, [PERMISSIONS.PERFORMANCE_READ], {
      page: 1,
      limit: 20,
      employeeId: OTHER_USER_ID,
      managerId: OTHER_USER_ID,
      status: "pending",
    });

    expect(findAppraisals).toHaveBeenCalledWith(
      {
        employeeId: EMPLOYEE_ID,
        status: "pending",
      },
      1,
      20,
    );
  });

  it("intersects a manager employee filter with the caller manager scope", async () => {
    await service.listAppraisals(
      MANAGER_ID,
      [PERMISSIONS.PERFORMANCE_MANAGER_REVIEW],
      {
        page: 2,
        limit: 10,
        employeeId: EMPLOYEE_ID,
        managerId: OTHER_USER_ID,
        status: "self_review",
      },
    );

    expect(findAppraisals).toHaveBeenCalledWith(
      {
        employeeId: EMPLOYEE_ID,
        managerId: MANAGER_ID,
        status: "self_review",
      },
      2,
      10,
    );
  });

  it("defaults a manager list to appraisals assigned to that manager", async () => {
    await service.listAppraisals(
      MANAGER_ID,
      [PERMISSIONS.PERFORMANCE_MANAGER_REVIEW],
      { page: 1, limit: 20 },
    );

    expect(findAppraisals).toHaveBeenCalledWith(
      { managerId: MANAGER_ID },
      1,
      20,
    );
  });

  it("keeps an explicit self query for a caller who is also a manager", async () => {
    await service.listAppraisals(
      MANAGER_ID,
      [
        PERMISSIONS.PERFORMANCE_SELF_REVIEW,
        PERMISSIONS.PERFORMANCE_MANAGER_REVIEW,
      ],
      {
        page: 1,
        limit: 20,
        employeeId: MANAGER_ID,
        managerId: OTHER_USER_ID,
      },
    );

    expect(findAppraisals).toHaveBeenCalledWith(
      { employeeId: MANAGER_ID },
      1,
      20,
    );
  });

  it("allows HR to apply explicit employee and manager filters", async () => {
    await service.listAppraisals(
      OTHER_USER_ID,
      [PERMISSIONS.PERFORMANCE_HR_MANAGE],
      {
        page: 1,
        limit: 50,
        employeeId: EMPLOYEE_ID,
        managerId: MANAGER_ID,
      },
    );

    expect(findAppraisals).toHaveBeenCalledWith(
      { employeeId: EMPLOYEE_ID, managerId: MANAGER_ID },
      1,
      50,
    );
  });
});

describe("PerformanceService.updateGoal", () => {
  let service: PerformanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    findGoalById.mockResolvedValue({
      id: "goal-1",
      appraisal: { employeeId: EMPLOYEE_ID, managerId: MANAGER_ID },
    });
    updateGoal.mockResolvedValue({ id: "goal-1" });
    service = new PerformanceService();
  });

  it("prevents an employee from forging the assigned manager score", async () => {
    await expect(
      service.updateGoal("goal-1", EMPLOYEE_ID, { managerScore: 5 }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });

    expect(updateGoal).not.toHaveBeenCalled();
  });

  it("prevents a manager from overwriting the employee self-score", async () => {
    await expect(
      service.updateGoal("goal-1", MANAGER_ID, { selfScore: 1 }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });

    expect(updateGoal).not.toHaveBeenCalled();
  });

  it("allows each actor to update only their own score field", async () => {
    await service.updateGoal("goal-1", EMPLOYEE_ID, {
      selfScore: 4,
      status: "in_progress",
    });
    await service.updateGoal("goal-1", MANAGER_ID, { managerScore: 3 });

    expect(updateGoal).toHaveBeenNthCalledWith(1, "goal-1", {
      selfScore: 4,
      status: "in_progress",
    });
    expect(updateGoal).toHaveBeenNthCalledWith(2, "goal-1", {
      managerScore: 3,
    });
  });
});
