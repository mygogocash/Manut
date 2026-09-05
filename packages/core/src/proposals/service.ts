import { PERMISSIONS } from "@nexora/contracts";
import { CHAIN_SCOPE } from "@nexora/contracts/modules/approval-chains/chain.types";
import type { ProposalQueryInput } from "@nexora/contracts/modules/proposals/proposal.validation";
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
} from "@nexora/contracts/modules/proposals/proposal.types";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { and, eq } from "drizzle-orm";
import { chainService } from "../approval-chains";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import { can, CAPABILITY } from "./proposal-authority";
import * as repo from "./repository";

const MIN_REASON_LENGTH = 5;

function statusOf(status: string): ProposalStatus {
  return isProposalStatus(status) ? status : PROPOSAL_STATUS.PENDING_APPROVAL;
}

function owner(proposalId: string) {
  return { proposalId } as const;
}

async function isSystemAdmin(db: Db, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: schema.userRoles.userId })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
    .where(
      and(
        eq(schema.userRoles.userId, userId),
        eq(schema.roles.isSystem, true),
        eq(schema.roles.name, "Admin"),
      ),
    )
    .limit(1);
  return !!row;
}

async function chainContext(db: Db, proposalId: string, actorId: string, perms: string[]) {
  const progress = await chainService.progress(db, owner(proposalId));
  if (progress.totalStages === 0) {
    const legacy =
      perms.includes(PERMISSIONS.PROPOSALS_REVIEW) ||
      perms.includes(PERMISSIONS.PROPOSALS_APPROVE) ||
      perms.includes(PERMISSIONS.PROJECTS_MANAGE);
    return {
      hasChain: false,
      canDecideStage: legacy,
      isFirstStage: true,
      currentOrder: null as number | null,
      decisionId: undefined as string | undefined,
    };
  }

  const decision = await chainService.canDecide(db, owner(proposalId), actorId, {
    hasSuperGrant: perms.includes(PERMISSIONS.PROJECTS_MANAGE),
    isSystemAdmin: await isSystemAdmin(db, actorId),
  });

  return {
    hasChain: true,
    canDecideStage: decision.allowed,
    isFirstStage:
      progress.currentOrder !== null &&
      progress.decisions.every(
        (d) => d.status === "pending" || d.order >= progress.currentOrder!,
      ),
    currentOrder: progress.currentOrder,
    decisionId: decision.decisionId,
  };
}

function pendingScope(perms: string[]) {
  return {
    superGrant: perms.includes(PERMISSIONS.PROJECTS_MANAGE),
    legacyCodes:
      perms.includes(PERMISSIONS.PROPOSALS_REVIEW) ||
      perms.includes(PERMISSIONS.PROPOSALS_APPROVE),
  };
}

