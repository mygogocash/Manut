import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

import type { MnHandoverImportResult } from '../../plugins/manut/manut-handover.service';
import { MnHandoverService } from '../../plugins/manut/manut-handover.service';
import type { MnReleaseRunObjectType } from '../../plugins/manut/manut-release-runs.dto';
import { MnReleaseRunsResolver } from '../../plugins/manut/manut-release-runs.resolver';
import {
  DEFAULT_TASK_SLUGS,
  MnReleaseRunsService,
} from '../../plugins/manut/manut-release-runs.service';

interface FakeRunRow {
  id: string;
  workspaceId: string;
  ghRunId: string;
  ghRunUrl: string | null;
  mode: string;
  status: string;
  version: string | null;
  shortSha: string | null;
  headSha: string | null;
  imageTag: string | null;
  imageDigest: string | null;
  registry: string | null;
  deployUrl: string | null;
  actor: string | null;
  generatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tasks?: FakeTaskRow[];
}

interface FakeTaskRow {
  id: string;
  runId: string;
  slug: string;
  label: string;
  sortOrder: number;
}

function makeFakeDb() {
  const runs: FakeRunRow[] = [];
  const tasks: FakeTaskRow[] = [];
  let runCounter = 0;
  let taskCounter = 0;

  const db = {
    mnReleaseRun: {
      findUnique: async ({
        where,
        include,
      }: {
        where: {
          id?: string;
          workspaceId_ghRunId?: { workspaceId: string; ghRunId: string };
        };
        include?: { tasks?: unknown };
      }) => {
        let row: FakeRunRow | undefined;
        if (where.id) {
          row = runs.find(r => r.id === where.id);
        } else if (where.workspaceId_ghRunId) {
          const k = where.workspaceId_ghRunId;
          row = runs.find(
            r => r.workspaceId === k.workspaceId && r.ghRunId === k.ghRunId
          );
        }
        if (!row) return null;
        if (include?.tasks) {
          return {
            ...row,
            tasks: tasks
              .filter(t => t.runId === row!.id)
              .sort((a, b) => a.sortOrder - b.sortOrder),
          };
        }
        return row;
      },
      findFirst: async ({
        where,
      }: {
        where: { workspaceId: string; ghRunId: string };
      }) => {
        return (
          runs.find(
            r =>
              r.workspaceId === where.workspaceId && r.ghRunId === where.ghRunId
          ) ?? null
        );
      },
      create: async ({ data }: { data: Omit<FakeRunRow, 'tasks'> }) => {
        runCounter += 1;
        const row: FakeRunRow = {
          ...data,
          id: data.id ?? `run-${runCounter}`,
          createdAt: data.createdAt ?? new Date(),
          updatedAt: data.updatedAt ?? new Date(),
        } as FakeRunRow;
        runs.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeRunRow>;
      }) => {
        const idx = runs.findIndex(r => r.id === where.id);
        if (idx < 0) throw new Error('not found');
        const merged: FakeRunRow = {
          ...runs[idx],
          ...data,
          updatedAt: new Date(),
        };
        runs[idx] = merged;
        return merged;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: {
          workspaceId_ghRunId: { workspaceId: string; ghRunId: string };
        };
        create: Omit<FakeRunRow, 'tasks'>;
        update: Partial<FakeRunRow>;
      }) => {
        const existing = runs.find(
          r =>
            r.workspaceId === where.workspaceId_ghRunId.workspaceId &&
            r.ghRunId === where.workspaceId_ghRunId.ghRunId
        );
        if (existing) {
          const merged: FakeRunRow = {
            ...existing,
            ...update,
            updatedAt: new Date(),
          };
          const idx = runs.indexOf(existing);
          runs[idx] = merged;
          return merged;
        }
        runCounter += 1;
        const row: FakeRunRow = {
          ...create,
          id: create.id ?? `run-${runCounter}`,
          createdAt: create.createdAt ?? new Date(),
          updatedAt: create.updatedAt ?? new Date(),
        } as FakeRunRow;
        runs.push(row);
        return row;
      },
      findMany: async ({
        where,
        orderBy,
        take,
        skip,
      }: {
        where: { workspaceId: string };
        orderBy?:
          | Array<Record<string, 'asc' | 'desc'>>
          | Record<string, 'asc' | 'desc'>;
        take?: number;
        skip?: number;
      }) => {
        let result = runs.filter(r => r.workspaceId === where.workspaceId);
        const order = Array.isArray(orderBy)
          ? orderBy
          : orderBy
            ? [orderBy]
            : [];
        for (const sort of order.reverse()) {
          const [key, dir] = Object.entries(sort)[0];
          result = [...result].sort((a, b) => {
            const av = (a as any)[key];
            const bv = (b as any)[key];
            if (av === bv) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            if (av < bv) return dir === 'asc' ? -1 : 1;
            return dir === 'asc' ? 1 : -1;
          });
        }
        if (typeof skip === 'number') result = result.slice(skip);
        if (typeof take === 'number') result = result.slice(0, take);
        return result;
      },
    },
    mnReleaseTask: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where: { runId: string };
        orderBy?: Record<string, 'asc' | 'desc'>;
      }) => {
        let result = tasks.filter(t => t.runId === where.runId);
        if (orderBy) {
          const [key, dir] = Object.entries(orderBy)[0];
          result = [...result].sort((a, b) => {
            const av = (a as any)[key];
            const bv = (b as any)[key];
            if (av === bv) return 0;
            return av < bv ? (dir === 'asc' ? -1 : 1) : dir === 'asc' ? 1 : -1;
          });
        }
        return result;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { runId_slug: { runId: string; slug: string } };
        create: Omit<FakeTaskRow, 'id'> & { id?: string };
        update: Partial<FakeTaskRow>;
      }) => {
        const existing = tasks.find(
          t =>
            t.runId === where.runId_slug.runId &&
            t.slug === where.runId_slug.slug
        );
        if (existing) {
          const idx = tasks.indexOf(existing);
          tasks[idx] = { ...existing, ...update };
          return tasks[idx];
        }
        taskCounter += 1;
        const row: FakeTaskRow = {
          ...create,
          id: create.id ?? `task-${taskCounter}`,
        } as FakeTaskRow;
        tasks.push(row);
        return row;
      },
    },
  };

  return { db, runs, tasks };
}

