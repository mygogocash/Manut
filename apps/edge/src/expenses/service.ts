import { HttpError } from "../http-error";
import {
  STORAGE_BUCKETS,
  TrustedStorageError,
  validateReceiptUrl,
} from "../trusted-storage";
import {
  canReadExpenses,
  EXPENSE_CREATE,
  EXPENSE_HR_APPROVE,
  EXPENSE_HR_READ,
  hasExpensePermission,
} from "./access";
import type {
  ExpenseApprovalDecisionRow,
  ExpenseApprovalStepRecord,
  ExpenseReportRecord,
  ExpensesStore,
} from "./store";

const CATEGORIES = new Set([
  "general",
  "business_or_bd",
  "allowance",
  "office",
]);

const BRIDGE_CURRENCIES = ["USD", "THB", "EUR"] as const;

function asIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Client projection: strip employee email/department (matches app-core).
 */
function serializeReport(raw: ExpenseReportRecord): Record<string, unknown> {
  return {
    id: raw.id,
    period: raw.period,
    title: raw.title,
    category: raw.category,
    status: raw.status,
    submittedAt: asIso(raw.submittedAt),
    approvedAt: asIso(raw.approvedAt),
    rejectReason: raw.rejectReason,
    reimbursedAt: asIso(raw.reimbursedAt),
    totalAmount: raw.totalAmount,
    totalCurrency: raw.totalCurrency,
    converted: raw.converted,
    missingRates: raw.missingRates,
    approvedTotal: raw.approvedTotal,
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
    employee: {
      id: raw.employeeId,
      name: raw.employeeName,
    },
    entity: {
      id: raw.entityId,
      name: raw.entityName,
    },
    _count: { expenses: raw.expenseCount },
  };
}

function assertCanUseOfficeCategory(
  category: string | undefined,
  permissions: Set<string>,
): void {
  if (category !== "office") return;
  if (
    !hasExpensePermission(permissions, EXPENSE_HR_APPROVE) &&
    !hasExpensePermission(permissions, EXPENSE_HR_READ)
  ) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "Office category requires HR expense permission.",
    );
  }
}

function toHttpError(error: unknown): never {
  if (error instanceof TrustedStorageError) {
    throw new HttpError(error.status, error.code, error.message);
  }
  throw error;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function resolveDirectOrInverse(
  store: ExpensesStore,
  from: string,
  to: string,
  asOf?: Date,
): Promise<number | null> {
  if (from === to) return 1;
  const direct = await store.findExchangeRate(from, to, asOf);
  if (direct !== null) return direct;
  const inverse = await store.findExchangeRate(to, from, asOf);
  if (inverse !== null) return 1 / inverse;
  return null;
}

async function resolveRate(
  store: ExpensesStore,
  fromCurrency: string,
  toCurrency: string,
  asOf?: Date,
): Promise<{ rate: number; source: string } | null> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (from === to) return { rate: 1, source: "identity" };

  const direct = await store.findExchangeRate(from, to, asOf);
  if (direct !== null) return { rate: direct, source: "direct" };

  const inverse = await store.findExchangeRate(to, from, asOf);
  if (inverse !== null) return { rate: 1 / inverse, source: "inverse" };

  for (const bridge of BRIDGE_CURRENCIES) {
    if (bridge === from || bridge === to) continue;
    const leg1 = await resolveDirectOrInverse(store, from, bridge, asOf);
    if (leg1 === null) continue;
    const leg2 = await resolveDirectOrInverse(store, bridge, to, asOf);
    if (leg2 === null) continue;
    return { rate: leg1 * leg2, source: "triangulated" };
  }

  return null;
}

async function convertAmount(
  store: ExpensesStore,
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  asOf?: Date,
): Promise<{ converted: number; rate: number } | null> {
  const lookup = await resolveRate(store, fromCurrency, toCurrency, asOf);
  if (!lookup) return null;
  return {
    converted: Math.round(amount * lookup.rate * 100) / 100,
    rate: lookup.rate,
  };
}

