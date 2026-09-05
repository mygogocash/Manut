import type { Request } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { isSystemAdmin } from "@/core/guards/auth.guard";
import { prisma } from "@/infrastructure/database/prisma";
import { chainService } from "@/modules/approval-chains/chain.service";
import { CHAIN_SCOPE } from "@/modules/approval-chains/chain.types";
import { proposalRepository } from "@/modules/proposals/proposal.repository";
import {
  allowedActions,
  allowedDecisions,
  isProposalStatus,
  PROPOSAL_ACTION,
  PROPOSAL_CHOICE,
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_LABELS,
  type ProposalAction,
  type ProposalStatus,
  TERMINAL_STATUSES,
  TRANSITIONS,
} from "@/modules/proposals/proposal.types";
import { can, CAPABILITY } from "@/modules/proposals/proposal-authority";
import { proposalEmailService } from "@/modules/proposals/proposal-email.service";

// Product proposal engine.
//
// Every status change flows through the single private `transition()`, so there
// is exactly one place where legality, authority, atomicity and logging are
// enforced.
//
// Questions are deliberately NOT transitions. Asking one leaves the proposal
// exactly where it is, with the reviewer who asked. See proposal.types.ts for
// why an `awaiting_information` status turned out to be the wrong model.

const MIN_REASON_LENGTH = 5;

export class ProposalService {
  private statusOf(status: string): ProposalStatus {
    return isProposalStatus(status) ? status : PROPOSAL_STATUS.PENDING_APPROVAL;
  }

  /** The owner shape the chain engine keys a snapshot by. */
  private owner(proposalId: string) {
    return { proposalId } as const;
  }

  /**
   * Everything the authority check needs from the chain, in one place.
   *
   * A proposal with no snapshot — raised before chains, or submitted while no
   * chain was active — reports `hasChain: false`. Callers then fall back to the
   * permission codes this flow used originally, so an old proposal stays
   * decidable instead of stranding.
   */
  private async chainContext(
    proposalId: string,
    actorId: string,
    perms: string[],
  ): Promise<{
    hasChain: boolean;
    canDecideStage: boolean;
    isFirstStage: boolean;
    currentOrder: number | null;
    decisionId?: string;
  }> {
    const progress = await chainService.progress(this.owner(proposalId));
    if (progress.totalStages === 0) {
      // Legacy fallback: the codes that used to gate the two fixed tiers.
      const legacy =
        perms.includes(PERMISSIONS.PROPOSALS_REVIEW) ||
        perms.includes(PERMISSIONS.PROPOSALS_APPROVE) ||
        perms.includes(PERMISSIONS.PROJECTS_MANAGE);
      return {
        hasChain: false,
        canDecideStage: legacy,
        isFirstStage: true,
        currentOrder: null,
      };
    }

    const decision = await chainService.canDecide(
      this.owner(proposalId),
      actorId,
      {
        hasSuperGrant: perms.includes(PERMISSIONS.PROJECTS_MANAGE),
        isSystemAdmin: await isSystemAdmin(actorId),
      },
    );

    return {
      hasChain: true,
      canDecideStage: decision.allowed,
      // Nothing has decided yet, so the requester's edit window is still open.
      // `currentOrder === null` means the chain has FINISHED (no pending
      // decision), not that it is at stage one — defaulting it to 1 made a
      // decided proposal look editable.
      isFirstStage:
        progress.currentOrder !== null &&
        progress.decisions.every(
          (d) => d.status === "pending" || d.order >= progress.currentOrder!,
        ),
      currentOrder: progress.currentOrder,
      decisionId: decision.decisionId,
    };
  }