function makeHandoverJson(overrides: Record<string, any> = {}) {
  return JSON.stringify({
    schemaVersion: 1,
    generatedAt: '2026-05-14T12:00:00.000Z',
    controlPlane: {
      name: 'Manut Control Plane',
      source: 'docs/MANUT_CONTROL_PLANE.md',
      company: 'GoGoCash Manut',
      goal: 'Ship verified AI-assisted AFFiNE work.',
    },
    workflow: {
      mode: 'release',
      status: 'release image built',
      repository: 'mygogocash/Manut',
      ref: 'v1.12.0',
      actor: 'codex',
      runId: 'gha-run-987654',
      runUrl: 'https://github.com/mygogocash/Manut/actions/runs/987654',
    },
    release: {
      version: 'v1.12.0',
      shortSha: 'abc1234',
      headSha: 'abc1234deadbeef',
      imageTag: 'v1.12.0',
      imageDigest: 'sha256:abc',
      image:
        'asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:v1.12.0',
      registry:
        'asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash',
      deployUrl: 'https://manut.gogocash.co',
    },
    agents: [
      {
        role: 'Verifier',
        adapter: 'CI checks',
        responsibility: 'Attach evidence before release.',
      },
    ],
    taskTree: [
      'Build fresh server, web, admin, and mobile artifacts.',
      'Package an immutable image tag for the GCE linux/amd64 runtime.',
      'Validate handoff facts and upload machine-readable release context.',
      'Deploy through smoke-then-swap when this image is selected for production.',
      'Record any follow-up risks in handover docs or release notes.',
    ],
    verificationGates: [
      'oxlint and codegen drift guards pass in Manut CI.',
      'server, web, admin, and mobile bundles are rebuilt before docker build.',
      'image tag is immutable and does not rely on latest.',
      'sidecar /info passes before production swap.',
      'post-swap /info and prompt-seed checks pass after deploy.',
    ],
    rollback: {
      workflow: 'manut-rollback.yml',
      vmSnapshot: '/srv/affine/compose/compose.yml.previous.bak',
    },
    ...overrides,
  });
}

