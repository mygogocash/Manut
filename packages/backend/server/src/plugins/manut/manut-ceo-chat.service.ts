/**
 * M17 — CEO Chat orchestrator.
 *
 * Top-level chat surface that resolves every USER turn to a typed work
 * object (MnTask / MnApproval / MnTaskPlan / DECISION_RECORDED). Intent
 * classification is a keyword-heuristic placeholder; a real LLM
 * classifier is deferred to a follow-up that wires the existing
 * Manut auto-router (`copilot/auto-router.ts`) into the resolver.
 *
 * State machine, per user turn:
 *
 *    [USER turn persisted] ──► classifyIntent() ──► MnCeoResolutionKind
 *                                                     │
 *                          ┌──────────────────────────┤
 *                          ▼                          ▼
 *                  TASK_CREATED                APPROVAL_REQUESTED
 *                  resolveIntent() →           resolveIntent() →
 *                  MnTask.create()             MnApproval.create()
 *                          │                          │
 *                          ▼                          ▼
 *                  turn.resolutionRefId = <work object id>
 *                  conversation.lastResolutionKind = kind
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` so TypeScript emits `design:paramtypes` for NestJS
 *    DI (v1.12.0 scar).
 *  - `PrismaClient`, `MnCeoResolutionKind`, `MnCeoTurnRole` are RUNTIME
 *    imports (not `import type`) — they are the constructor target and
 *    the enum value sources respectively. `MnCeoConversation` and
 *    `MnCeoTurn` are pure type-only usages, safe to `import type`.
 *  - The service writes to `mnCeoTurn` / `mnCeoConversation` only. Work
 *    object creation goes through the same Prisma client to keep
 *    invariants (project-in-workspace, agent-in-workspace, etc.) the
 *    one-and-only PM/Approval/Plan resolvers enforce. The CEO resolver
 *    is a thin orchestrator above those service surfaces.
 */
import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MnCeoConversation, MnCeoTurn } from '@prisma/client';
import {
  MnApprovalType,
  MnCeoResolutionKind,
  MnCeoTurnRole,
  PrismaClient,
} from '@prisma/client';

/**
 * Keyword → resolution kind. Ordered: longer / more-specific phrases
 * come first so "approve" beats nothing and "draft plan" beats
 * "plan". The match is case-insensitive and whole-word — we don't
 * fire `STATUS_QUERY` on the word "status" embedded inside another
 * word (e.g. "circumstatus"). Tested in `m17-ceo-chat-service.spec.ts`.
 */
const INTENT_KEYWORDS: Array<{
  pattern: RegExp;
  kind: MnCeoResolutionKind;
}> = [
  {
    pattern: /\bdraft\s+(?:a\s+)?plan\b/i,
    kind: MnCeoResolutionKind.PLAN_DRAFTED,
  },
  {
    pattern: /\bcreate\s+(?:a\s+)?task\b/i,
    kind: MnCeoResolutionKind.TASK_CREATED,
  },
  { pattern: /\bapprove\b/i, kind: MnCeoResolutionKind.APPROVAL_REQUESTED },
  { pattern: /\bdecide\b/i, kind: MnCeoResolutionKind.DECISION_RECORDED },
  { pattern: /\bbudget\b/i, kind: MnCeoResolutionKind.BUDGET_QUERY },
  { pattern: /\bstatus\b/i, kind: MnCeoResolutionKind.STATUS_QUERY },
];

