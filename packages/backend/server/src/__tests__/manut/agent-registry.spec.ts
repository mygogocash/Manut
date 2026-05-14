import { BadRequestException, NotFoundException } from '@nestjs/common';
import test from 'ava';

import {
  DEFAULT_AGENT_ROLE_SEEDS,
  MnAgentRegistryService,
} from '../../plugins/manut/manut-agent-registry.service';

interface FakeRow {
  id: string;
  workspaceId: string;
  slug: string;
  displayName: string;
  adapter: string;
  responsibility: string;
  escalation: string | null;
  lastSuccessfulRunId: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function createFakeDb() {
  const rows: FakeRow[] = [];
  let upsertCalls = 0;
  let updateCalls = 0;

  const db = {
    mnAgentRole: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where: { workspaceId: string };
        orderBy?: any;
      }) => {
        let out = rows.filter(r => r.workspaceId === where.workspaceId);
        if (orderBy?.slug === 'asc') {
          out = [...out].sort((a, b) => a.slug.localeCompare(b.slug));
        }
        return out;
      },
      findFirst: async ({
        where,
      }: {
        where: { workspaceId: string; slug: string };
      }) => {
        return (
          rows.find(
            r => r.workspaceId === where.workspaceId && r.slug === where.slug
          ) ?? null
        );
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { workspaceId_slug: { workspaceId: string; slug: string } };
        create: Omit<FakeRow, 'createdAt' | 'updatedAt'>;
        update: Partial<FakeRow>;
      }) => {
        upsertCalls++;
        const { workspaceId, slug } = where.workspaceId_slug;
        const existing = rows.find(
          r => r.workspaceId === workspaceId && r.slug === slug
        );
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const now = new Date();
        const row: FakeRow = {
          id: create.id ?? `id-${rows.length + 1}`,
          workspaceId: create.workspaceId,
          slug: create.slug,
          displayName: create.displayName,
          adapter: create.adapter,
          responsibility: create.responsibility,
          escalation: create.escalation ?? null,
          lastSuccessfulRunId: create.lastSuccessfulRunId ?? null,
          lastSeenAt: create.lastSeenAt ?? null,
          createdAt: now,
          updatedAt: now,
        };
        rows.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id?: string; workspaceId_slug?: any };
        data: Partial<FakeRow>;
      }) => {
        updateCalls++;
        let target: FakeRow | undefined;
        if (where.id) {
          target = rows.find(r => r.id === where.id);
        } else if (where.workspaceId_slug) {
          const { workspaceId, slug } = where.workspaceId_slug;
          target = rows.find(
            r => r.workspaceId === workspaceId && r.slug === slug
          );
        }
        if (!target) {
          throw new Error('not found');
        }
        Object.assign(target, data, { updatedAt: new Date() });
        return target;
      },
    },
  };

  return {
    db,
    rows,
    counts: {
      get upsert() {
        return upsertCalls;
      },
      get update() {
        return updateCalls;
      },
    },
  };
}

test('listRoles returns empty array when no seed has run', async t => {
  const { db } = createFakeDb();
  const svc = new MnAgentRegistryService(db as any);

  const roles = await svc.listRoles('workspace-1');

  t.deepEqual(roles, []);
});

test('seedDefaults creates the 5 canonical roles', async t => {
  const { db, rows } = createFakeDb();
  const svc = new MnAgentRegistryService(db as any);

  await svc.seedDefaults('workspace-1');
  const roles = await svc.listRoles('workspace-1');

  t.is(roles.length, 5);
  t.is(rows.length, 5);
  const slugs = roles.map(r => r.slug).sort((a, b) => a.localeCompare(b));
  t.deepEqual(slugs, [
    'builder',
    'deployer',
    'historian',
    'release-captain',
    'verifier',
  ]);
});

test('seedDefaults is idempotent — running twice does not duplicate', async t => {
  const { db, rows } = createFakeDb();
  const svc = new MnAgentRegistryService(db as any);

  await svc.seedDefaults('workspace-1');
  await svc.seedDefaults('workspace-1');

  t.is(rows.length, 5);
});

