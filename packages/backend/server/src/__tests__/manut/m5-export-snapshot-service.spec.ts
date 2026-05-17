import { createHash } from 'node:crypto';

import test from 'ava';

import { MnExportSnapshotService } from '../../plugins/manut/manut-export-snapshot.service';

/**
 * M5.3 export snapshot service — SHA-256 stability + sourceFingerprint
 * idempotency + cross-workspace lookup invariants.
 *
 * In-memory Prisma stub mirrors only the columns the service touches.
 */

interface FakeSnapshot {
  id: string;
  workspaceId: string;
  createdByUserId: string | null;
  manifest: unknown;
  sha256: string;
  byteSize: number;
  payloadBlobKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function createFakeDb() {
  const snapshots: FakeSnapshot[] = [];
  let nextId = 1;

  const db = {
    mnExportSnapshot: {
      create: async ({ data }: { data: Partial<FakeSnapshot> }) => {
        const dup = snapshots.find(s => s.sha256 === data.sha256);
        if (dup) {
          const err = new Error('Unique constraint failed') as Error & {
            code: string;
          };
          err.code = 'P2002';
          throw err;
        }
        const now = new Date();
        const row: FakeSnapshot = {
          id: data.id ?? `sn-${nextId++}`,
          workspaceId: data.workspaceId!,
          createdByUserId: data.createdByUserId ?? null,
          manifest: data.manifest,
          sha256: data.sha256!,
          byteSize: data.byteSize!,
          payloadBlobKey: data.payloadBlobKey ?? null,
          createdAt: now,
          updatedAt: now,
        };
        snapshots.push(row);
        return row;
      },
      findUnique: async ({
        where,
      }: {
        where: { id?: string; sha256?: string };
      }) => {
        if (where.id) return snapshots.find(s => s.id === where.id) ?? null;
        if (where.sha256)
          return snapshots.find(s => s.sha256 === where.sha256) ?? null;
        return null;
      },
      findMany: async ({
        where,
        orderBy,
        take,
      }: {
        where?: { workspaceId?: string };
        orderBy?: Array<{ createdAt?: 'desc' }>;
        take?: number;
      }) => {
        let rows = snapshots.slice();
        if (where?.workspaceId) {
          rows = rows.filter(s => s.workspaceId === where.workspaceId);
        }
        if (orderBy && orderBy[0]?.createdAt === 'desc') {
          rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows;
      },
    },
  };
  return { db: db as any, snapshots };
}

function service() {
  const ctx = createFakeDb();
  return { svc: new MnExportSnapshotService(ctx.db), ...ctx };
}

const WS = 'ws-1';
const USER = 'u-1';

// ---------------------------------------------------------------------------
// SHA-256 stability
// ---------------------------------------------------------------------------

test('computeSha256 > given UTF-8 string > matches node:crypto baseline', t => {
  const payload = '{"hello":"world"}';
  const expected = createHash('sha256').update(payload).digest('hex');
  t.is(MnExportSnapshotService.computeSha256(payload), expected);
});

test('computeSha256 > given equal bytes via string and Uint8Array > equal hash', t => {
  const text = 'canonical payload';
  const bytes = new TextEncoder().encode(text);
  t.is(
    MnExportSnapshotService.computeSha256(text),
    MnExportSnapshotService.computeSha256(bytes)
  );
});

test('computeSha256 > given different bytes > different hash', t => {
  t.not(
    MnExportSnapshotService.computeSha256('a'),
    MnExportSnapshotService.computeSha256('b')
  );
});

// ---------------------------------------------------------------------------
// Create + idempotent dedup
// ---------------------------------------------------------------------------

test('create > given fresh payload > persists row with correct sha + byteSize', async t => {
  const { svc, snapshots } = service();
  const payload = '{"manifest":"v1","items":[]}';
  const row = await svc.create({
    workspaceId: WS,
    createdByUserId: USER,
    manifest: { kind: 'export', items: 0 },
    payload,
    payloadBlobKey: 'blobs/ws-1/snap-a.json',
  });
  t.is(snapshots.length, 1);
  t.is(row.workspaceId, WS);
  t.is(row.sha256, MnExportSnapshotService.computeSha256(payload));
  t.is(row.byteSize, Buffer.byteLength(payload, 'utf8'));
  t.is(row.payloadBlobKey, 'blobs/ws-1/snap-a.json');
});

test('create > given same payload twice > returns existing row (no duplicate)', async t => {
  const { svc, snapshots } = service();
  const payload = 'idempotent-payload';
  const first = await svc.create({
    workspaceId: WS,
    createdByUserId: USER,
    manifest: { foo: 'bar' },
    payload,
  });
  const second = await svc.create({
    workspaceId: WS,
    createdByUserId: USER,
    manifest: { foo: 'bar' },
    payload,
  });
  t.is(first.id, second.id);
  t.is(snapshots.length, 1);
});

test('create > given same payload across workspaces > still dedups (sha is global)', async t => {
  const { svc, snapshots } = service();
  const payload = 'shared-bytes';
  const first = await svc.create({
    workspaceId: WS,
    createdByUserId: USER,
    manifest: {},
    payload,
  });
  const second = await svc.create({
    workspaceId: 'ws-2',
    createdByUserId: 'u-2',
    manifest: {},
    payload,
  });
  t.is(first.id, second.id);
  t.is(snapshots.length, 1);
  // Ownership stays with the first writer — second caller doesn't get to claim it.
  t.is(second.workspaceId, WS);
});

test('create > given different payloads > distinct rows', async t => {
  const { svc, snapshots } = service();
  await svc.create({
    workspaceId: WS,
    createdByUserId: USER,
    manifest: {},
    payload: 'one',
  });
  await svc.create({
    workspaceId: WS,
    createdByUserId: USER,
    manifest: {},
    payload: 'two',
  });
  t.is(snapshots.length, 2);
});

test('create > given race condition (P2002 from create) > falls back to existing row', async t => {
  // Force a P2002 by pre-seeding the row before calling create.
  const { svc, snapshots, db } = service();
  const payload = 'race-payload';
  const sha = MnExportSnapshotService.computeSha256(payload);
  await db.mnExportSnapshot.create({
    data: {
      id: 'pre-existing',
      workspaceId: WS,
      createdByUserId: USER,
      manifest: {},
      sha256: sha,
      byteSize: Buffer.byteLength(payload, 'utf8'),
      payloadBlobKey: null,
    },
  });
  // Make findUnique return null on the first call so we go into the create
  // branch and trip the P2002. The fake re-reads on retry, so it'll succeed.
  const original = db.mnExportSnapshot.findUnique;
  let calls = 0;
  db.mnExportSnapshot.findUnique = async (args: any) => {
    calls += 1;
    if (calls === 1) return null;
    return original(args);
  };
  const row = await svc.create({
    workspaceId: WS,
    createdByUserId: USER,
    manifest: {},
    payload,
  });
  t.is(row.id, 'pre-existing');
  t.is(snapshots.length, 1);
});

// ---------------------------------------------------------------------------
// Lookups + tenant fence
// ---------------------------------------------------------------------------

test('get > given foreign workspace id > returns null', async t => {
  const { svc } = service();
  const row = await svc.create({
    workspaceId: WS,
    createdByUserId: USER,
    manifest: {},
    payload: 'tenant-fence',
  });
  const miss = await svc.get('ws-other', row.id);
  t.is(miss, null);
});

test('getBySha256 > given known hash > returns row', async t => {
  const { svc } = service();
  await svc.create({
    workspaceId: WS,
    createdByUserId: USER,
    manifest: {},
    payload: 'find-me',
  });
  const sha = MnExportSnapshotService.computeSha256('find-me');
  const row = await svc.getBySha256(sha);
  t.truthy(row);
  t.is(row?.sha256, sha);
});

test('list > given workspace > sorted newest-first', async t => {
  const { svc } = service();
  const a = await svc.create({
    workspaceId: WS,
    createdByUserId: USER,
    manifest: {},
    payload: 'older',
  });
  // Force monotonic createdAt: nudge by mutating snapshot times directly.
  await new Promise(r => setTimeout(r, 5));
  const b = await svc.create({
    workspaceId: WS,
    createdByUserId: USER,
    manifest: {},
    payload: 'newer',
  });
  const rows = await svc.list(WS);
  t.is(rows[0].id, b.id);
  t.is(rows[1].id, a.id);
});
