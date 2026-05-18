import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import {
  type MnDoDPredicate,
  MnDoDPredicateKind,
  MnDoDPredicateListSchema,
} from './manut-outcome-verifier.dto';

/**
 * M11 — Enforced Outcomes verifier.
 *
 * Runs each predicate declared on `MnTask.definitionOfDone` and
 * returns a per-predicate breakdown plus an aggregate satisfied flag.
 * The PM resolver's `updateMnTaskStatus` mutation calls
 * `assertCanTransitionToDone` before any write that would move the
 * task into the DONE state — if any predicate fails, the status write
 * is refused with a BadRequestException so the user sees the reason
 * inline rather than getting a silent half-done state.
 *
 * Predicate runners:
 *   - DOC_EXISTS           — queries WorkspaceDoc by composite key, or
 *                            falls back to a positive existence probe.
 *   - URL_REACHABLE        — HEAD request with a 10s timeout via the
 *                            global fetch + AbortController. Returns
 *                            satisfied=true when the response status
 *                            matches `expectedStatus` (default: 2xx).
 *   - WORK_PRODUCT_EXISTS  — queries MnWorkProduct by taskId. M10
 *                            may not be present yet — we feature-detect
 *                            `prisma.mnWorkProduct` at runtime and
 *                            return a graceful `satisfied=false,
 *                            reason='M10 not deployed yet'` rather
 *                            than crashing.
 *   - EMBEDDING_SIMILARITY — v1 stub: returns satisfied=true with a
 *                            warning reason. Wire up to the real
 *                            embedding service in a follow-up PR.
 *   - CUSTOM               — always returns satisfied=false; an
 *                            operator must approve it manually.
 *
 * CLAUDE.md scars honored:
 *  - @Injectable() so TS emits design:paramtypes for NestJS DI
 *    (v1.12.0 scar).
 *  - PrismaClient is a runtime import (not `import type`) because
 *    it's the DI target (PR #57 incident class).
 *  - The verifier never throws on transient predicate failures —
 *    it captures them into the per-predicate `reason` so the caller
 *    sees the whole picture and can retry one specific predicate
 *    without re-running the others.
 */

/** Maximum wait per URL_REACHABLE check. */
export const URL_REACHABLE_TIMEOUT_MS = 10_000;

/** Per-predicate evidence is free-form JSON the runner returns. */
export interface MnDoDPredicateRunResult {
  predicate: MnDoDPredicate;
  satisfied: boolean;
  kind: MnDoDPredicateKind;
  evidence: Record<string, unknown> | null;
  reason: string | null;
}

export interface MnDoDVerificationOutcome {
  taskId: string;
  satisfied: boolean;
  results: MnDoDPredicateRunResult[];
  hasDefinition: boolean;
}

/**
 * Optional injectable for tests. The real implementation uses the
 * global `fetch` shipped with Node 18+ which AFFiNE/Manut targets.
 */
export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

@Injectable()
export class MnOutcomeVerifierService {
  private readonly logger = new Logger(MnOutcomeVerifierService.name);
  private readonly fetcher: FetchLike;

  constructor(private readonly db: PrismaClient) {
    // Default to the platform fetch. Tests can replace via a
    // setter rather than constructor injection so the DI surface stays
    // narrow (PrismaClient is the only runtime dependency).
    this.fetcher = (input, init) => fetch(input, init);
  }

  /**
   * Replace the fetcher used by URL_REACHABLE. Returns the previous
   * implementation so tests can chain swaps cleanly.
   *
   * Test-only seam — production code injects PrismaClient and never
   * touches this. Kept as a method (not a constructor param) to keep
   * the NestJS DI surface minimal and to avoid the v1.12.0
   * UnknownDependenciesException trap that bit PrismaClient + DocReader.
   */
  setFetcherForTesting(fetcher: FetchLike): FetchLike {
    const previous = (this as unknown as { fetcher: FetchLike }).fetcher;
    (this as unknown as { fetcher: FetchLike }).fetcher = fetcher;
    return previous;
  }

  /**
   * Run every predicate declared on the task's `definitionOfDone`
   * column. Returns a per-predicate breakdown; the aggregate
   * `satisfied` flag is the logical AND.
   *
   * A task with no predicates (null or empty array) is treated as
   * `hasDefinition=false, satisfied=true`. The transition guard
   * relies on that: clearing the DoD reverts to upstream behavior.
   */
  async verifyTaskDone(taskId: string): Promise<MnDoDVerificationOutcome> {
    if (!taskId) {
      throw new BadRequestException(
        'verifyTaskDone requires a non-empty taskId'
      );
    }

    const task = await this.db.mnTask.findUnique({
      where: { id: taskId },
      select: { id: true, definitionOfDone: true },
    });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    const predicates = this.parsePredicates(task.definitionOfDone);

    if (predicates.length === 0) {
      return {
        taskId,
        satisfied: true,
        results: [],
        hasDefinition: false,
      };
    }

    const results: MnDoDPredicateRunResult[] = [];
    for (const predicate of predicates) {
      const result = await this.runPredicate(predicate);
      results.push(result);
    }
    const satisfied = results.every(r => r.satisfied);

    return {
      taskId,
      satisfied,
      results,
      hasDefinition: true,
    };
  }

