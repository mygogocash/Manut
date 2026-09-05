import type { Prisma } from "@nexora/database";
import type { Request } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { isSystemAdmin } from "@/core/guards/auth.guard";
import { prisma } from "@/infrastructure/database/prisma";
import { chainService } from "@/modules/approval-chains/chain.service";
import { CHAIN_SCOPE } from "@/modules/approval-chains/chain.types";
import {
  allowedActions,
  CHAIN_ADVANCE_TARGET,
  isApproved,
  isWorkflowStatus,
  isWorkflowTeam,
  STAGE_PERMISSION,
  TERMINAL_STATUSES,
  TRANSITIONS,
  WORKFLOW_ACTION,
  WORKFLOW_STATUS,
  WORKFLOW_STATUS_LABELS,
  type WorkflowAction,
  type WorkflowState,
  type WorkflowStatus,
  type WorkflowView,
} from "@/modules/projects/workflow/workflow.types";
import {
  can,
  CAPABILITY,
  isProjectManager,
} from "@/modules/projects/workflow/workflow-authority";
import { workflowEmailService } from "@/modules/projects/workflow/workflow-email.service";
import { workflowPushService } from "@/modules/projects/workflow/workflow-push.service";

// Project approval workflow engine.
//
// Every state change flows through the single private `transition()` method, so
// there is exactly one place where legality, authorization, atomicity and
// logging are enforced. The module does one thing: move a project along a
// fixed linear chain and record that it happened.

export class WorkflowService {
  /**
   * A project that has never entered the workflow reports as `draft`, so every
   * pre-existing Project CRM row remains valid and submittable without a
   * backfill.
   */
  private statusOf(workflowStatus: string | null): WorkflowStatus {
    return isWorkflowStatus(workflowStatus)
      ? workflowStatus
      : WORKFLOW_STATUS.DRAFT;
  }

  /**
   * The capability an action requires, given the stage it is taken from.
   * Approval gates are stage-specific; closing out a project that has reached
   * development (complete OR reject) is the Project Manager's authority.
   */
  private capabilityFor(from: WorkflowStatus, action: WorkflowAction) {
    switch (action) {
      case WORKFLOW_ACTION.SUBMIT:
        return CAPABILITY.CREATE_REQUEST;
      case WORKFLOW_ACTION.RETURN:
        return CAPABILITY.RETURN_TO_REQUESTER;
      case WORKFLOW_ACTION.REOPEN:
        return CAPABILITY.REOPEN;
      case WORKFLOW_ACTION.COMPLETE:
        return CAPABILITY.MARK_COMPLETED;
      case WORKFLOW_ACTION.ESCALATE:
        return CAPABILITY.ESCALATE;
      default:
        break;
    }
    // approve / reject — determined by the stage being decided.
    switch (from) {
      case WORKFLOW_STATUS.PENDING_PM_APPROVAL:
        return CAPABILITY.PM_DECIDE;
      case WORKFLOW_STATUS.PENDING_ESCALATION:
        return CAPABILITY.ESCALATED_DECIDE;
      default:
        return CAPABILITY.MARK_COMPLETED;
    }
  }

  private canActFrom(from: WorkflowStatus, perms: string[]): boolean {
    // Used by the read model to decide which buttons to show: can this caller
    // take ANY action from this stage?
    return [
      WORKFLOW_ACTION.APPROVE,
      WORKFLOW_ACTION.REJECT,
      WORKFLOW_ACTION.SUBMIT,
      WORKFLOW_ACTION.COMPLETE,
      WORKFLOW_ACTION.RETURN,
      WORKFLOW_ACTION.REOPEN,
    ]
      .filter((a) => TRANSITIONS[from]?.[a])
      .some(
        (a) =>
          can(this.capabilityFor(from, a), {
            permissions: perms,
            status: from,
          }).allowed,
      );
  }

  /** The owner shape the chain engine keys a request's snapshot by. */
  private owner(projectId: string) {
    return { projectId } as const;
  }

