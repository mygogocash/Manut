import { Injectable } from '@nestjs/common';
import {
  MnRoutine,
  MnRoutineRun,
  MnRoutineStatus,
  MnRoutineVisibility,
  PrismaClient,
} from '@prisma/client';
// cron-parser is CJS-only; the default import is the right shape under
// our Node ESM<->CJS bridge. Mirrors the import pattern in
// manut-routine.cron.ts — a named `{ parseExpression }` import compiles
// but throws at runtime.
import cronParser from 'cron-parser';

import { ActionForbidden, NotInSpace } from '../../base';
import { AccessController } from '../../core/permission';

/**
 * Hard cap on the prompt column we persist for a routine. Pentest R1
 * (post-Routines audit): an attacker who can call `createMnRoutine` /
 * `updateMnRoutine` with an unbounded prompt can blow up the row, the
 * downstream Vertex token budget, and the in-flight memory of every
 * worker that materialises the row. 16 KB is well above any realistic
 * authoring need (~16k characters of UTF-8) but far below DoS scale.
 */
const MAX_PROMPT_BYTES = 16 * 1024;

/**
 * Minimum allowed interval between cron fires. Pentest R2 (schedule
 * storm): a per-minute 5-field cron fires every 60s and a per-second
 * 6-field cron fires every second. Either turns a per-tick scan +
 * BullMQ enqueue into a sustained DoS vector against the worker pool
 * and Vertex MaaS quota. We compute the wall-clock delta between two
 * successive fires and reject any schedule that wants to fire more
 * than once per 5 minutes.
 */
const MIN_SCHEDULE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Cron expression syntax check (pentest M4 mitigation). This is a
 * grammar-only check — we don't have a cron evaluator in deps yet.
 * Allowed chars: digits, whitespace, * / , - ? L W # (standard cron
 * vocabulary). Rejects shell metacharacters and free-form text so a
 * malicious expression can't be persisted that, when a real evaluator
 * lands in PR 2, would trigger DoS via catastrophic backtracking.
 */
