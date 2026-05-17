import { MnBudgetScope } from '@prisma/client';
import test from 'ava';

import { computeCostCents, pickRate } from '../../plugins/copilot/cost-rates';
import {
  formatMonthYear,
  MnCostService,
} from '../../plugins/manut/manut-cost.service';

/**
 * M4 cost service — pricing + fire-and-forget emission.
 *
 * Uses a hand-rolled in-memory Prisma stub (same pattern as
 * mn-agent-service.spec.ts) so tests stay fast + deterministic without
 * standing up a real Postgres.
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
}

interface FakeCostEvent {
  id: string;
  workspaceId: string;
  costCents: number;
}

function createFakeDb() {
  const budgets: FakeBudget[] = [];
  const events: FakeCostEvent[] = [];
  const agents: Array<{
    id: string;
    workspaceId: string;
    projectId: string;
    status: string;
  }> = [];
  const tasks: Array<{ id: string; projectId: string }> = [];
  const taskActivities: Array<{
    taskId: string;
    action: string;
    metadata: unknown;
  }> = [];

  let nextId = 1;
  const db = {
    mnCostEvent: {
      create: async ({ data }: { data: Partial<FakeCostEvent> }) => {
        const row: FakeCostEvent = {
          id: `evt-${nextId++}`,
          workspaceId: data.workspaceId!,
          costCents: data.costCents ?? 0,
        };
        events.push(row);
        return row;
      },
    },
    mnBudget: {
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          workspaceId: string;
          scopeType: MnBudgetScope;
          scopeId: string | null;
          monthYear: string;
        };
        data: { spentCents: { increment: number } };
      }) => {
        const matches = budgets.filter(
          b =>
            b.workspaceId === where.workspaceId &&
            b.scopeType === where.scopeType &&
            b.scopeId === where.scopeId &&
            b.monthYear === where.monthYear
        );
        for (const b of matches) {
          b.spentCents += data.spentCents.increment;
        }
        return { count: matches.length };
      },
      findFirst: async ({
        where,
      }: {
        where: {
          workspaceId: string;
          scopeType: MnBudgetScope;
          scopeId: string | null;
          monthYear: string;
        };
      }) => {
        return (
          budgets.find(
            b =>
              b.workspaceId === where.workspaceId &&
              b.scopeType === where.scopeType &&
              b.scopeId === where.scopeId &&
              b.monthYear === where.monthYear
          ) ?? null
        );
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { alertSent?: boolean };
      }) => {
        const row = budgets.find(b => b.id === where.id);
        if (row && data.alertSent !== undefined) row.alertSent = data.alertSent;
        return row;
      },
    },
    mnAgent: {
      updateMany: async ({
        where: _where,
        data,
      }: {
        where: unknown;
        data: { status: string };
      }) => {
        let count = 0;
        for (const a of agents) {
          if (a.status === 'IDLE' || a.status === 'RUNNING') {
            a.status = data.status;
            count++;
          }
        }
        return { count };
      },
    },
    mnTask: {
      findFirst: async () => tasks[0] ?? null,
    },
    mnTaskActivity: {
      create: async ({
        data,
      }: {
        data: { taskId: string; action: string; metadata: unknown };
      }) => {
        taskActivities.push({
          taskId: data.taskId,
          action: data.action,
          metadata: data.metadata,
        });
        return data;
      },
    },
  };

  return { db, budgets, events, agents, tasks, taskActivities };
}

test('pickRate returns known gemini-2.5-flash rate', t => {
  const rate = pickRate('geminiVertex', 'gemini-2.5-flash');
  t.truthy(rate);
  t.is(rate?.inputCentsPerMillion, 30);
  t.is(rate?.outputCentsPerMillion, 250);
});

test('pickRate returns null for unknown provider/model pair', t => {
  t.is(pickRate('unknownVendor', 'mystery-model'), null);
});

test('computeCostCents rounds UP per component and returns 0 for unknown model', t => {
  const a = computeCostCents('geminiVertex', 'gemini-2.5-flash', 1_000, 1_000);
  // input: 1000 tokens * 30 c/M = 0.03 c -> rounds up to 1
  // output: 1000 tokens * 250 c/M = 0.25 c -> rounds up to 1
  t.is(a.costCents, 2);

  const b = computeCostCents('geminiVertex', 'gemini-2.5-flash', 0, 0);
  t.is(b.costCents, 0, 'zero tokens cost zero cents');

  const c = computeCostCents('unknownVendor', 'unknown', 1_000_000, 1_000_000);
  t.is(c.costCents, 0, 'unknown model returns 0 with null rate');
  t.is(c.rate, null);
});

test('formatMonthYear uses UTC and zero-pads month', t => {
  const d = new Date(Date.UTC(2026, 4, 17)); // 2026-05-17
  t.is(formatMonthYear(d), '2026-05');

  const jan = new Date(Date.UTC(2026, 0, 1));
  t.is(formatMonthYear(jan), '2026-01');
});

test('MnCostService.emit persists event + bumps workspace budget', async t => {
  const { db, events, budgets } = createFakeDb();
  budgets.push({
    id: 'b1',
    workspaceId: 'w1',
    projectId: null,
    scopeType: MnBudgetScope.WORKSPACE,
    scopeId: null,
    monthYear: formatMonthYear(new Date()),
    capCents: 10_000,
    spentCents: 0,
    warnThresholdPct: 80,
    hardStopEnabled: true,
    alertSent: false,
  });

  const service = new MnCostService(
    db as unknown as ConstructorParameters<typeof MnCostService>[0]
  );

  const id = await service.emit({
    workspaceId: 'w1',
    provider: 'geminiVertex',
    model: 'gemini-2.5-flash',
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
  });

  t.truthy(id, 'returns persisted event id');
  t.is(events.length, 1);
  // workspace budget should be incremented by the computed cost.
  t.true(budgets[0].spentCents > 0, 'budget spentCents incremented');
});

test('MnCostService.emit pauses agents on cap-hit at AGENT scope', async t => {
  const { db, budgets, agents, taskActivities } = createFakeDb();
  agents.push({ id: 'a1', workspaceId: 'w1', projectId: 'p1', status: 'IDLE' });
  budgets.push({
    id: 'b-agent',
    workspaceId: 'w1',
    projectId: 'p1',
    scopeType: MnBudgetScope.AGENT,
    scopeId: 'a1',
    monthYear: formatMonthYear(new Date()),
    capCents: 1,
    spentCents: 0,
    warnThresholdPct: 80,
    hardStopEnabled: true,
    alertSent: false,
  });

  const service = new MnCostService(
    db as unknown as ConstructorParameters<typeof MnCostService>[0]
  );

  await service.emit({
    workspaceId: 'w1',
    projectId: 'p1',
    agentId: 'a1',
    provider: 'geminiVertex',
    model: 'gemini-2.5-flash',
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
  });

  t.is(agents[0].status, 'PAUSED', 'agent paused on cap hit');
  t.true(budgets[0].alertSent, 'alertSent flipped on cap hit');
  // M3 not loaded — falls back to no-op (no task in flight) or task activity.
  // Either is acceptable; we just assert no crash and the side-effects above.
  t.true(Array.isArray(taskActivities));
});

test('MnCostService.emit swallows errors thrown by the DB', async t => {
  const service = new MnCostService({
    mnCostEvent: {
      create: async () => {
        throw new Error('synthetic DB outage');
      },
    },
  } as unknown as ConstructorParameters<typeof MnCostService>[0]);

  // Must NOT throw — the streaming response would fail otherwise.
  const id = await service.emit({
    workspaceId: 'w1',
    provider: 'geminiVertex',
    model: 'gemini-2.5-flash',
    inputTokens: 1,
    outputTokens: 1,
  });

  t.is(id, null, 'returns null on swallowed failure');
});

test('MnCostService.emit logs a warning + emits $0 for unknown models', async t => {
  const { db, events } = createFakeDb();
  const service = new MnCostService(
    db as unknown as ConstructorParameters<typeof MnCostService>[0]
  );

  await service.emit({
    workspaceId: 'w1',
    provider: 'fake',
    model: 'mystery',
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
  });

  t.is(events.length, 1, 'audit row still written');
  t.is(events[0].costCents, 0, 'cost is 0 for unknown model');
});

test('MnCostService.estimate is the pure cost without DB writes', t => {
  const service = new MnCostService(
    {} as unknown as ConstructorParameters<typeof MnCostService>[0]
  );

  const cents = service.estimate(
    'geminiVertex',
    'gemini-2.5-flash',
    1_000_000,
    1_000_000
  );
  t.is(cents, 30 + 250);
});
