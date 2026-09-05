import { eq } from "drizzle-orm";
import { PERMISSIONS } from "@nexora/contracts";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import type {
  BalanceQuery,
  BulkImportBalanceRow,
  CreateLeaveApprovalStepInput,
  CreateLeaveRequestInput,
  CreateLeaveTypeInput,
  ForwardLeaveRequestInput,
  LeaveAnalyticsQuery,
  LeaveCalendarQuery,
  LeaveRequestQuery,
  ReorderLeaveApprovalStepsInput,
  SetLeavePolicyApproversInput,
  TeamBalanceQuery,
  UpdateLeaveApprovalStepInput,
  UpdateLeaveBalanceInput,
  UpdateLeaveTypeInput,
  UpsertLeaveBalanceInput,
} from "@nexora/contracts/modules/leave/leave.validation";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import { getSetting, upsertSetting } from "../survey/system-settings.repository";
import * as repo from "./leave.repository";



function leaveSubmittedConfirmationEmail(_: Record<string, unknown>) {
  return { subject: "", html: "" };
}
function leaveSubmittedDeskEmail(_: Record<string, unknown>) {
  return { subject: "", html: "" };
}
function leaveSubmittedEmail(_: Record<string, unknown>) {
  return { subject: "", html: "" };
}
function leaveForwardedEmail(_: Record<string, unknown>) {
  return { subject: "", html: "" };
}
function leaveEscalationReminderEmail(_: Record<string, unknown>) {
  return { subject: "", html: "" };
}
function leaveApprovedEmail(_: Record<string, unknown>) {
  return { subject: "", html: "" };
}
function leaveDeskSummaryEmail(_: Record<string, unknown>) {
  return { subject: "", html: "" };
}
function leaveRejectedEmail(_: Record<string, unknown>) {
  return { subject: "", html: "" };
}
function leaveCancelledEmail(_: Record<string, unknown>) {
  return { subject: "", html: "" };
}

function filterExcludedLeaveRecipients(emails: string[]): string[] {
  return emails;
}

/** TODO: wire edge email service — fire-and-forget no-op for now */
function sendLeaveEmail(_payload: { to: string | string[]; subject?: string; html?: string }) {
  void _payload;
}

const LEAVE_NOTIFICATION_KEY = "leave.notification_recipients";
const PORTAL_URL = "/leave";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateStr(isoDate: string): string {
  return fmtDate(new Date(`${isoDate}T00:00:00Z`));
}



async function loadLeaveNotificationRecipients(db: Db): Promise<string[]> {
  const value = await getSetting(db, LEAVE_NOTIFICATION_KEY);
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return [];
}

function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// Does an approval step apply to this request? Shared by the per-policy
// (LeavePolicyApprover) and org-wide (LeaveApprovalStep) snapshot paths.
// Submitter gating mirrors the original global-chain filter; the day band
// (minDays/maxDays, inclusive, null = unbounded) is per-policy only —
// global steps carry no band, so those checks no-op for them.
function stepApplies(
  step: {
    skipWhenSubmitterIds?: unknown;
    onlyWhenSubmitterIds?: unknown;
    minDays?: number | null;
    maxDays?: number | null;
  },
  ctx: { submitterId: string; days: number },
): boolean {
  const skip = Array.isArray(step.skipWhenSubmitterIds)
    ? (step.skipWhenSubmitterIds as string[])
    : [];
  if (skip.includes(ctx.submitterId)) return false;
  const only = Array.isArray(step.onlyWhenSubmitterIds)
    ? (step.onlyWhenSubmitterIds as string[])
    : [];
  if (only.length > 0 && !only.includes(ctx.submitterId)) return false;
  if (step.minDays != null && ctx.days < step.minDays) return false;
  if (step.maxDays != null && ctx.days > step.maxDays) return false;
  return true;
}

/**
 * Policies visible to the calling user. Resolves the user's entity
 * automatically; passing entityId explicitly lets HR preview a
 * specific entity. Always includes global (entityId = null) policies.
 */
export async function getTypes(db: Db, userId?: string, entityIdOverride?: string | null) {
    let entityId: string | null = null;
    if (entityIdOverride !== undefined) {
      entityId = entityIdOverride;
    } else if (userId) {
      entityId = await repo.findUserEntityId(db, userId);
    }
    return repo.findTypes(db, entityId);
  }

export async function getAllTypes(db: Db, filters?: { entityId?: string | "global" | null }) {
    return repo.findAllTypes(db, filters);
  }

export async function createType(db: Db, input: CreateLeaveTypeInput) {
    const code = input.code.toUpperCase();
    const entityId = input.entityId ?? null;
    const [byName, byCode] = await Promise.all([
      repo.findTypeByNameInEntity(db, input.name, entityId),
      repo.findTypeByCodeInEntity(db, code, entityId),
    ]);
    if (byName) {
      throw new ConflictException(
        "Leave type name already in use for this entity",
      );
    }
    if (byCode) {
      throw new ConflictException(
        "Leave type code already in use for this entity",
      );
    }

    return repo.createType(db, {
      name: input.name,
      code,
      description: input.description,
      category: input.category,
      daysPerYear: input.daysPerYear,
      requiresApproval: input.requiresApproval,
      isPaid: input.isPaid,
      isActive: input.isActive,
      ...(entityId ? { entity: { connect: { id: entityId } } } : {}),
    });
  }

export async function updateType(db: Db, id: string, input: UpdateLeaveTypeInput) {
    const existing = await repo.findTypeById(db, id);
    if (!existing) throw new NotFoundException("Leave type not found");

    // Allow re-scoping a policy to a different entity (or to "global"
    // by passing null/empty). Default = keep existing scope.
    const nextEntityId =
      input.entityId === undefined
        ? existing.entityId
        : input.entityId
          ? input.entityId
          : null;

    if (
      input.name &&
      (input.name !== existing.name || nextEntityId !== existing.entityId)
    ) {
      const byName = await repo.findTypeByNameInEntity(db, 
        input.name,
        nextEntityId,
      );
      if (byName && byName.id !== id) {
        throw new ConflictException(
          "Leave type name already in use for this entity",
        );
      }
    }

    const code = input.code ? input.code.toUpperCase() : undefined;
    if (
      code &&
      (code !== existing.code || nextEntityId !== existing.entityId)
    ) {
      const byCode = await repo.findTypeByCodeInEntity(db, 
        code,
        nextEntityId,
      );
      if (byCode && byCode.id !== id) {
        throw new ConflictException(
          "Leave type code already in use for this entity",
        );
      }
    }

    return repo.updateType(db, id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(code !== undefined && { code }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.daysPerYear !== undefined && {
        daysPerYear: input.daysPerYear,
      }),
      ...(input.requiresApproval !== undefined && {
        requiresApproval: input.requiresApproval,
      }),
      ...(input.isPaid !== undefined && { isPaid: input.isPaid }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.entityId !== undefined && {
        entity: input.entityId
          ? { connect: { id: input.entityId } }
          : { disconnect: true },
      }),
    });
  }

export async function deleteType(db: Db, id: string) {
    const existing = await repo.findTypeById(db, id);
    if (!existing) throw new NotFoundException("Leave type not found");

    const refs = await repo.countTypeReferences(db, id);
    if (refs.balances > 0 || refs.requests > 0 || refs.transactions > 0) {
      throw new ConflictException(
        `Cannot delete leave policy "${existing.name}" because ${refs.balances} balance(s), ${refs.requests} request(s), and ${refs.transactions} transaction(s) reference it. Deactivate it instead.`,
      );
    }

    await repo.deleteType(db, id);
    return { id };
  }

export async function getApprovers(db: Db, leaveTypeId: string) {
    const existing = await repo.findTypeById(db, leaveTypeId);
    if (!existing) throw new NotFoundException("Leave type not found");
    return repo.findApprovers(db, leaveTypeId);
  }

export async function setApprovers(db: Db, leaveTypeId: string, input: SetLeavePolicyApproversInput) {
    const existing = await repo.findTypeById(db, leaveTypeId);
    if (!existing) throw new NotFoundException("Leave type not found");

    const rows = input.approvers.map((a, idx) => ({
      order: idx + 1,
      approverType: a.approverType,
      approverUserId: a.approverType === "user" ? a.approverUserId : null,
      skipWhenSubmitterIds: a.skipWhenSubmitterIds ?? [],
      onlyWhenSubmitterIds: a.onlyWhenSubmitterIds ?? [],
      minDays: a.minDays ?? null,
      maxDays: a.maxDays ?? null,
    }));

    return repo.replaceApprovers(db, leaveTypeId, rows);
  }

