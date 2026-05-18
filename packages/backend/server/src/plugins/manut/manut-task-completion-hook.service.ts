import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { MnOrgLearningService } from './manut-org-learning.service';

/**
 * M16 — Hook surface that fires the auto-learning extraction when a
 * task transitions to DONE.
 *
 * Status of the wiring (intentional, see PRD `E. Storage` note):
 *
 *  - The trigger is exposed via the GraphQL mutation
 *    `triggerLearningExtractionForTask` on `MnOrgLearningResolver`.
 *    Operators / cron jobs / the watchdog can invoke it on demand.
 *
 *  - The auto-on-DONE wiring (a Prisma middleware or a poller) is
 *    intentionally deferred to a follow-up PR so that this milestone
 *    does NOT touch `MnTaskService` directly. The ownership rule in
 *    the PRD is: "Modules only register new providers". Wiring into
 *    the task transition pipe-line is its own R1 operation (because
 *    it can cascade into job-queue churn on legacy workspaces) and
 *    will land with its own dedicated test surface.
 *
 *  - In the meantime, this service exposes two stable methods that
 *    the future wiring will call from whichever surface ends up
 *    owning the DONE transition: `onTaskCompleted` (full pipeline)
 *    and `pollOnce` (a no-op default that the deferred follow-up
 *    will fill in). Both are safe to call right now — they reuse
 *    the same idempotent extraction path so a duplicate call just
 *    produces a fresh candidate row.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` is present so NestJS DI emits `design:paramtypes`
 *    (v1.12.0 production scar).
 *  - `PrismaClient` + `MnOrgLearningService` are RUNTIME imports
 *    (v1.12.0 production scar). They are also the constructor DI
 *    targets, so they CANNOT be `import type`.
 */
@Injectable()
export class MnTaskCompletionHookService {
  private readonly logger = new Logger(MnTaskCompletionHookService.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly orgLearning: MnOrgLearningService
  ) {}

  /**
   * Invoke the auto-learning extraction for a single task that has
   * just transitioned to DONE. Idempotent — re-calling on the same
   * task produces a fresh candidate (with a slug suffix) so an
   * operator can compare proposals across re-runs.
   *
   * Errors are CAUGHT and logged, never propagated: the calling
   * surface (currently the GraphQL mutation; eventually the task
   * status writer) must not fail because the auto-learning side
   * effect failed.
   */
  async onTaskCompleted(taskId: string): Promise<void> {
    try {
      const task = await this.db.mnTask.findUnique({
        where: { id: taskId },
        select: { id: true, project: { select: { workspaceId: true } } },
      });
      if (!task) {
        this.logger.warn(
          `onTaskCompleted called for missing task '${taskId}' — skipping`
        );
        return;
      }
      const workspaceId = task.project.workspaceId;
      await Promise.allSettled([
        this.orgLearning.extractPlaybookFromTask(task.id, workspaceId),
        this.orgLearning.extractDecisionMemory(task.id, workspaceId),
      ]);
    } catch (err) {
      this.logger.warn(
        `onTaskCompleted failed for task=${taskId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * Single tick of the deferred poller. The default implementation is
   * a no-op so the service is safe to register without any side
   * effects. The follow-up that ships the auto-on-DONE wiring will
   * replace this body with a "find tasks DONE since lastTickAt and
   * call onTaskCompleted for each" sweep.
   *
   * Exposed as a public method so the wiring follow-up can either:
   *   - schedule it via `@Cron(...)` in a separate file, OR
   *   - drive it from a Prisma middleware on the `mnTask.update`
   *     write path,
   * without touching this service's API.
   */
  async pollOnce(): Promise<void> {
    // Intentionally empty in M16.1. See class JSDoc.
    return;
  }
}
