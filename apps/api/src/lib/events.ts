import { prisma } from "@/infrastructure/database/prisma";
import { tracking } from "@/lib/tracking";

/**
 * Central registry of every event name + a typed wrapper per event.
 *
 * Shared event contracts for server-side tracking. Every track call
 * MUST go through one of these wrappers — no raw event-name strings.
 *
 * Each wrapper takes `actor` (the user the event is attributed to) so the
 * chokepoint can stamp `groups: { entity: ... }` automatically.
 */

export const EVENTS = {
  USER_CREATED: "user.created",
  USER_DEACTIVATED: "user.deactivated",

  LEAVE_REQUEST_SUBMITTED: "leave_request.submitted",
  LEAVE_REQUEST_APPROVED: "leave_request.approved",
  LEAVE_REQUEST_REJECTED: "leave_request.rejected",

  EXPENSE_SUBMITTED: "expense.submitted",
  EXPENSE_APPROVED: "expense.approved",

  TRAVEL_REQUEST_SUBMITTED: "travel_request.submitted",
  TRAVEL_REQUEST_APPROVED: "travel_request.approved",

  PAYROLL_RUN_STARTED: "payroll.run_started",
  PAYROLL_RUN_COMPLETED: "payroll.run_completed",
  PAYROLL_IMPORTED: "payroll.imported",

  AGREEMENT_UPLOADED: "agreement.uploaded",
  AGREEMENT_DOWNLOADED: "agreement.downloaded",

  PROJECT_CREATED: "project.created",
  TASK_CREATED: "task.created",
  TASK_STATUS_CHANGED: "task.status_changed",

  LEAD_CREATED: "lead.created",
  LEAD_CONVERTED: "lead.converted",
  DEAL_CREATED: "deal.created",
  DEAL_STAGE_CHANGED: "deal.stage_changed",
  DEAL_WON: "deal.won",
  DEAL_LOST: "deal.lost",

  PARTNER_CREATED: "partner.created",
  PARTNER_NOTE_ADDED: "partner.note_added",

  SURVEY_RESPONSE_SUBMITTED: "survey_response.submitted",

  COURSE_COMPLETED: "course.completed",

  VISA_REQUEST_SUBMITTED: "visa_request.submitted",
  BENEFIT_ENROLLED: "benefit.enrolled",
  APPLICATION_RECEIVED: "application.received",

  DOCUMENT_VIEWED: "document.viewed",
  DOCUMENT_DOWNLOADED: "document.downloaded",

  ROLE_ASSIGNED: "role.assigned",
  ROLE_REVOKED: "role.revoked",
  PROFILE_UPDATED: "profile.updated",
  INTEGRATION_CONNECTED: "integration.connected",

  FORM_VALIDATION_FAILED: "form.validation_failed",
  PERMISSION_DENIED: "permission.denied",
} as const;

export interface Actor {
  id: string;
  entityId: string | null;
}

/**
 * Resolve an Actor from just an actor id. Use this from service methods
 * that receive `actorId?: string` and need to fire a tracking call. Adds
 * one tiny `SELECT entity_id FROM users` per event. Returns null if no
 * id was supplied so callers can early-return without a try/catch.
 */
export async function actorFromId(
  actorId: string | undefined,
): Promise<Actor | null> {
  if (!actorId) return null;
  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { entityId: true },
  });
  return { id: actorId, entityId: user?.entityId ?? null };
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

export const trackUserCreated = (
  actor: Actor,
  props: {
    target_user_id: string;
    target_entity_code: "TH" | "IN" | "VN" | "ID";
    is_employee_only: boolean;
  },
) => tracking.capture(actor.id, EVENTS.USER_CREATED, props, actor.entityId);

export const trackUserDeactivated = (
  actor: Actor,
  props: { target_user_id: string },
) => tracking.capture(actor.id, EVENTS.USER_DEACTIVATED, props, actor.entityId);

// ─── Leave ─────────────────────────────────────────────────────────────────

export const trackLeaveRequestSubmittedServer = (
  actor: Actor,
  props: { leave_type_code: string; days: number; is_self: boolean },
) =>
  tracking.capture(
    actor.id,
    EVENTS.LEAVE_REQUEST_SUBMITTED,
    props,
    actor.entityId,
  );

export const trackLeaveRequestApproved = (
  actor: Actor,
  props: { leave_request_id: string; approver_role?: string },
) =>
  tracking.capture(
    actor.id,
    EVENTS.LEAVE_REQUEST_APPROVED,
    props,
    actor.entityId,
  );

