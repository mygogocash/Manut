import { PERMISSIONS } from "@/common/constants/permissions";
import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { deliverEmail } from "@/infrastructure/email/email.service";
import {
  proposalActionEmail,
  proposalUpdateEmail,
} from "@/infrastructure/email/templates";
import { chainService } from "@/modules/approval-chains/chain.service";
import { CHAIN_SCOPE } from "@/modules/approval-chains/chain.types";
import {
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_TYPE_LABELS,
  type ProposalStatus,
  type ProposalType,
} from "@/modules/proposals/proposal.types";

// Proposal notifications.
//
// Same delivery contract as the project workflow: claim a UNIQUE idempotency key
// BEFORE sending, retry only transient failures, log every attempt. The database
// constraint is what prevents a duplicate, not an application check, because a
// check loses under concurrency.
//
// Everything here is best effort and called AFTER the decision has committed. A
// mail outage must never roll back an approval that already happened, so failures
// are recorded and swallowed.

const PORTAL_URL = (
  process.env.PORTAL_URL ?? "https://intranet.thebinaryholdings.com"
).replace(/\/+$/, "");

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

interface Recipient {
  id: string;
  name: string;
  email: string;
}

/** The events a proposal can raise. Part of the idempotency key. */
export const PROPOSAL_EMAIL_KIND = {
  SUBMITTED: "submitted",
  QUESTION_ASKED: "question_asked",
  ANSWER_RECEIVED: "answer_received",
  DECISION: "decision",
} as const;
export type ProposalEmailKind =
  (typeof PROPOSAL_EMAIL_KIND)[keyof typeof PROPOSAL_EMAIL_KIND];

export class ProposalEmailService {
  private deepLink(proposalId: string): string {
    return `${PORTAL_URL}/projects/proposals/${proposalId}`;
  }

  private priorityLabel(priority: string | null): string {
    return PRIORITY_LABELS[priority ?? "normal"] ?? "Normal";
  }

  private typeLabel(type: string): string {
    return PROPOSAL_TYPE_LABELS[type as ProposalType] ?? "Proposal";
  }

