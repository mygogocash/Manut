import { HttpError } from "../http-error";
import {
  STORAGE_BUCKETS,
  TrustedStorageError,
  validateReceiptUrl,
} from "../trusted-storage";
import {
  canReadCashAdvance,
  CASH_ADVANCE_APPROVE,
  CASH_ADVANCE_CREATE,
  hasCashAdvancePermission,
} from "./access";
import type {
  CashAdvanceApprovalDecisionRecord,
  CashAdvanceRequestRecord,
  CashAdvanceStore,
} from "./store";

const PAYOUT_MODES = new Set(["cash", "bank-transfer"]);

function asDate(value: string): string {
  return value.slice(0, 10);
}

function serializeRequest(
  raw: CashAdvanceRequestRecord,
): Record<string, unknown> {
  return {
    id: raw.id,
    requestNumber: raw.requestNumber,
    requestDate: asDate(raw.requestDate),
    payoutMode: raw.payoutMode,
    currency: raw.currency,
    status: raw.status,
    requestedTotal: raw.requestedTotal,
    approvedTotal: raw.approvedTotal,
    rejectReason: raw.rejectReason,
    employee: {
      id: raw.employeeId,
      name: raw.employeeName,
      email: raw.employeeEmail,
    },
    entity: raw.entityId
      ? { id: raw.entityId, name: raw.entityName ?? "" }
      : null,
    items: raw.items.map((item) => ({
      id: item.id,
      description: item.description,
      receiptUrl: item.receiptUrl,
      requestedAmount: item.requestedAmount,
      approvedAmount: item.approvedAmount,
    })),
    // Present for Express parity; app-core projections strip bank/notes.
    bankName: raw.bankName,
    bankAccountNo: raw.bankAccountNo,
    notes: raw.notes,
  };
}

async function assertCanActOnStep(
  store: CashAdvanceStore,
  decision: CashAdvanceApprovalDecisionRecord,
  request: CashAdvanceRequestRecord,
  actorId: string,
  permissions: ReadonlySet<string>,
): Promise<void> {
  if (permissions.has(CASH_ADVANCE_APPROVE)) return;
  if (decision.approverType === "user") {
    if (decision.approverUserId !== actorId) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "This step is assigned to a different approver",
      );
    }
    return;
  }
  const employee = await store.findUserById(request.employeeId);
  if (employee?.reportingTo !== actorId) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "Only the employee's direct manager can approve this step",
    );
  }
}

function toHttpError(error: unknown): never {
  if (error instanceof TrustedStorageError) {
    throw new HttpError(error.status, error.code, error.message);
  }
  throw error;
}

async function validateItemReceipts(
  store: CashAdvanceStore,
  actorId: string,
  trustedOrigins: readonly string[],
  items: ReadonlyArray<{ receiptUrl?: string | null }>,
): Promise<void> {
  try {
    await Promise.all(
      items.map(async (item) => {
        if (!item.receiptUrl) return;
        await validateReceiptUrl(store, item.receiptUrl, {
          mode: "require-registered",
          allowedBuckets: [STORAGE_BUCKETS.RECEIPTS],
          purpose: "cash-advance-receipt",
          uploadedBy: actorId,
          trustedOrigins,
        });
      }),
    );
  } catch (error) {
    toHttpError(error);
  }
}

