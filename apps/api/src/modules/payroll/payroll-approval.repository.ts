import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const stepInclude = {
  approverUser: {
    select: {
      id: true,
      name: true,
      email: true,
      jobTitle: true,
    },
  },
} satisfies Prisma.PayrollApprovalStepInclude;

export type PayrollApprovalStepWithApprover =
  Prisma.PayrollApprovalStepGetPayload<{ include: typeof stepInclude }>;

export class PayrollApprovalRepository {
  list() {
    return prisma.payrollApprovalStep.findMany({
      include: stepInclude,
      orderBy: { order: "asc" },
    });
  }

  findById(id: string) {
    return prisma.payrollApprovalStep.findUnique({
      where: { id },
      include: stepInclude,
    });
  }

  // The order column is `@unique`, so a freshly-appended row must claim
  // a slot greater than every existing row. Returns the next free
  // integer.
  async nextOrder() {
    const last = await prisma.payrollApprovalStep.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return (last?.order ?? 0) + 1;
  }

  create(data: Prisma.PayrollApprovalStepUncheckedCreateInput) {
    return prisma.payrollApprovalStep.create({
      data,
      include: stepInclude,
    });
  }

  update(id: string, data: Prisma.PayrollApprovalStepUncheckedUpdateInput) {
    return prisma.payrollApprovalStep.update({
      where: { id },
      data,
      include: stepInclude,
    });
  }

  delete(id: string) {
    return prisma.payrollApprovalStep.delete({ where: { id } });
  }

  // Rewrite the `order` column for every step in a single transaction so
  // the unique constraint never fires mid-way. We shift the whole chain
  // into the negative range first, then re-emit ascending positive
  // values in the caller-supplied order.
  async reorder(orderedIds: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.payrollApprovalStep.update({
          where: { id: orderedIds[i]! },
          data: { order: -(i + 1) },
        });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.payrollApprovalStep.update({
          where: { id: orderedIds[i]! },
          data: { order: i + 1 },
        });
      }
    });
  }
}

export const payrollApprovalRepository = new PayrollApprovalRepository();