  /**
   * Throws BadRequestException if the task has a non-empty
   * `definitionOfDone` and any predicate is unsatisfied. The PM
   * resolver calls this just before persisting `status: DONE`.
   *
   * No-op for tasks without a DoD — preserves upstream behavior so
   * existing rows aren't suddenly un-completable after this column
   * is deployed.
   */
  async assertCanTransitionToDone(taskId: string): Promise<void> {
    const outcome = await this.verifyTaskDone(taskId);
    if (!outcome.hasDefinition) return;
    if (outcome.satisfied) return;

    const unsatisfied = outcome.results.filter(r => !r.satisfied);
    const summary = unsatisfied
      .map(r => `${r.kind}: ${r.reason ?? 'unsatisfied'}`)
      .join('; ');
    throw new BadRequestException(
      `Task ${taskId} cannot transition to DONE: ${unsatisfied.length} ` +
        `of ${outcome.results.length} predicates unsatisfied — ${summary}`
    );
  }

  /**
   * Validate and persist a new Definition of Done. Passing `null` or
   * an empty array clears the DoD and removes the transition guard.
   *
   * The shape is validated against `MnDoDPredicateListSchema` —
   * malformed entries raise BadRequestException with the Zod issue
   * path so the UI can highlight the offending field.
   */
  async setDefinitionOfDone(
    taskId: string,
    predicates: MnDoDPredicate[] | null
  ): Promise<MnDoDPredicate[]> {
    if (!taskId) {
      throw new BadRequestException(
        'setDefinitionOfDone requires a non-empty taskId'
      );
    }

    const value = predicates ?? [];
    const parsed = MnDoDPredicateListSchema.safeParse(value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path?.join('.') || '<root>';
      throw new BadRequestException(
        `Invalid definitionOfDone at ${path}: ${issue?.message ?? 'unknown error'}`
      );
    }

    const task = await this.db.mnTask.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    // Prisma's JSON-field input type narrows to `InputJsonValue`, which
    // the structural shape of our discriminated-union predicate array
    // doesn't widen to without a cast (TS won't accept literal `kind`
    // unions as plain `string`). The Zod parse above is the runtime
    // guarantee — the cast just satisfies the type-checker on the
    // write boundary. See `parsePredicates` below for the read-side
    // re-validation.
    //
    // Clearing the column uses `Prisma.JsonNull` (the sentinel for
    // "write SQL NULL into a JSONB column") rather than JS `null` —
    // assigning JS `null` directly is rejected by Prisma since v4
    // because it could mean either "remove the field" or "store JSON
    // null".
    const dbValue: Prisma.InputJsonValue | typeof Prisma.JsonNull =
      parsed.data.length === 0
        ? Prisma.JsonNull
        : (parsed.data as unknown as Prisma.InputJsonValue);
    await this.db.mnTask.update({
      where: { id: taskId },
      data: {
        definitionOfDone: dbValue,
      },
    });
    return parsed.data;
  }

  /**
   * Parse a stored JSONB column back into a typed predicate list.
   * Rows that fail validation are dropped with a warning log — we
   * never want a corrupt row to crash the verifier. The caller sees
   * `hasDefinition: false` instead.
   */
  private parsePredicates(stored: unknown): MnDoDPredicate[] {
    if (stored === null || stored === undefined) return [];
    const parsed = MnDoDPredicateListSchema.safeParse(stored);
    if (!parsed.success) {
      this.logger.warn(
        `Stored definitionOfDone failed validation: ${parsed.error.message}`
      );
      return [];
    }
    return parsed.data;
  }