export async function getBalances(db: Db, 
    userId: string,
    userPermissions: string[],
    query: BalanceQuery,
  ) {
    const year = query.year ?? new Date().getFullYear();
    const targetEmployeeId = query.employeeId ?? userId;

    if (targetEmployeeId !== userId) {
      const hasHrRead = userPermissions.includes(PERMISSIONS.LEAVE_HR_READ);
      if (!hasHrRead) {
        throw new ForbiddenException(
          "No permission to view other employee balances",
        );
      }
    }

    // Synthesise balances against the policies that actually apply to
    // this employee (their entity + global), not every active policy.
    const targetEntityId =
      await repo.findUserEntityId(db, targetEmployeeId);
    const [rows, types] = await Promise.all([
      repo.findBalances(db, targetEmployeeId, year),
      repo.findTypes(db, targetEntityId),
    ]);

    // Drop balance rows whose leave type belongs to a different entity.
    // Legacy seed/imports created cross-entity rows that, combined with
    // synthesised entries, surfaced as duplicate cards in the UI.
    const applicableRows = rows.filter(
      (b) =>
        b.leaveType.entityId === null ||
        b.leaveType.entityId === targetEntityId,
    );

    const stored = applicableRows.map((b) => {
      const entitled = Number(b.entitled);
      const used = Number(b.used);
      const carried = Number(b.carried);
      const carriedUsed = Number(b.carriedUsed);
      const adjustment = Number(b.adjustment);
      const carriedExpiry = b.carriedExpiry ?? null;
      const carriedExpired =
        carriedExpiry !== null &&
        carriedExpiry < new Date().toISOString().slice(0, 10);
      // Carried bucket sits OUTSIDE the headline entitled-vs-used tally
      // so HR's expiring carry-over doesn't quietly inflate "remaining"
      // for the entitlement column. Employees pick the bucket on the
      // leave request form.
      const carriedRemaining = carriedExpired
        ? 0
        : Math.max(0, carried - carriedUsed);
      return {
        id: b.id,
        leaveType: b.leaveType,
        year: b.year,
        entitled,
        used,
        carried,
        carriedUsed,
        carriedExpiry,
        carriedExpired,
        carriedRemaining,
        adjustment,
        remaining: entitled + adjustment - used,
      };
    });

    // Synthesise zero-used entries for active policies that don't have
    // a LeaveBalance row yet so the UI shows every policy with the
    // policy's daysPerYear as the entitlement instead of an empty list.
    const seen = new Set(stored.map((b) => b.leaveType.id));
    const synthetic = types
      .filter((t) => !seen.has(t.id))
      .map((t) => ({
        id: `synthetic-${targetEmployeeId}-${t.id}-${year}`,
        leaveType: {
          id: t.id,
          name: t.name,
          code: t.code,
          category: t.category,
        },
        year,
        entitled: t.daysPerYear,
        used: 0,
        carried: 0,
        carriedUsed: 0,
        carriedExpiry: null as string | null,
        carriedExpired: false,
        carriedRemaining: 0,
        adjustment: 0,
        remaining: t.daysPerYear,
      }));

    return [...stored, ...synthetic].sort((a, b) =>
      a.leaveType.name.localeCompare(b.leaveType.name),
    );
  }

  /**
   * Direct reports + their per-leave-type balance for the given year.
   * Visible to anyone with `leave:approve` (line manager) or `leave:hr-read`.
   * Non-HR sees only their own direct reports.
   */
export async function getTeamBalances(db: Db, 
    managerId: string,
    userPermissions: string[],
    query: TeamBalanceQuery,
  ) {
    const year = query.year ?? new Date().getFullYear();
    const hasHrRead = userPermissions.includes(PERMISSIONS.LEAVE_HR_READ);

    const reports = hasHrRead
      ? await repo.findAllReportees(db)
      : await repo.findDirectReports(db, managerId);

    const [balances, types] = await Promise.all([
      repo.findBalancesForEmployees(db, 
        reports.map((r) => r.id),
        year,
      ),
      repo.findTypesForEntities(db, reports.map((r) => r.entityId)),
    ]);

    const byEmployee = new Map<string, typeof balances>();
    for (const b of balances) {
      const arr = byEmployee.get(b.employeeId) ?? [];
      arr.push(b);
      byEmployee.set(b.employeeId, arr);
    }

    return reports.map((r) => {
      // Drop balance rows whose leave type belongs to a different entity
      // before merging with synthesised rows — otherwise legacy
      // cross-entity rows surface as duplicate cards alongside the
      // employee's actual policy.
      const existing = (byEmployee.get(r.id) ?? []).filter(
        (b) =>
          b.leaveType.entityId === null || b.leaveType.entityId === r.entityId,
      );
      const seenTypeIds = new Set(existing.map((b) => b.leaveTypeId));

      // Surface every leave type that applies to the employee. If a
      // balance row exists, use it; otherwise synthesize a zero-used
      // entry from the leave type's `daysPerYear` so managers can see
      // the entitlement instead of "No leave balance configured for {year}".
      const applicableTypes = types.filter(
        (t) => t.entityId === null || t.entityId === r.entityId,
      );

      const real = existing.map((b) => {
        const entitled = Number(b.entitled);
        const used = Number(b.used);
        const carried = Number(b.carried);
        const carriedUsed = Number(b.carriedUsed);
        const adjustment = Number(b.adjustment);
        const carriedExpiry = b.carriedExpiry ?? null;
        const carriedExpired =
          carriedExpiry !== null &&
          carriedExpiry < new Date().toISOString().slice(0, 10);
        const carriedRemaining = carriedExpired
          ? 0
          : Math.max(0, carried - carriedUsed);
        return {
          id: b.id,
          leaveType: b.leaveType,
          year: b.year,
          entitled,
          used,
          carried,
          carriedUsed,
          carriedExpiry,
          carriedExpired,
          carriedRemaining,
          adjustment,
          remaining: entitled + adjustment - used,
          synthesized: false,
        };
      });

      const virtual = applicableTypes
        .filter((t) => !seenTypeIds.has(t.id))
        .map((t) => ({
          id: `virtual-${r.id}-${t.id}-${year}`,
          leaveType: {
            id: t.id,
            name: t.name,
            code: t.code,
            category: t.category,
          },
          year,
          entitled: t.daysPerYear,
          used: 0,
          carried: 0,
          carriedUsed: 0,
          carriedExpiry: null as string | null,
          carriedExpired: false,
          carriedRemaining: 0,
          adjustment: 0,
          remaining: t.daysPerYear,
          synthesized: true,
        }));

      return {
        employee: r,
        year,
        balances: [...real, ...virtual].sort((a, b) =>
          a.leaveType.name.localeCompare(b.leaveType.name, undefined, {
            sensitivity: "base",
          }),
        ),
      };
    });
  }