  private async user(id: string | null): Promise<Recipient | null> {
    if (!id) return null;
    const u = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, isActive: true },
    });
    if (!u?.isActive) return null;
    // Seeded placeholder accounts have unroutable addresses.
    if (u.email.endsWith("@placeholder.local")) return null;
    return { id: u.id, name: u.name, email: u.email };
  }

  /**
   * Holders of a permission code, as the fallback when a configured slot is
   * empty. Capped, and falling back again to system Admins so a proposal never
   * sits with nobody notified.
   */
  private async holdersOf(code: string): Promise<Recipient[]> {
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

    logger.warn("No explicit holder for a proposal permission", { code });
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

  /**
   * Whoever owns the FIRST stage of the configured chain.
   *
   * This is the standing CC: the person who sees a proposal first stays in the
   * loop for everything that happens to it afterwards. Falls back to the old
   * review-code holders when no chain is configured, so notification never goes
   * silent on a proposal raised before chains.
   */
  private async firstReviewers(): Promise<Recipient[]> {
    const chain = await chainService.getChain(CHAIN_SCOPE.PROPOSAL);
    const first = chain?.steps.find((step) => step.isActive);
    if (first?.approver) return [first.approver];
    return this.holdersOf(PERMISSIONS.PROPOSALS_REVIEW);
  }

  /**
   * Whoever owes the decision this proposal is now waiting on.
   *
   * Read from the record's SNAPSHOT rather than the chain, so a proposal in
   * flight notifies the person it was actually routed to even if an admin has
   * since rewritten the chain.
   */
  private async pendingApprovers(proposalId: string): Promise<Recipient[]> {
    const approvers = await chainService.currentApprovers({ proposalId });
    if (approvers.length > 0) return approvers;
    return this.holdersOf(PERMISSIONS.PROPOSALS_APPROVE);
  }

  /**
   * The recipient list for one notification, with the first reviewer always
   * included.
   *
   * The first reviewer stays in the loop end to end by explicit request: they own
   * the flow, so they see every submission, every question, every answer and
   * every decision. Implemented as ONE rule here rather than as a special case at
   * each call site, so a new notification cannot forget to copy them.
   *
   * De-duplicated by email, because the reviewer is frequently also the direct
   * recipient and nobody should get the same message twice.
   */
  private async withReviewerCopied(primary: Recipient[]): Promise<Recipient[]> {
    const reviewers = await this.firstReviewers();
    const seen = new Set<string>();
    const out: Recipient[] = [];
    for (const r of [...primary, ...reviewers]) {
      const key = r.email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }

  /**
   * Send one message, exactly once.
   *
   * The key is claimed before delivery is attempted. A unique-constraint
   * violation means another process already owns this notification, so this one
   * returns without sending rather than racing it.
   */
  private async dispatch(input: {
    proposalId: string;
    kind: ProposalEmailKind;
    /** Distinguishes two notifications of the same kind, e.g. per question. */
    scope: string;
    stage: string;
    recipient: Recipient;
    subject: string;
    templateId: string;
    variables: Record<string, string | number | boolean | null | undefined>;
    html: string;
  }): Promise<boolean> {
    const idempotencyKey = [
      input.proposalId,
      input.kind,
      input.scope,
      input.recipient.email.toLowerCase(),
    ].join(":");

    let logRow;
    try {
      logRow = await prisma.proposalEmail.create({
        data: {
          proposalId: input.proposalId,
          kind: input.kind,
          stage: input.stage,
          recipient: input.recipient.email,
          subject: input.subject,
          status: "pending",
          idempotencyKey,
        },
      });
    } catch {
      logger.info("Proposal email skipped (already dispatched)", {
        idempotencyKey,
      });
      return false;
    }

    let lastError = "unknown error";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const result = await deliverEmail({
        to: input.recipient.email,
        templateId: input.templateId,
        variables: input.variables,
        subject: input.subject,
        html: input.html,
      });

      if (result.ok) {
        await prisma.proposalEmail.update({
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

    await prisma.proposalEmail.update({
      where: { id: logRow.id },
      data: { status: "failed", attempts: MAX_ATTEMPTS, error: lastError },
    });
    logger.error("Proposal email failed after retries", {
      idempotencyKey,
      error: lastError,
    });
    return false;
  }

  private async loadProposal(proposalId: string) {
    const p = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        id: true,
        title: true,
        type: true,
        priority: true,
        status: true,
        raisedById: true,
      },
    });
    if (!p) return null;
    const raisedBy = await this.user(p.raisedById);
    return { ...p, raisedByName: raisedBy?.name ?? "Unknown", raisedBy };
  }

  /** A proposal has been raised. Goes to the first reviewer. */
  async onSubmitted(proposalId: string): Promise<void> {
    try {
      const p = await this.loadProposal(proposalId);
      if (!p) return;

      // The reviewer IS the primary recipient here, so the CC rule collapses to
      // one message rather than two.
      const recipients = await this.withReviewerCopied([]);
      const status = p.status as ProposalStatus;

      for (const recipient of recipients) {
        const mail = proposalActionEmail({
          recipientName: recipient.name,
          headline: "New proposal for review",
          proposalTitle: p.title,
          proposalType: this.typeLabel(p.type),
          raisedBy: p.raisedByName,
          priority: this.priorityLabel(p.priority),
          status: PROPOSAL_STATUS_LABELS[status] ?? p.status,
          deepLink: this.deepLink(p.id),
          callToAction: "Review Proposal",
        });
        await this.dispatch({
          proposalId: p.id,
          kind: PROPOSAL_EMAIL_KIND.SUBMITTED,
          scope: "new",
          stage: p.status,
          recipient,
          ...mail,
        });
      }
    } catch (err) {
      logger.error("Proposal submission email failed (proposal unaffected)", {
        proposalId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Questions have been asked. Each assignee is mailed about their own question,
   * and the first reviewer is copied.
   *
   * `scope` is the question id, so asking two people creates two distinct keys
   * and asking again later is a new notification rather than a suppressed
   * duplicate.
   */
  async onQuestionsAsked(
    proposalId: string,
    questions: Array<{ id: string; assignedToId: string; question: string }>,
  ): Promise<void> {
    try {
      const p = await this.loadProposal(proposalId);
      if (!p) return;
      const status = p.status as ProposalStatus;

      for (const q of questions) {
        const assignee = await this.user(q.assignedToId);
        const recipients = await this.withReviewerCopied(
          assignee ? [assignee] : [],
        );

        for (const recipient of recipients) {
          const isAssignee = recipient.id === q.assignedToId;
          const mail = proposalActionEmail({
            recipientName: recipient.name,
            headline: isAssignee
              ? "Information needed on a proposal"
              : "Information requested on a proposal",
            proposalTitle: p.title,
            proposalType: this.typeLabel(p.type),
            raisedBy: p.raisedByName,
            priority: this.priorityLabel(p.priority),
            status: PROPOSAL_STATUS_LABELS[status] ?? p.status,
            question: q.question,
            deepLink: this.deepLink(p.id),
            callToAction: isAssignee ? "Provide Information" : "View Proposal",
          });
          await this.dispatch({
            proposalId: p.id,
            kind: PROPOSAL_EMAIL_KIND.QUESTION_ASKED,
            scope: q.id,
            stage: p.status,
            recipient,
            ...mail,
          });
        }
      }
    } catch (err) {
      logger.error("Proposal question email failed (questions unaffected)", {
        proposalId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** An answer has arrived. Goes to whoever asked, reviewer copied. */
  async onAnswerReceived(
    proposalId: string,
    question: {
      id: string;
      askedById: string;
      question: string;
      response: string;
      answeredById: string;
    },
  ): Promise<void> {
    try {
      const p = await this.loadProposal(proposalId);
      if (!p) return;
      const asker = await this.user(question.askedById);
      const answerer = await this.user(question.answeredById);
      const recipients = await this.withReviewerCopied(asker ? [asker] : []);
      const status = p.status as ProposalStatus;

      for (const recipient of recipients) {
        const mail = proposalUpdateEmail({
          recipientName: recipient.name,
          headline: "Information provided on a proposal",
          proposalTitle: p.title,
          status: PROPOSAL_STATUS_LABELS[status] ?? p.status,
          actedBy: answerer?.name ?? "Unknown",
          detail: question.response,
          detailLabel: "Answer",
          deepLink: this.deepLink(p.id),
        });
        await this.dispatch({
          proposalId: p.id,
          kind: PROPOSAL_EMAIL_KIND.ANSWER_RECEIVED,
          scope: question.id,
          stage: p.status,
          recipient,
          ...mail,
        });
      }
    } catch (err) {
      logger.error("Proposal answer email failed (answer unaffected)", {
        proposalId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * A decision has been recorded.
   *
   * Recipients depend on where it went. Passing the first tier notifies the final
   * approver, because the proposal is now waiting on them; anything else notifies
   * the requester, because it is their proposal that moved. The first reviewer is
   * copied either way.
   */
  async onDecision(
    proposalId: string,
    input: {
      transitionId: string;
      toStatus: ProposalStatus;
      choice: string;
      comment: string | null;
      actorId: string;
      /** The chain moved to a later stage rather than finishing. */
      advancedToStage?: boolean;
    },
  ): Promise<void> {
    try {
      const p = await this.loadProposal(proposalId);
      if (!p) return;
      const actor = await this.user(input.actorId);

      // Passed to a later stage: the proposal now waits on somebody, and they
      // are who needs telling. Otherwise it is the requester's proposal that
      // moved, so it goes to them.
      const awaitingApproval = input.advancedToStage === true;
      const primary: Recipient[] = awaitingApproval
        ? await this.pendingApprovers(proposalId)
        : p.raisedBy
          ? [p.raisedBy]
          : [];

      const recipients = await this.withReviewerCopied(primary);

      for (const recipient of recipients) {
        const mail = awaitingApproval
          ? proposalActionEmail({
              recipientName: recipient.name,
              headline: "Proposal awaiting your approval",
              proposalTitle: p.title,
              proposalType: this.typeLabel(p.type),
              raisedBy: p.raisedByName,
              priority: this.priorityLabel(p.priority),
              status: PROPOSAL_STATUS_LABELS[input.toStatus],
              deepLink: this.deepLink(p.id),
              callToAction: "Review Proposal",
            })
          : proposalUpdateEmail({
              recipientName: recipient.name,
              headline:
                input.toStatus === PROPOSAL_STATUS.APPROVED
                  ? "Proposal approved"
                  : "Proposal declined",
              proposalTitle: p.title,
              status: PROPOSAL_STATUS_LABELS[input.toStatus],
              actedBy: actor?.name ?? "Unknown",
              detail: input.comment,
              detailLabel:
                input.toStatus === PROPOSAL_STATUS.DECLINED
                  ? "Reason"
                  : "Notes",
              deepLink: this.deepLink(p.id),
            });

        await this.dispatch({
          proposalId: p.id,
          kind: PROPOSAL_EMAIL_KIND.DECISION,
          // The transition id, so each decision is its own notification.
          scope: input.transitionId,
          stage: input.toStatus,
          recipient,
          ...mail,
        });
      }
    } catch (err) {
      logger.error("Proposal decision email failed (decision unaffected)", {
        proposalId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Delivery log for one proposal. */
  listForProposal(proposalId: string) {
    return prisma.proposalEmail.findMany({
      where: { proposalId },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const proposalEmailService = new ProposalEmailService();