test('seedDefaults isolates rows per workspace', async t => {
  const { db, rows } = createFakeDb();
  const svc = new MnAgentRegistryService(db as any);

  await svc.seedDefaults('workspace-1');
  await svc.seedDefaults('workspace-2');

  t.is(rows.length, 10);
  t.is(rows.filter(r => r.workspaceId === 'workspace-1').length, 5);
  t.is(rows.filter(r => r.workspaceId === 'workspace-2').length, 5);
});

test('updateRole rejects attempts to mutate the slug', async t => {
  const { db } = createFakeDb();
  const svc = new MnAgentRegistryService(db as any);
  await svc.seedDefaults('workspace-1');

  await t.throwsAsync(
    () =>
      svc.updateRole('workspace-1', 'builder', {
        slug: 'something-else',
      } as any),
    { instanceOf: BadRequestException, message: /slug/i }
  );
});

test('updateRole updates editable fields and returns the merged row', async t => {
  const { db } = createFakeDb();
  const svc = new MnAgentRegistryService(db as any);
  await svc.seedDefaults('workspace-1');

  const updated = await svc.updateRole('workspace-1', 'builder', {
    displayName: 'Build Master',
    adapter: 'custom-build.yml',
    escalation: 'Escalate to oncall',
  });

  t.is(updated.displayName, 'Build Master');
  t.is(updated.adapter, 'custom-build.yml');
  t.is(updated.escalation, 'Escalate to oncall');
  // Immutable fields preserved
  t.is(updated.slug, 'builder');
  t.truthy(updated.responsibility);
});

test('updateRole throws NotFoundException when slug is unknown', async t => {
  const { db } = createFakeDb();
  const svc = new MnAgentRegistryService(db as any);
  await svc.seedDefaults('workspace-1');

  await t.throwsAsync(
    () =>
      svc.updateRole('workspace-1', 'unknown-role', {
        displayName: 'x',
      }),
    { instanceOf: NotFoundException }
  );
});

test('updateRole only writes provided fields (partial update)', async t => {
  const { db, rows } = createFakeDb();
  const svc = new MnAgentRegistryService(db as any);
  await svc.seedDefaults('workspace-1');

  const before = rows.find(
    r => r.workspaceId === 'workspace-1' && r.slug === 'builder'
  )!;
  const originalAdapter = before.adapter;

  await svc.updateRole('workspace-1', 'builder', {
    displayName: 'New Name',
  });

  const after = rows.find(
    r => r.workspaceId === 'workspace-1' && r.slug === 'builder'
  )!;
  t.is(after.displayName, 'New Name');
  t.is(after.adapter, originalAdapter);
});

test('markRoleRunSuccessful stamps lastSuccessfulRunId and lastSeenAt', async t => {
  const { db, rows } = createFakeDb();
  const svc = new MnAgentRegistryService(db as any);
  await svc.seedDefaults('workspace-1');

  await svc.markRoleRunSuccessful('workspace-1', 'builder', 'run-42');

  const row = rows.find(
    r => r.workspaceId === 'workspace-1' && r.slug === 'builder'
  )!;
  t.is(row.lastSuccessfulRunId, 'run-42');
  t.true(row.lastSeenAt instanceof Date);
});

test('markRoleRunSuccessful no-ops silently when the role does not exist', async t => {
  const { db, rows } = createFakeDb();
  const svc = new MnAgentRegistryService(db as any);

  // No seed — registry is empty.
  await t.notThrowsAsync(() =>
    svc.markRoleRunSuccessful('workspace-1', 'builder', 'run-42')
  );

  t.is(rows.length, 0);
});

test('DEFAULT_AGENT_ROLE_SEEDS exports the 5 canonical roles in stable order', t => {
  t.is(DEFAULT_AGENT_ROLE_SEEDS.length, 5);
  const slugs = DEFAULT_AGENT_ROLE_SEEDS.map(s => s.slug);
  t.deepEqual(slugs, [
    'release-captain',
    'builder',
    'verifier',
    'deployer',
    'historian',
  ]);
  for (const seed of DEFAULT_AGENT_ROLE_SEEDS) {
    t.truthy(seed.displayName, `${seed.slug} has displayName`);
    t.truthy(seed.adapter, `${seed.slug} has adapter`);
    t.truthy(seed.responsibility, `${seed.slug} has responsibility`);
  }
});