export async function getRequests(db: Db, 
    userId: string,
    userPermissions: string[],
    query: LeaveRequestQuery,
  ) {
    const { page, limit, ...filters } = query;
    const hasHrRead = userPermissions.includes(PERMISSIONS.LEAVE_HR_READ);

    if (!hasHrRead) {
      if (filters.employeeId && filters.employeeId !== userId) {
        const reports = await repo.findDirectReportIds(db, userId);
        if (!reports.includes(filters.employeeId)) {
          throw new ForbiddenException(
            "You can only filter leave requests for yourself or your direct reports",
          );
        }
      }
    }

    const { data, total } = await repo.findRequests(db, 
      {
        ...filters,
        ...(!hasHrRead ? { managerScopeUserId: userId } : {}),
      },
      page,
      limit,
    );

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

export async function getRequestById(db: Db, 
    requestId: string,
    userId: string,
    userPermissions: string[],
  ) {
    const request = await repo.findRequestById(db, requestId);
    if (!request) {
      throw new NotFoundException("Leave request not found");
    }

    const hasHrRead = userPermissions.includes(PERMISSIONS.LEAVE_HR_READ);
    if (!hasHrRead && request.employeeId !== userId) {
      const reports = await repo.findDirectReportIds(db, userId);
      if (!reports.includes(request.employeeId)) {
        throw new ForbiddenException(
          "You can only view leave requests for yourself or your direct reports",
        );
      }
    }

    return request;
  }

export async function createRequest(db: Db, 
    actorId: string,
    userPermissions: string[],
    input: CreateLeaveRequestInput,
  ) {
    const rawTarget = input.employeeId?.trim();
    const forOtherEmployee =
      rawTarget !== undefined && rawTarget !== "" && rawTarget !== actorId;

    const hasRequest = userPermissions.includes(PERMISSIONS.LEAVE_REQUEST);
    const hasOnBehalf = userPermissions.includes(
      PERMISSIONS.LEAVE_HR_ON_BEHALF,
    );

    let employeeId: string;
    if (forOtherEmployee) {
      if (!hasOnBehalf) {
        throw new ForbiddenException(
          "No permission to submit leave on behalf of another employee",
        );
      }
      employeeId = rawTarget;
    } else {
      if (!hasRequest) {
        throw new ForbiddenException(
          "No permission to submit your own leave request",
        );
      }
      employeeId = actorId;
    }

    const startDate = input.startDate;
    const endDate = input.endDate;
    const durationType = input.durationType ?? "full_day";

    let days: number;
    if (durationType === "half_day") {
      if (input.startDate !== input.endDate) {
        throw new BadRequestException("Half-day leave must use a single date");
      }
      const weekday = new Date(`${startDate}T00:00:00Z`).getUTCDay();
      if (weekday === 0 || weekday === 6) {
        throw new BadRequestException(
          "Half-day leave cannot fall on a weekend",
        );
      }
      days = 0.5;
    } else {
      days = countBusinessDays(new Date(`${startDate}T00:00:00Z`), new Date(`${endDate}T00:00:00Z`));
      if (days <= 0) {
        throw new BadRequestException(
          "Selected date range contains no business days",
        );
      }
    }

    const leaveType = (await repo.findTypes(db)).find(
      (t) => t.id === input.leaveTypeId,
    );
    if (!leaveType) {
      throw new NotFoundException("Leave type not found");
    }

    const targetUser = await repo.findUserById(db, employeeId);
    if (!targetUser) {
      throw new NotFoundException("Employee not found");
    }
    if (!targetUser.isActive) {
      throw new BadRequestException("Employee account is not active");
    }

    if (forOtherEmployee) {
      const actor = await repo.findUserById(db, actorId);
      const actorEntity = actor?.entityId ?? null;
      const targetEntity = targetUser.entityId ?? null;
      if (actorEntity !== null && targetEntity !== actorEntity) {
        throw new ForbiddenException(
          "You can only submit leave on behalf of employees in your entity",
        );
      }
    }

    const year = Number(startDate.slice(0, 4));
    const balance = await repo.findBalance(db, 
      employeeId,
      input.leaveTypeId,
      year,
    );

    if (balance) {
      if (input.source === "carried") {
        const carried = Number(balance.carried);
        const carriedUsed = Number(balance.carriedUsed);
        const expiry = balance.carriedExpiry ?? null;
        const today = new Date().toISOString().slice(0, 10);
        if (expiry !== null && expiry < today) {
          throw new BadRequestException(
            `Carried leave expired on ${expiry}. Submit against the entitled bucket instead.`,
          );
        }
        const carriedRemaining = Math.max(0, carried - carriedUsed);
        if (days > carriedRemaining) {
          throw new BadRequestException(
            `Insufficient carried leave. Available: ${carriedRemaining} day(s), requested: ${days} day(s)`,
          );
        }
      } else {
        const available =
          Number(balance.entitled) +
          Number(balance.adjustment) -
          Number(balance.used);
        if (days > available) {
          throw new BadRequestException(
            `Insufficient leave balance. Available: ${available} day(s), requested: ${days} day(s)`,
          );
        }
      }
    } else if (input.source === "carried") {
      throw new BadRequestException(
        "No carried balance available for this leave type — submit against the entitled bucket.",
      );
    }

    const overlap = await repo.checkOverlap(db, 
      employeeId,
      startDate,
      endDate,
    );
    if (overlap) {
      throw new ConflictException(
        "This employee already has a leave request overlapping with these dates",
      );
    }

    const created = await repo.createRequest(db, {
      employeeId,
      leaveTypeId: input.leaveTypeId,
      entityId: targetUser.entityId,
      startDate,
      endDate,
      days,
      durationType,
      halfDayPeriod:
        durationType === "half_day" ? (input.halfDayPeriod ?? null) : null,
      reason: input.reason,
      source: input.source,
    });

    // Snapshot the resolved approval chain (per-policy → global → manager)
    // so later chain edits can't rewrite in-flight requests. Same pattern
    // as travel / expense chains.
    if (!created) throw new NotFoundException("Leave request not found after create");
    const decisionRows = await snapshotApprovalDecisions(db, 
      created.id,
      employeeId,
      input.leaveTypeId,
      days,
    );
    await repo.updateRequestStepOrder(db, created.id, 1);

    // Leave-submit heads-up goes to the resolved first approver of the
    // snapshotted chain: a specific-user first step emails that user; a
    // manager step emails the submitter's line manager. WFH is routed like
    // any other leave type (its legacy executive-line fan-out was removed).
    await notifyFirstApprover(db, decisionRows[0], targetUser, {
      leaveTypeName: leaveType.name,
      startDate,
      endDate,
      reason: input.reason ?? "",
    });

    // Submitter confirmation — they should know the request landed
    // and who's been looped in, not just hear back when it's
    // approved / rejected days later.
    if (targetUser.email) {
      const email = leaveSubmittedConfirmationEmail({
        employeeName: targetUser.name,
        leaveType: leaveType.name,
        startDate: fmtDateStr(startDate),
        endDate: fmtDateStr(endDate),
        days,
        reason: input.reason ?? null,
        portalUrl: `${PORTAL_URL}/leave`,
      });
      void sendLeaveEmail({ to: "" });
    }

    // HR-desk fan-out on submit. The same admin-managed recipients
    // that get the approved-summary email now also get a "submitted"
    // FYI so HR (Sara, Pat, …) are looped in before approval, not
    // only after. Wrapped in try/catch so a mail-server hiccup
    // doesn't blow up the submission itself.
    try {
      const deskRecipients = filterExcludedLeaveRecipients(await loadLeaveNotificationRecipients(db));
      if (deskRecipients.length > 0) {
        const submitter = await repo.findUserWithEntity(db, employeeId);
        const deskEmail = leaveSubmittedDeskEmail({
          employeeName: targetUser.name,
          employeeEmail: targetUser.email,
          department: submitter?.department ?? null,
          entity: submitter?.entName ?? null,
          leaveType: leaveType.name,
          startDate: fmtDateStr(startDate),
          endDate: fmtDateStr(endDate),
          days,
          reason: input.reason ?? null,
          portalUrl: `${PORTAL_URL}/leave`,
        });
        void sendLeaveEmail({ to: "" });
      }
    } catch {
      // best-effort
    }

    return created;
  }

  // Build the per-request chain snapshot. Resolution precedence:
  //   1. the leave type's own approver chain (LeavePolicyApprover), if any;
  //   2. else the org-wide default chain (LeaveApprovalStep);
  //   3. else a single "manager" step.
  // Steps are filtered by `stepApplies` (submitter gating + day band). A
  // per-policy chain whose rows all filter out for this submitter/day-count
  // falls back to the single manager step (NOT the global chain) — a
  // configured per-policy chain fully overrides the org default.
async function snapshotApprovalDecisions(
    db: Db,
    requestId: string,
    submitterId: string,
    leaveTypeId: string,
    days: number,
  ) {
    const ctx = { submitterId, days };

    const policySteps = await repo.findApprovers(db, leaveTypeId);
    let applicableSteps: Array<{
      name?: string;
      approverType: string;
      approverUserId: string | null;
    }>;

    if (policySteps.length > 0) {
      applicableSteps = policySteps
        .filter((s) => stepApplies(s, ctx))
        .map((s, idx) => ({
          name: `Step ${idx + 1} — ${
            s.approverType === "manager" ? "Manager" : "Approver"
          }`,
          approverType: s.approverType,
          approverUserId: s.approverUserId,
        }));
    } else {
      const globalSteps = await repo.findApprovalSteps(db, {
        activeOnly: true,
      });
      applicableSteps = globalSteps
        .filter((s) => stepApplies(s, ctx))
        .map((s) => ({
          name: s.name,
          approverType: s.approverType,
          approverUserId: s.approverUserId,
        }));
    }

    const decisionRows =
      applicableSteps.length > 0
        ? applicableSteps.map((s, idx) => ({
            order: idx + 1,
            name: s.name ?? `Step ${idx + 1}`,
            approverType: s.approverType,
            approverUserId: s.approverType === "user" ? s.approverUserId : null,
          }))
        : [
            {
              order: 1,
              name: "Manager approval",
              approverType: "manager" as const,
              approverUserId: null,
            },
          ];
    await repo.deleteDecisionsForRequest(db, requestId);
    await repo.createDecisions(db, requestId, decisionRows);
    return decisionRows;
  }

  // Email the resolved approver of the first (pending) decision step on
  // submit. `user` → that specific user; `manager` → the submitter's
  // reportingTo. Logs and no-ops when no approver can be resolved (e.g. a
  // manager step for a submitter with no reportingTo) so the gap is
  // observable rather than silent.
async function notifyFirstApprover(
    db: Db,
    first: { approverType: string; approverUserId: string | null } | undefined,
    submitter: { name: string; reportingTo: string | null },
    details: {
      leaveTypeName: string;
      startDate: string;
      endDate: string;
      reason: string;
    },
  ) {
    if (!first) return;
    let approverEmail: string | null | undefined;
    let approverName: string | undefined;
    if (first.approverType === "user" && first.approverUserId) {
      const approver = await repo.findUserById(db, first.approverUserId);
      approverEmail = approver?.email;
      approverName = approver?.name;
    } else if (first.approverType === "manager" && submitter.reportingTo) {
      const manager = await repo.findUserById(db, submitter.reportingTo);
      approverEmail = manager?.email;
      approverName = manager?.name;
    }
    if (!approverEmail) {
      // TODO: log leave submit approver resolution
      return;
    }
    const email = leaveSubmittedEmail({
      approverName: approverName ?? "Approver",
      employeeName: submitter.name,
      leaveType: details.leaveTypeName,
      startDate: fmtDateStr(details.startDate),
      endDate: fmtDateStr(details.endDate),
      reason: details.reason,
      portalUrl: `${PORTAL_URL}/leave`,
    });
    void sendLeaveEmail({ to: "" });
  }

  // ── Approval chain admin ────────────────────────────────

export async function listApprovalSteps(db: Db) {
    return repo.findApprovalSteps(db);
  }

export async function createApprovalStep(db: Db, input: CreateLeaveApprovalStepInput) {
    const nextOrder = await repo.nextApprovalStepOrder(db);
    return repo.createApprovalStep(db, {
      order: nextOrder,
      name: input.name,
      description: input.description ?? null,
      approverType: input.approverType,
      approverUserId: input.approverType === "user" ? input.approverUserId ?? null : null,
      skipWhenSubmitterIds: input.skipWhenSubmitterIds,
      onlyWhenSubmitterIds: input.onlyWhenSubmitterIds,
      isActive: input.isActive,
    });
  }

export async function updateApprovalStep(db: Db, id: string, input: UpdateLeaveApprovalStepInput) {
    const existing = await repo.findApprovalStepById(db, id);
    if (!existing) throw new NotFoundException("Approval step not found");
    const data: Parameters<typeof repo.updateApprovalStep>[2] = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.approverType !== undefined) data.approverType = input.approverType;
    if (input.approverType === "manager") {
      data.approverUserId = null;
    } else if (input.approverUserId !== undefined) {
      data.approverUserId = input.approverUserId;
    }
    if (input.skipWhenSubmitterIds !== undefined) data.skipWhenSubmitterIds = input.skipWhenSubmitterIds;
    if (input.onlyWhenSubmitterIds !== undefined) data.onlyWhenSubmitterIds = input.onlyWhenSubmitterIds;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return repo.updateApprovalStep(db, id, data);
  }

