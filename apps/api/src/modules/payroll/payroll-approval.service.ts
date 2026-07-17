import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import {
  payrollApprovalRepository,
  type PayrollApprovalStepWithApprover,
} from "@/modules/payroll/payroll-approval.repository";
import type {
  CreatePayrollApprovalStepInput,
  ReorderPayrollApprovalStepsInput,
  UpdatePayrollApprovalStepInput,
} from "@/modules/payroll/payroll-approval.validation";

export type PayrollApprovalStepDTO = {
  id: string;
  order: number;
  name: string;
  description: string | null;
  approverUserId: string;
  approverUser: PayrollApprovalStepWithApprover["approverUser"] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function toDTO(row: PayrollApprovalStepWithApprover): PayrollApprovalStepDTO {
  return {
    id: row.id,
    order: row.order,
    name: row.name,
    description: row.description,
    approverUserId: row.approverUserId,
    approverUser: row.approverUser,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertApproverExists(approverUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: approverUserId },
    select: { id: true, isActive: true },
  });
  if (!user) {
    throw new BadRequestException("Approver user not found");
  }
  if (!user.isActive) {
    throw new BadRequestException("Approver user is inactive");
  }
}

export class PayrollApprovalService {
  async list() {
    const rows = await payrollApprovalRepository.list();
    return { data: rows.map(toDTO) };
  }

  async create(input: CreatePayrollApprovalStepInput) {
    await assertApproverExists(input.approverUserId);
    const order = await payrollApprovalRepository.nextOrder();
    const created = await payrollApprovalRepository.create({
      order,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      approverUserId: input.approverUserId,
      isActive: input.isActive ?? true,
    });
    return { data: toDTO(created) };
  }

  async update(id: string, input: UpdatePayrollApprovalStepInput) {
    const existing = await payrollApprovalRepository.findById(id);
    if (!existing) throw new NotFoundException("Approval step not found");

    if (input.approverUserId !== undefined) {
      await assertApproverExists(input.approverUserId);
    }

    const updated = await payrollApprovalRepository.update(id, {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.description !== undefined && {
        description: input.description?.trim() || null,
      }),
      ...(input.approverUserId !== undefined && {
        approverUserId: input.approverUserId,
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
    return { data: toDTO(updated) };
  }

  async delete(id: string) {
    const existing = await payrollApprovalRepository.findById(id);
    if (!existing) throw new NotFoundException("Approval step not found");
    await payrollApprovalRepository.delete(id);
    return { data: { id } };
  }

  async reorder(input: ReorderPayrollApprovalStepsInput) {
    if (input.orderedIds.length === 0) {
      throw new BadRequestException("orderedIds cannot be empty");
    }
    const existing = await payrollApprovalRepository.list();
    const existingIds = new Set(existing.map((s) => s.id));
    const seen = new Set<string>();
    for (const id of input.orderedIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException(`Unknown approval step id: ${id}`);
      }
      if (seen.has(id)) {
        throw new BadRequestException(
          `Duplicate approval step id in reorder list: ${id}`,
        );
      }
      seen.add(id);
    }
    if (input.orderedIds.length !== existing.length) {
      throw new BadRequestException(
        "orderedIds must include every existing approval step exactly once",
      );
    }
    await payrollApprovalRepository.reorder(input.orderedIds);
    const refreshed = await payrollApprovalRepository.list();
    return { data: refreshed.map(toDTO) };
  }
}

export const payrollApprovalService = new PayrollApprovalService();
