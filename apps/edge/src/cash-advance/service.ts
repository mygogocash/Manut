import { HttpError } from "../http-error";
import {
  canReadCashAdvance,
  CASH_ADVANCE_CREATE,
  hasCashAdvancePermission,
} from "./access";
import type { CashAdvanceRequestRecord, CashAdvanceStore } from "./store";

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
    })),
    // Present for Express parity; app-core projections strip bank/notes.
    bankName: raw.bankName,
    bankAccountNo: raw.bankAccountNo,
    notes: raw.notes,
  };
}

export function createCashAdvanceService(store: CashAdvanceStore) {
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
        return { description, requestedAmount };
      });

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
  };
}

export type CashAdvanceService = ReturnType<typeof createCashAdvanceService>;
