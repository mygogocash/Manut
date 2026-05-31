import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { withControlPlaneErrorMapping } from './manut-control-plane-errors';

/**
 * Canonical task tree slugs for a release run. Order matches the
 * `taskTree` array shape emitted by scripts/manut-release-handover.mjs:
 * 1. build, 2. verify (package), 3. deploy (validate & upload),
 * 4. observe (smoke-then-swap), 5. document (record follow-ups).
 *
 * Slugs are immutable across versions so the board renders consistently
 * even if upstream taskTree labels change wording.
 */
export const DEFAULT_TASK_SLUGS = [
  'build',
  'verify',
  'deploy',
  'observe',
  'document',
] as const;

export type ReleaseTaskSlug = (typeof DEFAULT_TASK_SLUGS)[number];

const MAX_HANDOVER_JSON_BYTES = 256 * 1024;

interface ListRunsOptions {
  limit?: number | null;
  offset?: number | null;
}

interface ParsedHandoverForRun {
  ghRunId: string;
  ghRunUrl: string | null;
  mode: string;
  status: string;
  version: string | null;
  shortSha: string | null;
  headSha: string | null;
  imageTag: string | null;
  imageDigest: string | null;
  registry: string | null;
  deployUrl: string | null;
  actor: string | null;
  generatedAt: Date | null;
  taskLabels: string[];
}

@Injectable()
export class MnReleaseRunsService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Upsert a release run + its task tree from a handover JSON string.
   * Idempotent on (workspaceId, ghRunId).
   */
  async recordRunFromHandover(workspaceId: string, handoverJson: string) {
    const parsed = parseHandoverForRun(handoverJson);

    if (!parsed.ghRunId) {
      throw new BadRequestException(
        'workflow.runId is required to record a release run'
      );
    }

    const generatedAt = parsed.generatedAt;

    return withControlPlaneErrorMapping(async () => {
      const run = await this.db.mnReleaseRun.upsert({
        where: {
          workspaceId_ghRunId: {
            workspaceId,
            ghRunId: parsed.ghRunId,
          },
        },
        create: {
          id: randomUUID(),
          workspaceId,
          ghRunId: parsed.ghRunId,
          ghRunUrl: parsed.ghRunUrl,
          mode: parsed.mode,
          status: parsed.status,
          version: parsed.version,
          shortSha: parsed.shortSha,
          headSha: parsed.headSha,
          imageTag: parsed.imageTag,
          imageDigest: parsed.imageDigest,
          registry: parsed.registry,
          deployUrl: parsed.deployUrl,
          actor: parsed.actor,
          generatedAt,
        },
        update: {
          ghRunUrl: parsed.ghRunUrl,
          mode: parsed.mode,
          status: parsed.status,
          version: parsed.version,
          shortSha: parsed.shortSha,
          headSha: parsed.headSha,
          imageTag: parsed.imageTag,
          imageDigest: parsed.imageDigest,
          registry: parsed.registry,
          deployUrl: parsed.deployUrl,
          actor: parsed.actor,
          generatedAt,
        },
      });

      await this.upsertDefaultTasks(run.id, parsed.taskLabels);

      return run;
    });
  }

  /**
   * List release runs for a workspace, newest generatedAt first.
   * generatedAt is NULLS LAST so any missing handovers sort to the end.
   */
  async listRuns(workspaceId: string, options: ListRunsOptions = {}) {
    const take = clampInt(options.limit, 1, 100, 50);
    const skip = Math.max(0, options.offset ?? 0);

    return withControlPlaneErrorMapping(() =>
      this.db.mnReleaseRun.findMany({
        where: { workspaceId },
        orderBy: [{ generatedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
      })
    );
  }

  /**
   * Fetch a run by id, scoped to the given workspaceId.
   * Returns null when the run does not exist or belongs to another workspace.
   * Includes the task list so resolvers don't need a second round-trip.
   */
  async getRun(workspaceId: string, runId: string) {
    return withControlPlaneErrorMapping(async () => {
      const run = await this.db.mnReleaseRun.findUnique({
        where: { id: runId },
        include: { tasks: { orderBy: { sortOrder: 'asc' } } },
      });

      if (!run) return null;
      if (run.workspaceId !== workspaceId) return null;

      return run;
    });
  }

  /**
   * Fetch the task rows for a given run id, ordered by sortOrder asc.
   * Used by the GraphQL ResolveField on MnReleaseRun.tasks.
   *
   * Pentest H8 hardening: scope by workspaceId so a workspace member who
   * guesses a runId from another workspace cannot enumerate its tasks
   * through this field. The caller is the resolver, which has the
   * workspaceId from the parent MnReleaseRun.
   */
  async listTasks(runId: string, workspaceId: string) {
    return withControlPlaneErrorMapping(() =>
      this.db.mnReleaseTask.findMany({
        where: { runId, run: { workspaceId } },
        orderBy: { sortOrder: 'asc' },
      })
    );
  }

  private async upsertDefaultTasks(runId: string, taskLabels: string[]) {
    for (let i = 0; i < DEFAULT_TASK_SLUGS.length; i++) {
      const slug = DEFAULT_TASK_SLUGS[i];
      // taskTree from the handover JSON is positional — the script
      // always emits 5 items in build/verify/deploy/observe/document
      // order. If the taskTree is short or missing, fall back to the
      // slug so we never insert an empty label.
      const label = taskLabels[i] ?? slug;

      await this.db.mnReleaseTask.upsert({
        where: { runId_slug: { runId, slug } },
        create: {
          id: randomUUID(),
          runId,
          slug,
          label,
          sortOrder: i,
        },
        update: {
          label,
          sortOrder: i,
        },
      });
    }
  }
}

function parseHandoverForRun(handoverJson: string): ParsedHandoverForRun {
  if (typeof handoverJson !== 'string' || !handoverJson.trim()) {
    throw new BadRequestException('handoverJson is required');
  }

  if (Buffer.byteLength(handoverJson, 'utf8') > MAX_HANDOVER_JSON_BYTES) {
    throw new BadRequestException('handoverJson is too large');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(handoverJson);
  } catch {
    throw new BadRequestException('handoverJson must be valid JSON');
  }

  const root = expectObject(raw, 'handover');
  const workflow = expectObject(root.workflow, 'workflow');
  const release = expectObject(root.release, 'release');

  const taskTreeRaw = root.taskTree;
  const taskTree = Array.isArray(taskTreeRaw) ? taskTreeRaw : [];

  return {
    ghRunId: takeString(workflow.runId),
    ghRunUrl: takeNullableString(workflow.runUrl),
    mode: takeString(workflow.mode),
    status: takeString(workflow.status),
    version: takeNullableString(release.version),
    shortSha: takeNullableString(release.shortSha),
    headSha: takeNullableString(release.headSha),
    imageTag: takeNullableString(release.imageTag),
    imageDigest: takeNullableString(release.imageDigest),
    registry: takeNullableString(release.registry),
    deployUrl: takeNullableString(release.deployUrl),
    actor: takeNullableString(workflow.actor),
    generatedAt: takeIsoDate(root.generatedAt),
    taskLabels: taskTree
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.replace(/[\r\n]+/g, ' ').slice(0, 500)),
  };
}

function expectObject(input: unknown, label: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException(`${label} must be an object`);
  }
  return input as Record<string, unknown>;
}

function takeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 500);
}

function takeNullableString(input: unknown): string | null {
  const value = takeString(input);
  return value ? value : null;
}

function takeIsoDate(input: unknown): Date | null {
  if (typeof input !== 'string' || !input) return null;
  const ms = Date.parse(input);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

function clampInt(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
