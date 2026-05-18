import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MnWorkProductKind } from '@prisma/client';
import test from 'ava';

import { MnWorkProductService } from '../../plugins/manut/manut-work-product.service';

/**
 * M10 work product service — CRUD invariants, workspace fence, agent
 * attribution, kind enum coverage.
 *
 * In-memory Prisma stub mirrors only the table shapes the service
 * actually touches: mnTask, mnAgent, mnWorkProduct. The task stub
 * implements the nested `select: { project: { select: ... } }` shape
 * the service uses to derive `workspaceId` from the task's project.
 */

interface FakeTask {
  id: string;
  projectId: string;
  workspaceId: string;
}
interface FakeAgent {
  id: string;
  workspaceId: string;
}
interface FakeWorkProduct {
  id: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  producedByAgentId: string | null;
  kind: MnWorkProductKind;
  ref: string;
  byteSize: number | null;
  title: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

function createFakeDb() {
  const tasks: FakeTask[] = [];
  const agents: FakeAgent[] = [];
  const workProducts: FakeWorkProduct[] = [];
  let nextId = 1;
  let clock = Date.now();
  function bumpClock(): Date {
    clock += 1;
    return new Date(clock);
  }

  const db = {
    mnTask: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const task = tasks.find(t => t.id === where.id);
        if (!task) return null;
        // The service requests `select: { id, projectId, project: { select: { workspaceId } } }`.
        // We return the same shape so the service's destructure works.
        return {
          id: task.id,
          projectId: task.projectId,
          project: { workspaceId: task.workspaceId },
        };
      },
    },
    mnAgent: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const agent = agents.find(a => a.id === where.id);
        if (!agent) return null;
        return { id: agent.id, workspaceId: agent.workspaceId };
      },
    },
    mnWorkProduct: {
      create: async ({ data }: { data: Partial<FakeWorkProduct> }) => {
        const row: FakeWorkProduct = {
          id: data.id ?? `wp-${nextId++}`,
          workspaceId: data.workspaceId!,
          projectId: data.projectId!,
          taskId: data.taskId!,
          producedByAgentId: data.producedByAgentId ?? null,
          kind: data.kind!,
          ref: data.ref!,
          byteSize: data.byteSize ?? null,
          title: data.title ?? null,
          description: data.description ?? null,
          metadata: (data.metadata ?? {}) as Record<string, unknown>,
          createdAt: bumpClock(),
        };
        workProducts.push(row);
        return row;
      },
      findMany: async ({
        where,
        orderBy,
      }: {
        where: { workspaceId: string; taskId: string };
        orderBy?: Array<{ createdAt?: 'desc' | 'asc' }>;
      }) => {
        let rows = workProducts.filter(
          w => w.workspaceId === where.workspaceId && w.taskId === where.taskId
        );
        if (orderBy?.[0]?.createdAt === 'desc') {
          rows = rows
            .slice()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return rows;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return workProducts.find(w => w.id === where.id) ?? null;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = workProducts.findIndex(w => w.id === where.id);
        if (idx < 0) throw new Error(`not found: ${where.id}`);
        const [row] = workProducts.splice(idx, 1);
        return row;
      },
    },
  };

  return { db: db as any, tasks, agents, workProducts };
}

function service() {
  const ctx = createFakeDb();
  return { svc: new MnWorkProductService(ctx.db), ...ctx };
}

const WS = 'ws-1';
const PROJ = 'proj-1';
const TASK = 'task-1';

function seedTask(ctx: ReturnType<typeof createFakeDb>) {
  ctx.tasks.push({ id: TASK, projectId: PROJ, workspaceId: WS });
}

function seedAgent(
  ctx: ReturnType<typeof createFakeDb>,
  id: string,
  workspaceId: string
) {
  ctx.agents.push({ id, workspaceId });
}

// ---------------------------------------------------------------------------
// CRUD basics
// ---------------------------------------------------------------------------

test('create > given valid DOC input > persists with task-derived workspaceId/projectId', async t => {
  const ctx = service();
  seedTask(ctx);
  const row = await ctx.svc.create(WS, {
    taskId: TASK,
    kind: MnWorkProductKind.DOC,
    ref: 'doc-123',
    title: 'Spec',
  });
  t.is(row.workspaceId, WS);
  t.is(row.projectId, PROJ);
  t.is(row.taskId, TASK);
  t.is(row.kind, MnWorkProductKind.DOC);
  t.is(row.ref, 'doc-123');
  t.is(row.title, 'Spec');
  t.is(row.producedByAgentId, null);
  t.deepEqual(row.metadata, {});
  t.is(ctx.workProducts.length, 1);
});

test('create > given each MnWorkProductKind > all 7 kinds accepted', async t => {
  const ctx = service();
  seedTask(ctx);
  const kinds = [
    MnWorkProductKind.DOC,
    MnWorkProductKind.FILE,
    MnWorkProductKind.URL,
    MnWorkProductKind.PR,
    MnWorkProductKind.DEPLOYMENT,
    MnWorkProductKind.CSV,
    MnWorkProductKind.SCREENSHOT,
  ];
  for (const kind of kinds) {
    const row = await ctx.svc.create(WS, {
      taskId: TASK,
      kind,
      ref: `ref-${kind}`,
    });
    t.is(row.kind, kind);
  }
  t.is(ctx.workProducts.length, kinds.length);
});