export async function deleteApprovalStep(db: Db, id: string) {
    const existing = await repo.findApprovalStepById(db, id);
    if (!existing) throw new NotFoundException("Approval step not found");
    return repo.deleteApprovalStep(db, id);
  }

export async function reorderApprovalSteps(db: Db, input: ReorderLeaveApprovalStepsInput) {
    return repo.reorderApprovalSteps(db, input.orderedIds);
  }

export async function getNotificationRecipients(db: Db) {
    return { emails: await loadLeaveNotificationRecipients(db) };
  }

export async function setNotificationRecipients(db: Db, rawEmails: string[]) {
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of rawEmails) {
      const trimmed = raw.trim().toLowerCase();
      if (!trimmed) continue;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        throw new BadRequestException(`Invalid email: ${raw}`);
      }
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      cleaned.push(trimmed);
    }
    await upsertSetting(db, LEAVE_NOTIFICATION_KEY, cleaned);
    return { emails: cleaned };
  }

async function assertCanApproveOrReject(
    db: Db,
    request: NonNullable<
      Awaited<ReturnType<typeof repo.findRequestById>>
    >,
    approverId: string,
    userPermissions: string[],
  ): Promise<void> {
    const isHr = userPermissions.includes(PERMISSIONS.LEAVE_HR_READ);
    if (isHr) return;

    const canApproveWfh = userPermissions.includes(
      PERMISSIONS.LEAVE_APPROVE_WFH,
    );
    const isWfh = request.leaveType.code === "WFH";

    if (isWfh && canApproveWfh) return;

    const delegatedId = request.delegatedToId;
    const managerId = request.employee.reportingTo;

    if (delegatedId) {
      if (approverId !== delegatedId && approverId !== managerId) {
        throw new ForbiddenException(
          "Only the delegated approver or the employee's direct manager can act on this request",
        );
      }
      return;
    }

    // Org-wide approval-chain snapshot takes precedence when present.
    // The decision row for the current step says who can act now;
    // submitter's manager is always allowed as a parallel approver so
    // stale snapshots (chain edited mid-flight) don't strand requests.
    const decisions = await repo.findDecisions(db, request.id);
    if (decisions.length > 0) {
      const current =
        decisions.find(
          (d) =>
            d.order === (request.currentStepOrder ?? decisions[0]?.order ?? 1),
        ) ?? null;
      if (current && current.status === "pending") {
        if (current.approverType === "user") {
          if (current.approverUserId === approverId) return;
        } else if (current.approverType === "manager") {
          if (managerId && managerId === approverId) return;
        }
      }
      // Parallel fallback: submitter's direct manager always allowed.
      if (managerId && managerId === approverId) return;
      throw new ForbiddenException(
        "You are not the assigned approver for this stage",
      );
    }

    // Legacy paths — no chain snapshot exists. Per-policy approver list
    // (set on the LeaveType) takes priority, otherwise fall back to the
    // submitter's direct manager.
    const policyApprovers = await repo.findApprovers(db, 
      request.leaveTypeId,
    );
    if (policyApprovers.length > 0) {
      const allowed = new Set<string>();
      for (const a of policyApprovers) {
        if (a.approverType === "manager" && managerId) allowed.add(managerId);
        if (a.approverType === "user" && a.approverUserId) {
          allowed.add(a.approverUserId);
        }
      }
      if (allowed.has(approverId)) return;
      throw new ForbiddenException(
        "You are not configured as an approver for this leave policy",
      );
    }

    if (isWfh) {
      throw new ForbiddenException(
        "WFH requests must be approved by a user with leave:approve-wfh (executive line)",
      );
    }

    if (!managerId || approverId !== managerId) {
      throw new ForbiddenException(
        "Only the employee's direct manager can approve or reject this request",
      );
    }
  }

export async function getCalendar(db: Db, 
    userId: string,
    userPermissions: string[],
    query: LeaveCalendarQuery,
  ) {
    const hasHrRead = userPermissions.includes(PERMISSIONS.LEAVE_HR_READ);
    const from = query.from;
    const to = query.to;
    const rows = await repo.findCalendarRows(db, 
      from,
      to,
      query.department,
    );

    if (!hasHrRead) {
      const reportIds = await repo.findDirectReportIds(db, userId);
      const allowed = new Set<string>([userId, ...reportIds]);
      return {
        data: rows.filter((r) => allowed.has(r.employeeId)),
      };
    }

    return { data: rows };
  }

export async function getAnalytics(db: Db, 
    userId: string,
    userPermissions: string[],
    query: LeaveAnalyticsQuery,
  ) {
    const year = query.year ?? new Date().getFullYear();
    const hasHrRead = userPermissions.includes(PERMISSIONS.LEAVE_HR_READ);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);

    const yearStart = start.toISOString();
    const yearEnd = end.toISOString();
    const whereParts = hasHrRead ? [] : [eq(schema.leaveRequests.employeeId, userId)];

    const [byStatusRaw, byTypeRaw] = await Promise.all([
      repo.groupRequestsByStatus(db, whereParts, yearStart, yearEnd),
      repo.groupRequestsByLeaveType(db, whereParts, yearStart, yearEnd),
    ]);

    const typeIds = byTypeRaw.map((b) => b.leaveTypeId);
    const types = await repo.findLeaveTypesByIds(db, typeIds);
    const typeNameById = new Map(types.map((t) => [t.id, t.name]));

    return {
      data: {
        year,
        byStatus: byStatusRaw.map((r) => ({
          status: r.status,
          count: r.count,
        })),
        byLeaveType: byTypeRaw.map((r) => ({
          leaveTypeId: r.leaveTypeId,
          leaveTypeName: typeNameById.get(r.leaveTypeId) ?? r.leaveTypeId,
          count: r.count,
        })),
      },
    };
  }