  /** The actor's role names, recorded on every permission-sensitive action. */
  private async rolesOf(userId: string): Promise<string[]> {
    const rows = await prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { name: true } } },
    });
    return rows.map((r) => r.role.name);
  }

  /**
   * The single mutation path for a status change. Validates legality, then
   * authority, then applies the status update, the transition log and the audit
   * entry inside ONE transaction, so a proposal can never move without a
   * matching log row.
   */
  private async transition(
    proposalId: string,
    actorId: string,
    perms: string[],
    approve: boolean,
    comment: string | undefined,
    req?: Request,
  ) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { id: true, title: true, status: true, raisedById: true },
    });
    if (!proposal) throw new NotFoundException("Proposal not found");

    const from = this.statusOf(proposal.status);
    const roles = await this.rolesOf(actorId);
    const chain = await this.chainContext(proposalId, actorId, perms);

    // 1. Authority, before legality: "this stage is not yours" is a better
    // answer than "that move is illegal" when both are true.
    const authority = can(CAPABILITY.DECIDE, {
      permissions: perms,
      status: from,
      canDecideStage: chain.canDecideStage,
    });
    if (!authority.allowed) {
      if (TERMINAL_STATUSES.includes(from)) {
        throw new BadRequestException(
          `This proposal is already ${PROPOSAL_STATUS_LABELS[from]} and can no longer change`,
        );
      }
      throw new ForbiddenException(
        authority.reason ?? "You are not authorised to decide this stage",
      );
    }

    // 2. A decline must always carry a reason. It is the only thing the
    // requester has to work with.
    const trimmed = comment?.trim() || null;
    if (!approve && (!trimmed || trimmed.length < MIN_REASON_LENGTH)) {
      throw new BadRequestException(
        "A reason of at least 5 characters is required to decline",
      );
    }

    // 3. Ask the chain what this decision means. `advance` reports whether a
    // later stage still owes a decision; only then is the status outcome known,
    // which is why the outcome is read from the chain rather than computed here.
    let advanced: { nextOrder: number | null; isComplete: boolean } = {
      nextOrder: null,
      // With no chain there is nothing left to await, so a pass finalises —
      // exactly what the flow did before chains existed.
      isComplete: true,
    };

    const now = new Date();
    const choice = approve ? PROPOSAL_CHOICE.PASS : PROPOSAL_CHOICE.DECLINE;

    // 4. Atomic apply: status, history, audit.
    //
    // The status update is CONDITIONAL on the proposal still being where this
    // request read it. Two reviewers acting at once (or one double-click) would
    // otherwise both pass the checks above and both commit, producing two
    // transition rows and two emails for a single real decision. Making the
    // database arbitrate means the loser is told, rather than silently
    // duplicating the winner.
    const { updated, record, to, action } = await prisma.$transaction(
      async (tx) => {
        // Settle the chain stage FIRST: its answer decides the status outcome, and
        // it carries its own conditional guard against a concurrent decider.
        if (chain.hasChain && chain.decisionId) {
          advanced = await chainService.advance(tx, this.owner(proposalId), {
            decisionId: chain.decisionId,
            approve,
            actorId,
            notes: trimmed,
          });
        }

        const outcome: ProposalAction = !approve
          ? PROPOSAL_ACTION.DECLINE
          : advanced.isComplete
            ? PROPOSAL_ACTION.FINALISE
            : PROPOSAL_ACTION.ADVANCE;

        const target = TRANSITIONS[from]?.[outcome];
        if (!target) {
          throw new BadRequestException(
            `Cannot ${outcome} a proposal that is ${PROPOSAL_STATUS_LABELS[from]}`,
          );
        }

        const applied = await tx.proposal.updateMany({
          where: { id: proposalId, status: from },
          data: {
            status: target,
            statusChangedAt: now,
            // Where the chain now sits. Null once nothing is awaited.
            currentStepOrder: advanced.nextOrder,
          },
        });
        if (applied.count === 0) {
          throw new ConflictException(
            "Somebody else has already acted on this proposal. Reload to see where it is now.",
          );
        }

        const row = await tx.proposal.findUniqueOrThrow({
          where: { id: proposalId },
          select: {
            id: true,
            title: true,
            status: true,
            statusChangedAt: true,
          },
        });

        const transitionRow = await tx.proposalTransition.create({
          data: {
            proposalId,
            fromStatus: from,
            toStatus: target,
            actorId,
            choice,
            comment: trimmed,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: `proposal.${outcome}`,
            resource: "proposal",
            resourceId: proposalId,
            details: {
              previousStatus: from,
              newStatus: target,
              choice,
              comment: trimmed,
              // Which stage of the chain was settled, so the audit trail says WHERE
              // the decision happened and not merely that the status moved.
              stageOrder: chain.currentOrder,
              nextStageOrder: advanced.nextOrder,
              // Permission-sensitive action: record who acted and in what role.
              roles,
              capability: CAPABILITY.DECIDE,
            },
            ipAddress:
              req?.ip ?? (req?.headers["x-forwarded-for"] as string) ?? null,
            userAgent: req?.headers["user-agent"] ?? null,
          },
        });

        return {
          updated: row,
          record: transitionRow,
          to: target,
          action: outcome,
        };
      },
    );

    // Notification happens AFTER the commit, and swallows its own failures. A
    // mail outage must never roll back a decision that already succeeded.
    await proposalEmailService.onDecision(proposalId, {
      transitionId: record.id,
      toStatus: to,
      choice,
      comment: trimmed,
      actorId,
      // Passed to a later stage rather than finished, so the next approver is
      // who needs telling.
      advancedToStage: action === PROPOSAL_ACTION.ADVANCE,
    });

    return { proposal: updated, transition: record };
  }

  /** Advance to the next stage. */
  async pass(
    proposalId: string,
    actorId: string,
    perms: string[],
    comment?: string,
    req?: Request,
  ) {
    return this.transition(proposalId, actorId, perms, true, comment, req);
  }

  /** Decline. Terminal, and always requires a reason. */
  async decline(
    proposalId: string,
    actorId: string,
    perms: string[],
    reason: string,
    req?: Request,
  ) {
    return this.transition(proposalId, actorId, perms, false, reason, req);
  }

  /**
   * Ask one or more people for information.
   *
   * Creates a row per assignee and leaves the status untouched. Several people
   * can be asked at once because needing Legal on the contract and Finance on
   * the cost is the normal case: asking serially would double the waiting.
   */
  async askForInformation(
    proposalId: string,
    actorId: string,
    perms: string[],
    assigneeIds: string[],
    question: string,
    req?: Request,
  ) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { id: true, status: true },
    });
    if (!proposal) throw new NotFoundException("Proposal not found");

    const status = this.statusOf(proposal.status);
    // Asking carries the same authority as deciding this stage, so it needs the
    // same answer from the chain.
    const chain = await this.chainContext(proposalId, actorId, perms);
    const decision = can(CAPABILITY.ASK_INFORMATION, {
      permissions: perms,
      status,
      canDecideStage: chain.canDecideStage,
    });
    if (!decision.allowed) {
      throw new ForbiddenException(
        decision.reason ?? "You cannot ask for information on this proposal",
      );
    }

    const trimmed = question.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      throw new BadRequestException(
        "Say what information you need, in at least 5 characters",
      );
    }

    // De-duplicate: asking the same person twice in one go would create two
    // identical questions, and both would have to be answered.
    const unique = [...new Set(assigneeIds)].filter((id) => id !== actorId);
    if (unique.length === 0) {
      throw new BadRequestException(
        "Choose at least one other person to ask. You cannot ask yourself.",
      );
    }

    // Every assignee must be someone who can actually answer. Checked against
    // the database rather than trusted from the request.
    const users = await prisma.user.findMany({
      where: { id: { in: unique }, isActive: true },
      select: { id: true },
    });
    if (users.length !== unique.length) {
      throw new BadRequestException(
        "One or more of those people are inactive or no longer exist",
      );
    }

    const roles = await this.rolesOf(actorId);

    // One transaction for every question plus the audit row, so a partial fan-out
    // cannot happen: either the reviewer asked everyone or nobody.
    const created = await prisma.$transaction([
      ...unique.map((assignedToId) =>
        prisma.proposalInformationRequest.create({
          data: {
            proposalId,
            askedById: actorId,
            assignedToId,
            raisedAtStatus: status,
            question: trimmed,
          },
        }),
      ),
      prisma.auditLog.create({
        data: {
          userId: actorId,
          action: "proposal.ask_information",
          resource: "proposal",
          resourceId: proposalId,
          details: {
            status,
            choice: PROPOSAL_CHOICE.QUESTION,
            question: trimmed,
            assignedTo: unique,
            roles,
            capability: CAPABILITY.ASK_INFORMATION,
          },
          ipAddress:
            req?.ip ?? (req?.headers["x-forwarded-for"] as string) ?? null,
          userAgent: req?.headers["user-agent"] ?? null,
        },
      }),
    ]);

    // Drop the audit row from the returned array.
    const questions = created.slice(0, unique.length) as Array<{
      id: string;
      assignedToId: string;
      question: string;
    }>;

    await proposalEmailService.onQuestionsAsked(proposalId, questions);

    return questions;
  }

  /**
   * Answer a question that was asked of you.
   *
   * Authority is identity: only the named assignee can respond, whatever
   * permissions they hold. An answer recorded against the wrong name is worse
   * than an unanswered question.
   */
  async provideInformation(
    requestId: string,
    actorId: string,
    perms: string[],
    response: string,
    req?: Request,
  ) {
    const infoRequest = await prisma.proposalInformationRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        proposalId: true,
        assignedToId: true,
        // Needed to notify whoever asked, once the answer lands.
        askedById: true,
        question: true,
        respondedAt: true,
        proposal: { select: { status: true } },
      },
    });
    if (!infoRequest) throw new NotFoundException("Question not found");

    const status = this.statusOf(infoRequest.proposal.status);
    const decision = can(CAPABILITY.PROVIDE_INFORMATION, {
      permissions: perms,
      status,
      isInformationAssignee: infoRequest.assignedToId === actorId,
    });
    if (!decision.allowed) {
      throw new ForbiddenException(
        decision.reason ?? "You cannot answer this question",
      );
    }

    // Answering twice would overwrite the first answer and lose it. The reviewer
    // can always ask again if they need more.
    if (infoRequest.respondedAt) {
      throw new BadRequestException("This question has already been answered");
    }

    const trimmed = response.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException("Write your answer before submitting");
    }

    const roles = await this.rolesOf(actorId);
    const now = new Date();

    const [updated] = await prisma.$transaction([
      prisma.proposalInformationRequest.update({
        where: { id: requestId },
        data: { response: trimmed, respondedAt: now },
      }),
      prisma.auditLog.create({
        data: {
          userId: actorId,
          action: "proposal.provide_information",
          resource: "proposal",
          resourceId: infoRequest.proposalId,
          details: {
            informationRequestId: requestId,
            roles,
            capability: CAPABILITY.PROVIDE_INFORMATION,
          },
          ipAddress:
            req?.ip ?? (req?.headers["x-forwarded-for"] as string) ?? null,
          userAgent: req?.headers["user-agent"] ?? null,
        },
      }),
    ]);

    await proposalEmailService.onAnswerReceived(infoRequest.proposalId, {
      id: requestId,
      askedById: infoRequest.askedById,
      question: infoRequest.question,
      response: trimmed,
      answeredById: actorId,
    });

    return updated;
  }

  /**
   * Current state, open questions and full history.
   *
   * `openQuestions` is what replaces an `awaiting_information` status: the
   * proposal stays where it is and the count says what it is waiting on.
   */
  async getState(proposalId: string, actorId: string, perms: string[]) {
    const [proposal, questions, transitions] = await Promise.all([
      prisma.proposal.findUnique({
        where: { id: proposalId },
        select: {
          id: true,
          title: true,
          status: true,
          raisedById: true,
        },
      }),
      prisma.proposalInformationRequest.findMany({
        where: { proposalId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.proposalTransition.findMany({
        where: { proposalId },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    if (!proposal) throw new NotFoundException("Proposal not found");

    const status = this.statusOf(proposal.status);
    const openQuestions = questions.filter((q) => q.respondedAt === null);

    const [chain, progress] = await Promise.all([
      this.chainContext(proposalId, actorId, perms),
      chainService.progress(this.owner(proposalId)),
    ]);

    const ctx = {
      permissions: perms,
      status,
      isRequester: proposal.raisedById === actorId,
      isInformationAssignee: openQuestions.some(
        (q) => q.assignedToId === actorId,
      ),
      canDecideStage: chain.canDecideStage,
      isFirstStage: chain.isFirstStage,
    };

    const canDecide =
      can(CAPABILITY.DECIDE, ctx).allowed &&
      !TERMINAL_STATUSES.includes(status);

    return {
      proposalId,
      status,
      label: PROPOSAL_STATUS_LABELS[status],
      isTerminal: TERMINAL_STATUSES.includes(status),
      allowedActions: allowedActions(status),
      /**
       * What this caller may actually do, which is what the UI renders. Expressed
       * as the reviewer's two choices rather than the internal outcomes: `pass`
       * covers both "advance" and "finalise", and only the chain knows which.
       */
      availableActions: canDecide ? allowedDecisions(status) : [],
      /** Where the proposal is in its chain, for the progress display. */
      chain: {
        currentStage: progress.currentOrder,
        totalStages: progress.totalStages,
        stages: progress.decisions,
      },
      canAskForInformation: can(CAPABILITY.ASK_INFORMATION, ctx).allowed,
      canAnswer: can(CAPABILITY.PROVIDE_INFORMATION, ctx).allowed,
      canEdit: can(CAPABILITY.EDIT, ctx).allowed,
      openQuestionCount: openQuestions.length,
      questions,
      transitions,
    };
  }

  /**
   * What surfaces in this caller's "pending" queue.
   *
   * The queue itself filters on being NAMED on a pending stage; this only carries
   * the two exceptions. Derived from their permissions, never from a
   * client-supplied filter.
   */
  private pendingScope(perms: string[]) {
    return {
      superGrant: perms.includes(PERMISSIONS.PROJECTS_MANAGE),
      // Only matters for proposals raised before chains, which have no stage to
      // be named on.
      legacyCodes:
        perms.includes(PERMISSIONS.PROPOSALS_REVIEW) ||
        perms.includes(PERMISSIONS.PROPOSALS_APPROVE),
    };
  }

  /**
   * Raise a proposal. Creating it submits it: it lands with the first reviewer
   * immediately, so nothing sits in a draft nobody looks at.
   *
   * The first history row is written after the proposal, not with it, because it
   * needs the generated id. That leaves a brief window where a proposal has no
   * history row. Accepted deliberately: a missing first history row is
   * recoverable, a proposal that failed to save is not.
   */
  async create(
    actorId: string,
    perms: string[],
    input: {
      title: string;
      description: string;
      type: string;
      projectId?: string | null;
      priority?: string | null;
    },
    req?: Request,
  ) {
    const decision = can(CAPABILITY.CREATE, {
      permissions: perms,
      status: PROPOSAL_STATUS.PENDING_APPROVAL,
    });
    if (!decision.allowed) {
      throw new ForbiddenException(
        decision.reason ?? "You cannot raise a proposal",
      );
    }

    // A named project must exist. Checked here rather than leaning on the
    // foreign key, so the caller gets a clear message instead of a constraint
    // error.
    if (input.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true },
      });
      if (!project) {
        throw new BadRequestException("That project does not exist");
      }
    }

    const proposal = await proposalRepository.create({
      ...input,
      raisedById: actorId,
    });

    // Snapshot the configured chain onto the new proposal.
    //
    // `stages: 0` means no chain is configured, which must NOT read as approved:
    // the proposal stays in flight and the legacy permission codes decide it, the
    // same way this flow worked before chains. Best effort for the same reason
    // the history row below is: the proposal is already committed, and a chain
    // failure must not lose somebody's submission.
    let stages = 0;
    try {
      const snap = await prisma.$transaction((tx) =>
        chainService.snapshot(
          tx,
          CHAIN_SCOPE.PROPOSAL,
          this.owner(proposal.id),
        ),
      );
      stages = snap.stages;
      if (snap.firstOrder !== null) {
        await prisma.proposal.update({
          where: { id: proposal.id },
          data: { currentStepOrder: snap.firstOrder },
        });
      }
    } catch (err) {
      logger.error("Could not snapshot the approval chain onto a proposal", {
        proposalId: proposal.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const roles = await this.rolesOf(actorId);
    await prisma.$transaction([
      prisma.proposalTransition.create({
        data: {
          proposalId: proposal.id,
          fromStatus: null,
          toStatus: PROPOSAL_STATUS.PENDING_APPROVAL,
          actorId,
          choice: null,
          comment: null,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: actorId,
          action: "proposal.create",
          resource: "proposal",
          resourceId: proposal.id,
          details: {
            type: proposal.type,
            newStatus: PROPOSAL_STATUS.PENDING_APPROVAL,
            // How many stages this proposal must clear. Zero records that it was
            // raised with no chain configured.
            chainStages: stages,
            roles,
            capability: CAPABILITY.CREATE,
          },
          ipAddress:
            req?.ip ?? (req?.headers["x-forwarded-for"] as string) ?? null,
          userAgent: req?.headers["user-agent"] ?? null,
        },
      }),
    ]);

    // Creating a proposal submits it, so the first reviewer is told straight
    // away. Best effort: the proposal is already committed and a mail failure
    // must not fail the create.
    await proposalEmailService.onSubmitted(proposal.id);

    return proposal;
  }

  /** Correct a proposal. Requester only, and only before the reviewer acts. */
  async update(
    proposalId: string,
    actorId: string,
    perms: string[],
    input: {
      title?: string;
      description?: string;
      type?: string;
      projectId?: string | null;
      priority?: string | null;
    },
  ) {
    const existing = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { id: true, status: true, raisedById: true },
    });
    if (!existing) throw new NotFoundException("Proposal not found");

    // The edit window closes when the FIRST stage decides, not at a fixed status,
    // so the chain has to say whether anything has decided yet.
    const chain = await this.chainContext(proposalId, actorId, perms);
    const decision = can(CAPABILITY.EDIT, {
      permissions: perms,
      status: this.statusOf(existing.status),
      isRequester: existing.raisedById === actorId,
      isFirstStage: chain.isFirstStage,
    });
    if (!decision.allowed) {
      throw new ForbiddenException(
        decision.reason ?? "You cannot edit this proposal",
      );
    }

    if (input.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true },
      });
      if (!project) {
        throw new BadRequestException("That project does not exist");
      }
    }

    return proposalRepository.update(proposalId, input);
  }

  /**
   * The queue. Rows for one view plus the counts for all of them, with raiser
   * names resolved in a single batched lookup.
   */
  async list(
    userId: string,
    perms: string[],
    query: { view: string; search?: string; type?: string },
  ) {
    const decision = can(CAPABILITY.VIEW, {
      permissions: perms,
      status: PROPOSAL_STATUS.PENDING_APPROVAL,
    });
    if (!decision.allowed) {
      throw new ForbiddenException(
        decision.reason ?? "You cannot view proposals",
      );
    }

    const { rows, counts } = await proposalRepository.listQueue(
      userId,
      query.view,
      this.pendingScope(perms),
      { search: query.search, type: query.type },
    );

    const names = await proposalRepository.namesById(
      rows.map((r) => r.raisedById),
    );

    return {
      counts,
      rows: rows.map(({ _count, ...r }) => {
        const status = this.statusOf(r.status);
        return {
          ...r,
          status,
          label: PROPOSAL_STATUS_LABELS[status],
          raisedBy: names.get(r.raisedById) ?? "Unknown",
          // Unanswered questions, so the queue can say what a row waits on.
          openQuestionCount: _count.informationRequests,
          statusChangedAt: r.statusChangedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        };
      }),
    };
  }

  /**
   * Everything the detail page needs in one round trip: the proposal, what this
   * caller may do with it, its questions and its decision history, with every
   * user id resolved to a name.
   */
  async getDetail(proposalId: string, actorId: string, perms: string[]) {
    const decision = can(CAPABILITY.VIEW, {
      permissions: perms,
      status: PROPOSAL_STATUS.PENDING_APPROVAL,
    });
    if (!decision.allowed) {
      throw new ForbiddenException(
        decision.reason ?? "You cannot view proposals",
      );
    }

    const proposal = await proposalRepository.findById(proposalId);
    if (!proposal) throw new NotFoundException("Proposal not found");

    const state = await this.getState(proposalId, actorId, perms);

    const names = await proposalRepository.namesById([
      proposal.raisedById,
      ...state.questions.flatMap((q) => [q.askedById, q.assignedToId]),
      ...state.transitions.map((t) => t.actorId ?? ""),
    ]);
    const nameOf = (id: string | null) =>
      id ? (names.get(id) ?? "Unknown") : "System";

    return {
      proposal: {
        ...proposal,
        status: state.status,
        label: state.label,
        raisedBy: nameOf(proposal.raisedById),
        statusChangedAt: proposal.statusChangedAt?.toISOString() ?? null,
        createdAt: proposal.createdAt.toISOString(),
        updatedAt: proposal.updatedAt.toISOString(),
      },
      permissions: {
        availableActions: state.availableActions,
        canAskForInformation: state.canAskForInformation,
        canAnswer: state.canAnswer,
        canEdit: state.canEdit,
      },
      // The detail page renders the progress rail and the Approve/Pass label
      // from this. `getState` has computed it since chains landed, but this
      // response never passed it on, so the page read `chain.stages` of
      // undefined and white-screened.
      chain: state.chain,
      openQuestionCount: state.openQuestionCount,
      questions: state.questions.map((q) => ({
        id: q.id,
        question: q.question,
        response: q.response,
        askedBy: nameOf(q.askedById),
        assignedTo: nameOf(q.assignedToId),
        /** Whether THIS caller is the one who must answer it. */
        isMine: q.assignedToId === actorId,
        raisedAtStatus: q.raisedAtStatus,
        createdAt: q.createdAt.toISOString(),
        respondedAt: q.respondedAt?.toISOString() ?? null,
      })),
      history: state.transitions.map((t) => ({
        id: t.id,
        fromStatus: t.fromStatus,
        toStatus: t.toStatus,
        choice: t.choice,
        comment: t.comment,
        actor: nameOf(t.actorId),
        at: t.createdAt.toISOString(),
      })),
    };
  }

  /** Questions waiting on this person, across every proposal. */
  async myOpenQuestions(userId: string) {
    const rows = await proposalRepository.openQuestionsFor(userId);
    const names = await proposalRepository.namesById(
      rows.map((r) => r.askedById),
    );
    return rows.map((r) => ({
      id: r.id,
      proposalId: r.proposalId,
      proposalTitle: r.proposal.title,
      question: r.question,
      askedBy: names.get(r.askedById) ?? "Unknown",
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

export const proposalService = new ProposalService();