test('create > given producedByAgentId in same workspace > persists attribution', async t => {
  const ctx = service();
  seedTask(ctx);
  seedAgent(ctx, 'agent-1', WS);
  const row = await ctx.svc.create(WS, {
    taskId: TASK,
    kind: MnWorkProductKind.PR,
    ref: 'https://github.com/owner/repo/pull/42',
    producedByAgentId: 'agent-1',
    byteSize: null,
    metadata: { repo: 'owner/repo', number: 42 },
  });
  t.is(row.producedByAgentId, 'agent-1');
  t.deepEqual(row.metadata, { repo: 'owner/repo', number: 42 });
});

// ---------------------------------------------------------------------------
// Workspace fence
// ---------------------------------------------------------------------------

test('create > given task in foreign workspace > throws Forbidden', async t => {
  const ctx = service();
  ctx.tasks.push({
    id: 'task-other',
    projectId: 'p-other',
    workspaceId: 'ws-other',
  });
  await t.throwsAsync(
    () =>
      ctx.svc.create(WS, {
        taskId: 'task-other',
        kind: MnWorkProductKind.DOC,
        ref: 'sneaky',
      }),
    { instanceOf: ForbiddenException }
  );
  t.is(ctx.workProducts.length, 0);
});

test('create > given unknown taskId > throws NotFound', async t => {
  const ctx = service();
  await t.throwsAsync(
    () =>
      ctx.svc.create(WS, {
        taskId: 'task-vanished',
        kind: MnWorkProductKind.URL,
        ref: 'https://example.com',
      }),
    { instanceOf: NotFoundException }
  );
});

test('create > given agent in foreign workspace > throws Forbidden', async t => {
  const ctx = service();
  seedTask(ctx);
  seedAgent(ctx, 'agent-leak', 'ws-other');
  await t.throwsAsync(
    () =>
      ctx.svc.create(WS, {
        taskId: TASK,
        kind: MnWorkProductKind.FILE,
        ref: 'r2://bucket/key.png',
        producedByAgentId: 'agent-leak',
      }),
    { instanceOf: ForbiddenException }
  );
});

test('get > given foreign workspaceId > returns null', async t => {
  const ctx = service();
  seedTask(ctx);
  const created = await ctx.svc.create(WS, {
    taskId: TASK,
    kind: MnWorkProductKind.DOC,
    ref: 'doc-fence',
  });
  const miss = await ctx.svc.get('ws-other', created.id);
  t.is(miss, null);
});

test('listByTask > given foreign workspaceId > returns empty', async t => {
  const ctx = service();
  seedTask(ctx);
  await ctx.svc.create(WS, {
    taskId: TASK,
    kind: MnWorkProductKind.DOC,
    ref: 'doc-1',
  });
  const empty = await ctx.svc.listByTask('ws-other', TASK);
  t.deepEqual(empty, []);
});

test('listByTask > given matching workspaceId > newest first', async t => {
  const ctx = service();
  seedTask(ctx);
  const first = await ctx.svc.create(WS, {
    taskId: TASK,
    kind: MnWorkProductKind.DOC,
    ref: 'doc-old',
  });
  const second = await ctx.svc.create(WS, {
    taskId: TASK,
    kind: MnWorkProductKind.URL,
    ref: 'https://newer.example',
  });
  const rows = await ctx.svc.listByTask(WS, TASK);
  t.is(rows.length, 2);
  // bumpClock guarantees second.createdAt > first.createdAt
  t.is(rows[0].id, second.id);
  t.is(rows[1].id, first.id);
});

// ---------------------------------------------------------------------------
// Delete + getOrThrow
// ---------------------------------------------------------------------------

test('delete > given matching workspace > removes the row', async t => {
  const ctx = service();
  seedTask(ctx);
  const row = await ctx.svc.create(WS, {
    taskId: TASK,
    kind: MnWorkProductKind.SCREENSHOT,
    ref: 'r2://bucket/shot.png',
  });
  t.is(ctx.workProducts.length, 1);
  await ctx.svc.delete(WS, row.id);
  t.is(ctx.workProducts.length, 0);
});

test('delete > given foreign workspaceId > throws NotFound (fence)', async t => {
  const ctx = service();
  seedTask(ctx);
  const row = await ctx.svc.create(WS, {
    taskId: TASK,
    kind: MnWorkProductKind.URL,
    ref: 'https://example',
  });
  await t.throwsAsync(() => ctx.svc.delete('ws-other', row.id), {
    instanceOf: NotFoundException,
  });
  // Row was NOT deleted because the fence rejected the call.
  t.is(ctx.workProducts.length, 1);
});

test('getOrThrow > given unknown id > throws NotFound', async t => {
  const ctx = service();
  await t.throwsAsync(() => ctx.svc.getOrThrow(WS, 'never-existed'), {
    instanceOf: NotFoundException,
  });
});