  /**
   * What the configured chain says about this request.
   *
   * `hasChain: false` covers every project that predates chains, and any
   * submitted while none was configured. Those keep the original behaviour
   * exactly — one PM gate decided by `workflow:pm-approve` — which is what stops
   * this change stranding anything already in flight.
   */
  private async chainContext(
    projectId: string,
    actorId: string,
    perms: string[],
  ): Promise<{
    hasChain: boolean;
    canDecideStage: boolean;
    decisionId?: string;
    currentOrder: number | null;
  }> {
    const progress = await chainService.progress(this.owner(projectId));
    if (progress.totalStages === 0) {
      return { hasChain: false, canDecideStage: true, currentOrder: null };
    }
    const decision = await chainService.canDecide(
      this.owner(projectId),
      actorId,
      {
        hasSuperGrant: perms.includes(PERMISSIONS.PROJECTS_MANAGE),
        isSystemAdmin: await isSystemAdmin(actorId),
      },
    );
    return {
      hasChain: true,
      canDecideStage: decision.allowed,
      // Which stage this action SETTLES — a fact about the chain, not a
      // judgement about the actor. `canDecide` only returns an id on its allow
      // branch, and an escalation target is refused by construction, so relying
      // on it meant an escalated approval never settled the stage: the decision
      // row stayed pending forever and, with 2+ stages configured, the request
      // jumped straight to approved, skipping the rest of the chain.
      decisionId:
        decision.decisionId ??
        progress.decisions.find((d) => d.status === "pending")?.id,
      currentOrder: progress.currentOrder,
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

  /** Current state + history. Read-only. */
  /**
   * May this actor open the request?
   *
   * Participation alone is not the rule: an approver is legitimately not a
   * member of the project they gate, and an escalation target can be anyone.
   * So the test is participant OR holder of a capability for the request's
   * CURRENT stage OR the named escalation target — the same population that
   * may actually decide it.
   *
   * Without this, `projects:read` (held by the Employee role) was enough to
   * read any project's details, task comments and resource URLs through the
   * workflow routes, including rows belonging to other CRMs.
   */
  async assertCanViewRequest(
    projectId: string,
    actorId: string,
    perms: string[],
  ): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        team: true,
        ownerId: true,
        escalatedToId: true,
        workflowStatus: true,
        archivedAt: true,
        members: { where: { userId: actorId }, select: { id: true } },
      },
    });
    if (!project) throw new NotFoundException("Project not found");

    // The requester, the people on the board, and a named escalation target.
    if (project.ownerId === actorId) return;
    if (project.escalatedToId === actorId) return;
    if (project.members.length > 0) return;

    // Anyone who could act on the request's current stage may read it.
    //
    // DRAFT is excluded deliberately. `statusOf(null)` maps to draft, and every
    // row outside this workflow — every HR / Legal / Accounting / QA / Product
    // board, and every Project CRM row predating the workflow — has a null
    // status. Draft's only action is `submit`, whose capability is granted
    // unconditionally, so including it would hand any `workflow:submit` holder
    // (the seeded Project Requester role) every such project's details, task
    // comments and resource URLs. `actionableStatuses()` already excludes draft
    // for exactly this reason.
    const status = this.statusOf(project.workflowStatus);
    const canActOnStage =
      status !== WORKFLOW_STATUS.DRAFT &&
      isWorkflowTeam(project.team) &&
      allowedActions(status).some(
        (a) =>
          can(this.capabilityFor(status, a), {
            permissions: perms,
            status,
            isArchived: Boolean(project.archivedAt),
          }).allowed,
      );
    if (canActOnStage) return;

    // Leadership / HR read-all, the same bypass the project board honours.
    if (perms.includes(PERMISSIONS.PROJECTS_READ_ALL)) return;

    throw new ForbiddenException("You do not have access to this request");
  }

  async getState(
    projectId: string,
    perms: string[] = [],
    actorId?: string,
  ): Promise<WorkflowState> {
    if (actorId) await this.assertCanViewRequest(projectId, actorId, perms);
    // The project row and its history are both keyed on projectId and neither
    // depends on the other, so they go out together. Only the actor lookup
    // below has to wait — it needs the ids the history returns.
    const [project, rows] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          workflowStatus: true,
          archivedAt: true,
          escalatedToId: true,
        },
      }),
      prisma.projectWorkflowTransition.findMany({
        where: { projectId },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    if (!project) throw new NotFoundException("Project not found");

    const status = this.statusOf(project.workflowStatus);
    const legal = allowedActions(status);
    // Every action legal from `pending_escalation` is gated on being the named
    // target, so without this the escalation target saw NO buttons — and since
    // nothing else can move a request out of that stage, the board froze
    // permanently. `transition()` has always supplied this; the read model
    // that decides what the UI offers did not.
    const isEscalationTarget =
      status === WORKFLOW_STATUS.PENDING_ESCALATION &&
      Boolean(actorId) &&
      project.escalatedToId === actorId;
    // Per-action authority, so the UI only offers what this caller may do.
    const permitted = legal.filter(
      (a) =>
        can(this.capabilityFor(status, a), {
          permissions: perms,
          status,
          isArchived: Boolean(project.archivedAt),
          isEscalationTarget,
        }).allowed,
    );

    const actorIds = [
      ...new Set(rows.map((r) => r.actorId).filter(Boolean)),
    ] as string[];
    const users = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    return {
      projectId,
      status,
      label: WORKFLOW_STATUS_LABELS[status],
      isTerminal: TERMINAL_STATUSES.includes(status),
      allowedActions: legal,
      availableActions: permitted,
      history: rows.map((r) => ({
        id: r.id,
        fromStatus: r.fromStatus,
        toStatus: r.toStatus,
        actor: r.actorId ? (nameById.get(r.actorId) ?? "Unknown") : "System",
        comment: r.comment,
        at: r.createdAt.toISOString(),
      })),
    };
  }

  /** The statuses this caller is allowed to act on (drives "My Approvals"). */
  private actionableStatuses(perms: string[]): WorkflowStatus[] {
    return (Object.keys(STAGE_PERMISSION) as WorkflowStatus[]).filter(
      (s) =>
        s !== WORKFLOW_STATUS.DRAFT &&
        STAGE_PERMISSION[s] !== null &&
        this.canActFrom(s, perms),
    );
  }

  /**
   * Queue behind the request views. Returns the rows for the requested view
   * PLUS the counts for every view, so the tab badges cost no extra round
   * trips. Read-only.
   */
  async listQueue(userId: string, perms: string[], view: WorkflowView) {
    const inWorkflow = { workflowStatus: { not: null } };
    const actionable = this.actionableStatuses(perms);

    const whereFor = (v: WorkflowView) => {
      switch (v) {
        case "mine":
          return { ...inWorkflow, ownerId: userId };
        case "pending": {
          // Two ways something can be waiting on you: you hold the permission
          // for its stage, or the PM escalated it to you personally. The second
          // is not permission-based, so it has to be ORed in explicitly —
          // otherwise an escalation target never sees their own queue.
          const mine: Prisma.ProjectWhereInput[] = [
            {
              workflowStatus: WORKFLOW_STATUS.PENDING_ESCALATION,
              escalatedToId: userId,
            },
          ];
          if (actionable.length) {
            mine.push({ workflowStatus: { in: actionable } });
          }
          return { OR: mine };
        }
        case "completed":
          return { workflowStatus: WORKFLOW_STATUS.COMPLETED };
        case "rejected":
          return { workflowStatus: WORKFLOW_STATUS.REJECTED };
        default:
          return inWorkflow;
      }
    };

    // The queue must not become a directory of every request in the company.
    // `list` / `completed` / `rejected` are status filters with no actor in
    // them, so scope them the same way a single request is scoped: your own
    // rows, rows you sit on, rows escalated to you, or rows at a stage you
    // hold the permission for. `projects:read-all` keeps the full view.
    const scoped = (w: Prisma.ProjectWhereInput): Prisma.ProjectWhereInput => {
      if (perms.includes(PERMISSIONS.PROJECTS_READ_ALL)) return w;
      const mine: Prisma.ProjectWhereInput[] = [
        { ownerId: userId },
        { members: { some: { userId } } },
        { escalatedToId: userId },
      ];
      if (actionable.length) {
        mine.push({ workflowStatus: { in: actionable } });
      }
      return { AND: [w, { OR: mine }] };
    };

    // Four of the five tab counts are just slices of the same per-status
    // tally, so one groupBy replaces four count() round trips. Only `mine`
    // needs its own query — it filters on owner, not status.
    const [rows, byStatus, mine, escalatedToMe] = await Promise.all([
      prisma.project.findMany({
        where: scoped(whereFor(view)),
        select: {
          id: true,
          name: true,
          department: true,
          workflowStatus: true,
          workflowUpdatedAt: true,
          goLiveDate: true,
          createdAt: true,
          // Escalation authority is per-row, so the queue needs the target to
          // decide whether to offer actions on an escalated request.
          escalatedToId: true,
          owner: { select: { id: true, name: true } },
        },
        orderBy: [{ workflowUpdatedAt: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
      prisma.project.groupBy({
        by: ["workflowStatus"],
        where: inWorkflow,
        _count: { _all: true },
      }),
      prisma.project.count({ where: whereFor("mine") }),
      prisma.project.count({
        where: {
          workflowStatus: WORKFLOW_STATUS.PENDING_ESCALATION,
          escalatedToId: userId,
        },
      }),
    ]);

    const tally = new Map(
      byStatus.map((g) => [g.workflowStatus, g._count._all]),
    );
    const tallied = (s: WorkflowStatus) => tally.get(s) ?? 0;
    const counts = {
      list: [...tally.values()].reduce((a, b) => a + b, 0),
      mine,
      // Same two sources as the `pending` filter above. The groupBy is keyed on
      // status alone, so escalations aimed at this caller need their own count.
      pending:
        actionable.reduce((sum, s) => sum + tallied(s), 0) + escalatedToMe,
      completed: tallied(WORKFLOW_STATUS.COMPLETED),
      rejected: tallied(WORKFLOW_STATUS.REJECTED),
    };

    // Authority depends only on the stage, not the row, so resolve it once per
    // distinct status instead of once per row.
    const actionsByStatus = new Map<WorkflowStatus, WorkflowAction[]>();
    const actionsFor = (
      status: WorkflowStatus,
      escalatedToId?: string | null,
    ) => {
      // Escalation authority is per-ROW (is this actor the named target?), so
      // the per-status memo below cannot answer it. Everything legal from this
      // stage is gated on being the target, so it is all-or-nothing.
      if (status === WORKFLOW_STATUS.PENDING_ESCALATION) {
        return escalatedToId === userId ? allowedActions(status) : [];
      }
      let cached = actionsByStatus.get(status);
      if (!cached) {
        cached = this.canActFrom(status, perms) ? allowedActions(status) : [];
        actionsByStatus.set(status, cached);
      }
      return cached;
    };

    return {
      counts,
      rows: rows.map((r) => {
        const status = this.statusOf(r.workflowStatus);
        return {
          id: r.id,
          name: r.name,
          department: r.department,
          status,
          label: WORKFLOW_STATUS_LABELS[status],
          owner: r.owner?.name ?? "—",
          goLiveDate: r.goLiveDate ? r.goLiveDate.toISOString() : null,
          updatedAt: (r.workflowUpdatedAt ?? r.createdAt).toISOString(),
          // Drives the inline Approve / Reject buttons in the list, so an
          // approval is reachable in a single click.
          availableActions: actionsFor(status, r.escalatedToId),
        };
      }),
    };
  }

  /**
   * Everything the request detail page needs in ONE round trip: project
   * details, workflow state + history, and the attachments / comments that
   * exist on the project's tasks.
   */
  async getRequestDetail(projectId: string, perms: string[], actorId?: string) {
    if (actorId) await this.assertCanViewRequest(projectId, actorId, perms);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        description: true,
        details: true,
        status: true,
        department: true,
        departments: true,
        escalatedToId: true,
        comment: true,
        goLiveDate: true,
        revisedGoLiveDate: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    if (!project) throw new NotFoundException("Project not found");

    const escalatedTo = project.escalatedToId
      ? await prisma.user.findUnique({
          where: { id: project.escalatedToId },
          select: { id: true, name: true },
        })
      : null;

    const [workflow, comments, attachments] = await Promise.all([
      this.getState(projectId, perms, actorId),
      // Project-level discussion does not exist as its own entity; surface the
      // comments recorded against this project's tasks.
      prisma.projectTaskComment.findMany({
        where: { task: { projectId } },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
          task: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.projectTaskResource.findMany({
        where: { task: { projectId } },
        select: {
          id: true,
          kind: true,
          label: true,
          url: true,
          createdAt: true,
          task: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return {
      project: {
        ...project,
        goLiveDate: project.goLiveDate?.toISOString() ?? null,
        revisedGoLiveDate: project.revisedGoLiveDate?.toISOString() ?? null,
        createdAt: project.createdAt.toISOString(),
        // Resolved to a name so the detail page can say who it is waiting on
        // rather than showing a bare id.
        escalatedTo: escalatedTo
          ? { id: escalatedTo.id, name: escalatedTo.name }
          : null,
      },
      workflow,
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        author: c.author?.name ?? "Unknown",
        taskTitle: c.task?.title ?? null,
        at: c.createdAt.toISOString(),
      })),
      attachments: attachments.map((a) => ({
        id: a.id,
        kind: a.kind,
        label: a.label,
        url: a.url,
        taskTitle: a.task?.title ?? null,
        at: a.createdAt.toISOString(),
      })),
    };
  }

  /** Draft -> Pending PM Approval. */
  submit(
    id: string,
    userId: string,
    perms: string[],
    comment?: string,
    req?: Request,
  ) {
    return this.transition(
      id,
      userId,
      perms,
      WORKFLOW_ACTION.SUBMIT,
      comment,
      req,
    );
  }

  /** Advances PM -> Business Head -> Product Admin -> Pending Development. */
  approve(
    id: string,
    userId: string,
    perms: string[],
    comment?: string,
    req?: Request,
  ) {
    return this.transition(
      id,
      userId,
      perms,
      WORKFLOW_ACTION.APPROVE,
      comment,
      req,
    );
  }

  /** Pending Development -> Completed. */
  complete(
    id: string,
    userId: string,
    perms: string[],
    comment?: string,
    req?: Request,
  ) {
    return this.transition(
      id,
      userId,
      perms,
      WORKFLOW_ACTION.COMPLETE,
      comment,
      req,
    );
  }

  /** Pending PM Approval -> Draft. Project Manager returns it for changes. */
  returnToRequester(
    id: string,
    userId: string,
    perms: string[],
    reason: string,
    req?: Request,
  ) {
    return this.transition(
      id,
      userId,
      perms,
      WORKFLOW_ACTION.RETURN,
      reason,
      req,
    );
  }

  /** Rejected -> Draft. Project Manager reopens for revision. */
  reopen(
    id: string,
    userId: string,
    perms: string[],
    comment?: string,
    req?: Request,
  ) {
    return this.transition(
      id,
      userId,
      perms,
      WORKFLOW_ACTION.REOPEN,
      comment,
      req,
    );
  }

  /**
   * Archive / unarchive — Project Manager authority. Archiving does not change
   * the workflow status; it makes the project read-only for every role. Logged
   * to the audit trail like any other permission-sensitive action.
   */
  /**
   * Project Manager refers the request to a named approver. The target is a
   * person rather than a role — who needs to sign off varies per request.
   */
  async escalate(
    projectId: string,
    actorId: string,
    perms: string[],
    escalateToId: string,
    comment?: string,
    req?: Request,
  ) {
    return this.transition(
      projectId,
      actorId,
      perms,
      WORKFLOW_ACTION.ESCALATE,
      comment,
      req,
      escalateToId,
    );
  }

  async setArchived(
    projectId: string,
    actorId: string,
    perms: string[],
    archived: boolean,
    comment?: string,
    req?: Request,
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, team: true, workflowStatus: true, archivedAt: true },
    });
    if (!project) throw new NotFoundException("Project not found");

    // This route is a workflow-scoped sibling of `POST /:id/archive`, which
    // gates on owner-or-manage. Without the team check it is the weaker of the
    // two: a `workflow:archive` holder could archive an HR / Legal row out of
    // that board entirely, which the sibling route would have refused.
    if (!isWorkflowTeam(project.team)) {
      throw new ForbiddenException(
        "This project does not use the approval workflow",
      );
    }
    await this.assertCanViewRequest(projectId, actorId, perms);

    const status = this.statusOf(project.workflowStatus);
    // Un-archiving is the same authority as archiving; the isArchived rule
    // only guards the archive direction.
    const decision = can(CAPABILITY.ARCHIVE, {
      permissions: perms,
      status,
      isArchived: archived ? Boolean(project.archivedAt) : false,
    });
    if (!decision.allowed) {
      throw new ForbiddenException(decision.reason ?? "Not authorised");
    }

    const roles = await this.rolesOf(actorId);
    const [updated] = await prisma.$transaction([
      prisma.project.update({
        where: { id: projectId },
        data: { archivedAt: archived ? new Date() : null },
        select: { id: true, name: true, archivedAt: true },
      }),
      prisma.auditLog.create({
        data: {
          userId: actorId,
          action: archived
            ? "project.workflow.archive"
            : "project.workflow.unarchive",
          resource: "project",
          resourceId: projectId,
          details: {
            status,
            comment: comment?.trim() || null,
            roles,
            capability: CAPABILITY.ARCHIVE,
            isWorkflowOwner: isProjectManager(perms),
          },
          ipAddress:
            req?.ip ?? (req?.headers["x-forwarded-for"] as string) ?? null,
          userAgent: req?.headers["user-agent"] ?? null,
        },
      }),
    ]);
    return updated;
  }

  /** Any pending stage -> Rejected. Reason is mandatory. */
  reject(
    id: string,
    userId: string,
    perms: string[],
    reason: string,
    req?: Request,
  ) {
    return this.transition(
      id,
      userId,
      perms,
      WORKFLOW_ACTION.REJECT,
      reason,
      req,
    );
  }

  /**
   * The single mutation path. Validates legality, then authorization, then
   * applies the status update + transition log + audit entry inside ONE
   * database transaction — if any write fails the whole transition rolls back
   * and the project keeps its previous state.
   */
  private async transition(
    projectId: string,
    actorId: string,
    perms: string[],
    action: WorkflowAction,
    comment: string | undefined,
    req?: Request,
    /** Only meaningful for `escalate`: the person the PM is referring it to. */
    escalateToId?: string,
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        team: true,
        workflowStatus: true,
        archivedAt: true,
        escalatedToId: true,
      },
    });
    if (!project) throw new NotFoundException("Project not found");

    // Only this workflow's own boards may be driven through it. Without this,
    // any `workflow:submit` holder could stamp `pending_pm_approval` onto an
    // HR / Legal / Accounting row — which `assertWorkStarted` then reads as
    // "awaiting approval" and freezes that board's tasks.
    if (!isWorkflowTeam(project.team)) {
      throw new ForbiddenException(
        "This project does not use the approval workflow",
      );
    }
    // And only people who can already see the request may move it.
    await this.assertCanViewRequest(projectId, actorId, perms);

    const from = this.statusOf(project.workflowStatus);
    // Recorded on the audit entry alongside the action.
    const roles = await this.rolesOf(actorId);

    // 1. Legality — the transition must exist in the state machine.
    const to = TRANSITIONS[from]?.[action];
    if (!to) {
      throw new BadRequestException(
        TERMINAL_STATUSES.includes(from)
          ? `This project is already ${WORKFLOW_STATUS_LABELS[from]} and can no longer change state`
          : `Cannot ${action} a project that is ${WORKFLOW_STATUS_LABELS[from]}`,
      );
    }

    // 2. Authorization — a single authority decision covering both the role's
    // permission and the "Cannot" rules for this stage.
    const capability = this.capabilityFor(from, action);
    const decision = can(capability, {
      permissions: perms,
      status: from,
      isArchived: Boolean(project.archivedAt),
      isEscalationTarget: project.escalatedToId === actorId,
    });
    if (!decision.allowed) {
      throw new ForbiddenException(
        decision.reason ??
          `You are not authorised to act at the ${WORKFLOW_STATUS_LABELS[from]} stage`,
      );
    }

    // When a chain IS configured, holding the permission is not enough: the
    // stage belongs to the person it names. This narrows authority, never widens
    // it — the permission check above still has to pass first.
    const chain = await this.chainContext(projectId, actorId, perms);
    // An escalation target decides the stage they were escalated INTO. The
    // chain names the routine approver, not them, so applying the chain's
    // identity check here would refuse exactly the person the escalation
    // appointed — and whom the notification email points at. Gate 1 above
    // already proved they are the named target.
    // Status-guarded: a `return` from pending_escalation lands on
    // pending_pm_approval WITHOUT clearing escalated_to_id, so an unguarded
    // check would let the old target settle a stage named to somebody else and
    // record it under their name.
    const isEscalationTarget =
      from === WORKFLOW_STATUS.PENDING_ESCALATION &&
      project.escalatedToId === actorId;
    const settlesAStage =
      chain.hasChain &&
      (action === WORKFLOW_ACTION.APPROVE || action === WORKFLOW_ACTION.REJECT);
    // The bypass is on the REFUSAL only, never on `settlesAStage` itself — an
    // escalated approval must still settle and advance the chain, it just must
    // not be refused for carrying the wrong identity.
    if (settlesAStage && !chain.canDecideStage && !isEscalationTarget) {
      throw new ForbiddenException(
        "This stage of the approval chain is not yours to decide",
      );
    }

    // 3. A rejection must always carry a reason.
    const trimmed = comment?.trim() || null;
    if (action === WORKFLOW_ACTION.REJECT && !trimmed) {
      throw new BadRequestException("A rejection reason is required");
    }

    // 3b. An escalation must name someone who can actually act on it. Checked
    // here rather than in the validator because it needs the database.
    let nextEscalatedToId: string | null | undefined;
    if (action === WORKFLOW_ACTION.ESCALATE) {
      if (!escalateToId) {
        throw new BadRequestException("Choose who to escalate this request to");
      }
      if (escalateToId === actorId) {
        // Escalating to yourself would let the PM manufacture a second
        // approval, which defeats the point of escalating at all.
        throw new BadRequestException(
          "You cannot escalate a request to yourself",
        );
      }
      const target = await prisma.user.findUnique({
        where: { id: escalateToId },
        select: { id: true, isActive: true },
      });
      if (!target || !target.isActive) {
        throw new BadRequestException(
          "That person cannot receive escalations — they are inactive or no longer exist",
        );
      }
      nextEscalatedToId = target.id;
    } else if (
      isApproved(to) ||
      TERMINAL_STATUSES.includes(to) ||
      to === WORKFLOW_STATUS.DRAFT ||
      // Any exit from the escalation clears it — `return` lands on
      // pending_pm_approval, which matches none of the above, and leaving the
      // id set kept a stale target able to act on the stage that follows.
      from === WORKFLOW_STATUS.PENDING_ESCALATION
    ) {
      // Leaving the escalation behind: clear the target so a later escalation
      // starts clean and "waiting on me" stops matching.
      nextEscalatedToId = null;
    }

    const now = new Date();

    // 4. Atomic apply: chain stage + status + history + audit.
    //
    // A callback transaction rather than the array form, because the chain's
    // answer decides where an approval lands and that answer only exists once
    // the stage has been settled.
    const {
      updated,
      record,
      to: landed,
    } = await prisma.$transaction(async (tx) => {
      let target = to;

      // Entering approval takes a fresh copy of the chain; leaving it discards
      // the old one. A resubmission should follow TODAY'S chain, not the one
      // captured before the request was sent back.
      if (to === WORKFLOW_STATUS.PENDING_PM_APPROVAL && !chain.hasChain) {
        const snap = await chainService.snapshot(
          tx,
          CHAIN_SCOPE.PROJECT_REQUEST,
          this.owner(projectId),
        );
        await tx.project.update({
          where: { id: projectId },
          data: { currentStepOrder: snap.firstOrder },
        });
      } else if (to === WORKFLOW_STATUS.DRAFT) {
        await chainService.clear(tx, this.owner(projectId));
        await tx.project.update({
          where: { id: projectId },
          data: { currentStepOrder: null },
        });
      }

      if (settlesAStage && chain.decisionId) {
        const advanced = await chainService.advance(tx, this.owner(projectId), {
          decisionId: chain.decisionId,
          approve: action === WORKFLOW_ACTION.APPROVE,
          actorId,
          notes: trimmed,
        });
        // A later stage still owes a decision, so the request stays in approval
        // rather than being released to development.
        if (action === WORKFLOW_ACTION.APPROVE && !advanced.isComplete) {
          target = CHAIN_ADVANCE_TARGET[from] ?? to;
        }
        await tx.project.update({
          where: { id: projectId },
          data: { currentStepOrder: advanced.nextOrder },
        });
      }

      const row = await tx.project.update({
        where: { id: projectId },
        data: {
          workflowStatus: target,
          workflowUpdatedAt: now,
          ...(nextEscalatedToId !== undefined && {
            escalatedToId: nextEscalatedToId,
          }),
        },
        select: {
          id: true,
          name: true,
          workflowStatus: true,
          workflowUpdatedAt: true,
          escalatedToId: true,
        },
      });

      const transitionRow = await tx.projectWorkflowTransition.create({
        data: {
          projectId,
          fromStatus: from,
          toStatus: target,
          actorId,
          comment: trimmed,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: `project.workflow.${action}`,
          resource: "project",
          resourceId: projectId,
          details: {
            previousStatus: from,
            newStatus: target,
            comment: trimmed,
            // Which stage of the chain this settled, so the trail says WHERE the
            // decision happened rather than only that the status moved.
            ...(settlesAStage && { stageOrder: chain.currentOrder }),
            // Permission-sensitive action: record WHO acted, in WHAT role,
            // and under which capability the action was authorised.
            roles,
            capability,
            isWorkflowOwner: isProjectManager(perms),
            ...(action === WORKFLOW_ACTION.ESCALATE && {
              escalatedTo: nextEscalatedToId,
            }),
          },
          ipAddress:
            req?.ip ?? (req?.headers["x-forwarded-for"] as string) ?? null,
          userAgent: req?.headers["user-agent"] ?? null,
        },
      });

      return { updated: row, record: transitionRow, to: target };
    });

    // Email fan-out happens AFTER the transaction has committed, so a
    // rolled-back transition can never notify anyone. The service swallows
    // its own failures — mail must never undo an approval that succeeded.
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { name: true },
    });
    await workflowEmailService.onTransition({
      projectId,
      transitionId: record.id,
      fromStatus: from,
      // Where it landed, which the chain may have redirected: an approval with a
      // later stage outstanding stays in approval rather than reaching
      // development, and the notification has to say so.
      toStatus: landed,
      actorName: actor?.name ?? "Unknown",
      comment: trimmed,
      escalatedToId: updated.escalatedToId,
    });

    // Web Push, to the same recipients email just used. Also post-commit, also
    // best-effort — it swallows its own failures, so a push service being down
    // cannot undo an approval that has already succeeded.
    await workflowPushService.onTransition({
      projectId,
      transitionId: record.id,
      toStatus: landed,
      escalatedToId: updated.escalatedToId,
      actorId,
    });

    return {
      project: updated,
      transition: {
        id: record.id,
        fromStatus: from,
        toStatus: landed,
        at: record.createdAt.toISOString(),
        comment: trimmed,
      },
    };
  }
}

export const workflowService = new WorkflowService();
