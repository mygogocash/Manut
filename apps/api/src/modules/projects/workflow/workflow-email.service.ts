import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { deliverEmail } from "@/infrastructure/email/email.service";
import {
  projectApprovalRequestEmail,
  projectWorkflowDecisionEmail,
} from "@/infrastructure/email/templates";
import { chainService } from "@/modules/approval-chains/chain.service";
import {
  isApproved,
  STAGE_PERMISSION,
  WORKFLOW_STATUS,
  WORKFLOW_STATUS_LABELS,
  type WorkflowStatus,
} from "@/modules/projects/workflow/workflow.types";
import { getDefaultApprover } from "@/modules/projects/workflow/workflow-settings";
import { issueActionToken } from "@/modules/projects/workflow/workflow-token";

// Email-driven approval notifications.
//
// Guarantees:
//  - EXACTLY ONCE per (transition, recipient, kind). The unique
//    `idempotencyKey` row is CLAIMED before any send is attempted, so a
//    replayed or concurrent trigger loses the race and skips.
//  - EVERY attempt is logged, including failures and attempt counts.
//  - Transient failures are retried with exponential backoff; permanent ones
//    (bad request, service not configured) are not.
//  - Delivery never affects the workflow: this is invoked after the transition
//    has already committed and every path is caught.

const PORTAL_URL = (
  process.env.PORTAL_URL ?? "https://manut.xyz"
).replace(/\/+$/, "");
const API_URL = (process.env.PUBLIC_API_URL ?? PORTAL_URL).replace(/\/+$/, "");

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

interface ProjectContext {
  id: string;
  name: string;
  priority: string | null;
  ownerId: string;
  ownerName: string;
  ownerEmail: string | null;
}

export class WorkflowEmailService {
  private deepLink(projectId: string): string {
    return `${PORTAL_URL}/projects/requests/${projectId}`;
  }

  private priorityLabel(priority: string | null): string {
    return PRIORITY_LABELS[priority ?? "normal"] ?? "Normal";
  }

  /** Active users whose roles grant the stage permission. */
  /**
   * Who to notify that a request is waiting.
   *
   * Three sources, in priority order:
   *   1. `pending_escalation` — the one person the PM named. Authority here is
   *      not a permission, so neither is the notification.
   *   2. `pending_pm_approval` — the admin-configured recipient, if set. This is
   *      the "requests go to this person" setting; without it every
   *      workflow:pm-approve holder would be mailed on every request.
   *   3. Otherwise, holders of the stage permission, falling back to system
   *      Admins so a request never stalls with nobody notified.
   */
  private async approversFor(
    stage: WorkflowStatus,
    escalatedToId?: string | null,
    projectId?: string,
  ) {
    if (stage === WORKFLOW_STATUS.PENDING_ESCALATION) {
      if (!escalatedToId) {
        logger.warn("Escalated request has no target to notify");
        return [];
      }
      const target = await prisma.user.findUnique({
        where: { id: escalatedToId },
        select: { id: true, name: true, email: true, isActive: true },
      });
      if (!target?.isActive) {
        logger.warn("Escalation target is missing or inactive", {
          escalatedToId,
        });
        return [];
      }
      const { id, name, email } = target;
      return [{ id, name, email }];
    }

    // The chain decides who may settle a stage (`chainService.canDecide`, which
    // `workflowService.act` enforces), so it must also decide who gets told.
    // Resolving recipients any other way emails people the chain will refuse
    // and never reaches the one person who can act. Same call the proposals
    // module already makes.
    if (projectId) {
      const current = await chainService.currentApprovers({ projectId });
      if (current.length > 0) return current;
    }

    if (stage === WORKFLOW_STATUS.PENDING_PM_APPROVAL) {
      const configured = await getDefaultApprover();
      if (configured) return [configured];
    }

    const code = STAGE_PERMISSION[stage];
    if (!code) return [];

    const byPermission = await prisma.user.findMany({
      where: {
        isActive: true,
        email: { not: { endsWith: "@placeholder.local" } },
        userRoles: {
          some: {
            role: {
              deletedAt: null,
              rolePermissions: { some: { permissionCode: code } },
            },
          },
        },
      },
      select: { id: true, name: true, email: true },
      take: 25,
    });
    if (byPermission.length > 0) return byPermission;

    // Nobody holds the code explicitly. Fall back to the system Admin role so
    // a request never stalls silently with no one notified.
    logger.warn("No explicit holder for workflow stage permission", {
      stage,
      code,
    });
    return prisma.user.findMany({
      where: {
        isActive: true,
        email: { not: { endsWith: "@placeholder.local" } },
        userRoles: {
          some: { role: { isSystem: true, name: "Admin", deletedAt: null } },
        },
      },
      select: { id: true, name: true, email: true },
      take: 10,
    });
  }

