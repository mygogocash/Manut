import { NotFoundException } from '@nestjs/common';
import { MnMemoryKind } from '@prisma/client';
import test from 'ava';

import { MnAgentMemoryService } from '../../plugins/manut/manut-memory.service';

/**
 * M9 memory service — CRUD invariants, recall ranking (importance desc
 * then recency desc), garbage collection, cross-tenant fence.
 *
 * In-memory Prisma stub mirrors only the table shape the service
 * actually touches.
 */

interface FakeMemory {
  id: string;
  workspaceId: string;
  projectId: string;
  agentId: string;
  taskId: string | null;
  kind: MnMemoryKind;
  contentMd: string;
  embedding: number[];
  retrievedCount: number;
  lastRetrievedAt: Date | null;
  importance: number;
  createdAt: Date;
  updatedAt: Date;
}

function createFakeDb() {
  const memories: FakeMemory[] = [];
  let nextId = 1;
  let clock = Date.now();

  function bumpClock(): Date {
    clock += 1;
    return new Date(clock);
  }

  const db = {
    mnAgentMemory: {
      create: async ({ data }: { data: Partial<FakeMemory> }) => {
        const now = bumpClock();
        const row: FakeMemory = {
          id: data.id ?? `mem-${nextId++}`,
          workspaceId: data.workspaceId!,
          projectId: data.projectId!,
          agentId: data.agentId!,
          taskId: data.taskId ?? null,
          kind: data.kind!,
          contentMd: data.contentMd!,
          embedding: Array.isArray(data.embedding) ? data.embedding : [],
          retrievedCount: data.retrievedCount ?? 0,
          lastRetrievedAt: data.lastRetrievedAt ?? null,
          importance: data.importance ?? 1,
          createdAt: now,
          updatedAt: now,
        };
        memories.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return memories.find(m => m.id === where.id) ?? null;
      },
      findMany: async ({
        where,
        orderBy,
        take,
      }: {
        where?: {
          workspaceId?: string;
          agentId?: string;
          taskId?: string | null;
          OR?: Array<{ taskId?: string | null }>;
        };
        orderBy?: Array<
          | { importance?: 'desc' | 'asc' }
          | { createdAt?: 'desc' | 'asc' }
          | {
              lastRetrievedAt?:
                | 'desc'
                | 'asc'
                | { sort: 'desc' | 'asc'; nulls: 'first' | 'last' };
            }
        >;
        take?: number;
      }) => {
        let rows = memories.slice();
        if (where?.workspaceId) {
          rows = rows.filter(m => m.workspaceId === where.workspaceId);
        }
        if (where?.agentId) {
          rows = rows.filter(m => m.agentId === where.agentId);
        }
        if (where?.taskId !== undefined) {
          rows = rows.filter(m => m.taskId === where.taskId);
        }
        if (where?.OR) {
          rows = rows.filter(m =>
            where.OR!.some(clause => {
              if ('taskId' in clause) return m.taskId === clause.taskId;
              return false;
            })
          );
        }
        if (orderBy) {
          rows.sort((a, b) => {
            for (const o of orderBy) {
              if ('importance' in o && o.importance) {
                const dir = o.importance === 'desc' ? -1 : 1;
                if (a.importance !== b.importance)
                  return (a.importance - b.importance) * dir;
              }
              if ('lastRetrievedAt' in o && o.lastRetrievedAt) {
                const spec = o.lastRetrievedAt;
                const sort = typeof spec === 'string' ? spec : spec.sort;
                const nulls =
                  typeof spec === 'string' ? 'last' : (spec.nulls ?? 'last');
                const at = a.lastRetrievedAt;
                const bt = b.lastRetrievedAt;
                if (at === null && bt === null) continue;
                if (at === null) return nulls === 'last' ? 1 : -1;
                if (bt === null) return nulls === 'last' ? -1 : 1;
                const dir = sort === 'desc' ? -1 : 1;
                if (at.getTime() !== bt.getTime())
                  return (at.getTime() - bt.getTime()) * dir;
              }
              if ('createdAt' in o && o.createdAt) {
                const dir = o.createdAt === 'desc' ? -1 : 1;
                if (a.createdAt.getTime() !== b.createdAt.getTime())
                  return (a.createdAt.getTime() - b.createdAt.getTime()) * dir;
              }
            }
            return 0;
          });
        }
        if (typeof take === 'number') {
          rows = rows.slice(0, take);
        }
        return rows;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id?: { in: string[] } };
        data: {
          retrievedCount?: { increment: number };
          lastRetrievedAt?: Date;
        };
      }) => {
        const ids = where.id?.in ?? [];
        let count = 0;
        for (const row of memories) {
          if (!ids.includes(row.id)) continue;
          if (data.retrievedCount?.increment) {
            row.retrievedCount += data.retrievedCount.increment;
          }
          if (data.lastRetrievedAt) {
            row.lastRetrievedAt = data.lastRetrievedAt;
          }
          row.updatedAt = bumpClock();
          count++;
        }
        return { count };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = memories.findIndex(m => m.id === where.id);
        if (idx === -1) throw new Error(`mnAgentMemory not found: ${where.id}`);
        const [row] = memories.splice(idx, 1);
        return row;
      },
      deleteMany: async ({
        where,
      }: {
        where: {
          agentId?: string;
          importance?: { lt?: number };
          createdAt?: { lt?: Date };
        };
      }) => {
        let count = 0;
        for (let i = memories.length - 1; i >= 0; i--) {
          const row = memories[i];
          if (where.agentId && row.agentId !== where.agentId) continue;
          if (
            where.importance?.lt !== undefined &&
            !(row.importance < where.importance.lt)
          )
            continue;
          if (
            where.createdAt?.lt !== undefined &&
            !(row.createdAt < where.createdAt.lt)
          )
            continue;
          memories.splice(i, 1);
          count++;
        }
        return { count };
      },
    },
  };

  return { db: db as any, memories };
}

