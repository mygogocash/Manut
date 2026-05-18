/**
 * M15 — Self-Organization service spec.
 *
 * Each lifecycle stage gets its own happy + sad path:
 *  - propose() creates a PROPOSED row AND a linked PENDING approval.
 *  - decide() rejects non-PROPOSED inputs, mirrors decision onto the
 *    sibling approval.
 *  - apply() executes the structural mutation per type (DELEGATION_CHANGE
 *    updates reportsToAgentId; NEW_ROUTINE creates an MnRoutine row;
 *    CAPABILITY_GRANT updates capabilities; advisory kinds no-op).
 *  - revert() restores prior state from payload.priorState.
 *
 * The fake DB is a hand-rolled minimal Prisma shape — we don't pull in
 * a real Prisma client in unit tests. `$transaction(callback)` is
 * implemented as `callback(this)` so write paths land on the in-memory
 * tables directly.
 *
 * CLAUDE.md scars honored:
 *  - Tests are FIRST: fast (millisecond), independent (own fake DB per
 *    test), repeatable (no shared state), self-validating.
 *  - Behavioral assertions (statuses, persisted columns, sibling
 *    approval rows) — not implementation details.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MnApprovalStatus,
  MnApprovalType,
  MnOrgChangeStatus,
  MnOrgChangeType,
} from '@prisma/client';
import test from 'ava';

import { MnOrgChangeService } from '../../plugins/manut/manut-org-change.service';

// ---------------------------------------------------------------------------
// Fake DB
// ---------------------------------------------------------------------------

interface FakeProject {
  id: string;
  workspaceId: string;
}

interface FakeAgent {
  id: string;
  workspaceId: string;
  reportsToAgentId: string | null;
  capabilities: string | null;
}

interface FakeOrgChange {
  id: string;
  workspaceId: string;
  projectId: string;
  type: MnOrgChangeType;
  proposedByAgentId: string | null;
  status: MnOrgChangeStatus;
  payload: Record<string, unknown>;
  rationale: string;
  decisionNote: string | null;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  appliedAt: Date | null;
  createdAt: Date;
}

interface FakeApproval {
  id: string;
  workspaceId: string;
  projectId: string;
  type: MnApprovalType;
  status: MnApprovalStatus;
  payload: Record<string, unknown>;
  decisionNote: string | null;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  requestedByAgentId: string | null;
}

interface FakeRoutine {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  prompt: string;
  description: string | null;
  cronSchedule: string | null;
  timezone: string | null;
  status: string;
  visibility: string;
}

function createFakeDb(
  projects: FakeProject[],
  agents: FakeAgent[] = []
): {
  db: unknown;
  state: {
    projects: Map<string, FakeProject>;
    agents: Map<string, FakeAgent>;
    orgChanges: Map<string, FakeOrgChange>;
    approvals: Map<string, FakeApproval>;
    routines: Map<string, FakeRoutine>;
  };
} {
  const state = {
    projects: new Map(projects.map(p => [p.id, { ...p }])),
    agents: new Map(agents.map(a => [a.id, { ...a }])),
    orgChanges: new Map<string, FakeOrgChange>(),
    approvals: new Map<string, FakeApproval>(),
    routines: new Map<string, FakeRoutine>(),
  };

  const db: Record<string, unknown> = {
    mnProject: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.projects.get(where.id) ?? null,
    },
    mnAgent: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.agents.get(where.id) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeAgent>;
      }) => {
        const a = state.agents.get(where.id);
        if (!a) throw new Error(`agent ${where.id} not found`);
        const updated = { ...a, ...data };
        state.agents.set(where.id, updated);
        return updated;
      },
    },
    mnOrgChange: {
      create: async ({ data }: { data: FakeOrgChange }) => {
        const row: FakeOrgChange = {
          ...data,
          status: data.status ?? MnOrgChangeStatus.PROPOSED,
          payload: { ...(data.payload as object) },
          decisionNote: data.decisionNote ?? null,
          decidedByUserId: data.decidedByUserId ?? null,
          decidedAt: data.decidedAt ?? null,
          appliedAt: data.appliedAt ?? null,
          createdAt: data.createdAt ?? new Date(),
        };
        state.orgChanges.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.orgChanges.get(where.id) ?? null,
      findMany: async ({
        where,
        orderBy: _orderBy,
        take,
      }: {
        where: {
          workspaceId: string;
          projectId?: string;
          status?: { in: MnOrgChangeStatus[] };
          type?: { in: MnOrgChangeType[] };
          proposedByAgentId?: string;
        };
        orderBy: unknown;
        take: number;
      }) => {
        const rows = [...state.orgChanges.values()]
          .filter(r => r.workspaceId === where.workspaceId)
          .filter(r => !where.projectId || r.projectId === where.projectId)
          .filter(r => !where.status || where.status.in.includes(r.status))
          .filter(r => !where.type || where.type.in.includes(r.type))
          .filter(
            r =>
              !where.proposedByAgentId ||
              r.proposedByAgentId === where.proposedByAgentId
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return rows.slice(0, take);
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeOrgChange>;
      }) => {
        const r = state.orgChanges.get(where.id);
        if (!r) throw new Error(`org change ${where.id} not found`);
        const next: FakeOrgChange = {
          ...r,
          ...data,
          payload:
            data.payload !== undefined
              ? { ...(data.payload as object) }
              : r.payload,
        };
        state.orgChanges.set(where.id, next);
        return next;
      },
    },
    mnApproval: {
      create: async ({ data }: { data: FakeApproval }) => {
        const row: FakeApproval = {
          ...data,
          status: data.status ?? MnApprovalStatus.PENDING,
          decisionNote: data.decisionNote ?? null,
          decidedByUserId: data.decidedByUserId ?? null,
          decidedAt: data.decidedAt ?? null,
          requestedByAgentId: data.requestedByAgentId ?? null,
          payload: { ...(data.payload as object) },
        };
        state.approvals.set(row.id, row);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          workspaceId: string;
          type: MnApprovalType;
          status: MnApprovalStatus;
          payload: { path: string[]; equals: string };
        };
        data: Partial<FakeApproval>;
      }) => {
        let count = 0;
        for (const a of state.approvals.values()) {
          if (a.workspaceId !== where.workspaceId) continue;
          if (a.type !== where.type) continue;
          if (a.status !== where.status) continue;
          const path = where.payload.path;
          const equals = where.payload.equals;
          if (path.length !== 1) continue;
          if (a.payload[path[0]] !== equals) continue;
          const next = { ...a, ...data };
          state.approvals.set(a.id, next);
          count += 1;
        }
        return { count };
      },
    },
    mnRoutine: {
      create: async ({ data }: { data: FakeRoutine }) => {
        state.routines.set(data.id, { ...data });
        return data;
      },
      deleteMany: async ({
        where,
      }: {
        where: { id: string; workspaceId: string };
      }) => {
        const r = state.routines.get(where.id);
        if (r && r.workspaceId === where.workspaceId) {
          state.routines.delete(where.id);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    // $transaction(callback) -> callback(this) so writes land on the
    // same in-memory tables. We don't model rollback because the
    // service path under test never throws after a partial write in
    // these test scenarios.
    $transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
      cb(db),
  };

  return { db, state };
}

function makeAgent(
  id: string,
  workspaceId: string,
  reportsToAgentId: string | null = null,
  capabilities: string | null = null
): FakeAgent {
  return { id, workspaceId, reportsToAgentId, capabilities };
}

const W1 = 'ws-1';
const P1 = 'proj-1';

function proposeNewRoutineInput(overrides: Record<string, unknown> = {}) {
  return {
    projectId: P1,
    type: MnOrgChangeType.NEW_ROUTINE,
    payload: {
      name: 'Daily standup digest',
      prompt: 'Summarize standup notes',
      ownerId: 'user-1',
      ...overrides,
    },
    rationale: 'Reduces operator toil; runs daily at 9am',
  };
}

// ---------------------------------------------------------------------------
// Tests — propose
// ---------------------------------------------------------------------------

test('propose creates PROPOSED row AND linked PENDING approval', async t => {
  const { db, state } = createFakeDb([{ id: P1, workspaceId: W1 }]);
  const svc = new MnOrgChangeService(db as never);

  const row = await svc.propose(W1, {
    projectId: P1,
    type: MnOrgChangeType.DELEGATION_CHANGE,
    payload: { agentId: 'agent-a', newReportsToAgentId: 'agent-b' },
    rationale: 'Agent A is over-allocated; route to B for the next sprint',
    proposedByAgentId: null,
  });

  t.is(row.status, MnOrgChangeStatus.PROPOSED);
  t.is(state.orgChanges.size, 1);
  t.is(state.approvals.size, 1);

  const approvals = [...state.approvals.values()];
  t.is(approvals[0].type, MnApprovalType.AGENT_ORG_CHANGE);
  t.is(approvals[0].status, MnApprovalStatus.PENDING);
  t.is(approvals[0].payload.orgChangeId, row.id);
});

test('propose rejects projects outside the workspace', async t => {
  const { db } = createFakeDb([{ id: P1, workspaceId: 'other-workspace' }]);
  const svc = new MnOrgChangeService(db as never);

  await t.throwsAsync(
    svc.propose(W1, {
      projectId: P1,
      type: MnOrgChangeType.DELEGATION_CHANGE,
      payload: { agentId: 'agent-a' },
      rationale: 'r',
    }),
    { instanceOf: BadRequestException }
  );
});

// ---------------------------------------------------------------------------
// Tests — decide
// ---------------------------------------------------------------------------

test('decide(APPROVED) mirrors decision onto the sibling approval', async t => {
  const { db, state } = createFakeDb([{ id: P1, workspaceId: W1 }]);
  const svc = new MnOrgChangeService(db as never);
  const row = await svc.propose(W1, proposeNewRoutineInput());

  const decided = await svc.decide(W1, row.id, 'user-1', {
    status: MnOrgChangeStatus.APPROVED,
    decisionNote: 'ship it',
  });

  t.is(decided.status, MnOrgChangeStatus.APPROVED);
  t.is(decided.decisionNote, 'ship it');
  t.is(decided.decidedByUserId, 'user-1');
  const approval = [...state.approvals.values()][0];
  t.is(approval.status, MnApprovalStatus.APPROVED);
  t.is(approval.decisionNote, 'ship it');
});

test('decide rejects APPLIED / REVERTED as illegal write targets', async t => {
  const { db } = createFakeDb([{ id: P1, workspaceId: W1 }]);
  const svc = new MnOrgChangeService(db as never);
  const row = await svc.propose(W1, proposeNewRoutineInput());

  await t.throwsAsync(
    svc.decide(W1, row.id, 'user-1', { status: MnOrgChangeStatus.APPLIED }),
    { instanceOf: BadRequestException }
  );
});

test('decide rejects rows not in PROPOSED state', async t => {
  const { db } = createFakeDb([{ id: P1, workspaceId: W1 }]);
  const svc = new MnOrgChangeService(db as never);
  const row = await svc.propose(W1, proposeNewRoutineInput());
  await svc.decide(W1, row.id, 'user-1', {
    status: MnOrgChangeStatus.APPROVED,
  });

  // Second decide on the now-APPROVED row should fail.
  await t.throwsAsync(
    svc.decide(W1, row.id, 'user-2', {
      status: MnOrgChangeStatus.REJECTED,
    }),
    { instanceOf: BadRequestException }
  );
});

test('decide throws NotFoundException for unknown id', async t => {
  const { db } = createFakeDb([{ id: P1, workspaceId: W1 }]);
  const svc = new MnOrgChangeService(db as never);
  await t.throwsAsync(
    svc.decide(W1, 'no-such-id', 'user-1', {
      status: MnOrgChangeStatus.APPROVED,
    }),
    { instanceOf: NotFoundException }
  );
});

// ---------------------------------------------------------------------------
// Tests — apply
// ---------------------------------------------------------------------------

test('apply DELEGATION_CHANGE updates reportsToAgentId and captures priorState', async t => {
  const { db, state } = createFakeDb(
    [{ id: P1, workspaceId: W1 }],
    [
      makeAgent('agent-a', W1, 'agent-old'),
      makeAgent('agent-b', W1),
      makeAgent('agent-old', W1),
    ]
  );
  const svc = new MnOrgChangeService(db as never);

  const row = await svc.propose(W1, {
    projectId: P1,
    type: MnOrgChangeType.DELEGATION_CHANGE,
    payload: { agentId: 'agent-a', newReportsToAgentId: 'agent-b' },
    rationale: 'rebalance',
  });
  await svc.decide(W1, row.id, 'user-1', {
    status: MnOrgChangeStatus.APPROVED,
  });

  const applied = await svc.apply(W1, row.id);

  t.is(applied.status, MnOrgChangeStatus.APPLIED);
  t.truthy(applied.appliedAt);
  t.is(state.agents.get('agent-a')!.reportsToAgentId, 'agent-b');
  // priorState captured for future revert.
  const payload = applied.payload as Record<string, unknown>;
  const prior = payload.priorState as Record<string, unknown>;
  t.is(prior.reportsToAgentId, 'agent-old');
});

test('apply NEW_ROUTINE creates a routine row and stores its id', async t => {
  const { db, state } = createFakeDb([{ id: P1, workspaceId: W1 }]);
  const svc = new MnOrgChangeService(db as never);

  const row = await svc.propose(W1, proposeNewRoutineInput());
  await svc.decide(W1, row.id, 'user-1', {
    status: MnOrgChangeStatus.APPROVED,
  });
  const applied = await svc.apply(W1, row.id);

  t.is(applied.status, MnOrgChangeStatus.APPLIED);
  t.is(state.routines.size, 1);
  const routine = [...state.routines.values()][0];
  t.is(routine.workspaceId, W1);
  t.is(routine.name, 'Daily standup digest');
  t.is(routine.prompt, 'Summarize standup notes');
  // Created routine id is recorded so revert can delete it.
  const payload = applied.payload as Record<string, unknown>;
  t.is(payload.createdRoutineId, routine.id);
});

test('apply CAPABILITY_GRANT writes new capability set and remembers prior', async t => {
  const { db, state } = createFakeDb(
    [{ id: P1, workspaceId: W1 }],
    [makeAgent('agent-a', W1, null, 'read:docs')]
  );
  const svc = new MnOrgChangeService(db as never);
  const row = await svc.propose(W1, {
    projectId: P1,
    type: MnOrgChangeType.CAPABILITY_GRANT,
    payload: { agentId: 'agent-a', capabilities: ['read:docs', 'write:docs'] },
    rationale: 'agent needs to publish drafts',
  });
  await svc.decide(W1, row.id, 'user-1', {
    status: MnOrgChangeStatus.APPROVED,
  });
  const applied = await svc.apply(W1, row.id);

  t.is(state.agents.get('agent-a')!.capabilities, 'read:docs,write:docs');
  const prior = (applied.payload as { priorState: Record<string, unknown> })
    .priorState;
  t.is(prior.capabilities, 'read:docs');
});

test('apply rejects rows not in APPROVED state', async t => {
  const { db } = createFakeDb([{ id: P1, workspaceId: W1 }]);
  const svc = new MnOrgChangeService(db as never);
  const row = await svc.propose(W1, proposeNewRoutineInput());

  // Still PROPOSED — apply must refuse.
  await t.throwsAsync(svc.apply(W1, row.id), {
    instanceOf: BadRequestException,
  });
});

// ---------------------------------------------------------------------------
// Tests — revert
// ---------------------------------------------------------------------------

test('revert DELEGATION_CHANGE restores prior reportsToAgentId', async t => {
  const { db, state } = createFakeDb(
    [{ id: P1, workspaceId: W1 }],
    [
      makeAgent('agent-a', W1, 'agent-old'),
      makeAgent('agent-b', W1),
      makeAgent('agent-old', W1),
    ]
  );
  const svc = new MnOrgChangeService(db as never);
  const row = await svc.propose(W1, {
    projectId: P1,
    type: MnOrgChangeType.DELEGATION_CHANGE,
    payload: { agentId: 'agent-a', newReportsToAgentId: 'agent-b' },
    rationale: 'rebalance',
  });
  await svc.decide(W1, row.id, 'user-1', {
    status: MnOrgChangeStatus.APPROVED,
  });
  await svc.apply(W1, row.id);

  const reverted = await svc.revert(W1, row.id);

  t.is(reverted.status, MnOrgChangeStatus.REVERTED);
  // Underlying state walked back to the original reports-to.
  t.is(state.agents.get('agent-a')!.reportsToAgentId, 'agent-old');
});

test('revert NEW_ROUTINE deletes the created routine row', async t => {
  const { db, state } = createFakeDb([{ id: P1, workspaceId: W1 }]);
  const svc = new MnOrgChangeService(db as never);
  const row = await svc.propose(W1, proposeNewRoutineInput());
  await svc.decide(W1, row.id, 'user-1', {
    status: MnOrgChangeStatus.APPROVED,
  });
  await svc.apply(W1, row.id);
  t.is(state.routines.size, 1);

  await svc.revert(W1, row.id);

  t.is(state.routines.size, 0);
});

test('revert rejects rows not in APPLIED state', async t => {
  const { db } = createFakeDb([{ id: P1, workspaceId: W1 }]);
  const svc = new MnOrgChangeService(db as never);
  const row = await svc.propose(W1, proposeNewRoutineInput());

  // Still PROPOSED — revert must refuse.
  await t.throwsAsync(svc.revert(W1, row.id), {
    instanceOf: BadRequestException,
  });
});

// ---------------------------------------------------------------------------
// Tests — list + get cross-workspace isolation
// ---------------------------------------------------------------------------

test('get returns null for cross-workspace lookups (no info leak)', async t => {
  const { db } = createFakeDb([{ id: P1, workspaceId: W1 }]);
  const svc = new MnOrgChangeService(db as never);
  const row = await svc.propose(W1, proposeNewRoutineInput());

  // Wrong workspace id; must NOT throw, must return null.
  const result = await svc.get('other-workspace', row.id);
  t.is(result, null);
});

test('list scopes by workspace and respects PROPOSED filter', async t => {
  const { db } = createFakeDb([{ id: P1, workspaceId: W1 }]);
  const svc = new MnOrgChangeService(db as never);
  const row1 = await svc.propose(W1, proposeNewRoutineInput());
  await svc.propose(W1, proposeNewRoutineInput({ name: 'Second routine' }));
  await svc.decide(W1, row1.id, 'user-1', {
    status: MnOrgChangeStatus.APPROVED,
  });

  const proposed = await svc.list(W1, {
    statuses: [MnOrgChangeStatus.PROPOSED],
  });
  t.is(proposed.length, 1);
  t.is(proposed[0].status, MnOrgChangeStatus.PROPOSED);
});