async function transition(
  db: Db,
  proposalId: string,
  actorId: string,
  perms: string[],
  approve: boolean,
  comment: string | undefined,
) {
  const proposal = await repo.findProposalCore(db, proposalId);
  if (!proposal) throw new NotFoundException("Proposal not found");

  const from = statusOf(proposal.status);
  const chain = await chainContext(db, proposalId, actorId, perms);

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
    throw new ForbiddenException(authority.reason ?? "You are not authorised to decide this stage");
  }

  const trimmed = comment?.trim() || null;
  if (!approve && (!trimmed || trimmed.length < MIN_REASON_LENGTH)) {
    throw new BadRequestException("A reason of at least 5 characters is required to decline");
  }

  let advanced: { nextOrder: number | null; isComplete: boolean } = {
    nextOrder: null,
    isComplete: true,
  };

  const choice = approve ? PROPOSAL_CHOICE.PASS : PROPOSAL_CHOICE.DECLINE;

  const result = await db.transaction(async (tx) => {
    if (chain.hasChain && chain.decisionId) {
      advanced = await chainService.advance(tx, owner(proposalId), {
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

    const applied = await repo.updateStatus(tx, proposalId, from, {
      status: target,
      currentStepOrder: advanced.nextOrder,
    });
    if (applied === 0) {
      throw new ConflictException(
        "Somebody else has already acted on this proposal. Reload to see where it is now.",
      );
    }

    const updated = await repo.findProposalCore(tx, proposalId);
    const record = await repo.createTransition(tx, {
      proposalId,
      fromStatus: from,
      toStatus: target,
      actorId,
      choice,
      comment: trimmed,
    });

    return { updated: updated!, record, to: target, action: outcome };
  });

  return { proposal: result.updated, transition: result.record };
}

export async function pass(
  db: Db,
  proposalId: string,
  actorId: string,
  perms: string[],
  comment?: string,
) {
  return transition(db, proposalId, actorId, perms, true, comment);
}

export async function decline(
  db: Db,
  proposalId: string,
  actorId: string,
  perms: string[],
  reason: string,
) {
  return transition(db, proposalId, actorId, perms, false, reason);
}

export async function askForInformation(
  db: Db,
  proposalId: string,
  actorId: string,
  perms: string[],
  assigneeIds: string[],
  question: string,
) {
  const proposal = await repo.findProposalCore(db, proposalId);
  if (!proposal) throw new NotFoundException("Proposal not found");

  const status = statusOf(proposal.status);
  const chain = await chainContext(db, proposalId, actorId, perms);
  const decision = can(CAPABILITY.ASK_INFORMATION, {
    permissions: perms,
    status,
    canDecideStage: chain.canDecideStage,
  });
  if (!decision.allowed) {
    throw new ForbiddenException(decision.reason ?? "You cannot ask for information on this proposal");
  }

  const trimmed = question.trim();
  if (trimmed.length < MIN_REASON_LENGTH) {
    throw new BadRequestException("Say what information you need, in at least 5 characters");
  }

  const unique = [...new Set(assigneeIds)].filter((id) => id !== actorId);
  if (unique.length === 0) {
    throw new BadRequestException("Choose at least one other person to ask. You cannot ask yourself.");
  }

  const active = await repo.activeUserIds(db, unique);
  if (active.length !== unique.length) {
    throw new BadRequestException("One or more of those people are inactive or no longer exist");
  }

  return repo.createInformationRequests(
    db,
    unique.map((assignedToId) => ({
      proposalId,
      askedById: actorId,
      assignedToId,
      raisedAtStatus: status,
      question: trimmed,
    })),
  );
}

export async function provideInformation(
  db: Db,
  requestId: string,
  actorId: string,
  perms: string[],
  response: string,
) {
  const infoRequest = await repo.findInformationRequest(db, requestId);
  if (!infoRequest) throw new NotFoundException("Question not found");

  const status = statusOf(infoRequest.proposal.status);
  const decision = can(CAPABILITY.PROVIDE_INFORMATION, {
    permissions: perms,
    status,
    isInformationAssignee: infoRequest.assignedToId === actorId,
  });
  if (!decision.allowed) {
    throw new ForbiddenException(decision.reason ?? "You cannot answer this question");
  }
  if (infoRequest.respondedAt) {
    throw new BadRequestException("This question has already been answered");
  }

  const trimmed = response.trim();
  if (trimmed.length === 0) {
    throw new BadRequestException("Write your answer before submitting");
  }

  const updated = await repo.answerInformationRequest(db, requestId, trimmed);
  if (!updated) throw new ConflictException("This question has already been answered");
  return updated;
}

export async function getState(db: Db, proposalId: string, actorId: string, perms: string[]) {
  const proposal = await repo.findProposalCore(db, proposalId);
  if (!proposal) throw new NotFoundException("Proposal not found");

  const [questions, transitionRows] = await Promise.all([
    repo.listInformationRequests(db, proposalId),
    repo.listTransitions(db, proposalId),
  ]);

  const status = statusOf(proposal.status);
  const openQuestions = questions.filter((q) => q.respondedAt === null);
  const [chain, progress] = await Promise.all([
    chainContext(db, proposalId, actorId, perms),
    chainService.progress(db, owner(proposalId)),
  ]);

  const ctx = {
    permissions: perms,
    status,
    isRequester: proposal.raisedById === actorId,
    isInformationAssignee: openQuestions.some((q) => q.assignedToId === actorId),
    canDecideStage: chain.canDecideStage,
    isFirstStage: chain.isFirstStage,
  };

  const canDecide =
    can(CAPABILITY.DECIDE, ctx).allowed && !TERMINAL_STATUSES.includes(status);

  return {
    proposalId,
    status,
    label: PROPOSAL_STATUS_LABELS[status],
    isTerminal: TERMINAL_STATUSES.includes(status),
    allowedActions: allowedActions(status),
    availableActions: canDecide ? allowedDecisions(status) : [],
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
    transitions: transitionRows,
  };
}

export async function create(
  db: Db,
  actorId: string,
  perms: string[],
  input: {
    title: string;
    description: string;
    type: string;
    projectId?: string | null;
    priority?: string | null;
  },
) {
  const decision = can(CAPABILITY.CREATE, {
    permissions: perms,
    status: PROPOSAL_STATUS.PENDING_APPROVAL,
  });
  if (!decision.allowed) {
    throw new ForbiddenException(decision.reason ?? "You cannot raise a proposal");
  }

  if (input.projectId) {
    const exists = await repo.projectExists(db, input.projectId);
    if (!exists) throw new BadRequestException("That project does not exist");
  }

  const proposal = await repo.create(db, { ...input, raisedById: actorId });

  let stages = 0;
  try {
    await db.transaction(async (tx) => {
      const snap = await chainService.snapshot(db, tx, CHAIN_SCOPE.PROPOSAL, owner(proposal.id));
      stages = snap.stages;
      if (snap.firstOrder !== null) {
        await repo.setCurrentStepOrder(tx, proposal.id, snap.firstOrder);
      }
    });
  } catch {
    // Best effort — proposal already committed.
  }

  await repo.createTransition(db, {
    proposalId: proposal.id,
    fromStatus: null,
    toStatus: PROPOSAL_STATUS.PENDING_APPROVAL,
    actorId,
    choice: null,
    comment: null,
  });

  void stages;
  return proposal;
}

export async function update(
  db: Db,
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
  const existing = await repo.findProposalCore(db, proposalId);
  if (!existing) throw new NotFoundException("Proposal not found");

  const chain = await chainContext(db, proposalId, actorId, perms);
  const decision = can(CAPABILITY.EDIT, {
    permissions: perms,
    status: statusOf(existing.status),
    isRequester: existing.raisedById === actorId,
    isFirstStage: chain.isFirstStage,
  });
  if (!decision.allowed) {
    throw new ForbiddenException(decision.reason ?? "You cannot edit this proposal");
  }

  if (input.projectId) {
    const exists = await repo.projectExists(db, input.projectId);
    if (!exists) throw new BadRequestException("That project does not exist");
  }

  return repo.update(db, proposalId, input);
}

export async function list(
  db: Db,
  userId: string,
  perms: string[],
  query: ProposalQueryInput,
) {
  const decision = can(CAPABILITY.VIEW, {
    permissions: perms,
    status: PROPOSAL_STATUS.PENDING_APPROVAL,
  });
  if (!decision.allowed) {
    throw new ForbiddenException(decision.reason ?? "You cannot view proposals");
  }

  const { rows, counts } = await repo.listQueue(
    db,
    userId,
    query.view,
    pendingScope(perms),
    { search: query.search, type: query.type },
  );

  const names = await repo.namesById(
    db,
    rows.map((r) => r.raisedById),
  );

  return {
    counts,
    rows: rows.map((r) => {
      const status = statusOf(r.status);
      return {
        id: r.id,
        title: r.title,
        type: r.type,
        priority: r.priority,
        status,
        label: PROPOSAL_STATUS_LABELS[status],
        raisedById: r.raisedById,
        raisedBy: names.get(r.raisedById) ?? "Unknown",
        projectId: r.projectId,
        openQuestionCount: r.openQuestionCount,
        statusChangedAt: r.statusChangedAt,
        createdAt: r.createdAt,
      };
    }),
  };
}

export async function getDetail(db: Db, proposalId: string, actorId: string, perms: string[]) {
  const decision = can(CAPABILITY.VIEW, {
    permissions: perms,
    status: PROPOSAL_STATUS.PENDING_APPROVAL,
  });
  if (!decision.allowed) {
    throw new ForbiddenException(decision.reason ?? "You cannot view proposals");
  }

  const proposal = await repo.findById(db, proposalId);
  if (!proposal) throw new NotFoundException("Proposal not found");

  const state = await getState(db, proposalId, actorId, perms);
  const names = await repo.namesById(db, [
    proposal.raisedById,
    ...state.questions.flatMap((q) => [q.askedById, q.assignedToId]),
    ...state.transitions.map((t) => t.actorId ?? ""),
  ]);
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? "Unknown") : "System");

  return {
    proposal: {
      ...proposal,
      status: state.status,
      label: state.label,
      raisedBy: nameOf(proposal.raisedById),
    },
    permissions: {
      availableActions: state.availableActions,
      canAskForInformation: state.canAskForInformation,
      canAnswer: state.canAnswer,
      canEdit: state.canEdit,
    },
    chain: state.chain,
    openQuestionCount: state.openQuestionCount,
    questions: state.questions.map((q) => ({
      id: q.id,
      question: q.question,
      response: q.response,
      askedBy: nameOf(q.askedById),
      assignedTo: nameOf(q.assignedToId),
      createdAt: q.createdAt,
      respondedAt: q.respondedAt,
    })),
    transitions: state.transitions.map((t) => ({
      id: t.id,
      fromStatus: t.fromStatus,
      toStatus: t.toStatus,
      choice: t.choice,
      comment: t.comment,
      actor: nameOf(t.actorId),
      createdAt: t.createdAt,
    })),
  };
}

export async function myOpenQuestions(db: Db, userId: string) {
  return repo.openQuestionsFor(db, userId);
}

/** Legacy alias — detail endpoint is authoritative. */
export async function getById(db: Db, proposalId: string, actorId: string, perms: string[]) {
  return getDetail(db, proposalId, actorId, perms);
}
