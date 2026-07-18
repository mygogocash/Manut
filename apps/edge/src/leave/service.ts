import { HttpError } from "../http-error";
import { canReadLeave, hasLeavePermission, LEAVE_REQUEST } from "./access";
import type { LeaveRequestRecord, LeaveStore } from "./store";

function asDate(value: string): string {
  return value.slice(0, 10);
}

function parseCalendarDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) {
    throw new HttpError(400, "INVALID_LEAVE", "Use YYYY-MM-DD date format.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(400, "INVALID_LEAVE", "Enter a valid calendar date.");
  }
  return date;
}

function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
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

function asStringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
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

    async create(
      userId: string,
      input: {
        leaveTypeId: string;
        startDate: string;
        endDate: string;
        durationType?: "full_day" | "half_day";
        halfDayPeriod?: "am" | "pm";
        reason?: string;
        source?: "entitled" | "carried";
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!hasLeavePermission(permissions, LEAVE_REQUEST)) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "No permission to submit your own leave request",
        );
      }

      const startDate = asDate(input.startDate);
      const endDate = asDate(input.endDate);
      if (endDate < startDate) {
        throw new HttpError(
          400,
          "INVALID_LEAVE",
          "End date must be on or after start date.",
        );
      }

      const durationType = input.durationType ?? "full_day";
      const source = input.source ?? "entitled";
      const start = parseCalendarDate(startDate);
      const end = parseCalendarDate(endDate);

      let days: number;
      if (durationType === "half_day") {
        if (startDate !== endDate) {
          throw new HttpError(
            400,
            "INVALID_LEAVE",
            "Half-day leave must use a single date",
          );
        }
        if (!input.halfDayPeriod) {
          throw new HttpError(
            400,
            "INVALID_LEAVE",
            "Half-day leave requires am or pm period.",
          );
        }
        const weekday = start.getUTCDay();
        if (weekday === 0 || weekday === 6) {
          throw new HttpError(
            400,
            "INVALID_LEAVE",
            "Half-day leave cannot fall on a weekend",
          );
        }
        days = 0.5;
      } else {
        days = countBusinessDays(start, end);
        if (days <= 0) {
          throw new HttpError(
            400,
            "INVALID_LEAVE",
            "Selected date range contains no business days",
          );
        }
      }

      const leaveType = await store.findLeaveTypeById(input.leaveTypeId);
      if (!leaveType || !leaveType.isActive) {
        throw new HttpError(404, "NOT_FOUND", "Leave type not found");
      }

      const targetUser = await store.findUserById(userId);
      if (!targetUser) {
        throw new HttpError(404, "NOT_FOUND", "Employee not found");
      }
      if (!targetUser.isActive) {
        throw new HttpError(
          400,
          "INVALID_LEAVE",
          "Employee account is not active",
        );
      }
      if (
        leaveType.entityId != null &&
        leaveType.entityId !== targetUser.entityId
      ) {
        throw new HttpError(
          400,
          "INVALID_LEAVE",
          "Leave type does not apply to this employee's entity",
        );
      }

      const year = start.getUTCFullYear();
      const balance = await store.findBalance(userId, input.leaveTypeId, year);

      if (source === "carried") {
        if (!balance) {
          throw new HttpError(
            400,
            "INSUFFICIENT_LEAVE_BALANCE",
            "No carried balance available for this leave type — submit against the entitled bucket.",
          );
        }
        const expiry = balance.carriedExpiry;
        const today = new Date().toISOString().slice(0, 10);
        if (expiry !== null && expiry < today) {
          throw new HttpError(
            400,
            "INSUFFICIENT_LEAVE_BALANCE",
            `Carried leave expired on ${expiry}. Submit against the entitled bucket instead.`,
          );
        }
        const carriedRemaining = Math.max(
          0,
          balance.carried - balance.carriedUsed,
        );
        if (days > carriedRemaining) {
          throw new HttpError(
            400,
            "INSUFFICIENT_LEAVE_BALANCE",
            `Insufficient carried leave. Available: ${carriedRemaining} day(s), requested: ${days} day(s)`,
          );
        }
      } else {
        const available = balance
          ? balance.entitled + balance.adjustment - balance.used
          : leaveType.daysPerYear;
        if (days > available) {
          throw new HttpError(
            400,
            "INSUFFICIENT_LEAVE_BALANCE",
            `Insufficient leave balance. Available: ${available} day(s), requested: ${days} day(s)`,
          );
        }
      }

      const overlap = await store.checkOverlap(userId, startDate, endDate);
      if (overlap) {
        throw new HttpError(
          409,
          "LEAVE_OVERLAP",
          "This employee already has a leave request overlapping with these dates",
        );
      }

      const requiresApproval = leaveType.requiresApproval !== false;
      const created = await store.createRequest({
        employeeId: userId,
        leaveTypeId: input.leaveTypeId,
        entityId: targetUser.entityId,
        startDate,
        endDate,
        days,
        durationType,
        halfDayPeriod:
          durationType === "half_day" ? (input.halfDayPeriod ?? null) : null,
        reason: input.reason?.trim() || undefined,
        source,
        defaultEntitlement: leaveType.daysPerYear,
        requiresApproval,
        approvalDescription: `Leave ${requiresApproval ? "approved" : "auto-approved"} (${source}): ${startDate} – ${endDate}`,
      });

      if (requiresApproval) {
        const steps = await store.findActiveApprovalSteps();
        const applicable = steps.filter((step) => {
          const skip = asStringIds(step.skipWhenSubmitterIds);
          if (skip.includes(userId)) return false;
          const only = asStringIds(step.onlyWhenSubmitterIds);
          if (only.length > 0 && !only.includes(userId)) return false;
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
        const initialized = await store.initializeApprovalChain(
          created.id,
          decisionRows,
        );
        if (!initialized) {
          throw new HttpError(
            409,
            "LEAVE_CHAIN_RACE",
            "Leave approval chain changed while the request was being submitted; refresh and try again",
          );
        }
      }

      return {
        data: {
          id: created.id,
          status: created.status,
        },
      };
    },
  };
}

export type LeaveService = ReturnType<typeof createLeaveService>;
