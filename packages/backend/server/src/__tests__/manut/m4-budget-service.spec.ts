import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MnBudgetScope } from '@prisma/client';
import test from 'ava';

import { MnBudgetService } from '../../plugins/manut/manut-budget.service';

/**
 * M4 budget service — CRUD invariants + rollup math.
 *
 * In-memory Prisma stub mirrors the table shape the service actually
 * touches.
 */

interface FakeBudget {
  id: string;
  workspaceId: string;
  projectId: string | null;
  scopeType: MnBudgetScope;
  scopeId: string | null;
  monthYear: string;
  capCents: number;
  spentCents: number;
  warnThresholdPct: number;
  hardStopEnabled: boolean;
  alertSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeProject {
  id: string;
  workspaceId: string;
}

interface FakeCostEvent {
  id: string;
  workspaceId: string;
  projectId: string | null;
  agentId: string | null;
  taskId: string | null;
  costCents: number;
  occurredAt: Date;
}

function createFakeDb() {
  const budgets: FakeBudget[] = [];
  const projects: FakeProject[] = [];
  const costEvents: FakeCostEvent[] = [];
  let nextId = 1;

  const db = {
    mnProject: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        projects.find(p => p.id === where.id) ?? null,
    },
    mnBudget: {
      create: async ({ data }: { data: Partial<FakeBudget> }) => {
        // Mimic the unique constraint.
        const dup = budgets.find(
          b =>
            b.workspaceId === data.workspaceId &&
            b.scopeType === data.scopeType &&
            b.scopeId === (data.scopeId ?? null) &&
            b.monthYear === data.monthYear
        );
        if (dup) {
          const err = new Error('Unique constraint failed') as Error & {
            code: string;
          };
          err.code = 'P2002';
          throw err;
        }
        const now = new Date();
        const row: FakeBudget = {
          id: data.id ?? `b-${nextId++}`,
          workspaceId: data.workspaceId!,
          projectId: data.projectId ?? null,
          scopeType: data.scopeType!,
          scopeId: data.scopeId ?? null,
          monthYear: data.monthYear!,
          capCents: data.capCents ?? 0,
          spentCents: data.spentCents ?? 0,
          warnThresholdPct: data.warnThresholdPct ?? 80,
          hardStopEnabled: data.hardStopEnabled ?? true,
          alertSent: false,
          createdAt: now,
          updatedAt: now,
        };
        budgets.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        budgets.find(b => b.id === where.id) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeBudget>;
      }) => {
        const row = budgets.find(b => b.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        row.updatedAt = new Date();
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = budgets.findIndex(b => b.id === where.id);
        if (idx === -1) throw new Error('not found');
        budgets.splice(idx, 1);
        return {};
      },
      findMany: async ({
        where,
        orderBy: _orderBy,
      }: {
        where: {
          workspaceId: string;
          monthYear?: string;
          scopeType?: MnBudgetScope;
        };
        orderBy?: unknown;
      }) =>
        budgets.filter(
          b =>
            b.workspaceId === where.workspaceId &&
            (where.monthYear ? b.monthYear === where.monthYear : true) &&
            (where.scopeType ? b.scopeType === where.scopeType : true)
        ),
    },
    mnCostEvent: {
      findMany: async ({
        where,
        take,
      }: {
        where: { workspaceId: string };
        take?: number;
      }) =>
        costEvents
          .filter(e => e.workspaceId === where.workspaceId)
          .slice(0, take ?? 500),
      groupBy: async ({ where }: { where: { workspaceId: string } }) => {
        const filtered = costEvents.filter(
          e => e.workspaceId === where.workspaceId
        );
        const buckets = new Map<string | null, number>();
        for (const ev of filtered) {
          buckets.set(
            ev.projectId,
            (buckets.get(ev.projectId) ?? 0) + ev.costCents
          );
        }
        return Array.from(buckets.entries()).map(([projectId, sum]) => ({
          projectId,
          _sum: { costCents: sum },
        }));
      },
    },
  };

  return { db, budgets, projects, costEvents };
}

test('create rejects WORKSPACE-scope with a scopeId', async t => {
  const { db } = createFakeDb();
  const svc = new MnBudgetService(
    db as unknown as ConstructorParameters<typeof MnBudgetService>[0]
  );
  await t.throwsAsync(
    svc.create('w1', {
      scopeType: MnBudgetScope.WORKSPACE,
      scopeId: 'something',
      monthYear: '2026-05',
      capCents: 1000,
    }),
    { instanceOf: BadRequestException }
  );
});