test('MnReleaseRunsService.recordRunFromHandover creates a run with 5 default tasks', async t => {
  const { db, runs, tasks } = makeFakeDb();
  const svc = new MnReleaseRunsService(db as any);

  const run = await svc.recordRunFromHandover(
    'workspace-1',
    makeHandoverJson()
  );

  t.is(runs.length, 1);
  t.is(run.workspaceId, 'workspace-1');
  t.is(run.ghRunId, 'gha-run-987654');
  t.is(run.mode, 'release');
  t.is(run.status, 'release image built');
  t.is(run.version, 'v1.12.0');
  t.is(run.shortSha, 'abc1234');
  t.is(run.imageTag, 'v1.12.0');
  t.is(run.deployUrl, 'https://manut.gogocash.co');
  t.is(run.actor, 'codex');
  t.truthy(run.generatedAt);

  // Five tasks with the expected slugs
  t.is(tasks.length, 5);
  t.deepEqual(tasks.map(t => t.slug).sort(), [...DEFAULT_TASK_SLUGS].sort());
  // sortOrder starts at 0 ascending
  const taskOrdered = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  t.is(taskOrdered[0].slug, 'build');
  t.is(taskOrdered[4].slug, 'document');
  // labels copied verbatim from taskTree
  t.is(
    taskOrdered[0].label,
    'Build fresh server, web, admin, and mobile artifacts.'
  );
  t.is(
    taskOrdered[4].label,
    'Record any follow-up risks in handover docs or release notes.'
  );
});

test('MnReleaseRunsService.recordRunFromHandover is idempotent under same (workspaceId, ghRunId)', async t => {
  const { db, runs, tasks } = makeFakeDb();
  const svc = new MnReleaseRunsService(db as any);

  await svc.recordRunFromHandover('workspace-1', makeHandoverJson());
  await svc.recordRunFromHandover(
    'workspace-1',
    makeHandoverJson({
      workflow: {
        mode: 'release',
        status: 'image deployed', // new status
        repository: 'mygogocash/Manut',
        ref: 'v1.12.0',
        actor: 'codex',
        runId: 'gha-run-987654', // SAME run id
        runUrl: 'https://github.com/mygogocash/Manut/actions/runs/987654',
      },
    })
  );

  t.is(runs.length, 1, 'duplicate ghRunId should reuse the same row');
  t.is(runs[0].status, 'image deployed', 'fields update on re-import');
  t.is(tasks.length, 5, 'tasks are not duplicated either');
});

test('MnReleaseRunsService.listRuns returns runs ordered by generatedAt desc', async t => {
  const { db, runs } = makeFakeDb();
  const svc = new MnReleaseRunsService(db as any);

  await svc.recordRunFromHandover(
    'workspace-1',
    makeHandoverJson({
      generatedAt: '2026-05-13T00:00:00.000Z',
      workflow: {
        mode: 'release',
        status: 'older',
        repository: 'mygogocash/Manut',
        ref: 'v1.11.0',
        actor: 'codex',
        runId: 'old-run',
        runUrl: '',
      },
    })
  );
  await svc.recordRunFromHandover(
    'workspace-1',
    makeHandoverJson({
      generatedAt: '2026-05-15T00:00:00.000Z',
      workflow: {
        mode: 'release',
        status: 'newest',
        repository: 'mygogocash/Manut',
        ref: 'v1.13.0',
        actor: 'codex',
        runId: 'new-run',
        runUrl: '',
      },
    })
  );
  await svc.recordRunFromHandover(
    'workspace-1',
    makeHandoverJson({
      generatedAt: '2026-05-14T12:00:00.000Z',
      workflow: {
        mode: 'release',
        status: 'middle',
        repository: 'mygogocash/Manut',
        ref: 'v1.12.0',
        actor: 'codex',
        runId: 'mid-run',
        runUrl: '',
      },
    })
  );

  t.is(runs.length, 3);

  const listed = await svc.listRuns('workspace-1');

  t.is(listed.length, 3);
  t.is(listed[0].ghRunId, 'new-run');
  t.is(listed[1].ghRunId, 'mid-run');
  t.is(listed[2].ghRunId, 'old-run');
});

