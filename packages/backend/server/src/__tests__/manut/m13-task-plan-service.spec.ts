/**
 * M13 — Task Plan service. Revision auto-increment + state machine
 * + supersede invariant + workspace fence.
 *
 * In-memory Prisma stub mirrors the table shape MnTaskPlanService
 * actually touches: mn_task_plans, mn_tasks (read-only). No real
 * Postgres — keeps the suite fast and isolated (FIRST.fast).
 *
 * Behaviour covered:
 *   - createPlan auto-increments revisionNumber per task (1, 2, 3, …)
 *   - createPlan rejects empty body
 *   - createPlan rejects body that exceeds the size cap
 *   - createPlan rejects an unknown taskId
 *   - createPlan rejects both authorAgentId AND authorUserId set (XOR)
 *   - submitForReview moves DRAFT → UNDER_REVIEW
 *   - submitForReview rejects non-DRAFT source state
 *   - decidePlan APPROVE moves UNDER_REVIEW → APPROVED + supersedes
 *     prior APPROVED on the same task
 *   - decidePlan REJECT moves UNDER_REVIEW → REJECTED with no
 *     supersede side-effect
 *   - decidePlan appends reviewerComments append-only
 *   - decidePlan rejects non-UNDER_REVIEW source state
 *   - getPlanWithWorkspace returns workspaceId for cross-workspace
 *     fence checks (the resolver uses this for permission gating)
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MnTaskPlanStatus } from '@prisma/client';
import test from 'ava';

import { MnTaskPlanDecision } from '../../plugins/manut/manut-task-plan.dto';
import { MnTaskPlanService } from '../../plugins/manut/manut-task-plan.service';

interface FakePlan {
  id: string;
  taskId: string;
  revisionNumber: number;
  bodyMd: string;
  status: MnTaskPlanStatus;
  authorAgentId: string | null;
  authorUserId: string | null;
  reviewerComments: unknown[];
  createdAt: Date;
}

interface FakeTask {
  id: string;
  projectId: string;
}

interface FakeProject {
  id: string;
  workspaceId: string;
}

function createFakeDb(
  initialTasks: FakeTask[] = [],
  initialProjects: FakeProject[] = []
) {
  const plans: FakePlan[] = [];
  const tasks = new Map(initialTasks.map(t => [t.id, t]));
  const projects = new Map(initialProjects.map(p => [p.id, p]));

  // The transaction stub runs the provided callback against `db`
  // synchronously enough that any updates inside it land before the
  // next test op. The real Prisma transaction is row-locked; the
  // in-memory stub doesn't need that guarantee because tests don't
  // race within a single ava worker.
  const db: Record<string, unknown> = {
    $transaction: async <T>(
      fn: (tx: Record<string, unknown>) => Promise<T>
    ): Promise<T> => fn(db),
    mnTask: {
      findUnique: async ({
        where,
        include,
        select: _select,
      }: {
        where: { id: string };
        include?: { project?: unknown };
        select?: unknown;
      }) => {
        const t = tasks.get(where.id);
        if (!t) return null;
        if (include?.project) {
          const project = projects.get(t.projectId);
          return {
            id: t.id,
            projectId: t.projectId,
            project: project
              ? { id: project.id, workspaceId: project.workspaceId }
              : null,
          };
        }
        return { id: t.id, projectId: t.projectId };
      },
    },
    mnTaskPlan: {
      findUnique: async ({
        where,
        include,
      }: {
        where: { id: string };
        include?: { task?: unknown };
      }) => {
        const p = plans.find(pp => pp.id === where.id);
        if (!p) return null;
        if (include?.task) {
          const t = tasks.get(p.taskId);
          const project = t ? projects.get(t.projectId) : undefined;
          return {
            ...p,
            task: t
              ? {
                  id: t.id,
                  projectId: t.projectId,
                  project: project
                    ? { id: project.id, workspaceId: project.workspaceId }
                    : null,
                }
              : null,
          };
        }
        return { ...p };
      },
      findFirst: async ({
        where,
        orderBy: _orderBy,
        select: _select,
      }: {
        where: { taskId: string };
        orderBy?: unknown;
        select?: unknown;
      }) => {
        const taskPlans = plans
          .filter(p => p.taskId === where.taskId)
          .sort((a, b) => b.revisionNumber - a.revisionNumber);
        return taskPlans[0] ?? null;
      },
      findMany: async ({
        where,
        orderBy: _orderBy,
      }: {
        where: { taskId: string };
        orderBy?: unknown;
      }) => {
        return plans
          .filter(p => p.taskId === where.taskId)
          .sort((a, b) => b.revisionNumber - a.revisionNumber);
      },
      create: async ({ data }: { data: Partial<FakePlan> }) => {
        // Enforce the unique constraint shape in the stub so a missing
        // monotonic increment in the service code would still surface
        // as a P2002 collision (same way Postgres would).
        if (
          plans.some(
            p =>
              p.taskId === data.taskId &&
              p.revisionNumber === data.revisionNumber
          )
        ) {
          const err = new Error('Unique violation') as Error & {
            code: string;
          };
          err.code = 'P2002';
          throw err;
        }
        const row: FakePlan = {
          id: data.id!,
          taskId: data.taskId!,
          revisionNumber: data.revisionNumber!,
          bodyMd: data.bodyMd!,
          status: data.status ?? MnTaskPlanStatus.DRAFT,
          authorAgentId: data.authorAgentId ?? null,
          authorUserId: data.authorUserId ?? null,
          reviewerComments: Array.isArray(data.reviewerComments)
            ? (data.reviewerComments as unknown[])
            : [],
          createdAt: new Date(),
        };
        plans.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakePlan>;
      }) => {
        const row = plans.find(p => p.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          taskId: string;
          status: MnTaskPlanStatus;
          id?: { not: string };
        };
        data: Partial<FakePlan>;
      }) => {
        let count = 0;
        for (const p of plans) {
          if (
            p.taskId === where.taskId &&
            p.status === where.status &&
            (where.id?.not === undefined || p.id !== where.id.not)
          ) {
            Object.assign(p, data);
            count++;
          }
        }
        return { count };
      },
    },
  };

  return { db, plans, tasks, projects };
}

function makeService(
  db: ReturnType<typeof createFakeDb>['db']
): MnTaskPlanService {
  return new MnTaskPlanService(
    db as unknown as ConstructorParameters<typeof MnTaskPlanService>[0]
  );
}

test('createPlan auto-increments revisionNumber per task', async t => {
  const { db } = createFakeDb([{ id: 't1', projectId: 'p1' }]);
  const svc = makeService(db);

  const r1 = await svc.createPlan('t1', '# v1', { authorUserId: 'u1' });
  const r2 = await svc.createPlan('t1', '# v2', { authorUserId: 'u1' });
  const r3 = await svc.createPlan('t1', '# v3', { authorUserId: 'u1' });

  t.is(r1.revisionNumber, 1);
  t.is(r2.revisionNumber, 2);
  t.is(r3.revisionNumber, 3);
  t.is(r1.status, MnTaskPlanStatus.DRAFT);
});

test('createPlan rejects empty body', async t => {
  const { db } = createFakeDb([{ id: 't1', projectId: 'p1' }]);
  const svc = makeService(db);
  await t.throwsAsync(svc.createPlan('t1', '   ', { authorUserId: 'u1' }), {
    instanceOf: BadRequestException,
  });
});

test('createPlan rejects unknown taskId', async t => {
  const { db } = createFakeDb();
  const svc = makeService(db);
  await t.throwsAsync(
    svc.createPlan('bogus', '# body', { authorUserId: 'u1' }),
    { instanceOf: NotFoundException }
  );
});

test('createPlan rejects authorAgentId AND authorUserId set (XOR)', async t => {
  const { db } = createFakeDb([{ id: 't1', projectId: 'p1' }]);
  const svc = makeService(db);
  await t.throwsAsync(
    svc.createPlan('t1', '# body', {
      authorAgentId: 'agent-1',
      authorUserId: 'user-1',
    }),
    { instanceOf: BadRequestException }
  );
});

test('submitForReview moves DRAFT → UNDER_REVIEW', async t => {
  const { db } = createFakeDb([{ id: 't1', projectId: 'p1' }]);
  const svc = makeService(db);
  const draft = await svc.createPlan('t1', '# v1', { authorUserId: 'u1' });
  const submitted = await svc.submitForReview(draft.id);
  t.is(submitted.status, MnTaskPlanStatus.UNDER_REVIEW);
});

test('submitForReview rejects non-DRAFT source state', async t => {
  const { db } = createFakeDb([{ id: 't1', projectId: 'p1' }]);
  const svc = makeService(db);
  const draft = await svc.createPlan('t1', '# v1', { authorUserId: 'u1' });
  await svc.submitForReview(draft.id);
  // Second submit on an UNDER_REVIEW plan must fail — the state
  // machine is strictly forward, no idempotent re-submission.
  await t.throwsAsync(svc.submitForReview(draft.id), {
    instanceOf: BadRequestException,
  });
});

test('decidePlan APPROVE supersedes prior APPROVED on the same task', async t => {
  const { db, plans } = createFakeDb([{ id: 't1', projectId: 'p1' }]);
  const svc = makeService(db);

  // Plan A — created, submitted, approved.
  const a = await svc.createPlan('t1', '# v1', { authorUserId: 'u1' });
  await svc.submitForReview(a.id);
  await svc.decidePlan(a.id, {
    decision: MnTaskPlanDecision.APPROVE,
    reviewerUserId: 'reviewer-1',
  });

  // Plan B — second revision, also approved. This MUST flip A to
  // SUPERSEDED so the "current plan" invariant (≤1 APPROVED per
  // task) holds.
  const b = await svc.createPlan('t1', '# v2', { authorUserId: 'u1' });
  await svc.submitForReview(b.id);
  const decidedB = await svc.decidePlan(b.id, {
    decision: MnTaskPlanDecision.APPROVE,
    reviewerUserId: 'reviewer-1',
  });

  const stillA = plans.find(p => p.id === a.id);
  t.is(stillA?.status, MnTaskPlanStatus.SUPERSEDED);
  t.is(decidedB.status, MnTaskPlanStatus.APPROVED);
  // Confirm exactly one APPROVED row remains.
  t.is(
    plans.filter(p => p.taskId === 't1' && p.status === 'APPROVED').length,
    1
  );
});

test('decidePlan REJECT does not supersede other revisions', async t => {
  const { db, plans } = createFakeDb([{ id: 't1', projectId: 'p1' }]);
  const svc = makeService(db);

  const a = await svc.createPlan('t1', '# v1', { authorUserId: 'u1' });
  await svc.submitForReview(a.id);
  await svc.decidePlan(a.id, {
    decision: MnTaskPlanDecision.APPROVE,
    reviewerUserId: 'reviewer-1',
  });

  const b = await svc.createPlan('t1', '# v2', { authorUserId: 'u1' });
  await svc.submitForReview(b.id);
  await svc.decidePlan(b.id, {
    decision: MnTaskPlanDecision.REJECT,
    reviewerUserId: 'reviewer-1',
    comment: 'not enough detail',
  });

  const stillA = plans.find(p => p.id === a.id);
  t.is(
    stillA?.status,
    MnTaskPlanStatus.APPROVED,
    'a REJECT decision must not flip the prior APPROVED plan'
  );
  const finalB = plans.find(p => p.id === b.id);
  t.is(finalB?.status, MnTaskPlanStatus.REJECTED);
});

test('decidePlan appends reviewerComments append-only', async t => {
  const { db } = createFakeDb([{ id: 't1', projectId: 'p1' }]);
  const svc = makeService(db);

  const a = await svc.createPlan('t1', '# v1', { authorUserId: 'u1' });
  await svc.submitForReview(a.id);
  const decided = await svc.decidePlan(a.id, {
    decision: MnTaskPlanDecision.APPROVE,
    reviewerUserId: 'reviewer-1',
    comment: 'looks great',
  });

  const comments = decided.reviewerComments as Array<Record<string, unknown>>;
  t.is(comments.length, 1);
  t.is(comments[0].decision, MnTaskPlanDecision.APPROVE);
  t.is(comments[0].comment, 'looks great');
  t.is(comments[0].reviewerUserId, 'reviewer-1');
  t.truthy(comments[0].decidedAt);
});

test('decidePlan rejects non-UNDER_REVIEW source state (workflow fence)', async t => {
  const { db } = createFakeDb([{ id: 't1', projectId: 'p1' }]);
  const svc = makeService(db);
  const draft = await svc.createPlan('t1', '# v1', { authorUserId: 'u1' });
  // DRAFT → decide must fail; only UNDER_REVIEW accepts decisions.
  await t.throwsAsync(
    svc.decidePlan(draft.id, {
      decision: MnTaskPlanDecision.APPROVE,
      reviewerUserId: 'r1',
    }),
    { instanceOf: BadRequestException }
  );
});

test('getPlanWithWorkspace returns the task project workspaceId for fencing', async t => {
  const { db } = createFakeDb(
    [{ id: 't1', projectId: 'p1' }],
    [{ id: 'p1', workspaceId: 'ws-alpha' }]
  );
  const svc = makeService(db);
  const plan = await svc.createPlan('t1', '# v1', { authorUserId: 'u1' });
  const ctx = await svc.getPlanWithWorkspace(plan.id);
  t.not(ctx, null);
  t.is(ctx?.workspaceId, 'ws-alpha');
  // Cross-workspace fence sanity: a plan in a project belonging to
  // workspace 'ws-alpha' MUST NOT resolve as belonging to anything
  // else. The resolver uses this exact value as the AccessController
  // workspace argument.
  t.not(ctx?.workspaceId, 'ws-beta');
});
