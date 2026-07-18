import { HttpError } from "../http-error";
import { canReadLeave } from "./access";
import type { LeaveRequestRecord, LeaveStore } from "./store";

function asDate(value: string): string {
  return value.slice(0, 10);
}

function serializeRequest(raw: LeaveRequestRecord): Record<string, unknown> {
  return {
    id: raw.id,
    leaveType: {
      id: raw.leaveTypeId,
      name: raw.leaveTypeName,
      code: raw.leaveTypeCode,
      category: raw.leaveTypeCategory,
    },
    startDate: asDate(raw.startDate),
    endDate: asDate(raw.endDate),
    durationType: raw.durationType,
    halfDayPeriod: raw.halfDayPeriod,
    days: raw.days,
    reason: raw.reason,
    status: raw.status,
    createdAt: raw.createdAt,
  };
}

export function createLeaveService(store: LeaveStore) {
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
      if (!canReadLeave(permissions)) {
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
  };
}

export type LeaveService = ReturnType<typeof createLeaveService>;