function service() {
  const ctx = createFakeDb();
  return { svc: new MnAgentMemoryService(ctx.db), ...ctx };
}

const WS = 'ws-1';
const PROJECT = 'proj-1';
const AGENT = 'agent-1';

function makeInput(
  over: Partial<Parameters<MnAgentMemoryService['storeMemory']>[0]> = {}
) {
  return {
    workspaceId: WS,
    projectId: PROJECT,
    agentId: AGENT,
    kind: MnMemoryKind.FACT,
    contentMd: '# default body',
    ...over,
  };
}

// ---------------------------------------------------------------------------
// CRUD basics
// ---------------------------------------------------------------------------

test('storeMemory > given valid input > persists with importance=1 default', async t => {
  const { svc, memories } = service();
  const row = await svc.storeMemory(makeInput());
  t.is(row.workspaceId, WS);
  t.is(row.agentId, AGENT);
  t.is(row.importance, 1);
  t.is(row.kind, MnMemoryKind.FACT);
  t.is(row.taskId, null);
  t.is(memories.length, 1);
});

test('storeMemory > given importance=7 > preserves importance', async t => {
  const { svc } = service();
  const row = await svc.storeMemory(makeInput({ importance: 7 }));
  t.is(row.importance, 7);
});

test('storeMemory > given out-of-range importance > throws ZodError', async t => {
  const { svc } = service();
  await t.throwsAsync(() => svc.storeMemory(makeInput({ importance: 99 })));
});

test('storeMemory > given empty contentMd > throws ZodError', async t => {
  const { svc } = service();
  await t.throwsAsync(() => svc.storeMemory(makeInput({ contentMd: '' })));
});

test('get > given foreign workspace id > returns null (tenant fence)', async t => {
  const { svc } = service();
  const created = await svc.storeMemory(makeInput());
  const miss = await svc.get('ws-other', created.id);
  t.is(miss, null);
});

test('getOrThrow > given unknown id > throws NotFound', async t => {
  const { svc } = service();
  await t.throwsAsync(() => svc.getOrThrow(WS, 'never-existed'), {
    instanceOf: NotFoundException,
  });
});

test('delete > given foreign workspace id > throws NotFound (tenant fence)', async t => {
  const { svc, memories } = service();
  const created = await svc.storeMemory(makeInput());
  await t.throwsAsync(() => svc.delete('ws-other', created.id), {
    instanceOf: NotFoundException,
  });
  t.is(memories.length, 1, 'row must not have been deleted');
});

test('delete > given matching workspace > removes row', async t => {
  const { svc, memories } = service();
  const created = await svc.storeMemory(makeInput());
  await svc.delete(WS, created.id);
  t.is(memories.length, 0);
});

// ---------------------------------------------------------------------------
// Recall ranking + side effects
// ---------------------------------------------------------------------------

test('recall > orders by importance desc then createdAt desc', async t => {
  const { svc } = service();
  await svc.storeMemory(makeInput({ contentMd: 'low-old', importance: 1 }));
  await svc.storeMemory(makeInput({ contentMd: 'high-old', importance: 9 }));
  await svc.storeMemory(makeInput({ contentMd: 'mid', importance: 5 }));
  await svc.storeMemory(makeInput({ contentMd: 'low-new', importance: 1 }));

  const recall = await svc.recall(WS, AGENT, { limit: 10 });
  t.deepEqual(
    recall.map(r => r.contentMd),
    ['high-old', 'mid', 'low-new', 'low-old'],
    'high importance first, ties broken by recency (createdAt desc)'
  );
});

test('recall > respects limit clamp', async t => {
  const { svc } = service();
  for (let i = 0; i < 5; i++) {
    await svc.storeMemory(makeInput({ contentMd: `r${i}`, importance: i + 1 }));
  }
  const top2 = await svc.recall(WS, AGENT, { limit: 2 });
  t.is(top2.length, 2);
});

