import { HttpError } from "../http-error";
import {
  canReadLeave,
  canRouteApproveLeave,
  hasLeavePermission,
  LEAVE_APPROVE_WFH,
  LEAVE_HR_READ,
  LEAVE_REQUEST,
} from "./access";
import type {
  LeaveApprovalDecisionRecord,
  LeaveRequestDetailRecord,
  LeaveRequestRecord,
  LeaveStore,
} from "./store";

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

/**
 * Self-scoped list/detail projection. Reason stays for the owner (Expo leave
 * list shows it). Team/HR widened queries stay proxied to Express.
 */
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

    async approve(actorId: string, requestId: string) {
      const permissions = await store.loadPermissions(actorId);
      if (!canRouteApproveLeave(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const request = await store.findRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "NOT_FOUND", "Leave request not found");
      }
      if (request.status !== "pending") {
        throw new HttpError(
          400,
          "INVALID_LEAVE",
          `Cannot approve a request with status "${request.status}"`,
        );
      }

      await assertCanApproveOrReject(store, request, actorId, permissions);

      let decisions = await store.findDecisions(requestId);
      let expectedStepOrder = request.currentStepOrder;
      if (decisions.length === 0) {
        const initialized = await snapshotApprovalDecisions(
          store,
          requestId,
          request.employeeId,
        );
        if (!initialized) {
          throw new HttpError(
            409,
            "LEAVE_CHAIN_RACE",
            "Leave request changed while its approval chain was being initialized; refresh and try again",
          );
        }
        decisions = await store.findDecisions(requestId);
        expectedStepOrder = 1;
      }

      const currentOrder = expectedStepOrder ?? decisions[0]?.order ?? 1;
      const current =
        decisions.find((decision) => decision.order === currentOrder) ?? null;
      const remainingPending = decisions.filter(
        (decision) =>
          decision.order > currentOrder && decision.status === "pending",
      );
      const nextPending = remainingPending[0] ?? null;
      const year = Number(request.startDate.slice(0, 4));
      const days = Number(request.days);
      const source = request.source;

      const result = await store.approveRequestStep({
        requestId,
        approverId: actorId,
        currentDecisionId:
          current && current.status === "pending" ? current.id : null,
        expectedStepOrder,
        nextStepOrder: nextPending?.order ?? null,
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        year,
        days,
        source,
        defaultEntitlement: request.leaveTypeDaysPerYear,
        description: `Leave approved (${source}): ${request.startDate} – ${request.endDate}`,
      });
      if (!result) {
        throw new HttpError(
          409,
          "LEAVE_CHAIN_RACE",
          "Leave request changed while it was being approved; refresh and try again",
        );
      }

      // Email / analytics stay on Express.
      return { data: serializeRequest(result) };
    },

    async reject(actorId: string, requestId: string, reason: string) {
      const permissions = await store.loadPermissions(actorId);
      if (!canRouteApproveLeave(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const trimmed = reason.trim();
      if (!trimmed) {
        throw new HttpError(
          400,
          "INVALID_LEAVE",
          "Rejection reason is required.",
        );
      }

      const request = await store.findRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "NOT_FOUND", "Leave request not found");
      }
      if (request.status !== "pending") {
        throw new HttpError(
          400,
          "INVALID_LEAVE",
          `Cannot reject a request with status "${request.status}"`,
        );
      }

      await assertCanApproveOrReject(store, request, actorId, permissions);

      let decisions = await store.findDecisions(requestId);
      let expectedStepOrder = request.currentStepOrder;
      if (decisions.length === 0) {
        const initialized = await snapshotApprovalDecisions(
          store,
          requestId,
          request.employeeId,
        );
        if (!initialized) {
          throw new HttpError(
            409,
            "LEAVE_CHAIN_RACE",
            "Leave request changed while its approval chain was being initialized; refresh and try again",
          );
        }
        decisions = await store.findDecisions(requestId);
        expectedStepOrder = 1;
      }

      const currentOrder = expectedStepOrder ?? decisions[0]?.order ?? 1;
      const current =
        decisions.find((decision) => decision.order === currentOrder) ?? null;
      const result = await store.rejectRequestStep({
        requestId,
        approverId: actorId,
        currentDecisionId:
          current && current.status === "pending" ? current.id : null,
        expectedStepOrder,
        reason: trimmed,
      });
      if (!result) {
        throw new HttpError(
          409,
          "LEAVE_CHAIN_RACE",
          "Leave request changed while it was being rejected; refresh and try again",
        );
      }

      return { data: serializeRequest(result) };
    },

    async cancel(actorId: string, requestId: string) {
      const permissions = await store.loadPermissions(actorId);
      if (!hasLeavePermission(permissions, LEAVE_REQUEST)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const request = await store.findRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "NOT_FOUND", "Leave request not found");
      }
      if (request.employeeId !== actorId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You can only cancel your own requests",
        );
      }
      if (request.status !== "pending" && request.status !== "approved") {
        throw new HttpError(
          400,
          "INVALID_LEAVE",
          `Cannot cancel a request with status "${request.status}"`,
        );
      }

      const year = Number(request.startDate.slice(0, 4));
      const days = Number(request.days);
      const source = request.source;
      const result = await store.cancelRequest({
        requestId,
        expectedStatus: request.status,
        refund:
          request.status === "approved"
            ? {
                employeeId: request.employeeId,
                leaveTypeId: request.leaveTypeId,
                year,
                days,
                source,
                defaultEntitlement: request.leaveTypeDaysPerYear,
                description: `Leave cancelled (${source}): ${request.startDate} – ${request.endDate}`,
              }
            : null,
      });
      if (!result) {
        throw new HttpError(
          409,
          "LEAVE_CHAIN_RACE",
          "Leave request changed while it was being cancelled; refresh and try again",
        );
      }

      return { data: serializeRequest(result) };
    },
  };
}