export async function getBalanceTransactions(db: Db, 
    userId: string,
    userPermissions: string[],
    employeeId: string,
    year: number,
    leaveTypeId?: string,
  ) {
    const hasHrRead = userPermissions.includes(PERMISSIONS.LEAVE_HR_READ);
    if (employeeId !== userId && !hasHrRead) {
      const reports = await repo.findDirectReportIds(db, userId);
      if (!reports.includes(employeeId)) {
        throw new ForbiddenException(
          "You can only view balance transactions for yourself or your direct reports",
        );
      }
    }

    const transactions = await repo.findBalanceTransactions(db, 
      employeeId,
      year,
      leaveTypeId,
    );
    // `amount` is Decimal — Prisma serialises those as strings over JSON,
    // so normalise to a number the way the balance endpoints do.
    return {
      data: transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
    };
  }

  /**
   * Balances whose stored `used` counter disagrees with the sum of the
   * employee's visible approved requests.
   *
   * `LeaveBalance.used` is a stored counter with three independent
   * writers (approval, refund, HR manual/bulk overwrite) and nothing
   * recomputes it, so it can drift from the request list silently — the
   * employee sees one number on the balance card and a different total
   * in "My requests", and the first anyone hears of it is a complaint.
   * This is the read model that surfaces it instead.
   *
   * Each row carries the likely cause alongside the delta:
   * - `deletedApprovedDays` — days sitting on soft-deleted approved
   *   requests. Before #1118 those were never refunded, so they are the
   *   classic source of a card reading high.
   * - `undeductedApprovedDays` — visible approved days NOT flagged
   *   `balanceDeducted`, i.e. the opposite error: approved but never
   *   charged.
   * - `ledgerRowCount` — how many times HR wrote to this balance by
   *   hand or by xlsx import. Zero means no human touched it, so the
   *   drift is code-caused and safe to correct mechanically. Non-zero
   *   means ask HR before touching it.
   *
   * `ledgerDelta` is reported but deliberately NOT subtracted from the
   * drift: `manual_adjustment` rows written before #1118 recorded the
   * change to `entitled`, not to `used`, so summing across the boundary
   * mixes two meanings. Treat the count as the signal and the delta as
   * indicative.
   */
export async function getBalanceDrift(db: Db, year?: number) {
    const scopedYear = year ?? null;
    const [rows, scanned] = await Promise.all([
      repo.findBalanceDrift(db, scopedYear),
      repo.countBalances(db, scopedYear),
    ]);

    const data = rows.map((r) => ({
      balanceId: r.balance_id,
      employee: {
        id: r.employee_id,
        name: r.employee_name,
        email: r.employee_email,
      },
      leaveType: { id: r.leave_type_id, name: r.leave_type_name },
      year: r.year,
      entitled: r.entitled,
      used: r.used,
      carriedUsed: r.carried_used,
      approvedDays: r.approved_days,
      approvedCarriedDays: r.approved_carried_days,
      drift: r.drift,
      carriedDrift: r.carried_drift,
      deletedApprovedDays: r.deleted_approved_days,
      undeductedApprovedDays: r.undeducted_approved_days,
      ledgerRowCount: r.ledger_row_count,
      ledgerDelta: r.ledger_delta,
    }));

    return {
      data,
      meta: {
        year: scopedYear,
        scanned,
        drifted: data.length,
        // Drift on a balance no human ever edited is code-caused, so it
        // is the subset a mechanical repair can safely take.
        untouchedByHr: data.filter((r) => r.ledgerRowCount === 0).length,
      },
    };
  }

export async function previewApprovers(db: Db, 
    employeeId: string,
    actorId: string,
    userPermissions: string[],
  ) {
    const hasHrRead = userPermissions.includes(PERMISSIONS.LEAVE_HR_READ);
    if (employeeId !== actorId) {
      if (!hasHrRead) {
        const reports = await repo.findDirectReportIds(db, actorId);
        if (!reports.includes(employeeId)) {
          throw new ForbiddenException(
            "You can only preview approvers for yourself or your direct reports",
          );
        }
      }
    }

    const chain: Array<{
      step: number;
      userId: string;
      name: string;
      email: string | null;
      role: string;
    }> = [];

    let currentEmployeeId = employeeId;
    for (let step = 0; step < 6; step++) {
      const emp = await repo.findUserById(db, currentEmployeeId);
      if (!emp?.reportingTo) break;
      const mgr = await repo.findUserById(db, emp.reportingTo);
      if (!mgr) break;
      chain.push({
        step: step + 1,
        userId: mgr.id,
        name: mgr.name,
        email: mgr.email,
        role: step === 0 ? "manager" : "upline",
      });
      currentEmployeeId = mgr.id;
    }

    return { data: chain };
  }

export async function forwardRequest(db: Db, 
    requestId: string,
    actorId: string,
    userPermissions: string[],
    input: ForwardLeaveRequestInput,
  ) {
    const request = await repo.findRequestById(db, requestId);
    if (!request) throw new NotFoundException("Leave request not found");
    if (request.status !== "pending") {
      throw new BadRequestException(
        `Cannot forward a request with status "${request.status}"`,
      );
    }

    const managerId = request.employee.reportingTo;
    const isHr = userPermissions.includes(PERMISSIONS.LEAVE_HR_READ);
    if (!isHr) {
      if (!managerId || actorId !== managerId) {
        throw new ForbiddenException(
          "Only the employee's direct manager can forward this request",
        );
      }
    }

    const delegate = await repo.findUserById(db, input.delegateUserId);
    if (!delegate?.isActive) {
      throw new BadRequestException("Delegate user not found or inactive");
    }
    if (delegate.id === request.employeeId) {
      throw new BadRequestException("Cannot delegate approval to the employee");
    }

    const employee = await repo.findUserById(db, request.employeeId);
    if (
      employee?.entityId &&
      delegate.entityId &&
      employee.entityId !== delegate.entityId
    ) {
      throw new BadRequestException(
        "Delegate should belong to the same entity as the employee",
      );
    }

    await repo.updateRequest(db, requestId, {
      delegatedTo: input.delegateUserId,
    });

    const actor = await repo.findUserById(db, actorId);
    if (delegate.email) {
      const email = leaveForwardedEmail({
        delegateName: delegate.name,
        forwardedByName: actor?.name ?? "Manager",
        employeeName: request.employee.name,
        leaveType: request.leaveType.name,
        startDate: fmtDateStr(request.startDate),
        endDate: fmtDateStr(request.endDate),
        portalUrl: `${PORTAL_URL}/leave`,
      });
      void sendLeaveEmail({ to: "" });
    }

    return repo.findRequestById(db, requestId);
  }

export async function processEscalationReminders(db: Db): Promise<{ reminded: number }> {
    const stale = await repo.findPendingForReminder(db, 72, 24, 3);
    let reminded = 0;
    for (const req of stale) {
      const mgrId = req.employee.reportingTo;
      if (!mgrId) continue;
      const manager = await repo.findUserById(db, mgrId);
      if (!manager?.email) continue;

      const nextCount = req.reminderCount + 1;
      await repo.updateRequest(db, req.id, {
        reminderCount: nextCount,
        lastReminderAt: new Date().toISOString(),
      });

      const email = leaveEscalationReminderEmail({
        approverName: manager.name,
        employeeName: req.employee.name,
        leaveType: req.leaveType.name,
        startDate: fmtDateStr(req.startDate),
        endDate: fmtDateStr(req.endDate),
        portalUrl: `${PORTAL_URL}/leave`,
        reminderCount: nextCount,
      });
      void sendLeaveEmail({ to: "" });
      reminded++;
    }
    return { reminded };
  }