test('recall > with taskId > returns task-pinned AND task-agnostic rows', async t => {
  const { svc } = service();
  await svc.storeMemory(makeInput({ contentMd: 'global', importance: 5 }));
  await svc.storeMemory(
    makeInput({ contentMd: 'task-A', taskId: 'task-A', importance: 5 })
  );
  await svc.storeMemory(
    makeInput({ contentMd: 'task-B', taskId: 'task-B', importance: 5 })
  );
  const taskA = await svc.recall(WS, AGENT, { taskId: 'task-A' });
  const slugs = taskA.map(r => r.contentMd).sort();
  t.deepEqual(slugs, ['global', 'task-A']);
});

test('recall > scoped to workspace (cross-tenant fence)', async t => {
  const { svc } = service();
  await svc.storeMemory(makeInput({ contentMd: 'mine' }));
  await svc.storeMemory(
    makeInput({ workspaceId: 'ws-other', contentMd: 'theirs' })
  );
  const out = await svc.recall(WS, AGENT);
  t.is(out.length, 1);
  t.is(out[0].contentMd, 'mine');
});

test('recall > touches retrievedCount + lastRetrievedAt as side effect', async t => {
  const { svc, memories } = service();
  await svc.storeMemory(makeInput());
  t.is(memories[0].retrievedCount, 0);
  t.is(memories[0].lastRetrievedAt, null);

  await svc.recall(WS, AGENT);
  // Best-effort write is fire-and-forget — wait one microtask tick.
  await new Promise(r => setImmediate(r));

  t.is(memories[0].retrievedCount, 1);
  t.truthy(memories[0].lastRetrievedAt);
});

// ---------------------------------------------------------------------------
// Garbage collection
// ---------------------------------------------------------------------------

test('garbageCollect > reaps low-importance rows older than cutoff', async t => {
  const { svc, memories } = service();
  const old = await svc.storeMemory(
    makeInput({ contentMd: 'old-low', importance: 1 })
  );
  // Backdate by mutating the in-memory row (fake DB is mutable).
  const oldRow = memories.find(m => m.id === old.id)!;
  oldRow.createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

  await svc.storeMemory(makeInput({ contentMd: 'new-low', importance: 1 }));

  const deleted = await svc.garbageCollect(AGENT, new Date());
  t.is(deleted, 1);
  t.deepEqual(
    memories.map(m => m.contentMd),
    ['new-low']
  );
});

test('garbageCollect > preserves high-importance rows', async t => {
  const { svc, memories } = service();
  const protectedRow = await svc.storeMemory(
    makeInput({ contentMd: 'curated', importance: 8 })
  );
  memories.find(m => m.id === protectedRow.id)!.createdAt = new Date(
    Date.now() - 365 * 24 * 60 * 60 * 1000
  );
  await svc.garbageCollect(AGENT, new Date());
  t.is(memories.length, 1);
  t.is(memories[0].importance, 8);
});

test('garbageCollect > custom floor preserves rows at or above floor', async t => {
  const { svc, memories } = service();
  for (let i = 1; i <= 5; i++) {
    const row = await svc.storeMemory(
      makeInput({ contentMd: `imp-${i}`, importance: i })
    );
    memories.find(m => m.id === row.id)!.createdAt = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    );
  }
  const deleted = await svc.garbageCollect(AGENT, new Date(), {
    importanceFloor: 5,
  });
  // importance < 5 → rows 1,2,3,4 deleted; row 5 survives.
  t.is(deleted, 4);
  t.is(memories.length, 1);
  t.is(memories[0].importance, 5);
});

// ---------------------------------------------------------------------------
// renderRecallBlock — prompt-prepend helper
// ---------------------------------------------------------------------------

test('renderRecallBlock > given zero memories > returns null', async t => {
  const { svc } = service();
  const block = await svc.renderRecallBlock(WS, AGENT);
  t.is(block, null);
});

test('renderRecallBlock > given memories > emits a MEMORY RECALL header and top lines', async t => {
  const { svc } = service();
  await svc.storeMemory(
    makeInput({
      contentMd: 'User prefers TypeScript over Go',
      kind: MnMemoryKind.FACT,
      importance: 8,
    })
  );
  await svc.storeMemory(
    makeInput({
      contentMd: 'Always run prettier before commit',
      kind: MnMemoryKind.PLAYBOOK,
      importance: 5,
    })
  );
  const block = await svc.renderRecallBlock(WS, AGENT);
  t.truthy(block);
  t.true(block!.startsWith('MEMORY RECALL\n'));
  t.regex(block!, /\[FACT\] User prefers TypeScript over Go/);
  t.regex(block!, /\[PLAYBOOK\] Always run prettier before commit/);
});