@Injectable()
export class MnCeoChatService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Create a new conversation owned by `ownerUserId` in `workspaceId`.
   * The title is optional; resolvers may default it from the first
   * USER turn's body before persisting.
   */
  async createConversation(
    workspaceId: string,
    ownerUserId: string,
    title?: string | null
  ): Promise<MnCeoConversation> {
    if (!workspaceId.trim()) {
      throw new BadRequestException('workspaceId is required');
    }
    if (!ownerUserId.trim()) {
      throw new BadRequestException('ownerUserId is required');
    }
    return this.db.mnCeoConversation.create({
      data: {
        id: randomUUID(),
        workspaceId,
        ownerUserId,
        title: title ?? null,
      },
    });
  }

  /**
   * List conversations in a workspace. Most recent first.
   */
  async listConversations(workspaceId: string): Promise<MnCeoConversation[]> {
    return this.db.mnCeoConversation.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Fetch a single conversation by id and assert it belongs to the
   * given workspace (caller-side fence). Returns `null` if missing or
   * the workspace doesn't match — callers throw NotFoundException at
   * the resolver edge.
   */
  async getConversation(
    workspaceId: string,
    conversationId: string
  ): Promise<MnCeoConversation | null> {
    const row = await this.db.mnCeoConversation.findUnique({
      where: { id: conversationId },
    });
    if (!row || row.workspaceId !== workspaceId) {
      return null;
    }
    return row;
  }

  /**
   * List turns in a conversation, oldest first. Caller is responsible
   * for verifying the conversation is in the user's workspace before
   * exposing turns.
   */
  async listTurns(conversationId: string): Promise<MnCeoTurn[]> {
    return this.db.mnCeoTurn.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Append a new turn to a conversation. Bumps the conversation's
   * `updatedAt` so list ordering stays accurate. The resolution kind
   * defaults to NONE — `resolveIntent` is the one path that updates it
   * after work-object creation.
   */
  async addTurn(
    conversationId: string,
    role: MnCeoTurnRole,
    bodyMd: string,
    resolution?: MnCeoResolutionKind
  ): Promise<MnCeoTurn> {
    if (!bodyMd.trim()) {
      throw new BadRequestException('bodyMd is required');
    }
    const conv = await this.db.mnCeoConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }
    const turn = await this.db.mnCeoTurn.create({
      data: {
        id: randomUUID(),
        conversationId,
        role,
        bodyMd,
        resolutionKind: resolution ?? MnCeoResolutionKind.NONE,
      },
    });
    await this.db.mnCeoConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return turn;
  }

  /**
   * Classify the user's intent based on keyword heuristics. Returns
   * the first matching resolution kind (longest / most-specific
   * phrases come first in `INTENT_KEYWORDS`); falls back to NONE when
   * no keyword matches.
   *
   * NOTE: This is intentionally a stub. The follow-up classifier will
   * route through the Vertex auto-router so we get LLM-grade intent
   * detection. The stub is good enough to exercise the rest of the
   * resolution machinery (work object creation, ref linking, list
   * rendering) in tests and on the demo path.
   */
  classifyIntent(bodyMd: string): MnCeoResolutionKind {
    for (const { pattern, kind } of INTENT_KEYWORDS) {
      if (pattern.test(bodyMd)) {
        return kind;
      }
    }
    return MnCeoResolutionKind.NONE;
  }

  /**
   * Resolve a turn into a work object. Looks up the turn, classifies
   * its body, creates the matching work object (when applicable),
   * and stores the work object id on `turn.resolutionRefId`. Also
   * mirrors the resolution kind onto the parent conversation's
   * `lastResolutionKind` cache for cheap list rendering.
   *
   * Branch summary:
   *   TASK_CREATED       → MnTask in the workspace's first project
   *   APPROVAL_REQUESTED → MnApproval (OTHER) in the same project
   *   PLAN_DRAFTED       → MnTaskPlan attached to a placeholder MnTask
   *                        (one-shot — see TODO below)
   *   DECISION_RECORDED  → no external row; resolutionKind alone is the
   *                        audit trail
   *   BUDGET_QUERY       → no row; the resolver renders a snapshot
   *   STATUS_QUERY       → no row; the resolver renders a snapshot
   *   NONE               → no-op
   */
  async resolveIntent(turnId: string): Promise<MnCeoTurn> {
    const turn = await this.db.mnCeoTurn.findUnique({
      where: { id: turnId },
      include: { conversation: true },
    });
    if (!turn) {
      throw new NotFoundException('Turn not found');
    }
    if (turn.role !== MnCeoTurnRole.USER) {
      // Only USER turns are resolved. CEO_AGENT / SYSTEM turns are the
      // resolution announcement itself — re-resolving them would loop.
      return turn;
    }
    const kind = this.classifyIntent(turn.bodyMd);
    let refId: string | null = null;

    if (
      kind === MnCeoResolutionKind.TASK_CREATED ||
      kind === MnCeoResolutionKind.APPROVAL_REQUESTED ||
      kind === MnCeoResolutionKind.PLAN_DRAFTED
    ) {
      const workspaceId = turn.conversation.workspaceId;
      const project = await this.findDefaultProject(workspaceId);
      if (project) {
        if (kind === MnCeoResolutionKind.TASK_CREATED) {
          const task = await this.db.mnTask.create({
            data: {
              id: randomUUID(),
              projectId: project.id,
              title: this.titleFromBody(turn.bodyMd),
              description: turn.bodyMd,
              createdByUserId: turn.conversation.ownerUserId,
            },
          });
          refId = task.id;
        } else if (kind === MnCeoResolutionKind.APPROVAL_REQUESTED) {
          const approval = await this.db.mnApproval.create({
            data: {
              id: randomUUID(),
              workspaceId,
              projectId: project.id,
              type: MnApprovalType.APPROVE_TASK_COMPLETION,
              requestedByUserId: turn.conversation.ownerUserId,
              payload: { sourceTurnId: turn.id, requestBody: turn.bodyMd },
            },
          });
          refId = approval.id;
        } else if (kind === MnCeoResolutionKind.PLAN_DRAFTED) {
          // Plans attach to a task. The CEO chat doesn't always have a
          // target task yet, so create a placeholder MnTask in the
          // default project and attach the plan to it. The user can
          // later re-parent the plan; this beats refusing to record
          // the plan because no task exists.
          const placeholder = await this.db.mnTask.create({
            data: {
              id: randomUUID(),
              projectId: project.id,
              title: this.titleFromBody(turn.bodyMd),
              description: 'Auto-created by CEO Chat plan draft',
              createdByUserId: turn.conversation.ownerUserId,
            },
          });
          const plan = await this.db.mnTaskPlan.create({
            data: {
              id: randomUUID(),
              taskId: placeholder.id,
              revisionNumber: 1,
              bodyMd: turn.bodyMd,
              authorUserId: turn.conversation.ownerUserId,
            },
          });
          refId = plan.id;
        }
      }
    }

    const updated = await this.db.mnCeoTurn.update({
      where: { id: turnId },
      data: { resolutionKind: kind, resolutionRefId: refId },
    });
    await this.db.mnCeoConversation.update({
      where: { id: turn.conversationId },
      data: { lastResolutionKind: kind, updatedAt: new Date() },
    });
    return updated;
  }

  /**
   * Pick the first project in a workspace for default routing when a
   * resolution needs to attach to a project. Future iterations can
   * thread an explicit `targetProjectId` through the chat composer.
   */
  private async findDefaultProject(
    workspaceId: string
  ): Promise<{ id: string } | null> {
    const row = await this.db.mnProject.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return row ?? null;
  }

  /**
   * Derive a short title from the body. Takes the first line or the
   * first 60 chars, whichever is shorter. Trimmed.
   */
  private titleFromBody(bodyMd: string): string {
    const firstLine = bodyMd.split('\n')[0]?.trim() ?? '';
    if (firstLine.length === 0) {
      return 'Untitled CEO chat item';
    }
    return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
  }
}