test('create rejects non-WORKSPACE scope without scopeId', async t => {
  const { db } = createFakeDb();
  const svc = new MnBudgetService(
    db as unknown as ConstructorParameters<typeof MnBudgetService>[0]
  );
  await t.throwsAsync(
    svc.create('w1', {
      scopeType: MnBudgetScope.AGENT,
      monthYear: '2026-05',
      capCents: 1000,
    }),
    { instanceOf: BadRequestException }
  );
});

test('create rejects PROJECT scope with project from another workspace', async t => {
  const { db, projects } = createFakeDb();
  projects.push({ id: 'p1', workspaceId: 'other' });
  const svc = new MnBudgetService(
    db as unknown as ConstructorParameters<typeof MnBudgetService>[0]
  );
  await t.throwsAsync(
    svc.create('w1', {
      scopeType: MnBudgetScope.PROJECT,
      scopeId: 'p1',
      monthYear: '2026-05',
      capCents: 1000,
    }),
    { instanceOf: BadRequestException }
  );
});

test('create rejects malformed monthYear via Zod', async t => {
  const { db } = createFakeDb();
  const svc = new MnBudgetService(
    db as unknown as ConstructorParameters<typeof MnBudgetService>[0]
  );
  await t.throwsAsync(
    svc.create('w1', {
      scopeType: MnBudgetScope.WORKSPACE,
      monthYear: 'May 2026',
      capCents: 1000,
    })
  );
});

test('create surfaces P2002 duplicate as BadRequestException', async t => {
  const { db } = createFakeDb();
  const svc = new MnBudgetService(
    db as unknown as ConstructorParameters<typeof MnBudgetService>[0]
  );
  await svc.create('w1', {
    scopeType: MnBudgetScope.WORKSPACE,
    monthYear: '2026-05',
    capCents: 1000,
  });
  await t.throwsAsync(
    svc.create('w1', {
      scopeType: MnBudgetScope.WORKSPACE,
      monthYear: '2026-05',
      capCents: 2000,
    }),
    { instanceOf: BadRequestException }
  );
});

test('get returns null when budget is in a different workspace', async t => {
  const { db } = createFakeDb();
  const svc = new MnBudgetService(
    db as unknown as ConstructorParameters<typeof MnBudgetService>[0]
  );
  const created = await svc.create('w1', {
    scopeType: MnBudgetScope.WORKSPACE,
    monthYear: '2026-05',
    capCents: 1000,
  });
  t.is(await svc.get('other-ws', created.id), null);
  await t.throwsAsync(svc.getOrThrow('other-ws', created.id), {
    instanceOf: NotFoundException,
  });
});

test('update raising the cap clears alertSent', async t => {
  const { db } = createFakeDb();
  const svc = new MnBudgetService(
    db as unknown as ConstructorParameters<typeof MnBudgetService>[0]
  );
  const created = await svc.create('w1', {
    scopeType: MnBudgetScope.WORKSPACE,
    monthYear: '2026-05',
    capCents: 1000,
  });
  // Simulate cap hit having flipped alertSent.
  const row = await svc.getOrThrow('w1', created.id);
  // Patch via the fake row directly to mimic an out-of-band update.
  (row as FakeBudget).alertSent = true;
  const updated = await svc.update('w1', created.id, { capCents: 5000 });
  t.false(updated.alertSent, 'alertSent re-armed when cap raised');
});

test('projectRollups returns rows for budgeted AND unbudgeted projects', async t => {
  const { db, budgets, costEvents } = createFakeDb();
  budgets.push({
    id: 'b1',
    workspaceId: 'w1',
    projectId: 'p1',
    scopeType: MnBudgetScope.PROJECT,
    scopeId: 'p1',
    monthYear: '2026-05',
    capCents: 1000,
    spentCents: 500,
    warnThresholdPct: 80,
    hardStopEnabled: true,
    alertSent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  // Unbudgeted project that still has spend.
  costEvents.push({
    id: 'e1',
    workspaceId: 'w1',
    projectId: 'p2',
    agentId: null,
    taskId: null,
    costCents: 250,
    occurredAt: new Date(Date.UTC(2026, 4, 10)),
  });

  const svc = new MnBudgetService(
    db as unknown as ConstructorParameters<typeof MnBudgetService>[0]
  );
  const rows = await svc.projectRollups('w1', '2026-05');

  const p1 = rows.find(r => r.scopeId === 'p1');
  const p2 = rows.find(r => r.scopeId === 'p2');
  t.truthy(p1, 'budgeted project surfaces');
  t.is(p1?.utilizationPct, 50);
  t.truthy(p2, 'unbudgeted project surfaces with capCents=0');
  t.is(p2?.capCents, 0);
  t.is(p2?.spentCents, 250);
});
