import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import type { MnHeartbeatRun } from '@prisma/client';
import {
  MnAgentStatus,
  MnHeartbeatInvocationSource,
  MnHeartbeatRunStatus,
  PrismaClient,
} from '@prisma/client';

/**
 * Input shape for `recordTurn`. The caller supplies an
 * `externalRunId` that uniquely identifies the chat turn (typically
 * the AiSessionMessage id) — that pair `(agentId, externalRunId)` is
 * the idempotency key.
 */
export interface RecordChatTurnInput {
  agentId: string;
  aiSessionId: string;
  /**
   * Caller-supplied correlator (e.g. AiSessionMessage id) that makes
   * the call idempotent. Re-passing the same value for the same
   * `agentId` returns the existing row instead of inserting a new one.
   *
   * REQUIRED for chat-turn writes — without it the call is not
   * idempotent and may double-record heartbeats on retry.
   */
  externalRunId: string;
  status: MnHeartbeatRunStatus;
  /**
   * Optional error blob — recorded verbatim when the turn failed.
   * Truncated to 2000 chars to keep rows compact.
   */
  error?: string | null;
  /**
   * Optional finish time. When omitted and `status` is terminal
   * (SUCCEEDED / FAILED / CANCELLED), we stamp `now()`.
   */
  finishedAt?: Date | null;
}

const ERROR_MAX = 2000;

const TERMINAL_STATUSES: ReadonlySet<MnHeartbeatRunStatus> = new Set([
  MnHeartbeatRunStatus.SUCCEEDED,
  MnHeartbeatRunStatus.FAILED,
  MnHeartbeatRunStatus.CANCELLED,
]);

/**
 * Records agent activity heartbeats. M1 only writes from chat turns
 * (`MnHeartbeatInvocationSource.CHAT_TURN`); manual + scheduled sources
 * arrive in PR-N once the routine runner needs them.
 *
 * Designed for **fire-and-forget callers**: every public method
 * catches its own errors internally so a heartbeat write failure
 * never blocks the actual chat turn. The caller pattern is:
 *
 *   service.recordTurn({ ... }).catch(() => void 0);
 *
 * That `.catch` is belt-and-braces — the service already swallows
 * errors and logs them — but it's the right call-site shape.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` is present so NestJS DI can read the constructor
 *    parameter types (v1.12.0 production scar).
 *  - `PrismaClient` is a RUNTIME import; only the row TYPE
 *    `MnHeartbeatRun` is `import type` (v1.12.0 production scar).
 */
@Injectable()
export class MnHeartbeatService {
  private readonly logger = new Logger(MnHeartbeatService.name);

  constructor(private readonly db: PrismaClient) {}

  /**
   * Record (or update) a heartbeat for one chat turn. Idempotent on
   * `(agentId, externalRunId)`:
   *  - first call inserts a new row,
   *  - subsequent calls with the same pair update the existing row's
   *    status / finishedAt / error fields.
   *
   * Also updates the agent's `lastHeartbeatAt` AND `status` so the
   * registry view reflects current activity without an extra round-
   * trip. Agent status only flips while the run is RUNNING — terminal
   * runs leave the agent back at IDLE.
   *
   * Swallows errors internally — see the class-level note about
   * fire-and-forget callers. Returns the row on success, `null` if
   * something went wrong (logged at WARN).
   */
  async recordTurn(input: RecordChatTurnInput): Promise<MnHeartbeatRun | null> {
    try {
      return await this.recordTurnUnsafe(input);
    } catch (error) {
      this.logger.warn(
        `recordTurn failed for agent=${input.agentId} externalRunId=${input.externalRunId}: ${formatError(error)}`
      );
      return null;
    }
  }

  /**
   * Same shape as `recordTurn` but lets errors propagate. Useful for
   * tests that want to assert specific exception types. Production
   * code should always prefer `recordTurn`.
   */
  async recordTurnUnsafe(input: RecordChatTurnInput): Promise<MnHeartbeatRun> {
    if (!input.agentId) {
      throw new Error('agentId is required');
    }
    if (!input.externalRunId) {
      throw new Error('externalRunId is required for chat-turn heartbeats');
    }

    const agent = await this.db.mnAgent.findUnique({
      where: { id: input.agentId },
    });
    if (!agent) {
      throw new Error(`Agent '${input.agentId}' not found`);
    }

    const isTerminal = TERMINAL_STATUSES.has(input.status);
    const finishedAt = isTerminal ? (input.finishedAt ?? new Date()) : null;
    const error = input.error ? truncate(input.error, ERROR_MAX) : null;

    // Check for prior run under the same (agentId, externalRunId)
    // pair. We can't use a compound unique index here because the
    // schema doesn't declare one — `externalRunId` is nullable so a
    // global unique would also reject the legitimate `NULL` case for
    // sources that don't supply one. So we hand-roll the lookup.
    const existing = await this.db.mnHeartbeatRun.findFirst({
      where: {
        agentId: input.agentId,
        externalRunId: input.externalRunId,
      },
    });

    const run = existing
      ? await this.db.mnHeartbeatRun.update({
          where: { id: existing.id },
          data: {
            status: input.status,
            ...(finishedAt !== null ? { finishedAt } : {}),
            error,
          },
        })
      : await this.db.mnHeartbeatRun.create({
          data: {
            id: randomUUID(),
            workspaceId: agent.workspaceId,
            projectId: agent.projectId,
            agentId: agent.id,
            invocationSource: MnHeartbeatInvocationSource.CHAT_TURN,
            aiSessionId: input.aiSessionId,
            externalRunId: input.externalRunId,
            status: input.status,
            ...(finishedAt !== null ? { finishedAt } : {}),
            error,
          },
        });

    // Reflect activity on the agent row. We only flip the agent into
    // RUNNING from non-terminal states — TERMINATED agents should NEVER
    // become RUNNING again (see MnAgentService.update for the matching
    // invariant on the user-facing update surface).
    const agentStatusChange = computeAgentStatusChange(
      agent.status,
      input.status
    );
    await this.db.mnAgent.update({
      where: { id: agent.id },
      data: {
        lastHeartbeatAt: new Date(),
        ...(agentStatusChange !== null ? { status: agentStatusChange } : {}),
      },
    });

    return run;
  }
}

/**
 * Decide whether the agent's `status` should move based on the new
 * heartbeat status. Returns `null` to leave it untouched.
 *
 *  - TERMINATED is sticky — never flipped.
 *  - RUNNING heartbeat → agent goes RUNNING (unless already RUNNING).
 *  - Terminal heartbeat (success / fail / cancelled) → agent goes IDLE
 *    if currently RUNNING, otherwise leave alone (e.g. PAUSED agents
 *    keep their manual paused-ness through a stray completed turn).
 */
function computeAgentStatusChange(
  agentStatus: MnAgentStatus,
  runStatus: MnHeartbeatRunStatus
): MnAgentStatus | null {
  if (agentStatus === MnAgentStatus.TERMINATED) return null;

  if (runStatus === MnHeartbeatRunStatus.RUNNING) {
    return agentStatus === MnAgentStatus.RUNNING ? null : MnAgentStatus.RUNNING;
  }
  if (TERMINAL_STATUSES.has(runStatus)) {
    if (agentStatus === MnAgentStatus.RUNNING) return MnAgentStatus.IDLE;
    return null;
  }
  return null;
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