async function convertReportToThb(
  store: ExpensesStore,
  reportId: string,
): Promise<{ thb: number; missing: string[] }> {
  const lines = await store.findLinesForReport(reportId);
  let thb = 0;
  const missing: string[] = [];
  for (const line of lines) {
    if (line.currency === "THB") {
      thb += line.amount;
      continue;
    }
    const fx = await convertAmount(
      store,
      line.amount,
      line.currency,
      "THB",
      new Date(line.date),
    );
    if (!fx) {
      if (!missing.includes(line.currency)) missing.push(line.currency);
      continue;
    }
    thb += fx.converted;
  }
  return { thb: Math.round(thb * 100) / 100, missing };
}

function assertReportConvertible(missing: string[], action: string): void {
  if (missing.length > 0) {
    throw new HttpError(
      400,
      "INVALID_EXPENSE",
      `Cannot ${action}: no exchange rate for ${missing.join(", ")} → THB. ` +
        `Add it in Accounting → Exchange Rates, then try again.`,
    );
  }
}

function filterApprovalSteps(
  steps: ExpenseApprovalStepRecord[],
  submitterId: string,
  category: string,
  totalBaht: number | null,
): ExpenseApprovalStepRecord[] {
  return steps.filter((step) => {
    const skip = asStringArray(step.skipWhenSubmitterIds);
    if (skip.includes(submitterId)) return false;
    const only = asStringArray(step.onlyWhenSubmitterIds);
    if (only.length > 0 && !only.includes(submitterId)) return false;
    const cats = asStringArray(step.categoryFilter);
    if (cats.length > 0 && !cats.includes(category)) return false;
    const hasAmountFilter =
      step.amountMinBaht != null || step.amountMaxBaht != null;
    if (hasAmountFilter) {
      if (totalBaht === null) return false;
      if (step.amountMinBaht != null && totalBaht < step.amountMinBaht) {
        return false;
      }
      if (step.amountMaxBaht != null && totalBaht > step.amountMaxBaht) {
        return false;
      }
    }
    return true;
  });
}

async function buildDecisionRows(
  store: ExpensesStore,
  submitterId: string,
  opts: { category: string; totalBaht: number | null },
): Promise<ExpenseApprovalDecisionRow[]> {
  const allSteps = await store.findActiveApprovalSteps();
  const applicable = filterApprovalSteps(
    allSteps,
    submitterId,
    opts.category,
    opts.totalBaht,
  );
  const { l1UserId, l2UserId } = await store.findManagerChain(submitterId);

  type MaybeRow = ExpenseApprovalDecisionRow | null;
  const rawRows: MaybeRow[] =
    applicable.length > 0
      ? applicable.map((step, idx): MaybeRow => {
          if (step.approverType === "manager_l2") {
            if (!l2UserId) return null;
            return {
              order: idx + 1,
              name: step.name,
              approverType: "user",
              approverUserId: l2UserId,
            };
          }
          if (step.approverType === "manager") {
            if (!l1UserId) return null;
            return {
              order: idx + 1,
              name: step.name,
              approverType: step.approverType,
              approverUserId: null,
            };
          }
          return {
            order: idx + 1,
            name: step.name,
            approverType: step.approverType,
            approverUserId:
              step.approverType === "user" ? step.approverUserId : null,
          };
        })
      : [
          {
            order: 1,
            name: "Manager approval",
            approverType: "manager",
            approverUserId: null,
          },
        ];

  const decisionRows = rawRows
    .filter((row): row is ExpenseApprovalDecisionRow => row !== null)
    .map((row, idx) => ({ ...row, order: idx + 1 }));

  if (decisionRows.length === 0) {
    decisionRows.push({
      order: 1,
      name: "Manager approval",
      approverType: "manager",
      approverUserId: null,
    });
  }
  return decisionRows;
}

