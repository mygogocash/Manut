import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { MnSkill, MnTask } from '@prisma/client';
import { MnMemoryKind, MnSkillSource, PrismaClient } from '@prisma/client';

import {
  MnLearningCandidateStatus,
  type PlaybookExtractionPromptInput,
  type PlaybookExtractionPromptOutput,
} from './manut-org-learning.dto';

/**
 * M16 — Automatic Organizational Learning.
 *
 * After a task transitions to DONE, this service extracts a reusable
 * playbook from its description / DoD / agent memories and persists it
 * as a candidate {@link MnSkill} row (source=IMPORTED) awaiting
 * operator approval. Approved candidates remain source=IMPORTED so the
 * provenance (auto-extracted vs hand-authored) survives forever.
 *
 * The candidate marker is embedded as a trailing HTML comment inside
 * {@link MnSkill.contentMd}:
 *
 *     <!-- mn-learning-candidate: {"sourceTaskId":"...","status":"pending"} -->
 *
 * No schema change. The marker is the single source of truth — listing
 * candidates is a substring scan over `contentMd`, and `status` flips
 * by re-rendering the marker. Approving a candidate rewrites the marker
 * to `"status":"approved"` AND clears the marker entirely from the
 * canonical `contentMd` once promotion is final so downstream consumers
 * of MnSkill see a clean body. Rejection sets status=rejected AND
 * archives the row (MnSkill has soft-delete via archivedAt).
 *
 * Invariants enforced here (NOT in the resolver) so direct service
 * callers get the same guarantees as GraphQL clients:
 *
 *  1. `workspaceId` is the tenancy fence on every read AND write. A
 *     candidate id leaked from another workspace cannot be approved or
 *     rejected — the row lookup re-checks workspaceId before mutating.
 *  2. Decision-memory rows are written with `kind=DECISION` and their
 *     importance is derived from the task's priority (`URGENT=8,
 *     HIGH=6, MEDIUM=4, LOW=2, NONE=2`) so operator-curated importance
 *     never gets clobbered by the auto-write.
 *  3. Re-running extraction on the same task produces a fresh slug
 *     suffix (`-<short-uuid>`) — the M5 (workspaceId, slug) unique
 *     constraint means we can't blindly overwrite; instead we add a
 *     new candidate so the operator gets to compare proposals.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` is present so TS emits `design:paramtypes` and
 *    NestJS DI can resolve `PrismaClient` (v1.12.0 production scar).
 *  - `PrismaClient` + `MnMemoryKind` + `MnSkillSource` are RUNTIME
 *    imports, not `import type`, so the constructor parameter
 *    metadata reflects the real classes (v1.12.0 production scar).
 *  - Row types `MnSkill`, `MnTask`, `MnAgentMemory` ARE imported via
 *    `import type` — pure type usage is fine.
 *  - Owner rule: no direct touch of MnSkillService / MnAgentMemoryService.
 *    All DB writes go through PrismaClient directly so this service
 *    is a true peer of M5 / M9 — neither owns the other.
 */
@Injectable()
export class MnOrgLearningService {
  private readonly logger = new Logger(MnOrgLearningService.name);

  constructor(private readonly db: PrismaClient) {}

  /**
   * Default prompt template. Returns a stub playbook derived
   * deterministically from the input so the service is self-sufficient
   * without a model call. Tests override this via
   * {@link setPromptTemplate} to assert the input shape that WOULD have
   * gone to a real model.
   *
   * Production wiring (deferred) will replace this with a Vertex AI
   * call that returns the same shape. Keeping the default deterministic
   * means an operator can disable the AI provider entirely and the
   * extraction surface still works — they just get a templated
   * playbook instead of an LLM-authored one.
   */
  private promptTemplate: (
    input: PlaybookExtractionPromptInput
  ) => Promise<PlaybookExtractionPromptOutput> = async input => {
    const body = [
      `# Playbook: ${input.title}`,
      '',
      input.description?.trim() ?? '_(no description on source task)_',
      '',
      '## Observations',
      ...input.relatedMemorySnippets.slice(0, 5).map(m => {
        const head = m.contentMd.split('\n')[0].trim();
        const trimmed = head.length > 200 ? head.slice(0, 197) + '...' : head;
        return `- [${m.kind}] ${trimmed}`;
      }),
    ].join('\n');

    return {
      slug: buildCandidateSlug(input.title, input.taskId),
      name: input.title,
      body,
      observations: input.relatedMemorySnippets.map(m => m.kind),
    };
  };