export async function approveRequest(db: Db, 
    requestId: string,
    approverId: string,
    userPermissions: string[],
  ) {
    const request = await repo.findRequestById(db, requestId);
    if (!request) {
      throw new NotFoundException("Leave request not found");
    }
    if (request.status !== "pending") {
      throw new BadRequestException(
        `Cannot approve a request with status "${request.status}"`,
      );
    }

    await assertCanApproveOrReject(db, request, approverId, userPermissions);

    // Advance the chain. Lazy-snapshot for legacy rows that pre-date
    // the chain landing, so older requests still flow through.
    let decisions = await repo.findDecisions(db, requestId);
    if (decisions.length === 0) {
      await snapshotApprovalDecisions(db, 
        requestId,
        request.employeeId,
        request.leaveTypeId,
        Number(request.days),
      );
      await repo.updateRequestStepOrder(db, requestId, 1);
      decisions = await repo.findDecisions(db, requestId);
    }
    const currentOrder = request.currentStepOrder ?? decisions[0]?.order ?? 1;
    const current = decisions.find((d) => d.order === currentOrder) ?? null;

    const remainingPending = decisions.filter(
      (d) => d.order > currentOrder && d.status === "pending",
    );
    const isFinalStep = remainingPending.length === 0;

    const year = Number(request.startDate.slice(0, 4));
    const days = Number(request.days);
    const source = (request.source === "carried" ? "carried" : "entitled") as
      | "entitled"
      | "carried";

    const result = await db.transaction(async (tx) => {
      if (current && current.status === "pending") {
        await repo.updateDecision(tx, current.id, {
          status: "approved",
          decidedById: approverId,
          decidedAt: new Date().toISOString(),
        });
      }

      if (isFinalStep) {
        // `status: "pending"` in the where clause makes this a
        // compare-and-swap: the pre-flight guard above read the row
        // outside any transaction, so two concurrent approvals could
        // both pass it. Only one can flip the row here; the loser
        // matches nothing and Prisma raises P2025, which we translate
        // to a 409 below. Without this the balance was decremented
        // once per racing call.
        const r = await repo.claimPendingRequest(tx, requestId, {
          status: "approved",
          approvedBy: approverId,
          approvedAt: new Date().toISOString(),
          currentStepOrder: null,
          balanceDeducted: true,
        });

        // Mutate balance only after the *whole* chain approves so a
        // mid-chain reject doesn't have to claw back balance. Bucket
        // (`entitled` vs `carried`) comes from the request.source set
        // at create time — main's #362 carried-bucket support. Both
        // writes ride the same transaction as the status flip, so a
        // failure here can no longer leave a request approved with its
        // days never deducted.
        await repo.updateBalance(
          tx,
          request.employeeId,
          request.leaveTypeId,
          year,
          days,
          source,
        );

        await repo.createBalanceTransaction(tx, {
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year,
            type: source === "carried" ? "used_carried" : "used",
            amount: days,
            description: `Leave approved (${source}): ${fmtDateStr(request.startDate)} – ${fmtDateStr(request.endDate)}`,
            referenceId: requestId,
          });

        return r;
      }

      const r = await repo.claimPendingRequest(tx, requestId, {
        currentStepOrder: remainingPending[0]!.order,
      });
      return r;
    });

    if (isFinalStep) {
      const approver = await repo.findUserById(db, approverId);
      const email = leaveApprovedEmail({
        employeeName: request.employee.name,
        leaveType: request.leaveType.name,
        startDate: fmtDateStr(request.startDate),
        endDate: fmtDateStr(request.endDate),
        approverName: approver?.name ?? "Your Manager",
        portalUrl: `${PORTAL_URL}/leave`,
      });
      void sendLeaveEmail({ to: "" });

      // HR-desk long-form summary on final approval. Admin-managed
      // recipients receive a one-row summary email so HR can act on the
      // approved leave without opening the portal. Wrapped in try/catch
      // so a missing template / mail-server hiccup doesn't roll back
      // the approval itself.
      try {
        const deskRecipients = filterExcludedLeaveRecipients(await loadLeaveNotificationRecipients(db));
        if (deskRecipients.length > 0) {
          const employee = await repo.findUserWithEntity(db, request.employeeId);
          const deskEmail = leaveDeskSummaryEmail({
            employeeName: request.employee.name,
            employeeEmail: request.employee.email,
            department: employee?.department ?? null,
            entity: employee?.entName ?? null,
            leaveType: request.leaveType.name,
            startDate: fmtDateStr(request.startDate),
            endDate: fmtDateStr(request.endDate),
            days,
            reason: request.reason ?? null,
            approverName: approver?.name ?? "Your Manager",
            portalUrl: `${PORTAL_URL}/leave`,
          });
          void sendLeaveEmail({ to: "" });
        }
      } catch {
        // best-effort
      }
    } else {
      // Mid-chain: notify the next approver if they're a specific user.
      // Manager-step routing has no single email to target without
      // re-resolving the submitter's reportingTo each time, so we keep
      // it simple and skip the courtesy mail for that case.
      const next = remainingPending[0]!;
      if (next.approverType === "user" && next.approverUserId) {
        const nextUser = await repo.findUserById(db, 
          next.approverUserId,
        );
        if (nextUser?.email) {
          const email = leaveSubmittedEmail({
            approverName: nextUser.name,
            employeeName: request.employee.name,
            leaveType: request.leaveType.name,
            startDate: fmtDateStr(request.startDate),
            endDate: fmtDateStr(request.endDate),
            reason: request.reason ?? "",
            portalUrl: `${PORTAL_URL}/leave`,
          });
          void sendLeaveEmail({ to: "" });
        }
      }
    }

    return result;
  }

export async function rejectRequest(db: Db, 
    requestId: string,
    approverId: string,
    reason: string,
    userPermissions: string[],
  ) {
    const request = await repo.findRequestById(db, requestId);
    if (!request) {
      throw new NotFoundException("Leave request not found");
    }
    if (request.status !== "pending") {
      throw new BadRequestException(
        `Cannot reject a request with status "${request.status}"`,
      );
    }

    await assertCanApproveOrReject(db, request, approverId, userPermissions);

    // Mark the current snapshot decision rejected (audit trail) before
    // flipping the request itself. Lazy-snapshot for legacy rows.
    let decisions = await repo.findDecisions(db, requestId);
    if (decisions.length === 0) {
      await snapshotApprovalDecisions(db, 
        requestId,
        request.employeeId,
        request.leaveTypeId,
        Number(request.days),
      );
      await repo.updateRequestStepOrder(db, requestId, 1);
      decisions = await repo.findDecisions(db, requestId);
    }
    const currentOrder = request.currentStepOrder ?? decisions[0]?.order ?? 1;
    const current = decisions.find((d) => d.order === currentOrder) ?? null;
    if (current && current.status === "pending") {
      await repo.updateDecision(db, current.id, {
        status: "rejected",
        decidedById: approverId,
        decidedAt: new Date().toISOString(),
        notes: reason,
      });
    }

    const result = await repo.updateRequestStatus(db, requestId, {
      status: "rejected",
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
      rejectReason: reason,
    });
    await repo.updateRequestStepOrder(db, requestId, null);

    const approver = await repo.findUserById(db, approverId);
    const email = leaveRejectedEmail({
      employeeName: request.employee.name,
      leaveType: request.leaveType.name,
      startDate: fmtDateStr(request.startDate),
      endDate: fmtDateStr(request.endDate),
      approverName: approver?.name ?? "Your Manager",
      rejectionReason: reason,
      portalUrl: `${PORTAL_URL}/leave`,
    });
    void sendLeaveEmail({ to: "" });

    return result;
  }

  /**
   * Give back the days an approved leave drew down at final approval.
   * Mirrors the deduction in the approval final-step (updateBalance with
   * +days, transaction type `used`) with the opposite sign, and writes a
   * refund BalanceTransaction so the employee's balance history stays
   * auditable.
   *
   * Guarded on `balanceDeducted`, so it is idempotent: calling it for a
   * request whose days are not currently drawn down (a pending request,
   * or one already refunded by an earlier cancel) is a no-op. That is
   * what lets the cancel, cancellation-approval, soft-delete and
   * permanent-delete paths all call it without any of them handing the
   * employee free days.
   */
