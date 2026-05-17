import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MnBudget, MnCostEvent } from '@prisma/client';
import { MnBudgetScope, PrismaClient } from '@prisma/client';

import {
  CreateMnBudgetSchema,
  type CreateMnBudgetValues,
  UpdateMnBudgetSchema,
  type UpdateMnBudgetValues,
} from './manut-budget.dto';

/**
 * CRUD for Manut budgets and read-side queries against cost events (M4).
 *
 * The enforcer (`MnBudgetEnforcerService`) is the hot path; this service
 * handles the cold operations: dashboard reads, admin mutations, and the
 * rollup query the frontend uses to render the spend page.
 *
 * @Injectable + RUNTIME `PrismaClient` per the v1.12.0 DI scar; `MnBudget`
 * + `MnCostEvent` row types are imported as `import type` because they're
 * pure type usage in return signatures.
 */
@Injectable()
export class MnBudgetService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Create a budget. The unique tuple `(workspaceId, scopeType, scopeId,
   * monthYear)` makes the create racy across two concurrent admins — we
   * rely on the database to reject duplicates rather than a TOCTOU read.
   */
  async create(
    workspaceId: string,
    input: CreateMnBudgetValues
  ): Promise<MnBudget> {
    const values = CreateMnBudgetSchema.parse(input);
    this.assertScopeValid(values);

    if (values.projectId) {
      await this.assertProjectInWorkspace(workspaceId, values.projectId);
    }
    if (values.scopeType === MnBudgetScope.PROJECT) {
      if (!values.scopeId) {
        throw new BadRequestException('PROJECT-scope budgets require scopeId');
      }
      await this.assertProjectInWorkspace(workspaceId, values.scopeId);
    }

    try {
      return await this.db.mnBudget.create({
        data: {
          id: randomUUID(),
          workspaceId,
          scopeType: values.scopeType,
          scopeId: values.scopeId ?? null,
          projectId: values.projectId ?? null,
          monthYear: values.monthYear,
          capCents: values.capCents,
          warnThresholdPct: values.warnThresholdPct ?? 80,
          hardStopEnabled: values.hardStopEnabled ?? true,
        },
      });
    } catch (error) {
      // Prisma's unique-violation error code is P2002. Surface the conflict
      // as a 400 rather than a 500 so the UI can render a helpful message.
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException(
          `Budget already exists for (scope=${values.scopeType}, scopeId=${values.scopeId ?? 'null'}, month=${values.monthYear})`
        );
      }
      throw error;
    }
  }

  /**
   * Update editable fields. The scope tuple is immutable; if an operator
   * wants to move a budget between scopes they delete + create. Keeping
   * the tuple immutable means the running total is never invalidated.
   */
  async update(
    workspaceId: string,
    budgetId: string,
    input: UpdateMnBudgetValues
  ): Promise<MnBudget> {
    const values = UpdateMnBudgetSchema.parse(input);
    const current = await this.getOrThrow(workspaceId, budgetId);

    return this.db.mnBudget.update({
      where: { id: current.id },
      data: {
        ...(values.capCents !== undefined ? { capCents: values.capCents } : {}),
        ...(values.warnThresholdPct !== undefined
          ? { warnThresholdPct: values.warnThresholdPct }
          : {}),
        ...(values.hardStopEnabled !== undefined
          ? { hardStopEnabled: values.hardStopEnabled }
          : {}),
        // Resetting alertSent gives the operator a way to re-arm the
        // cap-hit notification after acknowledging it. Tied to capCents
        // so simply raising the cap re-arms automatically.
        ...(values.capCents !== undefined && values.capCents > current.capCents
          ? { alertSent: false }
          : {}),
      },
    });
  }

  /**
   * Hard delete. Cost events stay; only the cap configuration goes. This
   * is the right default — the audit trail of spend predates the budget
   * and should survive a configuration change.
   */
  async delete(workspaceId: string, budgetId: string): Promise<void> {
    await this.getOrThrow(workspaceId, budgetId);
    await this.db.mnBudget.delete({ where: { id: budgetId } });
  }

  async get(workspaceId: string, budgetId: string): Promise<MnBudget | null> {
    const row = await this.db.mnBudget.findUnique({
      where: { id: budgetId },
    });
    if (!row || row.workspaceId !== workspaceId) return null;
    return row;
  }

  async getOrThrow(workspaceId: string, budgetId: string): Promise<MnBudget> {
    const row = await this.get(workspaceId, budgetId);
    if (!row) {
      throw new NotFoundException(`Budget '${budgetId}' not found`);
    }
    return row;
  }

  /**
   * List budgets for a workspace, optionally narrowed by month or scope.
   */
  async list(
    workspaceId: string,
    filter?: { monthYear?: string; scopeType?: MnBudgetScope }
  ): Promise<MnBudget[]> {
    return this.db.mnBudget.findMany({
      where: {
        workspaceId,
        ...(filter?.monthYear ? { monthYear: filter.monthYear } : {}),
        ...(filter?.scopeType ? { scopeType: filter.scopeType } : {}),
      },
      orderBy: [
        { monthYear: 'desc' },
        { scopeType: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Recent cost events. Capped at 500 by default to keep payloads sane;
   * the dashboard is paginated separately if the operator drills in.
   */
  async listCostEvents(
    workspaceId: string,
    filter?: {
      projectId?: string | null;
      agentId?: string | null;
      taskId?: string | null;
      monthYear?: string;
      limit?: number;
    }
  ): Promise<MnCostEvent[]> {
    const limit = Math.min(filter?.limit ?? 500, 5000);
    const where: Record<string, unknown> = { workspaceId };
    if (filter?.projectId !== undefined) where.projectId = filter.projectId;
    if (filter?.agentId !== undefined) where.agentId = filter.agentId;
    if (filter?.taskId !== undefined) where.taskId = filter.taskId;
    if (filter?.monthYear) {
      const [year, month] = filter.monthYear
        .split('-')
        .map(s => parseInt(s, 10));
      if (Number.isFinite(year) && Number.isFinite(month)) {
        // Use UTC bounds — see formatMonthYear notes in manut-cost.service.ts
        // for why we don't trust local-time month boundaries.
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 1));
        where.occurredAt = { gte: start, lt: end };
      }
    }
    return this.db.mnCostEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Rollup query used by the dashboard. Aggregates spend per project for
   * the requested month, joined with the matching PROJECT-scope budget.
   * Returns one row per project that either has a budget OR has spend in
   * the period.
   */
  async projectRollups(
    workspaceId: string,
    monthYear: string
  ): Promise<
    Array<{
      scopeType: MnBudgetScope;
      scopeId: string | null;
      projectId: string | null;
      monthYear: string;
      capCents: number;
      spentCents: number;
      utilizationPct: number;
    }>
  > {
    // We use the denormalised running total from MnBudget so the dashboard
    // is cheap. If no budget exists, fall back to a live aggregate so the
    // operator can still see uncapped spend.
    const budgets = await this.db.mnBudget.findMany({
      where: {
        workspaceId,
        monthYear,
        scopeType: MnBudgetScope.PROJECT,
      },
    });

    const aggregates = await this.db.mnCostEvent.groupBy({
      by: ['projectId'],
      where: {
        workspaceId,
        occurredAt: {
          gte: monthYearStart(monthYear),
          lt: monthYearEnd(monthYear),
        },
      },
      _sum: { costCents: true },
    });

    type RollupRow = {
      scopeType: MnBudgetScope;
      scopeId: string | null;
      projectId: string | null;
      monthYear: string;
      capCents: number;
      spentCents: number;
      utilizationPct: number;
    };
    const byProject = new Map<string, RollupRow>();

    for (const b of budgets) {
      const key = b.scopeId ?? 'null';
      byProject.set(key, {
        scopeType: MnBudgetScope.PROJECT,
        scopeId: b.scopeId,
        projectId: b.scopeId ?? b.projectId,
        monthYear,
        capCents: b.capCents,
        spentCents: b.spentCents,
        utilizationPct:
          b.capCents > 0
            ? Math.min(100, Math.floor((b.spentCents / b.capCents) * 100))
            : 0,
      });
    }

    for (const agg of aggregates) {
      const key = agg.projectId ?? 'null';
      if (byProject.has(key)) continue; // Already covered by a budget row.
      byProject.set(key, {
        scopeType: MnBudgetScope.PROJECT,
        scopeId: agg.projectId ?? null,
        projectId: agg.projectId ?? null,
        monthYear,
        capCents: 0,
        spentCents: agg._sum.costCents ?? 0,
        utilizationPct: 0,
      });
    }

    return Array.from(byProject.values());
  }

  private async assertProjectInWorkspace(
    workspaceId: string,
    projectId: string
  ): Promise<void> {
    const project = await this.db.mnProject.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new BadRequestException(`Project '${projectId}' not found`);
    }
    if (project.workspaceId !== workspaceId) {
      throw new BadRequestException(
        `Project '${projectId}' does not belong to this workspace`
      );
    }
  }

  private assertScopeValid(input: CreateMnBudgetValues): void {
    if (input.scopeType === MnBudgetScope.WORKSPACE && input.scopeId) {
      throw new BadRequestException(
        'WORKSPACE-scope budgets must NOT have a scopeId'
      );
    }
    if (input.scopeType !== MnBudgetScope.WORKSPACE && !input.scopeId) {
      throw new BadRequestException(
        `${input.scopeType}-scope budgets require a scopeId`
      );
    }
  }
}

function monthYearStart(monthYear: string): Date {
  const [year, month] = monthYear.split('-').map(s => parseInt(s, 10));
  return new Date(Date.UTC(year, month - 1, 1));
}

function monthYearEnd(monthYear: string): Date {
  const [year, month] = monthYear.split('-').map(s => parseInt(s, 10));
  return new Date(Date.UTC(year, month, 1));
}