async function snapshotApprovalDecisions(
  store: LeaveStore,
  requestId: string,
  submitterId: string,
): Promise<boolean> {
  const steps = await store.findActiveApprovalSteps();
  const applicable = steps.filter((step) => {
    if (step.skipWhenSubmitterIds.includes(submitterId)) return false;
    if (
      step.onlyWhenSubmitterIds.length > 0 &&
      !step.onlyWhenSubmitterIds.includes(submitterId)
    ) {
      return false;
    }
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
  return store.initializeApprovalChain(requestId, decisionRows);
}

async function assertCanApproveOrReject(
  store: LeaveStore,
  request: LeaveRequestDetailRecord,
  approverId: string,
  permissions: ReadonlySet<string>,
): Promise<void> {
  if (permissions.has(LEAVE_HR_READ)) return;

  const canApproveWfh = permissions.has(LEAVE_APPROVE_WFH);
  const isWfh = request.leaveTypeCode === "WFH";
  if (isWfh && canApproveWfh) return;

  const delegatedId = request.delegatedToId;
  const managerId = request.employeeReportingTo;

  if (delegatedId) {
    if (approverId !== delegatedId && approverId !== managerId) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Only the delegated approver or the employee's direct manager can act on this request",
      );
    }
    return;
  }

  const decisions = await store.findDecisions(request.id);
  if (decisions.length > 0) {
    const current =
      decisions.find(
        (decision: LeaveApprovalDecisionRecord) =>
          decision.order ===
          (request.currentStepOrder ?? decisions[0]?.order ?? 1),
      ) ?? null;
    if (current && current.status === "pending") {
      if (current.approverType === "user") {
        if (current.approverUserId === approverId) return;
      } else if (current.approverType === "manager") {
        if (managerId && managerId === approverId) return;
      }
    }
    if (managerId && managerId === approverId) return;
    throw new HttpError(
      403,
      "FORBIDDEN",
      "You are not the assigned approver for this stage",
    );
  }

  const policyApprovers = await store.findPolicyApprovers(request.leaveTypeId);
  if (policyApprovers.length > 0) {
    const allowed = new Set<string>();
    for (const approver of policyApprovers) {
      if (approver.approverType === "manager" && managerId) {
        allowed.add(managerId);
      }
      if (approver.approverType === "user" && approver.approverUserId) {
        allowed.add(approver.approverUserId);
      }
    }
    if (allowed.has(approverId)) return;
    throw new HttpError(
      403,
      "FORBIDDEN",
      "You are not configured as an approver for this leave policy",
    );
  }

  if (isWfh) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "WFH requests must be approved by a user with leave:approve-wfh (executive line)",
    );
  }

  if (!managerId || approverId !== managerId) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "Only the employee's direct manager can approve or reject this request",
    );
  }
}

export type LeaveService = ReturnType<typeof createLeaveService>;
