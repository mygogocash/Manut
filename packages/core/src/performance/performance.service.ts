import { PERMISSIONS } from "@nexora/contracts";
import type { Db } from "@nexora/db";
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
} from "@nexora/contracts/modules/performance/performance.validation";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import * as repo from "./performance.repository";

function hasAny(userPermissions: string[], ...perms: string[]): boolean {
  return perms.some((p) => userPermissions.includes(p));
}

function isHr(userPermissions: string[]): boolean {
  return userPermissions.includes(PERMISSIONS.PERFORMANCE_HR_MANAGE);
}

export async function listCycles(db: Db, query: CycleQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findCycles(db, filters, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getCycleById(db: Db, id: string) {
  const cycle = await repo.findCycleById(db, id);
  if (!cycle) throw new NotFoundException("Appraisal cycle not found");
  return cycle;
}

export async function createCycle(db: Db, userId: string, input: CreateCycleInput) {
  return repo.createCycle(db, {
    name: input.name,
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate,
    createdBy: userId,
  });
}

export async function updateCycle(db: Db, id: string, input: UpdateCycleInput) {
  const existing = await repo.findCycleById(db, id);
  if (!existing) throw new NotFoundException("Appraisal cycle not found");
  return repo.updateCycle(db, id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.startDate !== undefined && { startDate: input.startDate }),
    ...(input.endDate !== undefined && { endDate: input.endDate }),
    ...(input.status !== undefined && { status: input.status }),
  });
}

export async function listAppraisals(
  db: Db,
  userId: string,
  userPermissions: string[],
  query: AppraisalQuery,
) {
  const { page, limit, ...filters } = query;

  if (isHr(userPermissions)) {
    const { data, total } = await repo.findAppraisals(db, filters, page, limit);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  const isManager = hasAny(userPermissions, PERMISSIONS.PERFORMANCE_MANAGER_REVIEW);
  const scoped = { ...filters };
  if (isManager) {
    if (!scoped.employeeId && !scoped.managerId) scoped.managerId = userId;
  } else {
    scoped.employeeId = userId;
  }

  const { data, total } = await repo.findAppraisals(db, scoped, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getAppraisalById(
  db: Db,
  id: string,
  userId: string,
  userPermissions: string[],
) {
  const appraisal = await repo.findAppraisalById(db, id);
  if (!appraisal) throw new NotFoundException("Appraisal not found");
  if (!isHr(userPermissions)) {
    const isOwner = appraisal.employeeId === userId;
    const isManager = appraisal.managerId === userId;
    if (!isOwner && !isManager) {
      throw new ForbiddenException("You can only view your own appraisals or those you manage");
    }
  }
  return appraisal;
}

export async function createAppraisal(db: Db, input: CreateAppraisalInput) {
  return repo.createAppraisal(db, {
    cycleId: input.cycleId,
    employeeId: input.employeeId,
    managerId: input.managerId,
  });
}

export async function submitSelfReview(db: Db, id: string, userId: string, input: SelfReviewInput) {
  const appraisal = await repo.findAppraisalById(db, id);
  if (!appraisal) throw new NotFoundException("Appraisal not found");
  if (appraisal.employeeId !== userId) {
    throw new ForbiddenException("Only the assigned employee can submit a self-review");
  }
  if (appraisal.status !== "pending" && appraisal.status !== "self_review") {
    throw new BadRequestException(`Cannot submit self-review when status is "${appraisal.status}"`);
  }
  return repo.updateAppraisal(db, id, {
    selfRating: input.selfRating,
    selfComment: input.selfComment ?? null,
    status: "self_review",
  });
}

export async function submitManagerReview(
  db: Db,
  id: string,
  userId: string,
  input: ManagerReviewInput,
) {
  const appraisal = await repo.findAppraisalById(db, id);
  if (!appraisal) throw new NotFoundException("Appraisal not found");
  if (appraisal.managerId !== userId) {
    throw new ForbiddenException("Only the assigned manager can submit a manager review");
  }
  const nextStatus = input.finalRating ? "completed" : "manager_review";
  return repo.updateAppraisal(db, id, {
    managerRating: input.managerRating,
    managerComment: input.managerComment ?? null,
    ...(input.finalRating !== undefined && { finalRating: input.finalRating }),
    status: nextStatus,
    ...(nextStatus === "completed" && { completedAt: new Date().toISOString() }),
  });
}

export async function listGoals(
  db: Db,
  appraisalId: string,
  userId: string,
  userPermissions: string[],
) {
  const appraisal = await repo.findAppraisalById(db, appraisalId);
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
  return repo.findGoalsByAppraisal(db, appraisalId);
}

export async function createGoal(db: Db, userId: string, input: CreateGoalInput) {
  const appraisal = await repo.findAppraisalById(db, input.appraisalId);
  if (!appraisal) throw new NotFoundException("Appraisal not found");
  const isOwner = appraisal.employeeId === userId;
  const isManager = appraisal.managerId === userId;
  if (!isOwner && !isManager) {
    throw new ForbiddenException("Only the employee or manager of this appraisal can create goals");
  }
  return repo.createGoal(db, {
    appraisalId: input.appraisalId,
    title: input.title,
    description: input.description,
    weight: input.weight,
  });
}

export async function updateGoal(db: Db, goalId: string, userId: string, input: UpdateGoalInput) {
  const goal = await repo.findGoalById(db, goalId);
  if (!goal) throw new NotFoundException("Goal not found");
  const isOwner = goal.appraisal.employeeId === userId;
  const isManager = goal.appraisal.managerId === userId;
  if (!isOwner && !isManager) {
    throw new ForbiddenException("Only the employee or manager of this appraisal can update goals");
  }
  return repo.updateGoal(db, goalId, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.weight !== undefined && { weight: input.weight }),
    ...(input.selfScore !== undefined && { selfScore: input.selfScore }),
    ...(input.managerScore !== undefined && { managerScore: input.managerScore }),
    ...(input.status !== undefined && { status: input.status }),
  });
}

export async function deleteGoal(db: Db, goalId: string, userId: string) {
  const goal = await repo.findGoalById(db, goalId);
  if (!goal) throw new NotFoundException("Goal not found");
  const isOwner = goal.appraisal.employeeId === userId;
  const isManager = goal.appraisal.managerId === userId;
  if (!isOwner && !isManager) {
    throw new ForbiddenException("Only the employee or manager of this appraisal can delete goals");
  }
  return repo.deleteGoal(db, goalId);
}