const CRON_GRAMMAR_RE = /^[\d\s*/,\-?LW#]{3,120}$/;

export function isValidCronGrammar(expr: string): boolean {
  return CRON_GRAMMAR_RE.test(expr);
}

/**
 * MnRoutineService — CRUD + permission-aware lookup for Manut Routines.
 *
 * Permission rules:
 *   - Personal routines: ownerId === currentUser.id is required for any
 *     operation. Workspace membership is also required (the routine is
 *     scoped to a workspace even when personal).
 *   - Workspace-shared: any workspace member with Workspace.Read can
 *     list/read/run. Writes (create/update/delete/pause/resume) require
 *     ownerId === currentUser.id OR Workspace.Admin.
 *
 * Per pentest H3 — we use `Workspace.Settings.Update` (the codebase's
 * admin-tier permission key) for writes on workspace-shared routines.
 * The pentest finding flagged that `Workspace.Settings.Update` may be
 * granted to non-admin roles in the permission builder; that's a
 * separate audit/fix tracked outside this PR. This file matches the
 * established reminder/CRM/PM convention.
 */
@Injectable()
export class MnRoutineService {
  constructor(
    private readonly db: PrismaClient,
    private readonly ac: AccessController
  ) {}

  // ---------- List ----------

  /**
   * List routines visible to `userId` in `workspaceId`:
   *   - Their personal routines (owned by userId)
   *   - Workspace-shared routines, IF they have Workspace.Read
   */
  async listForUser(userId: string, workspaceId: string): Promise<MnRoutine[]> {
    await this.ac.user(userId).workspace(workspaceId).assert('Workspace.Read');

    return this.db.mnRoutine.findMany({
      where: {
        workspaceId,
        OR: [
          { ownerId: userId },
          { visibility: MnRoutineVisibility.WORKSPACE_SHARED },
        ],
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  /**
   * Get a single routine by id, with permission check. Throws if the
   * caller can't see it (personal not owned by them, or workspace-shared
   * but not a member).
   */
  async getForUser(userId: string, routineId: string): Promise<MnRoutine> {
    const routine = await this.db.mnRoutine.findUnique({
      where: { id: routineId },
    });
    if (!routine) {
      throw new NotInSpace({ spaceId: 'unknown' });
    }

    await this.assertCanRead(userId, routine);
    return routine;
  }

  // ---------- Create ----------

  async create(
    userId: string,
    workspaceId: string,
    input: {
      name: string;
      description?: string | null;
      prompt: string;
      cronSchedule?: string | null;
      timezone?: string | null;
      visibility?: MnRoutineVisibility;
    }
  ): Promise<MnRoutine> {
    const visibility = input.visibility ?? MnRoutineVisibility.PERSONAL;

    // Workspace-shared creation needs admin role.
    // Personal creation needs only workspace membership.
    if (visibility === MnRoutineVisibility.WORKSPACE_SHARED) {
      await this.ac
        .user(userId)
        .workspace(workspaceId)
        .assert('Workspace.Settings.Update');
    } else {
      await this.ac
        .user(userId)
        .workspace(workspaceId)
        .assert('Workspace.Read');
    }

    this.validatePromptSize(input.prompt);
    this.validateCron(input.cronSchedule);
    this.validateScheduleInterval(input.cronSchedule, input.timezone);

    return this.db.mnRoutine.create({
      data: {
        workspaceId,
        ownerId: userId,
        visibility,
        name: input.name,
        description: input.description ?? null,
        prompt: input.prompt,
        cronSchedule: input.cronSchedule ?? null,
        timezone: input.timezone ?? null,
      },
    });
  }

  // ---------- Update ----------

  async update(
    userId: string,
    routineId: string,
    input: {
      name?: string;
      description?: string | null;
      prompt?: string;
      cronSchedule?: string | null;
      timezone?: string | null;
      visibility?: MnRoutineVisibility;
      status?: MnRoutineStatus;
    }
  ): Promise<MnRoutine> {
    const routine = await this.requireRoutine(routineId);
    await this.assertCanWrite(userId, routine);

    // Promoting a personal routine to workspace-shared requires admin.
    if (
      input.visibility === MnRoutineVisibility.WORKSPACE_SHARED &&
      routine.visibility !== MnRoutineVisibility.WORKSPACE_SHARED
    ) {
      await this.ac
        .user(userId)
        .workspace(routine.workspaceId)
        .assert('Workspace.Settings.Update');
    }

    if (input.prompt !== undefined) {
      this.validatePromptSize(input.prompt);
    }

    if (input.cronSchedule !== undefined) {
      this.validateCron(input.cronSchedule);
      // Pentest R2: re-check interval on any schedule edit. Timezone
      // may have shifted on the same edit, so prefer the incoming
      // timezone; fall back to the persisted one when not provided.
      const tz =
        input.timezone !== undefined ? input.timezone : routine.timezone;
      this.validateScheduleInterval(input.cronSchedule, tz);
    }

    return this.db.mnRoutine.update({
      where: { id: routineId },
      data: {
        name: input.name,
        description: input.description,
        prompt: input.prompt,
        cronSchedule: input.cronSchedule,
        timezone: input.timezone,
        visibility: input.visibility,
        status: input.status,
      },
    });
  }

  // ---------- Delete ----------

  async delete(userId: string, routineId: string): Promise<boolean> {
    const routine = await this.requireRoutine(routineId);
    await this.assertCanWrite(userId, routine);

    await this.db.mnRoutine.delete({ where: { id: routineId } });
    return true;
  }

  // ---------- Pause / Resume ----------

  async setStatus(
    userId: string,
    routineId: string,
    status: MnRoutineStatus
  ): Promise<MnRoutine> {
    const routine = await this.requireRoutine(routineId);
    await this.assertCanWrite(userId, routine);

    return this.db.mnRoutine.update({
      where: { id: routineId },
      data: { status },
    });
  }

  // ---------- Run history ----------

  async listRuns(
    userId: string,
    routineId: string,
    limit = 30
  ): Promise<MnRoutineRun[]> {
    const routine = await this.requireRoutine(routineId);
    await this.assertCanRead(userId, routine);

    return this.db.mnRoutineRun.findMany({
      where: { routineId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  // ---------- Manual trigger (PR 1: stub) ----------

  /**
   * Create a `QUEUED` run record. PR 1 does not actually execute against
   * Vertex — that lands in PR 4. The frontend can still render the run
   * row so the UX feels complete; the run sits at QUEUED until PR 4
   * wires the worker.
   */
  async createManualRun(
    userId: string,
    routineId: string
  ): Promise<MnRoutineRun> {
    const routine = await this.requireRoutine(routineId);
    await this.assertCanRead(userId, routine);

    return this.db.mnRoutineRun.create({
      data: {
        routineId,
        triggeredBy: userId,
        triggerType: 'MANUAL',
      },
    });
  }

  // ---------- Helpers ----------

  private async requireRoutine(routineId: string): Promise<MnRoutine> {
    const routine = await this.db.mnRoutine.findUnique({
      where: { id: routineId },
    });
    if (!routine) {
      throw new NotInSpace({ spaceId: 'unknown' });
    }
    return routine;
  }

  private async assertCanRead(
    userId: string,
    routine: MnRoutine
  ): Promise<void> {
    if (routine.visibility === MnRoutineVisibility.PERSONAL) {
      if (routine.ownerId !== userId) {
        throw new ActionForbidden();
      }
      // Owner must also still be in the workspace (defense in depth —
      // if they were removed, the routine becomes inert).
      await this.ac
        .user(userId)
        .workspace(routine.workspaceId)
        .assert('Workspace.Read');
      return;
    }

    // Workspace-shared: any reader is OK.
    await this.ac
      .user(userId)
      .workspace(routine.workspaceId)
      .assert('Workspace.Read');
  }

  /**
   * Write permission: owner OR workspace admin. Owner alone is enough
   * even for workspace-shared routines they created (matches the
   * "delete your own task" precedent from manut-reminder.resolver).
   */
  private async assertCanWrite(
    userId: string,
    routine: MnRoutine
  ): Promise<void> {
    if (routine.ownerId === userId) {
      await this.ac
        .user(userId)
        .workspace(routine.workspaceId)
        .assert('Workspace.Read');
      return;
    }

    // Non-owner writes need admin.
    await this.ac
      .user(userId)
      .workspace(routine.workspaceId)
      .assert('Workspace.Settings.Update');
  }

  private validateCron(expr: string | null | undefined): void {
    if (expr === null || expr === undefined || expr === '') return;
    if (!isValidCronGrammar(expr)) {
      throw new ActionForbidden();
    }
  }

  /**
   * Pentest R1 — reject prompts above MAX_PROMPT_BYTES.
   * Byte length, not character count: a single emoji is 4 UTF-8 bytes,
   * which is what we actually pay for at the column / token level.
   */
  private validatePromptSize(prompt: string | null | undefined): void {
    const bytes = Buffer.byteLength(prompt ?? '', 'utf8');
    if (bytes > MAX_PROMPT_BYTES) {
      throw new ActionForbidden('routine prompt exceeds 16KB');
    }
  }

  /**
   * Pentest R2 — reject schedules that fire more than once per 5
   * minutes. We let `cron-parser` walk two successive fires forward
   * from "now" and compute the delta; this works for both 5- and
   * 6-field expressions, and respects the routine's timezone if set.
   *
   * The grammar guard (validateCron) runs first, so anything that
   * reaches us here passed the regex. If `cron-parser` still throws —
   * e.g. semantically invalid combinations like `60 * * * *` —
   * surface a useful error rather than letting the failure leak from
   * Prisma at insert time.
   */
  private validateScheduleInterval(
    expr: string | null | undefined,
    timezone: string | null | undefined
  ): void {
    if (expr === null || expr === undefined || expr === '') return;
    let intervalMs: number;
    try {
      const it = cronParser.parseExpression(expr, {
        tz: timezone ?? undefined,
      });
      const first = it.next().toDate();
      const second = it.next().toDate();
      intervalMs = second.getTime() - first.getTime();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ActionForbidden(`routine schedule is not parseable: ${reason}`);
    }
    if (intervalMs < MIN_SCHEDULE_INTERVAL_MS) {
      throw new ActionForbidden(
        'routine schedule must fire no more than every 5 minutes'
      );
    }
  }
}
