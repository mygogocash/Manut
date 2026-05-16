import { Injectable } from '@nestjs/common';
import {
  MnRoutine,
  MnRoutineRun,
  MnRoutineStatus,
  MnRoutineVisibility,
  PrismaClient,
} from '@prisma/client';

import { ActionForbidden, NotInSpace } from '../../base';
import { AccessController } from '../../core/permission';

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

    this.validateCron(input.cronSchedule);

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

    if (input.cronSchedule !== undefined) {
      this.validateCron(input.cronSchedule);
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
}