export const trackLeaveRequestRejected = (
  actor: Actor,
  props: { leave_request_id: string },
) =>
  tracking.capture(
    actor.id,
    EVENTS.LEAVE_REQUEST_REJECTED,
    props,
    actor.entityId,
  );

// ─── Expenses ──────────────────────────────────────────────────────────────

export const trackExpenseSubmittedServer = (
  actor: Actor,
  props: { amount_thb: number; category: string; has_receipt: boolean },
) =>
  tracking.capture(actor.id, EVENTS.EXPENSE_SUBMITTED, props, actor.entityId);

export const trackExpenseApproved = (actor: Actor) =>
  tracking.capture(actor.id, EVENTS.EXPENSE_APPROVED, {}, actor.entityId);

// ─── Travel ────────────────────────────────────────────────────────────────

export const trackTravelRequestSubmittedServer = (
  actor: Actor,
  props: {
    trip_type: "domestic" | "international";
    destination_country?: string;
    estimated_cost_thb?: number;
  },
) =>
  tracking.capture(
    actor.id,
    EVENTS.TRAVEL_REQUEST_SUBMITTED,
    props,
    actor.entityId,
  );

export const trackTravelRequestApproved = (actor: Actor) =>
  tracking.capture(
    actor.id,
    EVENTS.TRAVEL_REQUEST_APPROVED,
    {},
    actor.entityId,
  );

// ─── Payroll ───────────────────────────────────────────────────────────────

export const trackPayrollRunStarted = (
  actor: Actor,
  props: { period: string; target_entity_code: "TH" | "IN" | "VN" | "ID" },
) =>
  tracking.capture(actor.id, EVENTS.PAYROLL_RUN_STARTED, props, actor.entityId);

export const trackPayrollRunCompleted = (
  actor: Actor,
  props: {
    period: string;
    target_entity_code: string;
    employee_count: number;
  },
) =>
  tracking.capture(
    actor.id,
    EVENTS.PAYROLL_RUN_COMPLETED,
    props,
    actor.entityId,
  );

export const trackPayrollImportedServer = (
  actor: Actor,
  props: { row_count: number; error_count: number },
) => tracking.capture(actor.id, EVENTS.PAYROLL_IMPORTED, props, actor.entityId);

// ─── HRMS ──────────────────────────────────────────────────────────────────

export const trackAgreementUploadedServer = (
  actor: Actor,
  props: { agreement_type?: string },
) =>
  tracking.capture(actor.id, EVENTS.AGREEMENT_UPLOADED, props, actor.entityId);

export const trackAgreementDownloaded = (
  actor: Actor,
  props: { agreement_id: string },
) =>
  tracking.capture(
    actor.id,
    EVENTS.AGREEMENT_DOWNLOADED,
    props,
    actor.entityId,
  );

// ─── Projects ──────────────────────────────────────────────────────────────

export const trackProjectCreatedServer = (actor: Actor) =>
  tracking.capture(actor.id, EVENTS.PROJECT_CREATED, {}, actor.entityId);

export const trackTaskCreatedServer = (
  actor: Actor,
  props: { project_id: string },
) => tracking.capture(actor.id, EVENTS.TASK_CREATED, props, actor.entityId);

export const trackTaskStatusChangedServer = (
  actor: Actor,
  props: { task_id: string; from_status: string; to_status: string },
) =>
  tracking.capture(actor.id, EVENTS.TASK_STATUS_CHANGED, props, actor.entityId);

// ─── Sales CRM ─────────────────────────────────────────────────────────────

export const trackLeadCreatedServer = (
  actor: Actor,
  props: { source_code?: string },
) => tracking.capture(actor.id, EVENTS.LEAD_CREATED, props, actor.entityId);

export const trackLeadConverted = (actor: Actor, props: { deal_id: string }) =>
  tracking.capture(actor.id, EVENTS.LEAD_CONVERTED, props, actor.entityId);

export const trackDealCreatedServer = (
  actor: Actor,
  props: { amount_thb?: number; stage: string },
) => tracking.capture(actor.id, EVENTS.DEAL_CREATED, props, actor.entityId);

export const trackDealStageChangedServer = (
  actor: Actor,
  props: { deal_id: string; from_stage: string; to_stage: string },
) =>
  tracking.capture(actor.id, EVENTS.DEAL_STAGE_CHANGED, props, actor.entityId);