test('MnReleaseRunsService.listRuns supports limit and offset paging', async t => {
  const { db } = makeFakeDb();
  const svc = new MnReleaseRunsService(db as any);

  for (let i = 0; i < 5; i++) {
    await svc.recordRunFromHandover(
      'workspace-1',
      makeHandoverJson({
        generatedAt: `2026-05-${10 + i}T00:00:00.000Z`,
        workflow: {
          mode: 'release',
          status: `status-${i}`,
          repository: 'mygogocash/Manut',
          ref: `v1.${i}.0`,
          actor: 'codex',
          runId: `run-${i}`,
          runUrl: '',
        },
      })
    );
  }

  const firstPage = await svc.listRuns('workspace-1', { limit: 2 });
  t.is(firstPage.length, 2);
  t.is(firstPage[0].ghRunId, 'run-4'); // newest

  const secondPage = await svc.listRuns('workspace-1', { limit: 2, offset: 2 });
  t.is(secondPage.length, 2);
  t.is(secondPage[0].ghRunId, 'run-2');
});

test('MnReleaseRunsService.getRun returns the run with tasks', async t => {
  const { db } = makeFakeDb();
  const svc = new MnReleaseRunsService(db as any);

  const created = await svc.recordRunFromHandover(
    'workspace-1',
    makeHandoverJson()
  );

  const run = await svc.getRun('workspace-1', created.id);

  t.truthy(run);
  t.is(run!.id, created.id);
  // tasks come included; verify count
  t.is((run as any).tasks.length, 5);
});

test('MnReleaseRunsService.getRun returns null when run belongs to another workspace', async t => {
  const { db } = makeFakeDb();
  const svc = new MnReleaseRunsService(db as any);

  const created = await svc.recordRunFromHandover(
    'workspace-1',
    makeHandoverJson()
  );

  const mismatched = await svc.getRun('workspace-2', created.id);

  t.is(mismatched, null);
});

test('MnReleaseRunsResolver.tasks resolves field via the service', async t => {
  const { db } = makeFakeDb();
  const svc = new MnReleaseRunsService(db as any);
  const ac = {
    user: () => ({
      workspace: () => ({
        assert: async () => undefined,
      }),
    }),
  };
  const resolver = new MnReleaseRunsResolver(svc, ac as any);

  const created = await svc.recordRunFromHandover(
    'workspace-1',
    makeHandoverJson()
  );

  const parent = {
    id: created.id,
    workspaceId: 'workspace-1',
  } as MnReleaseRunObjectType;

  const resolved = await resolver.tasks(parent);

  t.is(resolved.length, 5);
  // Returned in sortOrder
  t.is(resolved[0].slug, 'build');
  t.is(resolved[4].slug, 'document');
});

test('MnReleaseRunsResolver.releaseRuns calls Workspace.Read and returns runs', async t => {
  const { db } = makeFakeDb();
  const svc = new MnReleaseRunsService(db as any);

  let asserted = '';
  const ac = {
    user: () => ({
      workspace: () => ({
        assert: async (perm: string) => {
          asserted = perm;
        },
      }),
    }),
  };
  const resolver = new MnReleaseRunsResolver(svc, ac as any);

  await svc.recordRunFromHandover('workspace-1', makeHandoverJson());

  const user = { id: 'user-1' } as any;
  const out = await resolver.releaseRuns(
    user,
    'workspace-1',
    undefined,
    undefined
  );

  t.is(asserted, 'Workspace.Read');
  t.is(out.length, 1);
});

test('MnReleaseRunsResolver.releaseRun calls Workspace.Read and 404s on missing run', async t => {
  const { db } = makeFakeDb();
  const svc = new MnReleaseRunsService(db as any);

  let asserted = '';
  const ac = {
    user: () => ({
      workspace: () => ({
        assert: async (perm: string) => {
          asserted = perm;
        },
      }),
    }),
  };
  const resolver = new MnReleaseRunsResolver(svc, ac as any);

  const created = await svc.recordRunFromHandover(
    'workspace-1',
    makeHandoverJson()
  );

  const user = { id: 'user-1' } as any;

  const ok = await resolver.releaseRun(user, 'workspace-1', created.id);
  t.is(asserted, 'Workspace.Read');
  t.is(ok.id, created.id);

  await t.throwsAsync(() =>
    resolver.releaseRun(user, 'workspace-1', 'does-not-exist')
  );
});