export function createExpensesService(
  store: ExpensesStore,
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
        period?: string;
        pendingForMe?: boolean;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!canReadExpenses(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      if (query.pendingForMe) {
        const hasHrApprove = hasExpensePermission(
          permissions,
          EXPENSE_HR_APPROVE,
        );
        if (hasHrApprove) {
          const { data, total } = await store.findMany(
            { status: "submitted" },
            query.page,
            query.limit,
          );
          return {
            data: data.map(serializeReport),
            meta: {
              page: query.page,
              limit: query.limit,
              total,
              totalPages: Math.ceil(total / query.limit),
            },
          };
        }

        const reportIds = await store.findPendingForMeReportIds(userId);
        if (reportIds.length === 0) {
          return {
            data: [],
            meta: {
              page: query.page,
              limit: query.limit,
              total: 0,
              totalPages: 0,
            },
          };
        }
        const { data, total } = await store.findMany(
          {
            reportIds,
            status: query.status ?? "submitted",
          },
          query.page,
          query.limit,
        );
        return {
          data: data.map(serializeReport),
          meta: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },
        };
      }

      const { data, total } = await store.findMany(
        {
          employeeId: userId,
          status: query.status,
          period: query.period,
        },
        query.page,
        query.limit,
      );

      return {
        data: data.map(serializeReport),
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
        entityId: string;
        period: string;
        title: string;
        category?: string;
        notes?: string;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!hasExpensePermission(permissions, EXPENSE_CREATE)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const title = input.title.trim();
      if (!title) {
        throw new HttpError(400, "INVALID_EXPENSE", "Title is required.");
      }
      if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(input.period)) {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          "Period must be YYYY-MM.",
        );
      }
      if (!input.entityId.trim()) {
        throw new HttpError(400, "INVALID_EXPENSE", "Entity is required.");
      }

      const category = input.category?.trim() || "general";
      if (!CATEGORIES.has(category)) {
        throw new HttpError(400, "INVALID_EXPENSE", "Invalid category.");
      }
      assertCanUseOfficeCategory(category, permissions);

      const created = await store.create({
        employeeId: userId,
        entityId: input.entityId.trim(),
        period: input.period,
        title,
        category,
        notes: input.notes,
      });

      return { data: serializeReport(created) };
    },

    async getOwn(userId: string, reportId: string) {
      const permissions = await store.loadPermissions(userId);
      if (!canReadExpenses(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const report = await store.findById(reportId);
      if (!report) {
        throw new HttpError(404, "NOT_FOUND", "Expense report not found.");
      }
      if (report.employeeId !== userId) {
        throw new HttpError(
          403,
          "EXPENSE_DETAIL_NOT_SELF",
          "Non-self expense detail remains on the API origin.",
        );
      }

      return { data: serializeReport(report) };
    },

    async convert(
      userId: string,
      amount: number,
      fromCurrency: string,
      toCurrency: string,
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!canReadExpenses(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          "Amount must be a positive number.",
        );
      }
      const from = fromCurrency.trim();
      const to = toCurrency.trim();
      if (!from || !to) {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          "fromCurrency and toCurrency are required.",
        );
      }
      const result = await convertAmount(store, amount, from, to);
      if (!result) {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          `No exchange rate found for ${from} → ${to}`,
        );
      }
      return { data: result };
    },

    async submit(userId: string, reportId: string) {
      const permissions = await store.loadPermissions(userId);
      if (!hasExpensePermission(permissions, EXPENSE_CREATE)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const report = await store.findById(reportId);
      if (!report) {
        throw new HttpError(404, "NOT_FOUND", "Expense report not found");
      }
      if (report.employeeId !== userId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You can only submit your own reports",
        );
      }
      if (report.status !== "draft" && report.status !== "rejected") {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          `Cannot submit a report with status "${report.status}"`,
        );
      }

      const lines = await store.findLinesForReport(reportId);
      if (lines.length === 0) {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          "Add at least one expense before submitting",
        );
      }

      const categoryIds = lines
        .map((line) => line.categoryId)
        .filter((id): id is string => !!id);
      let reportCategory = report.category;
      if (
        categoryIds.length === lines.length &&
        categoryIds.length > 0
      ) {
        const flags = await store.findCategoriesAllowance(categoryIds);
        const isAllowanceOnly =
          flags.length === new Set(categoryIds).size &&
          flags.every((row) => row.isAllowance);
        if (isAllowanceOnly) {
          const steps = await store.findActiveApprovalSteps();
          const hasAllowanceChain = steps.some((step) =>
            asStringArray(step.categoryFilter).includes("allowance"),
          );
          if (hasAllowanceChain) {
            reportCategory = "allowance";
          } else {
            const { missing } = await convertReportToThb(store, reportId);
            assertReportConvertible(missing, "submit this allowance report");
            // Email notify stays on Express; edge finalises status only.
            const finalised = await store.finaliseAllowance(reportId, userId);
            return { data: serializeReport(finalised) };
          }
        }
      }

      const { thb: totalBaht, missing } = await convertReportToThb(
        store,
        reportId,
      );
      assertReportConvertible(missing, "submit this report");

      const decisionRows = await buildDecisionRows(store, userId, {
        category: reportCategory,
        totalBaht,
      });

      // Email notify stays on Express; edge snapshots chain + status only.
      const submitted = await store.submitWithDecisions(
        reportId,
        decisionRows,
        { category: reportCategory },
      );
      return { data: serializeReport(submitted) };
    },

    async approve(
      userId: string,
      reportId: string,
      opts: { approvedAmount?: number; notes?: string } = {},
    ) {
      const permissions = await store.loadPermissions(userId);
      const report = await store.findById(reportId);
      if (!report) {
        throw new HttpError(404, "NOT_FOUND", "Expense report not found");
      }
      if (report.status !== "submitted") {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          `Cannot approve a report with status "${report.status}"`,
        );
      }

      let approvedAmountOverride: number | null = null;
      if (opts.approvedAmount !== undefined) {
        if (!report.converted) {
          assertReportConvertible(report.missingRates, "approve this report");
        }
        if (opts.approvedAmount > report.totalAmount) {
          throw new HttpError(
            400,
            "INVALID_EXPENSE",
            `Approved amount (${opts.approvedAmount}) cannot exceed submitted total (${report.totalAmount})`,
          );
        }
        approvedAmountOverride = opts.approvedAmount;
      }

      let decisions = await store.findDecisions(reportId);
      let currentStepOrder = report.currentStepOrder ?? 1;
      if (decisions.length === 0) {
        const rows = await buildDecisionRows(store, report.employeeId, {
          category: report.category,
          totalBaht: report.converted ? report.totalAmount : null,
        });
        await store.snapshotDecisions(reportId, rows);
        decisions = await store.findDecisions(reportId);
        currentStepOrder = 1;
      }

      const current =
        decisions.find((decision) => decision.order === currentStepOrder) ??
        null;
      if (!current || current.status !== "pending") {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          "No pending approval step is waiting on this report",
        );
      }

      let isAuthorisedApprover = false;
      if (current.approverType === "user") {
        isAuthorisedApprover = current.approverUserId === userId;
      } else if (current.approverType === "manager") {
        const reportingTo = await store.findEmployeeReportingTo(
          report.employeeId,
        );
        isAuthorisedApprover = reportingTo === userId;
      }
      if (!isAuthorisedApprover) {
        const reportingTo = await store.findEmployeeReportingTo(
          report.employeeId,
        );
        if (reportingTo === userId) isAuthorisedApprover = true;
      }
      if (
        !isAuthorisedApprover &&
        hasExpensePermission(permissions, EXPENSE_HR_APPROVE)
      ) {
        isAuthorisedApprover = true;
      }
      if (!isAuthorisedApprover) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You are not the assigned approver for this stage",
        );
      }

      const remainingPending = decisions.filter(
        (decision) =>
          decision.order > current.order && decision.status === "pending",
      );
      const isFinalStep = remainingPending.length === 0;

      let finalApprovedTotal: number | null = null;
      if (isFinalStep) {
        const overrides = decisions
          .filter((d) => d.id !== current.id && d.approvedAmount !== null)
          .map((d) => d.approvedAmount as number);
        if (approvedAmountOverride !== null) {
          overrides.push(approvedAmountOverride);
        }
        if (overrides.length > 0) {
          finalApprovedTotal = overrides[overrides.length - 1]!;
        }
      }

      // Email notify stays on Express.
      const updated = await store.approveStep({
        reportId,
        decisionId: current.id,
        approverId: userId,
        isFinalStep,
        nextStepOrder: isFinalStep ? null : remainingPending[0]!.order,
        approvedAmount: approvedAmountOverride,
        notes: opts.notes,
        finalApprovedTotal,
      });
      return { data: serializeReport(updated) };
    },

    async reject(userId: string, reportId: string, reason: string) {
      const permissions = await store.loadPermissions(userId);
      const trimmed = reason.trim();
      if (!trimmed) {
        throw new HttpError(400, "INVALID_EXPENSE", "Reason is required.");
      }

      const report = await store.findById(reportId);
      if (!report) {
        throw new HttpError(404, "NOT_FOUND", "Expense report not found");
      }
      if (report.status !== "submitted") {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          `Cannot reject a report with status "${report.status}"`,
        );
      }

      let decisions = await store.findDecisions(reportId);
      let currentStepOrder = report.currentStepOrder ?? 1;
      if (decisions.length === 0) {
        const rows = await buildDecisionRows(store, report.employeeId, {
          category: report.category,
          totalBaht: report.converted ? report.totalAmount : null,
        });
        await store.snapshotDecisions(reportId, rows);
        decisions = await store.findDecisions(reportId);
        currentStepOrder = 1;
      }

      const current =
        decisions.find((decision) => decision.order === currentStepOrder) ??
        null;

      if (current && current.status === "pending") {
        let canReject = false;
        if (current.approverType === "user") {
          canReject = current.approverUserId === userId;
        } else if (current.approverType === "manager") {
          const reportingTo = await store.findEmployeeReportingTo(
            report.employeeId,
          );
          canReject = reportingTo === userId;
        }
        if (!canReject) {
          const reportingTo = await store.findEmployeeReportingTo(
            report.employeeId,
          );
          if (reportingTo === userId) canReject = true;
        }
        if (
          !canReject &&
          hasExpensePermission(permissions, EXPENSE_HR_APPROVE)
        ) {
          canReject = true;
        }
        if (!canReject) {
          throw new HttpError(
            403,
            "FORBIDDEN",
            "You are not the assigned approver for this stage",
          );
        }
      }

      // Email notify stays on Express.
      const updated = await store.rejectStep({
        reportId,
        decisionId: current?.status === "pending" ? current.id : null,
        approverId: userId,
        reason: trimmed,
      });
      return { data: serializeReport(updated) };
    },

    async addLine(
      userId: string,
      reportId: string,
      input: {
        description: string;
        amount: number;
        currency: string;
        date: string;
        categoryId?: string;
        travelRequestId?: string;
        notes?: string;
        receiptUrl?: string | null;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!hasExpensePermission(permissions, EXPENSE_CREATE)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const report = await store.findById(reportId);
      if (!report) {
        throw new HttpError(404, "NOT_FOUND", "Expense report not found");
      }
      if (report.employeeId !== userId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You can only edit your own reports",
        );
      }
      if (report.status !== "draft" && report.status !== "rejected") {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          `Cannot add expenses to a report with status "${report.status}"`,
        );
      }

      const description = input.description.trim();
      if (!description) {
        throw new HttpError(400, "INVALID_EXPENSE", "Description is required.");
      }
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          "Amount must be a positive number.",
        );
      }
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(input.date)) {
        throw new HttpError(400, "INVALID_EXPENSE", "Date must be YYYY-MM-DD.");
      }

      const receiptUrl = input.receiptUrl?.trim() || null;
      try {
        await validateReceiptUrl(store, receiptUrl, {
          mode: "allow-external",
          allowedBuckets: [STORAGE_BUCKETS.RECEIPTS],
          purpose: "expense-receipt",
          uploadedBy: userId,
          trustedOrigins,
        });
      } catch (error) {
        toHttpError(error);
      }

      if (input.categoryId) {
        const category = await store.findCategoryById(input.categoryId);
        if (category) {
          if (category.receiptRequired && !receiptUrl) {
            throw new HttpError(
              400,
              "INVALID_EXPENSE",
              `Category "${category.name}" requires a receipt`,
            );
          }
          if (
            category.spendingLimit != null &&
            input.amount > category.spendingLimit
          ) {
            throw new HttpError(
              400,
              "INVALID_EXPENSE",
              `Amount exceeds category spending limit of ${category.spendingLimit}`,
            );
          }
        }
      }

      const line = await store.addLine({
        reportId,
        employeeId: userId,
        entityId: report.entityId,
        description,
        amount: input.amount,
        currency: input.currency.trim().toUpperCase() || "THB",
        date: input.date,
        categoryId: input.categoryId,
        travelRequestId: input.travelRequestId,
        notes: input.notes?.trim() || undefined,
        receiptUrl,
      });

      return {
        data: {
          id: line.id,
          description: line.description,
          amount: line.amount,
          currency: line.currency,
          date: line.date,
          status: line.status,
          receiptUrl: line.receiptUrl,
        },
      };
    },

    async updateLine(
      userId: string,
      reportId: string,
      expenseId: string,
      input: {
        description?: string;
        amount?: number;
        currency?: string;
        date?: string;
        categoryId?: string | null;
        notes?: string | null;
        receiptUrl?: string | null;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!hasExpensePermission(permissions, EXPENSE_CREATE)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const report = await store.findById(reportId);
      if (!report) {
        throw new HttpError(404, "NOT_FOUND", "Expense report not found");
      }
      if (report.employeeId !== userId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You can only edit your own reports",
        );
      }
      if (report.status !== "draft" && report.status !== "rejected") {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          `Cannot edit expenses in a report with status "${report.status}"`,
        );
      }

      const expense = await store.findLineById(expenseId);
      if (!expense || expense.reportId !== reportId) {
        throw new HttpError(
          404,
          "NOT_FOUND",
          "Expense not found in this report",
        );
      }

      if (input.receiptUrl !== undefined) {
        const receiptUrl = input.receiptUrl?.trim() || null;
        try {
          await validateReceiptUrl(store, receiptUrl, {
            mode: "allow-external",
            allowedBuckets: [STORAGE_BUCKETS.RECEIPTS],
            purpose: "expense-receipt",
            uploadedBy: userId,
            trustedOrigins,
          });
        } catch (error) {
          toHttpError(error);
        }
      }

      const line = await store.updateLine(expenseId, {
        description: input.description?.trim(),
        amount: input.amount,
        currency: input.currency?.trim().toUpperCase(),
        date: input.date,
        categoryId: input.categoryId,
        notes: input.notes,
        ...(input.receiptUrl !== undefined && {
          receiptUrl: input.receiptUrl?.trim() || null,
        }),
      });

      return {
        data: {
          id: line.id,
          description: line.description,
          amount: line.amount,
          currency: line.currency,
          date: line.date,
          status: line.status,
          receiptUrl: line.receiptUrl,
        },
      };
    },

    async removeLine(userId: string, reportId: string, expenseId: string) {
      const permissions = await store.loadPermissions(userId);
      if (!hasExpensePermission(permissions, EXPENSE_CREATE)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const report = await store.findById(reportId);
      if (!report) {
        throw new HttpError(404, "NOT_FOUND", "Expense report not found");
      }
      if (report.employeeId !== userId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You can only edit your own reports",
        );
      }
      if (report.status !== "draft" && report.status !== "rejected") {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          `Cannot remove expenses from a report with status "${report.status}"`,
        );
      }

      const expense = await store.findLineById(expenseId);
      if (!expense || expense.reportId !== reportId) {
        throw new HttpError(
          404,
          "NOT_FOUND",
          "Expense not found in this report",
        );
      }

      await store.softDeleteLine(expenseId);
      return { data: { success: true } };
    },
  };
}

export type ExpensesService = ReturnType<typeof createExpensesService>;