export const trackDealWon = (
  actor: Actor,
  props: { deal_id: string; amount_thb?: number },
) => tracking.capture(actor.id, EVENTS.DEAL_WON, props, actor.entityId);

export const trackDealLost = (
  actor: Actor,
  props: { deal_id: string; lost_reason_code?: string },
) => tracking.capture(actor.id, EVENTS.DEAL_LOST, props, actor.entityId);

// ─── Partner CRM ───────────────────────────────────────────────────────────

export const trackPartnerCreatedServer = (actor: Actor) =>
  tracking.capture(actor.id, EVENTS.PARTNER_CREATED, {}, actor.entityId);

export const trackPartnerNoteAddedServer = (
  actor: Actor,
  props: { partner_id: string },
) =>
  tracking.capture(actor.id, EVENTS.PARTNER_NOTE_ADDED, props, actor.entityId);

// ─── Survey / Learning / Visa / Benefits / Careers ─────────────────────────

export const trackSurveyResponseSubmittedServer = (
  actor: Actor,
  props: { survey_id: string; completion_seconds?: number },
) =>
  tracking.capture(
    actor.id,
    EVENTS.SURVEY_RESPONSE_SUBMITTED,
    props,
    actor.entityId,
  );

export const trackCourseCompletedServer = (
  actor: Actor,
  props: { course_id: string; completion_seconds?: number },
) => tracking.capture(actor.id, EVENTS.COURSE_COMPLETED, props, actor.entityId);

export const trackVisaRequestSubmittedServer = (
  actor: Actor,
  props: { visa_type?: string },
) =>
  tracking.capture(
    actor.id,
    EVENTS.VISA_REQUEST_SUBMITTED,
    props,
    actor.entityId,
  );

export const trackBenefitEnrolledServer = (
  actor: Actor,
  props: { benefit_id: string },
) => tracking.capture(actor.id, EVENTS.BENEFIT_ENROLLED, props, actor.entityId);

export const trackApplicationReceived = (
  actor: Actor,
  props: { posting_id: string },
) =>
  tracking.capture(
    actor.id,
    EVENTS.APPLICATION_RECEIVED,
    props,
    actor.entityId,
  );

// ─── Documents ─────────────────────────────────────────────────────────────

export const trackDocumentViewedServer = (
  actor: Actor,
  props: {
    document_id: string;
    document_kind: "legal" | "dataroom" | "hrms_agreement" | "payroll_slip";
  },
) => tracking.capture(actor.id, EVENTS.DOCUMENT_VIEWED, props, actor.entityId);

export const trackDocumentDownloadedServer = (
  actor: Actor,
  props: { document_id: string; document_kind: string },
) =>
  tracking.capture(actor.id, EVENTS.DOCUMENT_DOWNLOADED, props, actor.entityId);

// ─── Configuration ─────────────────────────────────────────────────────────

export const trackRoleAssigned = (
  actor: Actor,
  props: { target_user_id: string; role_name: string },
) => tracking.capture(actor.id, EVENTS.ROLE_ASSIGNED, props, actor.entityId);

export const trackRoleRevoked = (
  actor: Actor,
  props: { target_user_id: string; role_name: string },
) => tracking.capture(actor.id, EVENTS.ROLE_REVOKED, props, actor.entityId);

export const trackProfileUpdatedServer = (
  actor: Actor,
  props: { fields_changed: string },
) => tracking.capture(actor.id, EVENTS.PROFILE_UPDATED, props, actor.entityId);

export const trackIntegrationConnectedServer = (
  actor: Actor,
  props: {
    provider:
      "gmail" | "google_calendar" | "slack" | "workers_ai" | "ai_gateway";
  },
) =>
  tracking.capture(
    actor.id,
    EVENTS.INTEGRATION_CONNECTED,
    props,
    actor.entityId,
  );

// ─── Errors ────────────────────────────────────────────────────────────────

export const trackFormValidationFailed = (
  actor: Actor,
  props: { form: string; field_count: number },
) =>
  tracking.capture(
    actor.id,
    EVENTS.FORM_VALIDATION_FAILED,
    props,
    actor.entityId,
  );

export const trackPermissionDenied = (
  actor: Actor,
  props: { permission: string; route?: string },
) =>
  tracking.capture(actor.id, EVENTS.PERMISSION_DENIED, props, actor.entityId);
