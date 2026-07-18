import { HttpError } from "../http-error";
import { canReadPayroll } from "./access";
import type { PayrollRunRecord, PayrollStore } from "./store";

function serializeRun(raw: PayrollRunRecord): Record<string, unknown> {
  // Strip notes, emails, and currencyTotals — match app-core projection.
  return {
    id: raw.id,
    period: raw.period,
    status: raw.status,
    totalGross: raw.totalGross,
    totalNet: raw.totalNet,
    totalTax: raw.totalTax,
    createdAt: raw.createdAt,
    entity: { id: raw.entityId, name: raw.entityName },
    runner: { id: raw.runnerId, name: raw.runnerName },
    approver: raw.approverId
      ? { id: raw.approverId, name: raw.approverName ?? "Approver" }
      : null,
  };
}

export function createPayrollService(store: PayrollStore) {
  return {
    async listSelfRuns(
      userId: string,
      query: {
        page: number;
        limit: number;
        status?: string;
        period?: string;
        entityId?: string;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!canReadPayroll(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const { data, total } = await store.findMany(
        {
          employeeIdScope: userId,
          status: query.status,
          period: query.period,
          entityId: query.entityId,
        },
        query.page,
        query.limit,
      );

      return {
        data: data.map(serializeRun),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    },
  };
}

export type PayrollService = ReturnType<typeof createPayrollService>;
