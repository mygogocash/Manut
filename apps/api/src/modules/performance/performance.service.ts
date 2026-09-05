import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { performanceRepository } from "@/modules/performance/performance.repository";
import type {
  AppraisalQuery,
  CreateAppraisalInput,
  CreateCycleInput,
  CreateGoalInput,
  CycleQuery,
  ManagerReviewInput,
  SelfReviewInput,
  UpdateCycleInput,
  UpdateGoalInput,
} from "@/modules/performance/performance.validation";

function hasAny(userPermissions: string[], ...perms: string[]): boolean {
  return perms.some((p) => userPermissions.includes(p));
}

function isHr(userPermissions: string[]): boolean {
  return userPermissions.includes(PERMISSIONS.PERFORMANCE_HR_MANAGE);
}

export class PerformanceService {
  // ── Cycles ──────────────────────────────────────────────

  async listCycles(query: CycleQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await performanceRepository.findCycles(
      filters,
      page,
      limit,
    );

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCycleById(id: string) {
    const cycle = await performanceRepository.findCycleById(id);
    if (!cycle) throw new NotFoundException("Appraisal cycle not found");
    return cycle;
  }

  async createCycle(userId: string, input: CreateCycleInput) {
    return performanceRepository.createCycle({
      name: input.name,
      description: input.description,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      createdBy: userId,
    });
  }

  async updateCycle(id: string, input: UpdateCycleInput) {
    const existing = await performanceRepository.findCycleById(id);
    if (!existing) throw new NotFoundException("Appraisal cycle not found");

    return performanceRepository.updateCycle(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.startDate !== undefined && {
        startDate: new Date(input.startDate),
      }),
      ...(input.endDate !== undefined && { endDate: new Date(input.endDate) }),
      ...(input.status !== undefined && { status: input.status }),
    });
  }

  // ── Appraisals ──────────────────────────────────────────

  async listAppraisals(
    userId: string,
    userPermissions: string[],
    query: AppraisalQuery,
  ) {
    const { page, limit, ...filters } = query;

    if (isHr(userPermissions)) {
      const { data, total } = await performanceRepository.findAppraisals(
        filters,
        page,
        limit,
      );
      return {
        data,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }

    const isManager = hasAny(
      userPermissions,
      PERMISSIONS.PERFORMANCE_MANAGER_REVIEW,
    );

    const scopedFilters = { ...filters };
    if (isManager) {
      if (!scopedFilters.employeeId && !scopedFilters.managerId) {
        scopedFilters.managerId = userId;
      }
    } else {
      scopedFilters.employeeId = userId;
    }

    const { data, total } = await performanceRepository.findAppraisals(
      scopedFilters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAppraisalById(
    id: string,
    userId: string,
    userPermissions: string[],
  ) {
    const appraisal = await performanceRepository.findAppraisalById(id);
    if (!appraisal) throw new NotFoundException("Appraisal not found");

    if (!isHr(userPermissions)) {
      const isOwner = appraisal.employeeId === userId;
      const isManager = appraisal.managerId === userId;
      if (!isOwner && !isManager) {
        throw new ForbiddenException(
          "You can only view your own appraisals or those you manage",
        );
      }
    }

    return appraisal;
  }

  async createAppraisal(input: CreateAppraisalInput) {
    return performanceRepository.createAppraisal({
      cycleId: input.cycleId,
      employeeId: input.employeeId,
      managerId: input.managerId,
    });
  }

  async submitSelfReview(id: string, userId: string, input: SelfReviewInput) {
    const appraisal = await performanceRepository.findAppraisalById(id);
    if (!appraisal) throw new NotFoundException("Appraisal not found");

    if (appraisal.employeeId !== userId) {
      throw new ForbiddenException(
        "Only the assigned employee can submit a self-review",
      );
    }

    if (appraisal.status !== "pending" && appraisal.status !== "self_review") {
      throw new BadRequestException(
        `Cannot submit self-review when status is "${appraisal.status}"`,
      );
    }

    return performanceRepository.updateAppraisal(id, {
      selfRating: input.selfRating,
      selfComment: input.selfComment,
      status: "self_review",
    });
  }

  async submitManagerReview(
    id: string,
    userId: string,
    input: ManagerReviewInput,
  ) {
    const appraisal = await performanceRepository.findAppraisalById(id);
    if (!appraisal) throw new NotFoundException("Appraisal not found");

    if (appraisal.managerId !== userId) {
      throw new ForbiddenException(
        "Only the assigned manager can submit a manager review",
      );
    }

    const nextStatus = input.finalRating ? "completed" : "manager_review";

    return performanceRepository.updateAppraisal(id, {
      managerRating: input.managerRating,
      managerComment: input.managerComment,
      ...(input.finalRating !== undefined && {
        finalRating: input.finalRating,
      }),
      status: nextStatus,
      ...(nextStatus === "completed" && { completedAt: new Date() }),
    });
  }

  // ── Goals ───────────────────────────────────────────────

  async listGoals(
    appraisalId: string,
    userId: string,
    userPermissions: string[],
  ) {
    const appraisal =
      await performanceRepository.findAppraisalById(appraisalId);
    if (!appraisal) throw new NotFoundException("Appraisal not found");

    if (!isHr(userPermissions)) {
      const isOwner = appraisal.employeeId === userId;
      const isManager = appraisal.managerId === userId;
      if (!isOwner && !isManager) {
        throw new ForbiddenException(
          "You can only view goals for your own appraisals or those you manage",
        );
      }
    }

    return performanceRepository.findGoalsByAppraisal(appraisalId);
  }

  async createGoal(userId: string, input: CreateGoalInput) {
    const appraisal = await performanceRepository.findAppraisalById(
      input.appraisalId,
    );
    if (!appraisal) throw new NotFoundException("Appraisal not found");

    const isOwner = appraisal.employeeId === userId;
    const isManager = appraisal.managerId === userId;
    if (!isOwner && !isManager) {
      throw new ForbiddenException(
        "Only the employee or manager of this appraisal can create goals",
      );
    }

    return performanceRepository.createGoal({
      appraisalId: input.appraisalId,
      title: input.title,
      description: input.description,
      weight: input.weight,
    });
  }

  async updateGoal(goalId: string, userId: string, input: UpdateGoalInput) {
    const goal = await performanceRepository.findGoalById(goalId);
    if (!goal) throw new NotFoundException("Goal not found");

    const isOwner = goal.appraisal.employeeId === userId;
    const isManager = goal.appraisal.managerId === userId;
    if (!isOwner && !isManager) {
      throw new ForbiddenException(
        "Only the employee or manager of this appraisal can update goals",
      );
    }

    return performanceRepository.updateGoal(goalId, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.weight !== undefined && { weight: input.weight }),
      ...(input.selfScore !== undefined && { selfScore: input.selfScore }),
      ...(input.managerScore !== undefined && {
        managerScore: input.managerScore,
      }),
      ...(input.status !== undefined && { status: input.status }),
    });
  }

  async deleteGoal(goalId: string, userId: string) {
    const goal = await performanceRepository.findGoalById(goalId);
    if (!goal) throw new NotFoundException("Goal not found");

    const isOwner = goal.appraisal.employeeId === userId;
    const isManager = goal.appraisal.managerId === userId;
    if (!isOwner && !isManager) {
      throw new ForbiddenException(
        "Only the employee or manager of this appraisal can delete goals",
      );
    }

    return performanceRepository.deleteGoal(goalId);
  }
}

export const performanceService = new PerformanceService();
