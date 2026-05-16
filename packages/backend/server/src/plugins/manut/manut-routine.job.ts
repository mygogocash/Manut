import { Injectable, Logger } from '@nestjs/common';
import { MnRoutineRunStatus, PrismaClient } from '@prisma/client';

import { OnJob } from '../../base/job';

declare global {
  interface Jobs {
    'superflow.executeRoutine': {
      routineId: string;
      runId: string;
    };
  }
}

/**
 * BullMQ consumer for routine ticks (PR 2 stub).
 *
 * The cron scanner (`MnRoutineCron`) creates an `MnRoutineRun` with
 * `status=QUEUED` for every fire and enqueues one of these jobs. PR 2
 * intentionally does not execute the prompt against Vertex — that
 * runner lands in PR 4 and will replace this method's body.
 *
 * For PR 2 the consumer marks the run as `SUCCEEDED` with an
 * explanatory `output`. Rationale: leaving runs `QUEUED` forever
 * confuses the History modal and accumulates state PR 4 then has to
 * scrub. Marking them SUCCEEDED with a clear stub message gives users
 * an honest signal ("the schedule fired") and PR 4 picks up from a
 * clean slate.
 *
 * §6 NestJS DI traps: `@Injectable()` is present and `PrismaClient` is
 * a runtime import (not `import type`). Both checks pass.
 */
@Injectable()
export class MnRoutineJob {
  private readonly logger = new Logger(MnRoutineJob.name);

  constructor(private readonly db: PrismaClient) {}

  @OnJob('superflow.executeRoutine')
  async executeRoutine(job: Jobs['superflow.executeRoutine']): Promise<void> {
    const run = await this.db.mnRoutineRun.findUnique({
      where: { id: job.runId },
    });

    // Idempotency: BullMQ may redeliver after a worker crash. If the
    // run was already moved past QUEUED by a prior delivery, skip.
    if (!run) {
      this.logger.warn(
        `routine run ${job.runId} for routine ${job.routineId} was not found`
      );
      return;
    }
    if (run.status !== MnRoutineRunStatus.QUEUED) {
      this.logger.debug(
        `routine run ${run.id} already in terminal state ${run.status}`
      );
      return;
    }

    const startedAt = new Date();
    await this.db.mnRoutineRun.update({
      where: { id: run.id, status: MnRoutineRunStatus.QUEUED },
      data: {
        status: MnRoutineRunStatus.SUCCESS,
        startedAt,
        finishedAt: startedAt,
        durationMs: 0,
        output:
          'Scheduled tick acknowledged. Vertex execution lands in PR 4 of the Routines stack.',
      },
    });
  }
}
