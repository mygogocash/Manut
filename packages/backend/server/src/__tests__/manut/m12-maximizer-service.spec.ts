/**
 * M12 — MAXIMIZER MODE orchestrator service spec.
 *
 * Behaviors covered (the four invariants from the milestone plan):
 *
 *   1. Auto-delegation: when an agent has subordinates whose
 *      `capabilities` column lists the call's capability, the call
 *      lands on the first matching subordinate. Ties are resolved by
 *      `id` ascending for idempotency.
 *
 *   2. Batch scheduling: calls that stay local are grouped into
 *      batches of 10 (`MAX_BATCH_SIZE`). The 11th call rolls to
 *      `batchIndex = 1`, the 21st to `batchIndex = 2`, etc.
 *
 *   3. Tightened approval gate: when the agent has a known remaining
 *      monthly budget and a call costs more than 50% of it, the call
 *      is forced to `REQUIRE_APPROVAL` regardless of whether any
 *      MnApproval policy demands it.
 *
 *   4. Tightened outcome verification: maximizer-mode agents call
 *      `MnOutcomeVerifierService.assertCanTransitionToDone` on every
 *      DONE transition; the orchestrator surfaces `enforced=true` so
 *      callers can prove they routed through the strict gate.
 *
 * The fake DB and fake verifier let us run the whole service in
 * isolation — no Postgres, no NestJS DI container. Mirrors the
 * approach used by m11-outcome-verifier.spec.ts.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import test from 'ava';

import type {
  MnMaximizerAgentRow,
  MnMaximizerToolCall,
} from '../../plugins/manut/manut-maximizer.dto';
import {
  COST_APPROVAL_THRESHOLD,
  MAX_BATCH_SIZE,
  MnMaximizerService,
  pickDelegate,
} from '../../plugins/manut/manut-maximizer.service';
import type { MnOutcomeVerifierService } from '../../plugins/manut/manut-outcome-verifier.service';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

interface FakeAgent {
  id: string;
  workspaceId: string;
  projectId: string;
  maximizerMode: boolean;
  capabilities: string | null;
  reportsToAgentId: string | null;
}

function makeAgent(id: string, overrides: Partial<FakeAgent> = {}): FakeAgent {
  return {
    id,
    workspaceId: 'w1',
    projectId: 'p1',
    maximizerMode: false,
    capabilities: null,
    reportsToAgentId: null,
    ...overrides,
  };
}

function createFakeDb(initialAgents: FakeAgent[]) {
  const agents = new Map(initialAgents.map(a => [a.id, { ...a }]));

  function pickFields(
    agent: FakeAgent,
    select?: Record<string, boolean>
  ): Record<string, unknown> {
    if (!select) return { ...agent };
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(select)) {
      if (v) out[k] = (agent as unknown as Record<string, unknown>)[k];
    }
    return out;
  }

  const db = {
    mnAgent: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { id: string };
        select?: Record<string, boolean>;
      }) => {
        const a = agents.get(where.id);
        if (!a) return null;
        return pickFields(a, select);
      },
      update: async ({
        where,
        data,
        select,
      }: {
        where: { id: string };
        data: { maximizerMode?: boolean };
        select?: Record<string, boolean>;
      }) => {
        const a = agents.get(where.id);
        if (!a) throw new Error(`agent ${where.id} not found in fake db`);
        const next: FakeAgent = {
          ...a,
          maximizerMode:
            data.maximizerMode !== undefined
              ? data.maximizerMode
              : a.maximizerMode,
        };
        agents.set(where.id, next);
        return pickFields(next, select);
      },
      findMany: async ({
        where,
        orderBy,
      }: {
        where: { workspaceId: string; reportsToAgentId: string };
        select?: Record<string, boolean>;
        orderBy?: { id?: 'asc' | 'desc' };
      }) => {
        let rows = [...agents.values()].filter(
          a =>
            a.workspaceId === where.workspaceId &&
            a.reportsToAgentId === where.reportsToAgentId
        );
        if (orderBy?.id === 'asc') {
          rows = rows.sort((a, b) => a.id.localeCompare(b.id));
        } else if (orderBy?.id === 'desc') {
          rows = rows.sort((a, b) => b.id.localeCompare(a.id));
        }
        return rows.map(r => ({ ...r }));
      },
    },
  };

  return {
    db,
    getAgent: (id: string) => agents.get(id),
    setAgent: (id: string, patch: Partial<FakeAgent>) => {
      const a = agents.get(id);
      if (a) agents.set(id, { ...a, ...patch });
    },
  };
}

interface FakeVerifierState {
  shouldThrow: boolean;
  callCount: number;
}

function createFakeVerifier(): {
  verifier: MnOutcomeVerifierService;
  state: FakeVerifierState;
} {
  const state: FakeVerifierState = { shouldThrow: false, callCount: 0 };
  const verifier = {
    assertCanTransitionToDone: async (_taskId: string) => {
      state.callCount += 1;
      if (state.shouldThrow) {
        throw new BadRequestException('unsatisfied predicate');
      }
    },
  } as unknown as MnOutcomeVerifierService;
  return { verifier, state };
}

function makeCall(
  callId: string,
  overrides: Partial<MnMaximizerToolCall> = {}
): MnMaximizerToolCall {
  return {
    callId,
    toolName: 'doc-edit',
    capability: null,
    costCents: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Enable / disable
// ---------------------------------------------------------------------------

test('enable: flips maximizerMode to true and persists', async t => {
  const { db, getAgent } = createFakeDb([makeAgent('a1')]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  const next = await svc.enable('a1');
  t.true(next);
  t.is(getAgent('a1')?.maximizerMode, true);
});

test('disable: flips maximizerMode to false and persists', async t => {
  const { db, getAgent } = createFakeDb([
    makeAgent('a1', { maximizerMode: true }),
  ]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  const next = await svc.disable('a1');
  t.false(next);
  t.is(getAgent('a1')?.maximizerMode, false);
});

test('enable: missing agent throws NotFoundException', async t => {
  const { db } = createFakeDb([]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  await t.throwsAsync(svc.enable('missing'), {
    instanceOf: NotFoundException,
  });
});

test('enable: empty agentId throws BadRequestException', async t => {
  const { db } = createFakeDb([]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  await t.throwsAsync(svc.enable(''), {
    instanceOf: BadRequestException,
  });
});

// ---------------------------------------------------------------------------
// Plan: non-maximizer (identity pass)
// ---------------------------------------------------------------------------

test('planToolCalls: non-maximizer agent is an identity pass (all EXECUTE, batch 0)', async t => {
  const { db } = createFakeDb([makeAgent('a1', { maximizerMode: false })]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  const calls = Array.from({ length: 15 }, (_, i) =>
    makeCall(`c${i}`, { capability: 'github:write', costCents: 10_000 })
  );
  const plan = await svc.planToolCalls('a1', calls);

  t.is(plan.decisions.length, 15);
  for (const d of plan.decisions) {
    t.is(d.kind, 'EXECUTE');
    t.is(d.batchIndex, 0);
    t.is(d.delegateAgentId, null);
    t.is(d.approvalReason, null);
  }
  t.is(plan.batchCount, 1);
});

// ---------------------------------------------------------------------------
// Plan: auto-delegation
// ---------------------------------------------------------------------------

test('planToolCalls: auto-delegation routes to first capability-matched subordinate', async t => {
  const { db } = createFakeDb([
    makeAgent('boss', { maximizerMode: true }),
    makeAgent('worker1', {
      reportsToAgentId: 'boss',
      capabilities: 'docs:edit, github:write',
    }),
    makeAgent('worker2', {
      reportsToAgentId: 'boss',
      capabilities: 'shell:exec',
    }),
  ]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  const plan = await svc.planToolCalls('boss', [
    makeCall('c1', { capability: 'github:write' }),
    makeCall('c2', { capability: 'shell:exec' }),
    makeCall('c3', { capability: 'docs:edit' }),
  ]);

  t.is(plan.decisions[0].kind, 'DELEGATE');
  t.is(plan.decisions[0].delegateAgentId, 'worker1');
  t.is(plan.decisions[1].kind, 'DELEGATE');
  t.is(plan.decisions[1].delegateAgentId, 'worker2');
  t.is(plan.decisions[2].kind, 'DELEGATE');
  t.is(plan.decisions[2].delegateAgentId, 'worker1');
});

test('planToolCalls: no capability match → local EXECUTE in batch 0', async t => {
  const { db } = createFakeDb([
    makeAgent('boss', { maximizerMode: true }),
    makeAgent('worker1', {
      reportsToAgentId: 'boss',
      capabilities: 'docs:edit',
    }),
  ]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  const plan = await svc.planToolCalls('boss', [
    makeCall('c1', { capability: 'shell:exec' }),
  ]);

  t.is(plan.decisions[0].kind, 'EXECUTE');
  t.is(plan.decisions[0].batchIndex, 0);
});

// ---------------------------------------------------------------------------
// Plan: batch scheduling
// ---------------------------------------------------------------------------

test('planToolCalls: 10 local calls fit in batch 0; 11th rolls to batch 1', async t => {
  const { db } = createFakeDb([makeAgent('a1', { maximizerMode: true })]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  const calls = Array.from({ length: 11 }, (_, i) => makeCall(`c${i}`));
  const plan = await svc.planToolCalls('a1', calls);

  for (let i = 0; i < MAX_BATCH_SIZE; i += 1) {
    t.is(plan.decisions[i].batchIndex, 0, `call ${i} should be in batch 0`);
  }
  t.is(
    plan.decisions[10].batchIndex,
    1,
    'call 10 (11th) should roll to batch 1'
  );
  t.is(plan.batchCount, 2);
});

test('planToolCalls: 25 local calls produce 3 batches (10 + 10 + 5)', async t => {
  const { db } = createFakeDb([makeAgent('a1', { maximizerMode: true })]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  const calls = Array.from({ length: 25 }, (_, i) => makeCall(`c${i}`));
  const plan = await svc.planToolCalls('a1', calls);

  const byBatch = new Map<number, number>();
  for (const d of plan.decisions) {
    byBatch.set(d.batchIndex, (byBatch.get(d.batchIndex) ?? 0) + 1);
  }
  t.is(byBatch.get(0), 10);
  t.is(byBatch.get(1), 10);
  t.is(byBatch.get(2), 5);
  t.is(plan.batchCount, 3);
});

// ---------------------------------------------------------------------------
// Plan: tightened approval gate
// ---------------------------------------------------------------------------

test('planToolCalls: cost > 50% of remaining budget forces REQUIRE_APPROVAL', async t => {
  const { db } = createFakeDb([makeAgent('a1', { maximizerMode: true })]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  // Remaining budget = 1000¢. 50% = 500¢. A 600¢ call must require
  // approval; a 400¢ call must execute locally.
  svc.setBudgetReader(async () => 1000);

  const plan = await svc.planToolCalls('a1', [
    makeCall('expensive', { costCents: 600 }),
    makeCall('cheap', { costCents: 400 }),
  ]);

  t.is(plan.decisions[0].kind, 'REQUIRE_APPROVAL');
  t.regex(plan.decisions[0].approvalReason ?? '', /50%/);
  t.is(plan.decisions[1].kind, 'EXECUTE');
});

test('planToolCalls: no budget reader → cost gate is a no-op', async t => {
  const { db } = createFakeDb([makeAgent('a1', { maximizerMode: true })]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);
  // Default reader returns null — gate degrades to no-op.

  const plan = await svc.planToolCalls('a1', [
    makeCall('expensive', { costCents: 99_999 }),
  ]);

  t.is(plan.decisions[0].kind, 'EXECUTE');
});

test('planToolCalls: zero-cost call never trips the approval gate', async t => {
  const { db } = createFakeDb([makeAgent('a1', { maximizerMode: true })]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);
  svc.setBudgetReader(async () => 100);

  const plan = await svc.planToolCalls('a1', [
    makeCall('unknown-cost', { costCents: 0 }),
  ]);

  t.is(plan.decisions[0].kind, 'EXECUTE');
});

// ---------------------------------------------------------------------------
// Plan: validation
// ---------------------------------------------------------------------------

test('planToolCalls: empty agentId throws BadRequestException', async t => {
  const { db } = createFakeDb([]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  await t.throwsAsync(svc.planToolCalls('', []), {
    instanceOf: BadRequestException,
  });
});

test('planToolCalls: missing agent throws NotFoundException', async t => {
  const { db } = createFakeDb([]);
  const { verifier } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  await t.throwsAsync(svc.planToolCalls('missing', []), {
    instanceOf: NotFoundException,
  });
});

// ---------------------------------------------------------------------------
// Tightened outcome verification
// ---------------------------------------------------------------------------

test('assertCanTransitionToDone: maximizer-mode agent runs full verifier', async t => {
  const { db } = createFakeDb([makeAgent('a1', { maximizerMode: true })]);
  const { verifier, state } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  const result = await svc.assertCanTransitionToDone('a1', 't1');
  t.is(state.callCount, 1);
  t.true(result.enforced);
});

test('assertCanTransitionToDone: non-maximizer agent also runs verifier but enforced=false', async t => {
  const { db } = createFakeDb([makeAgent('a1', { maximizerMode: false })]);
  const { verifier, state } = createFakeVerifier();
  const svc = new MnMaximizerService(db as never, verifier);

  const result = await svc.assertCanTransitionToDone('a1', 't1');
  t.is(state.callCount, 1);
  t.false(result.enforced);
});

test('assertCanTransitionToDone: verifier failure propagates as BadRequestException', async t => {
  const { db } = createFakeDb([makeAgent('a1', { maximizerMode: true })]);
  const { verifier, state } = createFakeVerifier();
  state.shouldThrow = true;
  const svc = new MnMaximizerService(db as never, verifier);

  await t.throwsAsync(svc.assertCanTransitionToDone('a1', 't1'), {
    instanceOf: BadRequestException,
  });
});

// ---------------------------------------------------------------------------
// Pure helper: pickDelegate
// ---------------------------------------------------------------------------

test('pickDelegate: returns null when call has no capability', t => {
  const subs: MnMaximizerAgentRow[] = [
    {
      id: 's1',
      workspaceId: 'w1',
      projectId: 'p1',
      maximizerMode: false,
      capabilities: 'github:write',
      reportsToAgentId: 'boss',
    },
  ];
  t.is(pickDelegate(makeCall('c1', { capability: null }), subs), null);
});

test('pickDelegate: matches case-insensitively and trims whitespace', t => {
  const subs: MnMaximizerAgentRow[] = [
    {
      id: 's1',
      workspaceId: 'w1',
      projectId: 'p1',
      maximizerMode: false,
      capabilities: '  GITHUB:Write , docs:edit ',
      reportsToAgentId: 'boss',
    },
  ];
  const match = pickDelegate(
    makeCall('c1', { capability: 'github:write' }),
    subs
  );
  t.is(match?.id, 's1');
});

test('COST_APPROVAL_THRESHOLD constant is 0.5', t => {
  // Documented contract — any change to this constant should be a
  // deliberate one with operator messaging.
  t.is(COST_APPROVAL_THRESHOLD, 0.5);
});
