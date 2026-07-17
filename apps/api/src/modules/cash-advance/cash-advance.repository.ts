import { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";
import { excludeDeleted, softDeleteUpdate } from "@/infrastructure/soft-delete";

const include = {
  employee: {
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      jobTitle: true,
    },
  },
  entity: { select: { id: true, name: true, code: true } },
  approver: { select: { id: true, name: true, email: true } },
  items: {
    orderBy: { position: "asc" as const },
    include: {
      category: { select: { id: true, name: true } },
    },
  },
  approvalDecisions: {
    orderBy: { order: "asc" as const },
    include: {
      approverUser: { select: { id: true, name: true, email: true } },
      decidedBy: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.CashAdvanceRequestInclude;

export type CashAdvanceWithRelations = Prisma.CashAdvanceRequestGetPayload<{
  include: typeof include;
}>;

export class CashAdvanceRepository {
  list(args: {
    where: Prisma.CashAdvanceRequestWhereInput;
    skip: number;
    take: number;
  }) {
    const where = { ...args.where, ...excludeDeleted("deletedAt") };
    return prisma.cashAdvanceRequest.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: args.skip,
      take: args.take,
    });
  }

  count(where: Prisma.CashAdvanceRequestWhereInput) {
    const countWhere = { ...where, ...excludeDeleted("deletedAt") };
    return prisma.cashAdvanceRequest.count({ where: countWhere });
  }

  findById(id: string) {
    return prisma.cashAdvanceRequest
      .findUnique({
        where: { id },
        include,
      })
      .then((r) => (r && r.deletedAt ? null : r));
  }

  /** Like findById but returns soft-deleted rows too (restore authz). */
  findByIdIncludingDeleted(id: string) {
    return prisma.cashAdvanceRequest.findUnique({
      where: { id },
      include,
    });
  }

  create(data: Prisma.CashAdvanceRequestUncheckedCreateInput) {
    return prisma.cashAdvanceRequest.create({ data, include });
  }

  update(id: string, data: Prisma.CashAdvanceRequestUncheckedUpdateInput) {
    return prisma.cashAdvanceRequest.update({
      where: { id },
      data,
      include,
    });
  }

  /** A concurrent finance actor cannot replace committed payout evidence. */
  async markDisbursedIfApproved(
    id: string,
    data: {
      disbursedAt: Date;
      proofUploadId: string;
      proofUrl: string;
      uploadedBy: string;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const proofRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id
        FROM file_uploads
        WHERE id = ${data.proofUploadId}::uuid
          AND purpose = 'cash-advance-disbursement-proof'
          AND linked_to = 'cash-advance'
          AND linked_id = ${id}
          AND uploaded_by = ${data.uploadedBy}::uuid
        FOR KEY SHARE
      `);
      if (!proofRows[0]) return null;

      const transition = await tx.cashAdvanceRequest.updateMany({
        where: { id, status: "approved", deletedAt: null },
        data: {
          status: "disbursed",
          disbursedAt: data.disbursedAt,
          disbursementProofUploadId: data.proofUploadId,
          disbursementProofUrl: data.proofUrl,
        },
      });
      if (transition.count !== 1) return null;

      return tx.cashAdvanceRequest.findUniqueOrThrow({
        where: { id },
        include,
      });
    });
  }

  /** A concurrent clear cannot replace the first committed clear timestamp. */
  async markClearedIfDisbursed(id: string, clearedAt: Date) {
    return prisma.$transaction(async (tx) => {
      const transition = await tx.cashAdvanceRequest.updateMany({
        where: { id, status: "disbursed", deletedAt: null },
        data: { status: "cleared", clearedAt },
      });
      if (transition.count !== 1) return null;

      return tx.cashAdvanceRequest.findUniqueOrThrow({
        where: { id },
        include,
      });
    });
  }

  softDelete(id: string) {
    return prisma.cashAdvanceRequest.update({
      where: { id },
      data: softDeleteUpdate("deletedAt"),
      include,
    });
  }

  restore(id: string) {
    return prisma.cashAdvanceRequest.update({
      where: { id },
      data: { deletedAt: null },
      include,
    });
  }

  permanentDelete(id: string) {
    return prisma.cashAdvanceRequest.delete({ where: { id } });
  }

  replaceItems(
    requestId: string,
    items: Array<{
      description: string;
      requestedAmount: number;
      approvedAmount?: number;
      categoryId?: string | null;
      receiptUrl?: string | null;
    }>,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.cashAdvanceItem.deleteMany({ where: { requestId } });
      if (items.length === 0) return;
      await tx.cashAdvanceItem.createMany({
        data: items.map((it, idx) => ({
          requestId,
          position: idx + 1,
          description: it.description,
          requestedAmount: it.requestedAmount,
          approvedAmount: it.approvedAmount ?? 0,
          categoryId: it.categoryId ?? null,
          receiptUrl: it.receiptUrl ?? null,
        })),
      });
    });
  }

  // ── Approval chain config ──
  findApprovalSteps(opts: { activeOnly?: boolean } = {}) {
    return prisma.cashAdvanceApprovalStep.findMany({
      where: opts.activeOnly ? { isActive: true } : undefined,
      orderBy: { order: "asc" },
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  findStepById(id: string) {
    return prisma.cashAdvanceApprovalStep.findUnique({ where: { id } });
  }

  async maxStepOrder(): Promise<number> {
    const row = await prisma.cashAdvanceApprovalStep.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return row?.order ?? 0;
  }

  createStep(data: Prisma.CashAdvanceApprovalStepUncheckedCreateInput) {
    return prisma.cashAdvanceApprovalStep.create({ data });
  }

  updateStep(
    id: string,
    data: Prisma.CashAdvanceApprovalStepUncheckedUpdateInput,
  ) {
    return prisma.cashAdvanceApprovalStep.update({ where: { id }, data });
  }

  deleteStep(id: string) {
    return prisma.cashAdvanceApprovalStep.delete({ where: { id } });
  }

  // Reorder: two-phase to dodge the unique(order) constraint — park rows
  // at negative orders, then write the final 1..N.
  async reorderSteps(orderedIds: string[]) {
    await prisma.$transaction(async (tx) => {
      await Promise.all(
        orderedIds.map((id, idx) =>
          tx.cashAdvanceApprovalStep.update({
            where: { id },
            data: { order: -(idx + 1) },
          }),
        ),
      );
      await Promise.all(
        orderedIds.map((id, idx) =>
          tx.cashAdvanceApprovalStep.update({
            where: { id },
            data: { order: idx + 1 },
          }),
        ),
      );
    });
  }

  // ── Per-request decisions ──
  createDecisions(
    requestId: string,
    rows: Array<{
      order: number;
      name: string;
      approverType: string;
      approverUserId: string | null;
    }>,
  ) {
    return prisma.cashAdvanceApprovalDecision.createMany({
      data: rows.map((r) => ({ requestId, ...r })),
    });
  }

  findDecisions(requestId: string) {
    return prisma.cashAdvanceApprovalDecision.findMany({
      where: { requestId },
      orderBy: { order: "asc" },
    });
  }

  updateDecision(
    id: string,
    data: Prisma.CashAdvanceApprovalDecisionUncheckedUpdateInput,
  ) {
    return prisma.cashAdvanceApprovalDecision.update({ where: { id }, data });
  }

  findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, reportingTo: true },
    });
  }
}

export const cashAdvanceRepository = new CashAdvanceRepository();
