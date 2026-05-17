/**
 * MnGoalService — RED-first invariant coverage.
 *
 * Uses a hand-rolled in-memory Prisma stub, same pattern as
 * `mn-agent-service.spec.ts`. Tests behavior at the service boundary
 * (the only callable surface) — not implementation details.
 *
 * Invariants under test:
 *  - Cross-tenant fences: project / parent / owner agent must belong
 *    to the calling workspace.
 *  - Parent-goal cycle detection: self-parent and longer cycles raise
 *    BadRequestException before the write hits the DB.
 *  - Depth cap: chains longer than MAX_GOAL_CHAIN_DEPTH are rejected.
 *  - Lifecycle: ACHIEVED / CANCELLED goals cannot be flipped back to
 *    PLANNED / ACTIVE (terminal end-states).
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MnGoalLevel, MnGoalStatus } from '@prisma/client';
import test from 'ava';

import { MAX_GOAL_CHAIN_DEPTH } from '../../plugins/manut/manut-goal.dto';
import { MnGoalService } from '../../plugins/manut/manut-goal.service';

interface FakeProject {
  id: string;
  workspaceId: string;
}

interface FakeAgent {
  id: string;
  workspaceId: string;
  projectId: string;
}

interface FakeGoal {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string | null;
  level: MnGoalLevel;
  parentGoalId: string | null;
  ownerAgentId: string | null;
  status: MnGoalStatus;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function createFakeDb() {
  const projects: FakeProject[] = [];
  const agents: FakeAgent[] = [];
  const goals: FakeGoal[] = [];

  const db = {
    mnProject: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        projects.find(p => p.id === where.id) ?? null,
    },
    mnAgent: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        agents.find(a => a.id === where.id) ?? null,
    },
    mnGoal: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        goals.find(g => g.id === where.id) ?? null,
      findMany: async ({
        where,
      }: {
        where: { workspaceId: string; projectId?: string };
      }) =>
        goals
          .filter(g => g.workspaceId === where.workspaceId)
          .filter(g =>
            where.projectId ? g.projectId === where.projectId : true
          ),
      create: async ({
        data,
      }: {
        data: Partial<FakeGoal> & { id: string };
      }) => {
        const now = new Date();
        const row: FakeGoal = {
          id: data.id,
          workspaceId: data.workspaceId!,
          projectId: data.projectId!,
          title: data.title!,
          description: data.description ?? null,
          level: data.level!,
          parentGoalId: data.parentGoalId ?? null,
          ownerAgentId: data.ownerAgentId ?? null,
          status: data.status ?? MnGoalStatus.PLANNED,
          createdByUserId: data.createdByUserId ?? null,
          createdAt: now,
          updatedAt: now,
        };
        goals.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeGoal>;
      }) => {
        const idx = goals.findIndex(g => g.id === where.id);
        if (idx < 0) throw new Error('not found');
        goals[idx] = { ...goals[idx], ...data, updatedAt: new Date() };
        return goals[idx];
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = goals.findIndex(g => g.id === where.id);
        if (idx < 0) throw new Error('not found');
        const [removed] = goals.splice(idx, 1);
        return removed;
      },
    },
  };

  return { db, projects, agents, goals };
}

function seed(
  fake: ReturnType<typeof createFakeDb>,
  values: {
    projects?: FakeProject[];
    agents?: FakeAgent[];
    goals?: Partial<FakeGoal>[];
  }
) {
  fake.projects.push(...(values.projects ?? []));
  fake.agents.push(...(values.agents ?? []));
  for (const partial of values.goals ?? []) {
    const now = new Date();
    fake.goals.push({
      id: partial.id ?? `goal-${fake.goals.length + 1}`,
      workspaceId: partial.workspaceId ?? 'workspace-1',
      projectId: partial.projectId ?? 'project-1',
      title: partial.title ?? 'test-goal',
      description: partial.description ?? null,
      level: partial.level ?? MnGoalLevel.PROJECT,
      parentGoalId: partial.parentGoalId ?? null,
      ownerAgentId: partial.ownerAgentId ?? null,
      status: partial.status ?? MnGoalStatus.PLANNED,
      createdByUserId: partial.createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }
}

test('create persists a new goal with defaults', async t => {
  const fake = createFakeDb();
  seed(fake, { projects: [{ id: 'project-1', workspaceId: 'workspace-1' }] });
  const svc = new MnGoalService(fake.db as any);

  const row = await svc.create('workspace-1', 'user-1', {
    projectId: 'project-1',
    title: 'Ship M2',
    level: MnGoalLevel.PROJECT,
  });

  t.is(row.workspaceId, 'workspace-1');
  t.is(row.projectId, 'project-1');
  t.is(row.title, 'Ship M2');
  t.is(row.level, MnGoalLevel.PROJECT);
  t.is(row.status, MnGoalStatus.PLANNED);
  t.is(row.createdByUserId, 'user-1');
});

test('create rejects a project belonging to another workspace', async t => {
  const fake = createFakeDb();
  seed(fake, {
    projects: [{ id: 'project-other', workspaceId: 'workspace-other' }],
  });
  const svc = new MnGoalService(fake.db as any);

  await t.throwsAsync(
    () =>
      svc.create('workspace-1', null, {
        projectId: 'project-other',
        title: 'x',
        level: MnGoalLevel.PROJECT,
      }),
    { instanceOf: BadRequestException, message: /workspace/i }
  );
});

test('create rejects a parentGoalId belonging to another workspace', async t => {
  const fake = createFakeDb();
  seed(fake, {
    projects: [
      { id: 'project-1', workspaceId: 'workspace-1' },
      { id: 'project-other', workspaceId: 'workspace-other' },
    ],
    goals: [
      {
        id: 'goal-other',
        workspaceId: 'workspace-other',
        projectId: 'project-other',
      },
    ],
  });
  const svc = new MnGoalService(fake.db as any);

  await t.throwsAsync(
    () =>
      svc.create('workspace-1', null, {
        projectId: 'project-1',
        title: 'x',
        level: MnGoalLevel.TEAM,
        parentGoalId: 'goal-other',
      }),
    { instanceOf: BadRequestException, message: /workspace/i }
  );
});

test('create rejects an ownerAgentId belonging to another workspace', async t => {
  const fake = createFakeDb();
  seed(fake, {
    projects: [{ id: 'project-1', workspaceId: 'workspace-1' }],
    agents: [
      {
        id: 'agent-other',
        workspaceId: 'workspace-other',
        projectId: 'project-other',
      },
    ],
  });
  const svc = new MnGoalService(fake.db as any);

  await t.throwsAsync(
    () =>
      svc.create('workspace-1', null, {
        projectId: 'project-1',
        title: 'x',
        level: MnGoalLevel.AGENT,
        ownerAgentId: 'agent-other',
      }),
    { instanceOf: BadRequestException, message: /workspace/i }
  );
});

test('update rejects parent set to self', async t => {
  const fake = createFakeDb();
  seed(fake, {
    projects: [{ id: 'project-1', workspaceId: 'workspace-1' }],
    goals: [{ id: 'goal-1' }],
  });
  const svc = new MnGoalService(fake.db as any);

  await t.throwsAsync(
    () => svc.update('workspace-1', 'goal-1', { parentGoalId: 'goal-1' }),
    { instanceOf: BadRequestException, message: /itself/i }
  );
});

test('update rejects a parent chain that loops back to the goal', async t => {
  const fake = createFakeDb();
  seed(fake, {
    projects: [{ id: 'project-1', workspaceId: 'workspace-1' }],
    goals: [
      { id: 'goal-a', parentGoalId: null },
      { id: 'goal-b', parentGoalId: 'goal-a' },
      { id: 'goal-c', parentGoalId: 'goal-b' },
    ],
  });
  const svc = new MnGoalService(fake.db as any);

  // Setting goal-a.parentGoalId = goal-c would make a → c → b → a → ...
  await t.throwsAsync(
    () => svc.update('workspace-1', 'goal-a', { parentGoalId: 'goal-c' }),
    { instanceOf: BadRequestException, message: /cycle/i }
  );
});

test('update rejects a chain that exceeds MAX_GOAL_CHAIN_DEPTH', async t => {
  const fake = createFakeDb();
  seed(fake, {
    projects: [{ id: 'project-1', workspaceId: 'workspace-1' }],
  });
  // Build a straight chain of exactly MAX depth.
  const chain: { id: string; parentGoalId: string | null }[] = [];
  for (let i = 0; i < MAX_GOAL_CHAIN_DEPTH; i++) {
    chain.push({
      id: `chain-${i}`,
      parentGoalId: i === 0 ? null : `chain-${i - 1}`,
    });
  }
  seed(fake, { goals: chain });
  // Add the leaf that would push depth past the limit.
  seed(fake, { goals: [{ id: 'leaf', parentGoalId: null }] });

  const svc = new MnGoalService(fake.db as any);

  await t.throwsAsync(
    () =>
      svc.update('workspace-1', 'leaf', {
        parentGoalId: `chain-${MAX_GOAL_CHAIN_DEPTH - 1}`,
      }),
    { instanceOf: BadRequestException, message: /depth/i }
  );
});

test('update on an ACHIEVED goal cannot flip status back to ACTIVE', async t => {
  const fake = createFakeDb();
  seed(fake, {
    projects: [{ id: 'project-1', workspaceId: 'workspace-1' }],
    goals: [{ id: 'goal-1', status: MnGoalStatus.ACHIEVED }],
  });
  const svc = new MnGoalService(fake.db as any);

  await t.throwsAsync(
    () => svc.update('workspace-1', 'goal-1', { status: MnGoalStatus.ACTIVE }),
    { instanceOf: BadRequestException, message: /terminal/i }
  );
});

test('update on a CANCELLED goal cannot flip status back to PLANNED', async t => {
  const fake = createFakeDb();
  seed(fake, {
    projects: [{ id: 'project-1', workspaceId: 'workspace-1' }],
    goals: [{ id: 'goal-1', status: MnGoalStatus.CANCELLED }],
  });
  const svc = new MnGoalService(fake.db as any);

  await t.throwsAsync(
    () => svc.update('workspace-1', 'goal-1', { status: MnGoalStatus.PLANNED }),
    { instanceOf: BadRequestException, message: /terminal/i }
  );
});

test('get returns null when the goal belongs to another workspace', async t => {
  const fake = createFakeDb();
  seed(fake, {
    goals: [{ id: 'goal-other', workspaceId: 'workspace-other' }],
  });
  const svc = new MnGoalService(fake.db as any);

  t.is(await svc.get('workspace-1', 'goal-other'), null);
});

test('getOrThrow raises NotFoundException for missing goals', async t => {
  const fake = createFakeDb();
  const svc = new MnGoalService(fake.db as any);

  await t.throwsAsync(() => svc.getOrThrow('workspace-1', 'nope'), {
    instanceOf: NotFoundException,
  });
});

test('list filters by projectId when supplied', async t => {
  const fake = createFakeDb();
  seed(fake, {
    goals: [
      { id: 'g1', projectId: 'project-1' },
      { id: 'g2', projectId: 'project-2' },
    ],
  });
  const svc = new MnGoalService(fake.db as any);

  const rows = await svc.list('workspace-1', 'project-1');
  t.deepEqual(
    rows.map(r => r.id),
    ['g1']
  );
});

test('delete removes the row after ownership check', async t => {
  const fake = createFakeDb();
  seed(fake, { goals: [{ id: 'goal-1' }] });
  const svc = new MnGoalService(fake.db as any);

  await svc.delete('workspace-1', 'goal-1');
  t.is(fake.goals.length, 0);
});

test('ancestryChain walks parent links root → leaf', async t => {
  const fake = createFakeDb();
  seed(fake, {
    projects: [{ id: 'project-1', workspaceId: 'workspace-1' }],
    goals: [
      { id: 'root', parentGoalId: null, level: MnGoalLevel.PROJECT },
      { id: 'mid', parentGoalId: 'root', level: MnGoalLevel.TEAM },
      { id: 'leaf', parentGoalId: 'mid', level: MnGoalLevel.AGENT },
    ],
  });
  const svc = new MnGoalService(fake.db as any);

  const steps = await svc.ancestryChain('workspace-1', 'leaf');

  t.deepEqual(
    steps.map(s => s.goalId),
    ['root', 'mid', 'leaf']
  );
});