  private async loadProject(projectId: string): Promise<ProjectContext | null> {
    const p = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        priority: true,
        ownerId: true,
        owner: { select: { name: true, email: true } },
      },
    });
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      priority: p.priority,
      ownerId: p.ownerId,
      ownerName: p.owner?.name ?? "Unknown",
      ownerEmail: p.owner?.email ?? null,
    };
  }

  /**
   * Claims the idempotency key, then delivers with retry, then records the
   * outcome. Returns true when this call actually delivered.
   */
  private async dispatch(input: {
    projectId: string;
    transitionId: string | null;
    stage: string;
    kind: string;
    recipient: string;
    subject: string;
    templateId: string;
    variables: Record<string, string | number | boolean | null | undefined>;
    html: string;
  }): Promise<boolean> {
    const idempotencyKey = [
      input.projectId,
      input.transitionId ?? "none",
      input.kind,
      input.recipient.toLowerCase(),
    ].join(":");

    // Claim first. A unique-constraint violation means someone already owns
    // this notification — skip without sending.
    let logRow;
    try {
      logRow = await prisma.projectWorkflowEmail.create({
        data: {
          projectId: input.projectId,
          transitionId: input.transitionId,
          stage: input.stage,
          kind: input.kind,
          recipient: input.recipient,
          subject: input.subject,
          status: "pending",
          idempotencyKey,
        },
      });
    } catch {
      logger.info("Workflow email skipped (already dispatched)", {
        idempotencyKey,
      });
      return false;
    }

    let lastError = "unknown error";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const result = await deliverEmail({
        to: input.recipient,
        templateId: input.templateId,
        variables: input.variables,
        subject: input.subject,
        html: input.html,
      });

      if (result.ok) {
        await prisma.projectWorkflowEmail.update({
          where: { id: logRow.id },
          data: { status: "sent", attempts: attempt, sentAt: new Date() },
        });
        return true;
      }

      lastError = result.error ?? "unknown error";
      // Only transient failures are worth another attempt.
      if (!result.retryable || attempt === MAX_ATTEMPTS) break;
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }

    await prisma.projectWorkflowEmail.update({
      where: { id: logRow.id },
      data: { status: "failed", attempts: MAX_ATTEMPTS, error: lastError },
    });
    logger.error("Workflow email failed after retries", {
      idempotencyKey,
      error: lastError,
    });
    return false;
  }

  /**
   * Fan-out for a committed transition. Never throws — a mail problem must
   * never roll back or block an approval that already happened.
   */
  /**
   * Who a transition notifies, as user ids.
   *
   * Extracted so Web Push can reach the SAME people as email without restating
   * the rule. The rule itself is unchanged and lives in one place:
   *
   *   - rejected / completed  -> the requester (the project owner)
   *   - any other stage       -> whoever must act next (`approversFor`, which
   *                              defers to the approval chain)
   *
   * Returning ids rather than addresses keeps it channel-agnostic: push has no
   * use for an email address, and an id is what `pushService` takes.
   */
  async transitionRecipientIds(input: {
    projectId: string;
    toStatus: WorkflowStatus;
    escalatedToId?: string | null;
  }): Promise<string[]> {
    const project = await this.loadProject(input.projectId);
    if (!project) return [];

    if (
      input.toStatus === WORKFLOW_STATUS.REJECTED ||
      input.toStatus === WORKFLOW_STATUS.COMPLETED
    ) {
      return project.ownerId ? [project.ownerId] : [];
    }

    const approvers = await this.approversFor(
      input.toStatus,
      input.escalatedToId,
      project.id,
    );
    return approvers.map((a) => a.id).filter(Boolean);
  }

  async onTransition(input: {
    projectId: string;
    transitionId: string;
    fromStatus: WorkflowStatus;
    toStatus: WorkflowStatus;
    actorName: string;
    comment: string | null;
    /** Set when toStatus is `pending_escalation`: who the PM named. */
    escalatedToId?: string | null;
  }): Promise<void> {
    try {
      const project = await this.loadProject(input.projectId);
      if (!project) return;

      const deepLink = this.deepLink(project.id);
      const priority = this.priorityLabel(project.priority);
      const statusLabel = WORKFLOW_STATUS_LABELS[input.toStatus];

      // 1. Rejected / Completed -> notify the requester (project owner).
      if (
        input.toStatus === WORKFLOW_STATUS.REJECTED ||
        input.toStatus === WORKFLOW_STATUS.COMPLETED
      ) {
        if (project.ownerEmail) {
          const mail = projectWorkflowDecisionEmail({
            recipientName: project.ownerName,
            projectName: project.name,
            requesterName: project.ownerName,
            priority,
            status: statusLabel,
            decidedBy: input.actorName,
            approved: input.toStatus === WORKFLOW_STATUS.COMPLETED,
            comment: input.comment,
            deepLink,
          });
          await this.dispatch({
            projectId: project.id,
            transitionId: input.transitionId,
            stage: input.toStatus,
            kind: "decision_notice",
            recipient: project.ownerEmail,
            subject: mail.subject,
            templateId: mail.templateId,
            variables: mail.variables,
            html: mail.html,
          });
        }
        return;
      }

      // 2. Any other stage -> notify whoever must act next.
      const approvers = await this.approversFor(
        input.toStatus,
        input.escalatedToId,
        project.id,
      );
      for (const approver of approvers) {
        if (!approver.email) continue;

        // One-click approve, scoped to this approver + this exact stage.
        const action = isApproved(input.toStatus) ? "complete" : "approve";
        const token = issueActionToken({
          projectId: project.id,
          userId: approver.id,
          action,
          stage: input.toStatus,
        });
        const approveLink = token
          ? `${API_URL}/api/project-workflow/email-action?token=${encodeURIComponent(token)}`
          : null;

        const mail = projectApprovalRequestEmail({
          approverName: approver.name,
          projectName: project.name,
          requesterName: project.ownerName,
          priority,
          status: statusLabel,
          comment: input.comment,
          deepLink,
          approveLink,
          rejectLink: approveLink ? deepLink : null,
        });

        await this.dispatch({
          projectId: project.id,
          transitionId: input.transitionId,
          stage: input.toStatus,
          kind: "approval_request",
          recipient: approver.email,
          subject: mail.subject,
          templateId: mail.templateId,
          variables: mail.variables,
          html: mail.html,
        });
      }
    } catch (err) {
      logger.error("Workflow email fan-out failed (transition unaffected)", {
        projectId: input.projectId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Delivery log for a project (newest first). */
  async listForProject(projectId: string) {
    const rows = await prisma.projectWorkflowEmail.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      stage: r.stage,
      kind: r.kind,
      recipient: r.recipient,
      subject: r.subject,
      status: r.status,
      attempts: r.attempts,
      error: r.error,
      at: (r.sentAt ?? r.createdAt).toISOString(),
    }));
  }

  /** Re-attempts previously failed emails. Safe: only touches `failed` rows. */
  async retryFailed(
    projectId?: string,
  ): Promise<{ retried: number; sent: number }> {
    const failed = await prisma.projectWorkflowEmail.findMany({
      where: { status: "failed", ...(projectId ? { projectId } : {}) },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    let sent = 0;
    for (const row of failed) {
      const result = await deliverEmail({
        to: row.recipient,
        templateId: row.kind,
        variables: { projectId: row.projectId, subject: row.subject },
        subject: row.subject,
      });
      if (result.ok) {
        await prisma.projectWorkflowEmail.update({
          where: { id: row.id },
          data: {
            status: "sent",
            attempts: row.attempts + 1,
            sentAt: new Date(),
            error: null,
          },
        });
        sent++;
      } else {
        await prisma.projectWorkflowEmail.update({
          where: { id: row.id },
          data: {
            attempts: row.attempts + 1,
            error: result.error ?? "unknown error",
          },
        });
      }
    }
    return { retried: failed.length, sent };
  }
}

export const workflowEmailService = new WorkflowEmailService();