export function createCashAdvanceService(
  store: CashAdvanceStore,
  options: { trustedOrigins?: readonly string[] } = {},
) {
  const trustedOrigins = options.trustedOrigins ?? [];

  return {
    async list(
      userId: string,
      query: {
        page: number;
        limit: number;
        status?: string;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!canReadCashAdvance(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const { data, total } = await store.findMany(
        {
          employeeId: userId,
          status: query.status,
        },
        query.page,
        query.limit,
      );

      return {
        data: data.map(serializeRequest),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    },

    async create(
      userId: string,
      input: {
        entityId?: string;
        payoutMode: string;
        bankName?: string;
        bankAccountNo?: string;
        currency: string;
        notes?: string;
        items: Array<{
          description: string;
          requestedAmount: number;
          categoryId?: string | null;
          receiptUrl?: string | null;
        }>;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!hasCashAdvancePermission(permissions, CASH_ADVANCE_CREATE)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      if (!PAYOUT_MODES.has(input.payoutMode)) {
        throw new HttpError(400, "INVALID_CASH_ADVANCE", "Invalid payout mode.");
      }
      if (input.payoutMode === "bank-transfer") {
        if (!input.bankName?.trim() || !input.bankAccountNo?.trim()) {
          throw new HttpError(
            400,
            "INVALID_CASH_ADVANCE",
            "Bank name and account number are required for bank transfer.",
          );
        }
      }
      if (!Array.isArray(input.items) || input.items.length === 0) {
        throw new HttpError(
          400,
          "INVALID_CASH_ADVANCE",
          "At least one line item is required.",
        );
      }

      const items = input.items.map((item) => {
        const description = item.description.trim();
        const requestedAmount = Number(item.requestedAmount);
        if (!description) {
          throw new HttpError(
            400,
            "INVALID_CASH_ADVANCE",
            "Item description is required.",
          );
        }
        if (!Number.isFinite(requestedAmount) || requestedAmount < 0) {
          throw new HttpError(
            400,
            "INVALID_CASH_ADVANCE",
            "Item amount must be a non-negative number.",
          );
        }
        return {
          description,
          requestedAmount,
          categoryId: item.categoryId ?? null,
          receiptUrl: item.receiptUrl?.trim() || null,
        };
      });

      await validateItemReceipts(store, userId, trustedOrigins, items);

      const currency = input.currency.trim().toUpperCase() || "THB";
      const created = await store.create({
        employeeId: userId,
        entityId: input.entityId?.trim() || undefined,
        payoutMode: input.payoutMode,
        bankName: input.bankName?.trim() || undefined,
        bankAccountNo: input.bankAccountNo?.trim() || undefined,
        currency,
        notes: input.notes?.trim() || undefined,
        items,
      });

      return { data: serializeRequest(created) };
    },

    async update(
      userId: string,
      requestId: string,
      input: {
        entityId?: string | null;
        payoutMode?: string;
        bankName?: string | null;
        bankAccountNo?: string | null;
        currency?: string;
        notes?: string | null;
        items?: Array<{
          description: string;
          requestedAmount: number;
          categoryId?: string | null;
          receiptUrl?: string | null;
        }>;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!hasCashAdvancePermission(permissions, CASH_ADVANCE_CREATE)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const existing = await store.findById(requestId);
      if (!existing) {
        throw new HttpError(
          404,
          "NOT_FOUND",
          "Cash advance request not found",
        );
      }
      if (existing.employeeId !== userId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You can only edit your own requests",
        );
      }
      if (existing.status !== "draft" && existing.status !== "rejected") {
        throw new HttpError(
          400,
          "INVALID_CASH_ADVANCE",
          `Cannot edit a request with status "${existing.status}"`,
        );
      }

      if (input.payoutMode !== undefined && !PAYOUT_MODES.has(input.payoutMode)) {
        throw new HttpError(400, "INVALID_CASH_ADVANCE", "Invalid payout mode.");
      }

      let items:
        | Array<{
            description: string;
            requestedAmount: number;
            categoryId?: string | null;
            receiptUrl?: string | null;
          }>
        | undefined;
      if (input.items) {
        if (input.items.length === 0) {
          throw new HttpError(
            400,
            "INVALID_CASH_ADVANCE",
            "At least one line item is required.",
          );
        }
        items = input.items.map((item) => {
          const description = item.description.trim();
          const requestedAmount = Number(item.requestedAmount);
          if (!description) {
            throw new HttpError(
              400,
              "INVALID_CASH_ADVANCE",
              "Item description is required.",
            );
          }
          if (!Number.isFinite(requestedAmount) || requestedAmount < 0) {
            throw new HttpError(
              400,
              "INVALID_CASH_ADVANCE",
              "Item amount must be a non-negative number.",
            );
          }
          return {
            description,
            requestedAmount,
            categoryId: item.categoryId ?? null,
            receiptUrl: item.receiptUrl?.trim() || null,
          };
        });
        await validateItemReceipts(store, userId, trustedOrigins, items);
      }

      const updated = await store.update(requestId, {
        entityId: input.entityId,
        payoutMode: input.payoutMode,
        bankName: input.bankName,
        bankAccountNo: input.bankAccountNo,
        currency: input.currency?.trim().toUpperCase(),
        notes: input.notes,
        items,
      });
      return { data: serializeRequest(updated) };
    },

    async submit(userId: string, requestId: string) {
      const permissions = await store.loadPermissions(userId);
      if (!canReadCashAdvance(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const existing = await store.findById(requestId);
      if (!existing) {
        throw new HttpError(
          404,
          "NOT_FOUND",
          "Cash advance request not found",
        );
      }
      if (existing.employeeId !== userId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You can only submit your own request",
        );
      }
      if (existing.status !== "draft" && existing.status !== "rejected") {
        throw new HttpError(
          400,
          "INVALID_CASH_ADVANCE",
          `Cannot submit a request with status "${existing.status}"`,
        );
      }
      if (existing.items.length === 0) {
        throw new HttpError(
          400,
          "INVALID_CASH_ADVANCE",
          "Add at least one line item before submitting",
        );
      }

      const steps = await store.findActiveApprovalSteps();
      const requested = existing.requestedTotal;
      const applicable = steps.filter((step) => {
        if (step.skipWhenSubmitterIds.includes(userId)) return false;
        if (
          step.onlyWhenSubmitterIds.length > 0 &&
          !step.onlyWhenSubmitterIds.includes(userId)
        ) {
          return false;
        }
        if (
          step.payoutModeFilter.length > 0 &&
          !step.payoutModeFilter.includes(existing.payoutMode)
        ) {
          return false;
        }
        if (step.amountMin != null && requested < step.amountMin) return false;
        if (step.amountMax != null && requested > step.amountMax) return false;
        return true;
      });

      const decisionRows =
        applicable.length > 0
          ? applicable.map((step, index) => ({
              order: index + 1,
              name: step.name,
              approverType: step.approverType,
              approverUserId:
                step.approverType === "user" ? step.approverUserId : null,
            }))
          : [
              {
                order: 1,
                name: "Manager approval",
                approverType: "manager",
                approverUserId: null,
              },
            ];

      // Email notify stays on Express; edge snapshots chain + status only.
      const submitted = await store.submitWithDecisions(
        requestId,
        decisionRows,
      );
      return { data: serializeRequest(submitted) };
    },

    async approve(
      actorId: string,
      requestId: string,
      input: {
        notes?: string;
        items?: Array<{ id: string; approvedAmount: number }>;
      } = {},
    ) {
      const permissions = await store.loadPermissions(actorId);
      if (!canReadCashAdvance(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const existing = await store.findById(requestId);
      if (!existing) {
        throw new HttpError(
          404,
          "NOT_FOUND",
          "Cash advance request not found",
        );
      }
      if (existing.status !== "submitted") {
        throw new HttpError(
          400,
          "INVALID_CASH_ADVANCE",
          `Can only approve a submitted request (current: ${existing.status})`,
        );
      }

      let decisions = await store.findDecisions(requestId);
      if (decisions.length === 0) {
        await store.createDecisions(requestId, [
          {
            order: 1,
            name: "Manager approval",
            approverType: "manager",
            approverUserId: null,
          },
        ]);
        await store.advanceStep(requestId, 1);
        decisions = await store.findDecisions(requestId);
      }

      const stepOrder = existing.currentStepOrder ?? 1;
      const decision = decisions.find((row) => row.order === stepOrder);
      if (!decision || decision.status !== "pending") {
        throw new HttpError(
          400,
          "INVALID_CASH_ADVANCE",
          "Current approval step is already decided — refresh and try again",
        );
      }

      await assertCanActOnStep(
        store,
        decision,
        existing,
        actorId,
        permissions,
      );

      if (input.items && input.items.length > 0) {
        const itemsById = new Map(existing.items.map((item) => [item.id, item]));
        for (const item of input.items) {
          if (!itemsById.has(item.id)) {
            throw new HttpError(
              400,
              "INVALID_CASH_ADVANCE",
              `Unknown item id ${item.id}`,
            );
          }
        }
        await store.updateApprovedAmounts(input.items);
      }

      await store.updateDecision(decision.id, {
        status: "approved",
        decidedById: actorId,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      });

      const next = decisions.find(
        (row) => row.order > decision.order && row.status === "pending",
      );
      if (next) {
        const advanced = await store.advanceStep(requestId, next.order);
        return { data: serializeRequest(advanced) };
      }

      const fresh = await store.findById(requestId);
      const itemSum = (fresh?.items ?? []).reduce(
        (sum, item) => sum + item.approvedAmount,
        0,
      );
      const approvedTotal =
        itemSum > 0 ? itemSum : existing.requestedTotal;
      const finalized = await store.finalizeApproval(requestId, {
        approvedTotal,
        approvedById: actorId,
      });
      return { data: serializeRequest(finalized) };
    },

    async reject(actorId: string, requestId: string, reason: string) {
      const permissions = await store.loadPermissions(actorId);
      if (!canReadCashAdvance(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const trimmed = reason.trim();
      if (!trimmed) {
        throw new HttpError(
          400,
          "INVALID_CASH_ADVANCE",
          "Rejection reason is required.",
        );
      }

      const existing = await store.findById(requestId);
      if (!existing) {
        throw new HttpError(
          404,
          "NOT_FOUND",
          "Cash advance request not found",
        );
      }
      if (existing.status !== "submitted") {
        throw new HttpError(
          400,
          "INVALID_CASH_ADVANCE",
          `Can only reject a submitted request (current: ${existing.status})`,
        );
      }

      const decisions = await store.findDecisions(requestId);
      const stepOrder = existing.currentStepOrder ?? 1;
      const decision = decisions.find((row) => row.order === stepOrder);
      if (decision) {
        await assertCanActOnStep(
          store,
          decision,
          existing,
          actorId,
          permissions,
        );
        await store.updateDecision(decision.id, {
          status: "rejected",
          decidedById: actorId,
          notes: trimmed,
        });
      } else if (!permissions.has(CASH_ADVANCE_APPROVE)) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Approve permission required",
        );
      }

      const rejected = await store.markRejected(requestId, {
        rejectReason: trimmed,
        approvedById: actorId,
      });
      return { data: serializeRequest(rejected) };
    },

    async disburse(
      actorId: string,
      requestId: string,
      proofUrl: string,
    ) {
      const permissions = await store.loadPermissions(actorId);
      if (!hasCashAdvancePermission(permissions, CASH_ADVANCE_APPROVE)) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Approve permission required",
        );
      }

      const existing = await store.findById(requestId);
      if (!existing) {
        throw new HttpError(
          404,
          "NOT_FOUND",
          "Cash advance request not found",
        );
      }
      if (existing.status !== "approved") {
        throw new HttpError(
          400,
          "INVALID_CASH_ADVANCE",
          `Only approved requests can be marked disbursed (current: ${existing.status})`,
        );
      }

      const trimmedProof = proofUrl.trim();
      if (!trimmedProof) {
        throw new HttpError(
          400,
          "INVALID_CASH_ADVANCE",
          "Disbursement proof URL is required.",
        );
      }

      const proof = await validateReceiptUrl(store, trimmedProof, {
        mode: "require-registered",
        allowedBuckets: [STORAGE_BUCKETS.DOCUMENTS],
        purpose: "cash-advance-disbursement-proof",
        uploadedBy: actorId,
        linkedTo: "cash-advance",
        linkedId: requestId,
        trustedOrigins,
      }).catch((error: unknown) => toHttpError(error));
      if (!proof || proof.kind !== "registered") {
        throw new HttpError(
          400,
          "INVALID_CASH_ADVANCE",
          "Disbursement proof must be a registered upload.",
        );
      }

      const row = await store.markDisbursedIfApproved(requestId, {
        proofUploadId: proof.uploadId,
        proofUrl: trimmedProof,
        uploadedBy: actorId,
      });
      if (!row) {
        throw new HttpError(
          409,
          "CASH_ADVANCE_RACE",
          "Cash advance request changed while it was being disbursed; refresh and try again",
        );
      }
      return { data: serializeRequest(row) };
    },

    async clear(actorId: string, requestId: string) {
      const permissions = await store.loadPermissions(actorId);
      if (!hasCashAdvancePermission(permissions, CASH_ADVANCE_APPROVE)) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Approve permission required",
        );
      }

      const existing = await store.findById(requestId);
      if (!existing) {
        throw new HttpError(
          404,
          "NOT_FOUND",
          "Cash advance request not found",
        );
      }
      if (existing.status !== "disbursed") {
        throw new HttpError(
          400,
          "INVALID_CASH_ADVANCE",
          `Only disbursed requests can be cleared (current: ${existing.status})`,
        );
      }

      const row = await store.markClearedIfDisbursed(requestId);
      if (!row) {
        throw new HttpError(
          409,
          "CASH_ADVANCE_RACE",
          "Cash advance request changed while it was being cleared; refresh and try again",
        );
      }
      return { data: serializeRequest(row) };
    },
  };
}

export type CashAdvanceService = ReturnType<typeof createCashAdvanceService>;