async function refundLeaveBalance(
    db: Db,
    request: NonNullable<
      Awaited<ReturnType<typeof repo.findRequestById>>
    >,
    context: "cancellation" | "deletion" = "cancellation",
  ) {
    if (!request.balanceDeducted) return;

    const year = Number(request.startDate.slice(0, 4));
    const days = Number(request.days);
    const source = (request.source === "carried" ? "carried" : "entitled") as
      | "entitled"
      | "carried";
    const prefix =
      context === "deletion" ? "deletion_refund" : "cancellation_refund";
    const verb = context === "deletion" ? "deleted" : "cancelled";

    await repo.updateBalance(db, 
      request.employeeId,
      request.leaveTypeId,
      year,
      -days,
      source,
    );
    await repo.createBalanceTransaction(db, {
      employeeId: request.employeeId,
      leaveTypeId: request.leaveTypeId,
      year,
      type: source === "carried" ? `${prefix}_carried` : prefix,
      amount: -days,
      description: `Leave ${verb} (${source}): ${fmtDateStr(request.startDate)} – ${fmtDateStr(request.endDate)}`,
      referenceId: request.id,
    });
    await repo.setBalanceDeducted(db, request.id, false);
  }

  /**
   * Re-draw the days for a request whose refund is being undone — today
   * only the restore-a-soft-deleted-approved-request path. The inverse
   * of refundLeaveBalance, and guarded the same way so restoring twice
   * cannot charge the employee twice.
   */
async function deductLeaveBalance(
    db: Db,
    request: NonNullable<
      Awaited<
        ReturnType<typeof repo.findRequestByIdIncludingDeleted>
      >
    >,
  ) {
    if (request.balanceDeducted) return;

    const year = Number(request.startDate.slice(0, 4));
    const days = Number(request.days);
    const source = (request.source === "carried" ? "carried" : "entitled") as
      "entitled" | "carried";

    await repo.updateBalance(db, 
      request.employeeId,
      request.leaveTypeId,
      year,
      days,
      source,
    );
    await repo.createBalanceTransaction(db, {
      employeeId: request.employeeId,
      leaveTypeId: request.leaveTypeId,
      year,
      type: source === "carried" ? "used_carried" : "used",
      amount: days,
      description: `Leave restored (${source}): ${fmtDateStr(request.startDate)} – ${fmtDateStr(request.endDate)}`,
      referenceId: request.id,
    });
    await repo.setBalanceDeducted(db, request.id, true);
  }

export async function cancelRequest(db: Db, requestId: string, userId: string) {
    const request = await repo.findRequestById(db, requestId);
    if (!request) {
      throw new NotFoundException("Leave request not found");
    }
    if (request.employeeId !== userId) {
      throw new ForbiddenException("You can only cancel your own requests");
    }
    if (request.status !== "pending" && request.status !== "approved") {
      throw new BadRequestException(
        `Cannot cancel a request with status "${request.status}"`,
      );
    }

    // Instant self-cancel (product decision 2026-06-03): an employee can
    // pull back their own leave without a second approval round. An
    // approved request already drew its days down at final approval, so
    // cancelling refunds the balance immediately; a pending request was
    // never deducted, so refundLeaveBalance no-ops and it just flips to
    // cancelled.
    await refundLeaveBalance(db, request);

    const result = await repo.updateRequestStatus(db, requestId, {
      status: "cancelled",
    });

    const employee = await repo.findUserById(db, userId);
    if (employee?.reportingTo) {
      const manager = await repo.findUserById(db, employee.reportingTo);
      if (manager?.email) {
        const email = leaveCancelledEmail({
          recipientName: manager.name,
          employeeName: request.employee.name,
          leaveType: request.leaveType.name,
          startDate: fmtDateStr(request.startDate),
          endDate: fmtDateStr(request.endDate),
          portalUrl: `${PORTAL_URL}/leave`,
        });
        void sendLeaveEmail({ to: "" });
      }
    }

    return result;
  }

export async function approveCancellation(db: Db, 
    requestId: string,
    approverId: string,
    userPermissions: string[],
  ) {
    const request = await repo.findRequestById(db, requestId);
    if (!request) throw new NotFoundException("Leave request not found");
    if (request.status !== "pending_cancellation") {
      throw new BadRequestException(
        `Request is not pending cancellation (current: "${request.status}")`,
      );
    }

    await assertCanApproveOrReject(db, request, approverId, userPermissions);

    // Legacy path: pre-2026-06-03 reports could sit in
    // `pending_cancellation` awaiting a manager. New self-cancels refund
    // inline (see cancelRequest); this still resolves any such rows.
    await refundLeaveBalance(db, request);

    return repo.updateRequestStatus(db, requestId, {
      status: "cancelled",
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
    });
  }

export async function rejectCancellation(db: Db, 
    requestId: string,
    approverId: string,
    userPermissions: string[],
  ) {
    const request = await repo.findRequestById(db, requestId);
    if (!request) throw new NotFoundException("Leave request not found");
    if (request.status !== "pending_cancellation") {
      throw new BadRequestException(
        `Request is not pending cancellation (current: "${request.status}")`,
      );
    }

    await assertCanApproveOrReject(db, request, approverId, userPermissions);

    return repo.updateRequestStatus(db, requestId, {
      status: "approved",
    });
  }

  /**
   * HR-driven manual edit of a single LeaveBalance. Writes a
   * BalanceTransaction (type=`manual_adjustment`) that captures the
   * before/after snapshot and any reason. `amount` carries the change to
   * `used` — the ledger exists to explain how `used` got where it is, and
   * recording the entitled-delta there (as this did) made a manual edit
   * of `used` invisible to any reconciliation. Every other field is in
   * the description.
   */
export async function updateBalance(db: Db, 
    balanceId: string,
    input: UpdateLeaveBalanceInput,
    actorId: string,
  ) {
    const existing = await repo.findLeaveBalanceById(db, balanceId);
    if (!existing) throw new NotFoundException("Leave balance not found");

    const next = {
      entitled: input.entitled ?? Number(existing.entitled),
      used: input.used ?? Number(existing.used),
      carried: input.carried ?? Number(existing.carried),
      carriedUsed: input.carriedUsed ?? Number(existing.carriedUsed),
      adjustment: input.adjustment ?? Number(existing.adjustment),
      // `carriedExpiry` is the only `null`-meaningful field — pass it
      // through explicitly so `undefined` (no change) is distinguishable
      // from `null` (clear the expiry).
      carriedExpiry:
        input.carriedExpiry === undefined
          ? existing.carriedExpiry
          : input.carriedExpiry ?? null,
    };

    const fmtExpiry = (d: string | null) => d ?? "none";
    const before = `entitled=${existing.entitled}, used=${existing.used}, carried=${existing.carried}, carriedUsed=${existing.carriedUsed}, carriedExpiry=${fmtExpiry(existing.carriedExpiry)}, adjustment=${existing.adjustment}`;
    const after = `entitled=${next.entitled}, used=${next.used}, carried=${next.carried}, carriedUsed=${next.carriedUsed}, carriedExpiry=${fmtExpiry(next.carriedExpiry)}, adjustment=${next.adjustment}`;
    const reasonSuffix = input.reason ? ` | Reason: ${input.reason}` : "";

    const updated = await repo.updateLeaveBalanceRow(db, balanceId, {
      entitled: String(next.entitled),
      used: String(next.used),
      carried: String(next.carried),
      carriedUsed: String(next.carriedUsed),
      carriedExpiry: next.carriedExpiry,
      adjustment: String(next.adjustment),
    });

    await repo.createBalanceTransaction(db, {
      employeeId: existing.employeeId,
      leaveTypeId: existing.leaveTypeId,
      year: existing.year,
      type: "manual_adjustment",
      amount: next.used - Number(existing.used),
      description: `Manual adjustment by ${actorId}: before [${before}], after [${after}]${reasonSuffix}`,
    });

    return updated;
  }

  /**
   * Create-or-update a LeaveBalance keyed on (employeeId, leaveTypeId,
   * year). Used when HR edits a synthesized row that hasn't been
   * persisted yet — clicking the pencil on a "from policy default" card
   * calls this. Existing rows fall through to the same write path as
   * `updateBalance` so the audit trail stays consistent.
   */