  /**
   * Dispatch on `kind` and capture errors into the per-predicate
   * result. Never throws — a thrown error from a runner becomes
   * `satisfied=false, reason=err.message` so one bad predicate cannot
   * mask the rest.
   */
  private async runPredicate(
    predicate: MnDoDPredicate
  ): Promise<MnDoDPredicateRunResult> {
    try {
      switch (predicate.kind) {
        case MnDoDPredicateKind.DOC_EXISTS:
          return await this.runDocExists(predicate);
        case MnDoDPredicateKind.URL_REACHABLE:
          return await this.runUrlReachable(predicate);
        case MnDoDPredicateKind.WORK_PRODUCT_EXISTS:
          return await this.runWorkProductExists(predicate);
        case MnDoDPredicateKind.EMBEDDING_SIMILARITY:
          return this.runEmbeddingSimilarityStub(predicate);
        case MnDoDPredicateKind.CUSTOM:
          return this.runCustom(predicate);
      }
    } catch (err) {
      return {
        predicate,
        satisfied: false,
        kind: predicate.kind,
        evidence: null,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async runDocExists(
    predicate: Extract<MnDoDPredicate, { kind: MnDoDPredicateKind.DOC_EXISTS }>
  ): Promise<MnDoDPredicateRunResult> {
    // WorkspaceDoc uses a composite [workspaceId, docId] primary key
    // so a `findUnique` requires both. The verifier only knows the
    // docId — fall back to a positive existence probe across the
    // table. This is a low-volume read (per-task, predicate-bound)
    // and the docId column is indexed by the primary key, so the
    // `findFirst` cost is bounded.
    const doc = await this.db.workspaceDoc.findFirst({
      where: { docId: predicate.docId },
      select: { docId: true, workspaceId: true, title: true },
    });

    if (!doc) {
      return {
        predicate,
        satisfied: false,
        kind: predicate.kind,
        evidence: null,
        reason: `No WorkspaceDoc with id=${predicate.docId}`,
      };
    }
    return {
      predicate,
      satisfied: true,
      kind: predicate.kind,
      evidence: {
        docId: doc.docId,
        workspaceId: doc.workspaceId,
        title: doc.title ?? null,
      },
      reason: null,
    };
  }

  private async runUrlReachable(
    predicate: Extract<
      MnDoDPredicate,
      { kind: MnDoDPredicateKind.URL_REACHABLE }
    >
  ): Promise<MnDoDPredicateRunResult> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      URL_REACHABLE_TIMEOUT_MS
    );
    try {
      const response = await this.fetcher(predicate.url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });

      const expected = predicate.expectedStatus;
      const matches =
        expected !== undefined
          ? response.status === expected
          : response.status >= 200 && response.status < 300;

      return {
        predicate,
        satisfied: matches,
        kind: predicate.kind,
        evidence: {
          status: response.status,
          ok: response.ok,
          url: predicate.url,
        },
        reason: matches
          ? null
          : `Expected ${expected ?? '2xx'}, got ${response.status}`,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async runWorkProductExists(
    predicate: Extract<
      MnDoDPredicate,
      { kind: MnDoDPredicateKind.WORK_PRODUCT_EXISTS }
    >
  ): Promise<MnDoDPredicateRunResult> {
    // M10 may not be deployed yet — feature-detect the delegate on
    // the Prisma client. Once M10 ships the `mnWorkProduct` field
    // exists; before then `prisma.mnWorkProduct` is `undefined` and
    // calling it would throw. We treat the missing delegate as
    // "deployment not complete" rather than a satisfied predicate so
    // operators can't accidentally bypass the gate.
    const delegate = (this.db as unknown as { mnWorkProduct?: unknown })
      .mnWorkProduct as
      | {
          findFirst: (args: unknown) => Promise<unknown | null>;
        }
      | undefined;

    if (!delegate || typeof delegate.findFirst !== 'function') {
      return {
        predicate,
        satisfied: false,
        kind: predicate.kind,
        evidence: null,
        reason:
          'MnWorkProduct model (M10) not yet deployed — predicate cannot be evaluated',
      };
    }

    const where: Record<string, unknown> = { taskId: predicate.taskId };
    if (predicate.productKind) {
      where.kind = predicate.productKind;
    }
    const row = await delegate.findFirst({
      where,
      select: { id: true, taskId: true, kind: true },
    });

    if (!row) {
      return {
        predicate,
        satisfied: false,
        kind: predicate.kind,
        evidence: null,
        reason: `No MnWorkProduct for taskId=${predicate.taskId}${
          predicate.productKind ? ` kind=${predicate.productKind}` : ''
        }`,
      };
    }
    return {
      predicate,
      satisfied: true,
      kind: predicate.kind,
      evidence: row as Record<string, unknown>,
      reason: null,
    };
  }

  private runEmbeddingSimilarityStub(
    predicate: Extract<
      MnDoDPredicate,
      { kind: MnDoDPredicateKind.EMBEDDING_SIMILARITY }
    >
  ): MnDoDPredicateRunResult {
    // v1 stub — the embedding similarity verifier requires wiring up
    // the workspace embedding store, which lives behind a separate
    // copilot module. We return satisfied=true with a `reason` so
    // operators can deploy M11 without that dependency, and the UI
    // can flag the predicate as "warning: not enforced". Wire up a
    // real implementation in a follow-up PR (CLAUDE.md §2.4 scope
    // drift discipline).
    return {
      predicate,
      satisfied: true,
      kind: predicate.kind,
      evidence: null,
      reason:
        'EMBEDDING_SIMILARITY verification not yet implemented; auto-satisfied for v1',
    };
  }

  private runCustom(
    predicate: Extract<MnDoDPredicate, { kind: MnDoDPredicateKind.CUSTOM }>
  ): MnDoDPredicateRunResult {
    // CUSTOM predicates require human review — the verifier cannot
    // attest to them automatically. Operators acknowledge them via
    // the manual approval UI; the verifier always reports them as
    // unsatisfied so the transition guard fires.
    return {
      predicate,
      satisfied: false,
      kind: predicate.kind,
      evidence: null,
      reason: `Requires manual review: ${predicate.description}`,
    };
  }
}