test('Importing handover records a run alongside the doc write (success path)', async t => {
  const { db } = makeFakeDb();
  const releaseSvc = new MnReleaseRunsService(db as any);
  const docWriter = {
    createDoc: async () => ({ docId: 'doc-1' }),
    updateDoc: async () => undefined,
    updateDocMeta: async () => undefined,
  };
  const handover = new MnHandoverService(docWriter as any, releaseSvc);

  const result: MnHandoverImportResult = await handover.importHandover(
    'workspace-1',
    'user-1',
    makeHandoverJson()
  );

  t.is(result.docId, 'doc-1');
  t.is(result.updated, false);

  const runs = await releaseSvc.listRuns('workspace-1');
  t.is(runs.length, 1);
  t.is(runs[0].ghRunId, 'gha-run-987654');
});

test('Handover importer does NOT record a run when doc write fails', async t => {
  const { db, runs } = makeFakeDb();
  const releaseSvc = new MnReleaseRunsService(db as any);
  const docWriter = {
    createDoc: async () => {
      throw new Error('boom');
    },
    updateDoc: async () => undefined,
    updateDocMeta: async () => undefined,
  };
  const handover = new MnHandoverService(docWriter as any, releaseSvc);

  await t.throwsAsync(() =>
    handover.importHandover('workspace-1', 'user-1', makeHandoverJson())
  );

  t.is(runs.length, 0, 'no run is recorded when the doc write throws');
});

test('Handover importer swallows release-run recording failures so doc write remains source of truth', async t => {
  const flakyDb = {
    mnReleaseRun: {
      upsert: async () => {
        throw new Error('db is melting');
      },
      findUnique: async () => null,
      findMany: async () => [],
    },
    mnReleaseTask: {
      upsert: async () => {
        throw new Error('db is melting');
      },
    },
  };
  const releaseSvc = new MnReleaseRunsService(flakyDb as any);
  const docWriter = {
    createDoc: async () => ({ docId: 'doc-flaky' }),
    updateDoc: async () => undefined,
    updateDocMeta: async () => undefined,
  };
  const handover = new MnHandoverService(docWriter as any, releaseSvc);

  const result = await handover.importHandover(
    'workspace-1',
    'user-1',
    makeHandoverJson()
  );

  t.is(result.docId, 'doc-flaky', 'doc write succeeds even if recordRun fails');
  t.is(result.updated, false);
});

test('Handover importer records a run for an existing doc update', async t => {
  const { db } = makeFakeDb();
  const releaseSvc = new MnReleaseRunsService(db as any);
  const docWriter = {
    createDoc: async () => ({ docId: 'doc-new' }),
    updateDoc: async () => undefined,
    updateDocMeta: async () => undefined,
  };
  const handover = new MnHandoverService(docWriter as any, releaseSvc);

  const result = await handover.importHandover(
    'workspace-1',
    'user-1',
    makeHandoverJson(),
    'doc-existing'
  );

  t.is(result.docId, 'doc-existing');
  t.is(result.updated, true);

  const runs = await releaseSvc.listRuns('workspace-1');
  t.is(runs.length, 1);
});

test('MnReleaseRunObjectType nullable DTO fields use explicit GraphQL types', t => {
  const src = readFileSync(
    join(process.cwd(), 'src/plugins/manut/manut-release-runs.dto.ts'),
    'utf8'
  );

  t.false(
    /@Field\(\{\s*nullable:\s*true/.test(src),
    'nullable @Field decorators must use @Field(() => Type, { nullable: true })'
  );
});

test('DEFAULT_TASK_SLUGS exposes the canonical 5-step task tree', t => {
  t.deepEqual(DEFAULT_TASK_SLUGS, [
    'build',
    'verify',
    'deploy',
    'observe',
    'document',
  ]);
});