export async function upsertBalance(db: Db, input: UpsertLeaveBalanceInput, actorId: string) {
    const user = await repo.findUserById(db, input.employeeId);
    if (!user) throw new NotFoundException("Employee not found");

    const type = await repo.findTypeById(db, input.leaveTypeId);
    if (!type) throw new NotFoundException("Leave type not found");
    if (!type.isActive) {
      throw new BadRequestException("Leave type is inactive");
    }
    if (type.entityId !== null && type.entityId !== user.entityId) {
      throw new BadRequestException(
        "Leave type does not apply to this employee's entity",
      );
    }

    const existing = await repo.findBalance(db, 
      user.id,
      type.id,
      input.year,
    );

    if (existing) {
      return updateBalance(db, 
        existing.id,
        {
          entitled: input.entitled,
          used: input.used,
          carried: input.carried,
          carriedUsed: input.carriedUsed,
          carriedExpiry: input.carriedExpiry,
          adjustment: input.adjustment,
          reason: input.reason,
        },
        actorId,
      );
    }

    const created = await repo.createLeaveBalanceRow(db, {
      employeeId: user.id,
      leaveTypeId: type.id,
      year: input.year,
      entitled: input.entitled,
      used: input.used,
      carried: input.carried,
      carriedUsed: input.carriedUsed,
      carriedExpiry: input.carriedExpiry ?? null,
      adjustment: input.adjustment,
    });

    const reasonSuffix = input.reason ? ` | Reason: ${input.reason}` : "";
    await repo.createBalanceTransaction(db, {
      employeeId: user.id,
      leaveTypeId: type.id,
      year: input.year,
      type: "manual_adjustment",
      amount: Math.round(input.entitled),
      description: `HR create by ${actorId}: entitled=${input.entitled}, used=${input.used}, carried=${input.carried}, adjustment=${input.adjustment}${reasonSuffix}`,
    });

    return created;
  }

export async function previewBulkImport(db: Db, rows: BulkImportBalanceRow[]) {
    const leaveTypes = (await repo.findAllTypes(db)).filter(
      (t) => t.isActive,
    );

    const emails = [...new Set(rows.map((r) => r.employeeEmail))];
    const users = await repo.findUsersByEmails(db, emails);
    const userByEmail = new Map(users.map((u) => [u.email, u]));

    const resolveType = (entityId: string | null, code: string) =>
      leaveTypes.find((t) => t.entityId === entityId && t.code === code) ??
      leaveTypes.find((t) => t.entityId === null && t.code === code) ??
      null;

    const preview: Array<{
      row: number;
      employeeEmail: string;
      employeeName: string | null;
      leaveTypeCode: string;
      leaveTypeName: string | null;
      year: number;
      entitled: number | null;
      carried: number;
      adjustment: number;
      used: number;
      errors: string[];
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      const errors: string[] = [];
      const user = userByEmail.get(r.employeeEmail);
      const type = user
        ? resolveType(user.entityId ?? null, r.leaveTypeCode)
        : null;
      if (!user) {
        errors.push(`Employee not found: ${r.employeeEmail}`);
      }
      if (user && !type) {
        errors.push(
          `Leave type not found for ${r.employeeEmail}: ${r.leaveTypeCode}`,
        );
      }

      preview.push({
        row: i + 1,
        employeeEmail: r.employeeEmail,
        employeeName: user?.name ?? null,
        leaveTypeCode: r.leaveTypeCode,
        leaveTypeName: type?.name ?? null,
        year: r.year,
        entitled: r.entitled ?? null,
        carried: r.carried,
        adjustment: r.adjustment,
        used: r.used ?? 0,
        errors,
      });
    }

    const valid = preview.filter((p) => p.errors.length === 0).length;
    const invalid = preview.length - valid;

    return { data: preview, meta: { total: preview.length, valid, invalid } };
  }

export async function commitBulkImport(db: Db, rows: BulkImportBalanceRow[]) {
    const leaveTypes = (await repo.findAllTypes(db)).filter(
      (t) => t.isActive,
    );

    const emails = [...new Set(rows.map((r) => r.employeeEmail))];
    const users = await repo.findUsersByEmails(db, emails);
    const userByEmail = new Map(users.map((u) => [u.email, u]));

    const resolveType = (entityId: string | null, code: string) =>
      leaveTypes.find((t) => t.entityId === entityId && t.code === code) ??
      leaveTypes.find((t) => t.entityId === null && t.code === code) ??
      null;

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const r of rows) {
      const user = userByEmail.get(r.employeeEmail);
      const type = user
        ? resolveType(user.entityId ?? null, r.leaveTypeCode)
        : null;
      if (!user || !type) {
        skipped++;
        continue;
      }

      const existing = await repo.findBalance(db, 
        user.id,
        type.id,
        r.year,
      );
      const usedValue = r.used ?? (existing ? Number(existing.used) : 0);
      // Preserve existing entitled if the import row didn't specify one —
      // a roster that only carries "used" data must NOT wipe the policy.
      const entitledValue =
        r.entitled ?? (existing ? Number(existing.entitled) : 0);
      if (existing) {
        await repo.updateLeaveBalanceRow(db, existing.id, {
            ...(r.entitled !== undefined && { entitled: String(r.entitled) }),
            carried: String(r.carried),
            adjustment: String(r.adjustment),
            ...(r.used !== undefined && { used: String(r.used) }),
          });
        // `amount` is the change to `used` so the ledger can explain the
        // balance card; the description carries every other field.
        await repo.createBalanceTransaction(db, {
          employeeId: user.id,
          leaveTypeId: type.id,
          year: r.year,
          type: "bulk_import",
          amount: usedValue - Number(existing.used),
          description: `Bulk import update: entitled=${entitledValue}, used=${usedValue}, carried=${r.carried}, adj=${r.adjustment}`,
        });
        updated++;
      } else {
        await repo.createLeaveBalanceRow(db, {
            employeeId: user.id,
            leaveTypeId: type.id,
            year: r.year,
            entitled: entitledValue,
            carried: r.carried,
            carriedUsed: 0,
            carriedExpiry: null,
            adjustment: r.adjustment,
            used: usedValue,
          });
        await repo.createBalanceTransaction(db, {
          employeeId: user.id,
          leaveTypeId: type.id,
          year: r.year,
          type: "bulk_import",
          amount: usedValue,
          description: `Bulk import: entitled=${entitledValue}, used=${usedValue}, carried=${r.carried}, adj=${r.adjustment}`,
        });
        created++;
      }
    }

    return { data: { created, updated, skipped } };
  }

  // ── Soft delete ──

export async function removeRequest(db: Db, id: string, actorId: string, permissions: string[]) {
    const existing = await repo.findRequestById(db, id);
    if (!existing) throw new NotFoundException("Leave request not found");

    const isHr = permissions.includes(PERMISSIONS.LEAVE_HR_READ);
    if (!isHr && existing.employeeId !== actorId) {
      throw new ForbiddenException(
        "You can only delete your own leave requests",
      );
    }
    if (!isHr) {
      const DELETABLE = new Set(["draft", "pending", "cancelled", "rejected"]);
      if (!DELETABLE.has(existing.status)) {
        throw new BadRequestException(
          `Cannot delete a request with status "${existing.status}". Approved requests are retained for audit.`,
        );
      }
    }

    // HR can delete an approved request, and the list query filters on
    // deletedAt — so without this the row vanishes from the employee's
    // history while its days stay charged against the balance forever.
    // That silent drift is exactly what makes the balance card disagree
    // with "My requests".
    await refundLeaveBalance(db, existing, "deletion");

    return repo.softDeleteRequest(db, id);
  }

export async function restoreRequest(db: Db, id: string, actorId: string, permissions: string[]) {
    // findRequestById hides soft-deleted rows; a hit means it's still active.
    const active = await repo.findRequestById(db, id);
    if (active) throw new ConflictException("Request is not deleted");

    const existing = await repo.findRequestByIdIncludingDeleted(db, id);
    if (!existing) throw new NotFoundException("Leave request not found");

    const isHr = permissions.includes(PERMISSIONS.LEAVE_HR_READ);
    if (!isHr && existing.employeeId !== actorId) {
      throw new ForbiddenException(
        "You can only restore your own leave requests",
      );
    }

    // Bringing an approved request back into the employee's history has
    // to re-charge the days that removeRequest refunded, or the restore
    // hands out free leave. Deduct before restoring: if the balance
    // write fails, the row stays deleted and the two remain consistent.
    if (existing.status === "approved") {
      await deductLeaveBalance(db, existing);
    }

    return repo.restoreRequest(db, id);
  }

export async function permanentDeleteRequest(db: Db, id: string) {
    // Include deleted rows — the normal flow is soft-delete first, and
    // findRequestById hides those, so the old lookup 404'd on exactly
    // the rows this route exists to purge.
    const existing = await repo.findRequestByIdIncludingDeleted(db, id);
    if (!existing) {
      throw new NotFoundException("Leave request not found");
    }
    // Hard-deleting the row destroys the only record of why the days
    // were charged, so give them back first. No-ops when the soft-delete
    // already refunded them.
    await refundLeaveBalance(db, existing, "deletion");
    return repo.permanentDeleteRequest(db, id);
  }