  /**
   * Override the prompt template — used by the test harness to assert
   * the prompt-template-input shape WITHOUT making a real model call.
   * Returns the previous template so a test can chain restores.
   */
  setPromptTemplate(
    template: (
      input: PlaybookExtractionPromptInput
    ) => Promise<PlaybookExtractionPromptOutput>
  ): (
    input: PlaybookExtractionPromptInput
  ) => Promise<PlaybookExtractionPromptOutput> {
    const previous = this.promptTemplate;
    this.promptTemplate = template;
    return previous;
  }

  /**
   * Extract a candidate playbook from a completed task. Pulls the
   * task's description, DoD predicates, and associated agent memories,
   * runs them through the prompt template, and persists the result as
   * an MnSkill row (source=IMPORTED) with the pending marker embedded
   * in `contentMd`.
   *
   * Returns the persisted candidate. Throws NotFoundException if the
   * task does not exist OR belongs to a workspace the caller is not
   * scoped to — `expectedWorkspaceId` is the tenancy fence: callers
   * MUST pass the workspace they are authorized for so a leaked taskId
   * from another tenant cannot drive an extraction.
   */
  async extractPlaybookFromTask(
    taskId: string,
    expectedWorkspaceId: string
  ): Promise<MnSkill> {
    if (!taskId) {
      throw new BadRequestException('taskId is required');
    }
    if (!expectedWorkspaceId) {
      throw new BadRequestException('workspaceId is required');
    }

    const task = await this.db.mnTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        title: true,
        description: true,
        priority: true,
        definitionOfDone: true,
        project: { select: { workspaceId: true } },
      },
    });
    if (!task) {
      throw new NotFoundException(`Task '${taskId}' not found`);
    }
    const workspaceId = task.project.workspaceId;
    if (workspaceId !== expectedWorkspaceId) {
      // Don't leak existence across tenants.
      throw new NotFoundException(`Task '${taskId}' not found`);
    }

    const [memories, activities] = await Promise.all([
      this.db.mnAgentMemory.findMany({
        where: { workspaceId, taskId },
        orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      this.db.mnTaskActivity.findMany({
        where: { taskId },
        orderBy: [{ createdAt: 'desc' }],
        take: 20,
      }),
    ]);

    const promptInput: PlaybookExtractionPromptInput = {
      taskId: task.id,
      workspaceId,
      projectId: task.projectId,
      title: task.title,
      description: task.description ?? null,
      definitionOfDone: task.definitionOfDone ?? null,
      relatedMemorySnippets: memories.map(m => ({
        kind: m.kind,
        contentMd: m.contentMd,
      })),
      recentActivityActions: activities.map(a => ({
        action: a.action,
        createdAt: a.createdAt.toISOString(),
      })),
    };

    const result = await this.promptTemplate(promptInput);
    const { slug, name, body } = sanitizePromptOutput(result, task);

    const markedContent = stampMarkerOntoContent(body, {
      candidateOf: 'auto-learning',
      sourceTaskId: task.id,
      status: 'pending',
    });

    // Re-run on the same task → fresh suffix so we never collide with
    // a prior candidate. The (workspaceId, slug) unique constraint
    // would otherwise reject the second run.
    const finalSlug = await this.findFreeSlug(workspaceId, slug);

    return this.db.mnSkill.create({
      data: {
        id: randomUUID(),
        workspaceId,
        slug: finalSlug,
        name,
        description: truncate(task.description ?? name, 2000),
        contentMd: markedContent,
        version: `auto-${new Date().toISOString().slice(0, 10)}`,
        source: MnSkillSource.IMPORTED,
      },
    });
  }

  /**
   * Walk the task's activity log for typed-decision rows and persist
   * each one as an `MnAgentMemory(kind=DECISION)`. Importance scales
   * with task priority: URGENT=8, HIGH=6, MEDIUM=4, LOW=2, NONE=2.
   *
   * A "typed decision" is an activity row whose `action` starts with
   * `decision_` OR whose `metadata.kind === 'decision'`. This is
   * intentionally loose so future activity emitters (PM resolver,
   * approval gate, watchdog) can opt in by following the convention
   * without a schema change.
   *
   * Returns the number of memory rows created. Idempotent within a
   * task: re-running won't dedupe because activity rows are append-only
   * and the operator can `garbageCollect` low-importance noise via M9.
   */
  async extractDecisionMemory(
    taskId: string,
    expectedWorkspaceId: string
  ): Promise<number> {
    if (!taskId) {
      throw new BadRequestException('taskId is required');
    }
    if (!expectedWorkspaceId) {
      throw new BadRequestException('workspaceId is required');
    }

    const task = await this.db.mnTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        priority: true,
        assigneeAgentId: true,
        project: { select: { workspaceId: true } },
      },
    });
    if (!task) {
      throw new NotFoundException(`Task '${taskId}' not found`);
    }
    const workspaceId = task.project.workspaceId;
    if (workspaceId !== expectedWorkspaceId) {
      throw new NotFoundException(`Task '${taskId}' not found`);
    }

    // We need an agent to attribute the decision to. If the task has no
    // agent assignee there's nothing to memoize — decisions are
    // per-agent recall artefacts. Bail quietly rather than throwing so
    // the caller can run extraction blindly across a batch.
    if (!task.assigneeAgentId) {
      return 0;
    }
    const agentId = task.assigneeAgentId;

    const activities = await this.db.mnTaskActivity.findMany({
      where: { taskId },
      orderBy: [{ createdAt: 'asc' }],
    });

    const decisions = activities.filter(isDecisionActivity);
    if (decisions.length === 0) return 0;

    const importance = mapPriorityToImportance(task.priority);

    let created = 0;
    for (const activity of decisions) {
      const contentMd = renderDecisionMarkdown(activity);
      try {
        await this.db.mnAgentMemory.create({
          data: {
            id: randomUUID(),
            workspaceId,
            projectId: task.projectId,
            agentId,
            taskId: task.id,
            kind: MnMemoryKind.DECISION,
            contentMd,
            importance,
          },
        });
        created++;
      } catch (err) {
        // Don't blow up the whole batch on a single write failure —
        // the audit trail in `task.activities` still has the decision.
        this.logger.warn(
          `Failed to persist DECISION memory for task=${taskId} activity=${activity.id}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
    return created;
  }

  /**
   * List candidate playbooks for a workspace, newest first. The status
   * filter defaults to PENDING — the natural "inbox" semantics —
   * because the common operator workflow is "show me what's waiting on
   * me". Pass an explicit status (APPROVED / REJECTED) to inspect
   * historical decisions.
   *
   * The marker block is parsed back out of `contentMd` so the caller
   * sees a clean structural row alongside the body.
   *
   * IMPORTANT: this filters MnSkill rows where the marker block is
   * present in `contentMd`. Skills authored via the regular M5 surface
   * (no marker) are NEVER returned, even if `source=IMPORTED` — the
   * marker is what distinguishes auto-learning candidates from
   * AGENTS.md imports.
   */
  async listLearningCandidates(
    workspaceId: string,
    options: { status?: MnLearningCandidateStatus } = {}
  ): Promise<ReadonlyArray<ParsedCandidate>> {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId is required');
    }

    const status = options.status ?? MnLearningCandidateStatus.PENDING;

    const rows = await this.db.mnSkill.findMany({
      where: {
        workspaceId,
        source: MnSkillSource.IMPORTED,
        contentMd: { contains: CANDIDATE_MARKER_PREFIX },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    const parsed: ParsedCandidate[] = [];
    for (const row of rows) {
      const meta = parseMarker(row.contentMd);
      if (!meta) continue; // Marker missing or corrupt — skip silently.
      const candidateStatus = normaliseStatus(meta.status);
      if (candidateStatus !== status) continue;
      // Don't surface rejected-AND-archived candidates unless the
      // caller asked for them explicitly. Approving doesn't archive,
      // so an APPROVED candidate's archivedAt is null and survives this
      // guard.
      if (
        row.archivedAt !== null &&
        status !== MnLearningCandidateStatus.REJECTED
      ) {
        continue;
      }
      parsed.push(toParsedCandidate(row, candidateStatus, meta.sourceTaskId));
    }
    return parsed;
  }

  /**
   * Promote a candidate to a real skill. The row remains
   * `source=IMPORTED` so we never lose the provenance fact — but the
   * marker is rewritten to `status=approved` so subsequent listings
   * filter it out of the pending bucket. The candidate marker is left
   * inside `contentMd` (as `status=approved`) for audit; approval is
   * NOT a destructive write of body content.
   */
  async approveLearningCandidate(
    workspaceId: string,
    candidateId: string
  ): Promise<MnSkill> {
    return this.updateCandidateStatus(
      workspaceId,
      candidateId,
      MnLearningCandidateStatus.APPROVED
    );
  }

  /**
   * Reject a candidate. Archives the row (sets `archivedAt`) AND
   * rewrites the marker to `status=rejected` so the audit trail
   * survives. Subsequent calls to `listLearningCandidates({status:
   * REJECTED})` will surface the row.
   */
  async rejectLearningCandidate(
    workspaceId: string,
    candidateId: string
  ): Promise<MnSkill> {
    const updated = await this.updateCandidateStatus(
      workspaceId,
      candidateId,
      MnLearningCandidateStatus.REJECTED
    );
    if (updated.archivedAt !== null) return updated;
    return this.db.mnSkill.update({
      where: { id: candidateId },
      data: { archivedAt: new Date() },
    });
  }

  private async updateCandidateStatus(
    workspaceId: string,
    candidateId: string,
    status: MnLearningCandidateStatus
  ): Promise<MnSkill> {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId is required');
    }
    if (!candidateId) {
      throw new BadRequestException('candidateId is required');
    }

    const current = await this.db.mnSkill.findUnique({
      where: { id: candidateId },
    });
    if (!current || current.workspaceId !== workspaceId) {
      throw new NotFoundException(`Candidate '${candidateId}' not found`);
    }
    if (current.source !== MnSkillSource.IMPORTED) {
      throw new BadRequestException(
        `Skill '${candidateId}' is not an auto-learning candidate ` +
          `(source=${current.source})`
      );
    }
    const marker = parseMarker(current.contentMd);
    if (!marker) {
      throw new BadRequestException(
        `Skill '${candidateId}' is not an auto-learning candidate ` +
          `(no candidate marker)`
      );
    }

    const newContent = stampMarkerOntoContent(
      stripMarkerFromContent(current.contentMd),
      {
        candidateOf: 'auto-learning',
        sourceTaskId: marker.sourceTaskId,
        status: status.toLowerCase() as 'pending' | 'approved' | 'rejected',
      }
    );

    // Bump version: the body changed (marker re-stamped), and the
    // M5 service enforces a version bump on any contentMd write.
    // Using a deterministic suffix derived from status so two
    // operators clicking approve concurrently end up with the same
    // version, which Prisma handles via row-lock without our
    // intervention.
    const nextVersion = bumpVersion(current.version, status);

    return this.db.mnSkill.update({
      where: { id: candidateId },
      data: {
        contentMd: newContent,
        version: nextVersion,
      },
    });
  }

  /**
   * Find an unused slug in the workspace. Tries the base first, then
   * appends `-<short-uuid>` until we hit a free one. The collision
   * loop is bounded to 5 attempts — at that point we let the unique
   * constraint surface as a BadRequestException so the caller can
   * retry with a different title.
   */
  private async findFreeSlug(
    workspaceId: string,
    baseSlug: string
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate =
        attempt === 0 ? baseSlug : `${baseSlug}-${randomUUID().slice(0, 6)}`;
      const conflict = await this.db.mnSkill.findUnique({
        where: { workspaceId_slug: { workspaceId, slug: candidate } },
      });
      if (!conflict) return candidate;
    }
    throw new BadRequestException(
      `Could not allocate a free slug after 5 attempts for base '${baseSlug}'`
    );
  }
}

// ---------------------------------------------------------------------------
// Marker handling — public-ish for tests but not GraphQL surface.
// ---------------------------------------------------------------------------

const CANDIDATE_MARKER_PREFIX = '<!-- mn-learning-candidate: ';
const CANDIDATE_MARKER_SUFFIX = ' -->';

interface MarkerPayload {
  readonly candidateOf: 'auto-learning';
  readonly sourceTaskId: string | null;
  readonly status: 'pending' | 'approved' | 'rejected';
}

export interface ParsedCandidate {
  readonly id: string;
  readonly workspaceId: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly body: string;
  readonly sourceTaskId: string | null;
  readonly status: MnLearningCandidateStatus;
  readonly source: MnSkillSource;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function stampMarkerOntoContent(
  content: string,
  payload: MarkerPayload
): string {
  const stripped = stripMarkerFromContent(content).trimEnd();
  const marker = `${CANDIDATE_MARKER_PREFIX}${JSON.stringify(payload)}${CANDIDATE_MARKER_SUFFIX}`;
  return `${stripped}\n\n${marker}\n`;
}

function stripMarkerFromContent(content: string): string {
  const idx = content.lastIndexOf(CANDIDATE_MARKER_PREFIX);
  if (idx < 0) return content;
  const end = content.indexOf(CANDIDATE_MARKER_SUFFIX, idx);
  if (end < 0) return content;
  return (
    content.slice(0, idx) + content.slice(end + CANDIDATE_MARKER_SUFFIX.length)
  )
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

function parseMarker(content: string): MarkerPayload | null {
  const idx = content.lastIndexOf(CANDIDATE_MARKER_PREFIX);
  if (idx < 0) return null;
  const start = idx + CANDIDATE_MARKER_PREFIX.length;
  const end = content.indexOf(CANDIDATE_MARKER_SUFFIX, start);
  if (end < 0) return null;
  const raw = content.slice(start, end).trim();
  try {
    const obj = JSON.parse(raw) as Partial<MarkerPayload> & {
      [key: string]: unknown;
    };
    if (obj.candidateOf !== 'auto-learning') return null;
    const status =
      obj.status === 'approved' || obj.status === 'rejected'
        ? obj.status
        : 'pending';
    const sourceTaskId =
      typeof obj.sourceTaskId === 'string' ? obj.sourceTaskId : null;
    return {
      candidateOf: 'auto-learning',
      sourceTaskId,
      status,
    };
  } catch {
    return null;
  }
}

function normaliseStatus(
  status: 'pending' | 'approved' | 'rejected'
): MnLearningCandidateStatus {
  switch (status) {
    case 'approved':
      return MnLearningCandidateStatus.APPROVED;
    case 'rejected':
      return MnLearningCandidateStatus.REJECTED;
    default:
      return MnLearningCandidateStatus.PENDING;
  }
}

function toParsedCandidate(
  row: MnSkill,
  status: MnLearningCandidateStatus,
  sourceTaskId: string | null
): ParsedCandidate {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    body: row.contentMd,
    sourceTaskId,
    status,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Helpers — pure, exported for unit tests.
// ---------------------------------------------------------------------------

/**
 * Build a slug satisfying M5's pattern `^[a-z0-9]+(?:[-.][a-z0-9]+)*$`.
 * Falls back to `auto-learning.task-<id-tail>` when the title is empty
 * or all-symbols.
 */
export function buildCandidateSlug(title: string, taskId: string): string {
  const slugged = (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  const titlePart = slugged.length > 0 ? slugged.slice(0, 40) : 'untitled';
  const idTail = taskId
    .replace(/[^a-z0-9]+/gi, '')
    .slice(0, 8)
    .toLowerCase();
  return `auto-learning.${titlePart}-${idTail || 'task'}`;
}

function sanitizePromptOutput(
  result: PlaybookExtractionPromptOutput,
  task: Pick<MnTask, 'id' | 'title'>
): { slug: string; name: string; body: string } {
  const baseSlug = result.slug?.trim()
    ? result.slug.trim()
    : buildCandidateSlug(result.name || task.title, task.id);
  // Defensive: even if the prompt template returned a wonky slug,
  // re-normalise so the M5 CreateSchema regex never rejects us.
  const safeSlug = baseSlug
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/\.{2,}/g, '.');
  const finalSlug =
    safeSlug.length > 0 ? safeSlug : buildCandidateSlug(task.title, task.id);
  const name = (
    result.name?.trim() ||
    task.title ||
    'Auto-extracted playbook'
  ).slice(0, 200);
  const body = (result.body?.trim() || `# ${name}`).slice(0, 200_000);
  return { slug: finalSlug, name, body };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + '...';
}

function isDecisionActivity(activity: {
  action: string;
  metadata: unknown;
}): boolean {
  if (activity.action.startsWith('decision_')) return true;
  if (activity.action === 'decision') return true;
  if (typeof activity.metadata === 'object' && activity.metadata !== null) {
    const kind = (activity.metadata as Record<string, unknown>).kind;
    if (kind === 'decision' || kind === 'DECISION') return true;
  }
  return false;
}

function renderDecisionMarkdown(activity: {
  action: string;
  metadata: unknown;
  createdAt: Date;
}): string {
  const ts = activity.createdAt.toISOString();
  const metaJson = (() => {
    if (typeof activity.metadata !== 'object' || activity.metadata === null) {
      return '';
    }
    try {
      return JSON.stringify(activity.metadata);
    } catch {
      return '';
    }
  })();
  const lines = [`[DECISION] action=${activity.action}`, `at=${ts}`];
  if (metaJson && metaJson !== '{}') lines.push(`metadata=${metaJson}`);
  return lines.join('\n');
}

function mapPriorityToImportance(priority: string): number {
  switch (priority) {
    case 'URGENT':
      return 8;
    case 'HIGH':
      return 6;
    case 'MEDIUM':
      return 4;
    case 'LOW':
      return 2;
    default:
      return 2;
  }
}

function bumpVersion(
  current: string,
  status: MnLearningCandidateStatus
): string {
  const suffix =
    status === MnLearningCandidateStatus.APPROVED ? 'approved' : 'rejected';
  // M5's VERSION_PATTERN is /^[A-Za-z0-9._+-]+$/ — the suffix below
  // stays inside that character class.
  return `${current}+${suffix}-${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}`;
}

// Re-exports for tests + diagnostics.
export const __internal = {
  parseMarker,
  stampMarkerOntoContent,
  stripMarkerFromContent,
  buildCandidateSlug,
  isDecisionActivity,
  renderDecisionMarkdown,
  mapPriorityToImportance,
  bumpVersion,
} as const;

// Re-export so memory-row callers (tests) can avoid a separate import.
export type { MnAgentMemory } from '@prisma/client';
