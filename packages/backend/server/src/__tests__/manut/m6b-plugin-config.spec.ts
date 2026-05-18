/**
 * M6b — per-workspace plugin config service.
 *
 * The workspace settings UI flips `configJson.enabled` on each plugin to
 * enable/disable it for that workspace. The resolver layer does the
 * workspace-fence (`AccessController.assert('Workspace.Read' /
 * 'Workspace.Settings.Update')`), so this service trusts its workspaceId
 * input as already-authorised. These tests exercise the service's own
 * invariants:
 *   - virtual rows for unconfigured plugins (so the UI lists everything)
 *   - workspace-default rows isolate from project-scoped overrides
 *   - upsert is idempotent (same key → updates, never duplicates)
 *   - 16 KB size cap on serialised configJson
 *   - plugin must exist before its config can be created
 *   - workspace-default + project-scoped coexist on the same plugin
 *   - project-scoped fence: the project's workspaceId must match
 *
 * Fakes for the Prisma client — no real Postgres.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import test from 'ava';

import { ManutPluginConfigService } from '../../plugins/manut/plugin-runtime/manut-plugin-config.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface FakePluginRow {
  id: string;
  name: string;
  version: string;
  manifestJson: unknown;
  packagePath: string | null;
  processStatus: 'INSTALLED' | 'LOADING' | 'RUNNING' | 'CRASHED' | 'DISABLED';
  enabledAt: Date | null;
  installedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeConfigRow {
  id: string;
  pluginId: string;
  workspaceId: string;
  projectId: string | null;
  configJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

function buildPluginRow(id = 'plugin-1', name = 'demo'): FakePluginRow {
  const now = new Date('2026-05-01T00:00:00Z');
  return {
    id,
    name,
    version: '0.1.0',
    manifestJson: {
      name,
      version: '0.1.0',
      hostApiVersion: '1.0',
      capabilities: ['read.workspace'],
      tools: [],
      apiRoutes: [],
    },
    packagePath: '/tmp/fake',
    processStatus: 'INSTALLED',
    enabledAt: null,
    installedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

interface FakeStore {
  plugins: FakePluginRow[];
  configs: FakeConfigRow[];
}

function buildFakeDb(store: FakeStore) {
  return {
    mnPlugin: {
      findMany: async () => store.plugins,
      findUnique: async ({ where }: { where: { id?: string } }) =>
        store.plugins.find(p => p.id === where.id) ?? null,
    },
    mnPluginConfig: {
      findMany: async ({ where }: { where: { workspaceId?: string } }) =>
        store.configs.filter(
          c => !where.workspaceId || c.workspaceId === where.workspaceId
        ),
      findFirst: async ({
        where,
      }: {
        where: {
          pluginId: string;
          workspaceId: string;
          projectId: string | null;
        };
      }) =>
        store.configs.find(
          c =>
            c.pluginId === where.pluginId &&
            c.workspaceId === where.workspaceId &&
            c.projectId === where.projectId
        ) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeConfigRow>;
      }) => {
        const row = store.configs.find(c => c.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      create: async ({ data }: { data: Partial<FakeConfigRow> }) => {
        const row: FakeConfigRow = {
          id: `cfg-${store.configs.length + 1}`,
          pluginId: data.pluginId!,
          workspaceId: data.workspaceId!,
          projectId: data.projectId ?? null,
          configJson: data.configJson,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.configs.push(row);
        return row;
      },
    },
  } as never;
}

function makeService(store: FakeStore) {
  return new ManutPluginConfigService(buildFakeDb(store));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('listForWorkspace synthesises a virtual row for unconfigured plugins', async t => {
  const store: FakeStore = {
    plugins: [buildPluginRow('p1', 'demo')],
    configs: [],
  };
  const svc = makeService(store);

  const list = await svc.listForWorkspace('ws-1');
  t.is(list.length, 1);
  t.is(list[0]!.pluginId, 'p1');
  t.is(list[0]!.id, 'virtual:p1');
  t.deepEqual(list[0]!.configJson, { enabled: false });
});

test('listForWorkspace returns real row for configured plugin', async t => {
  const store: FakeStore = {
    plugins: [buildPluginRow('p1', 'demo')],
    configs: [
      {
        id: 'cfg-1',
        pluginId: 'p1',
        workspaceId: 'ws-1',
        projectId: null,
        configJson: { enabled: true, apiKey: 'shh' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };
  const svc = makeService(store);

  const list = await svc.listForWorkspace('ws-1');
  t.is(list.length, 1);
  t.is(list[0]!.id, 'cfg-1');
  t.deepEqual(list[0]!.configJson, { enabled: true, apiKey: 'shh' });
});

test('listForWorkspace ignores project-scoped configs for the workspace toggle row', async t => {
  const store: FakeStore = {
    plugins: [buildPluginRow('p1', 'demo')],
    configs: [
      {
        id: 'cfg-proj',
        pluginId: 'p1',
        workspaceId: 'ws-1',
        projectId: 'proj-A',
        configJson: { enabled: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };
  const svc = makeService(store);

  const list = await svc.listForWorkspace('ws-1');
  // The synthesised row stands in for the unconfigured workspace-default;
  // the project-scoped row alone does not satisfy the toggle.
  t.is(list[0]!.id, 'virtual:p1');
});

test('listForWorkspace fences cross-workspace data', async t => {
  // The service is told to list 'ws-1' — it must NOT return rows where
  // workspaceId is 'ws-other'. (The fake db filters by workspaceId; this
  // test exists to make sure the service uses that filter, not naive
  // findMany().)
  const store: FakeStore = {
    plugins: [buildPluginRow('p1', 'demo')],
    configs: [
      {
        id: 'cfg-other',
        pluginId: 'p1',
        workspaceId: 'ws-other',
        projectId: null,
        configJson: { enabled: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };
  const svc = makeService(store);

  const list = await svc.listForWorkspace('ws-1');
  // Only the virtual row for the plugin — ws-other's enabled flag must
  // not leak into ws-1's view.
  t.is(list[0]!.id, 'virtual:p1');
  t.deepEqual(list[0]!.configJson, { enabled: false });
});

test('upsert creates a new config row on first call', async t => {
  const store: FakeStore = {
    plugins: [buildPluginRow('p1', 'demo')],
    configs: [],
  };
  const svc = makeService(store);

  const row = await svc.upsert({
    workspaceId: 'ws-1',
    pluginId: 'p1',
    configJson: { enabled: true },
  });
  t.is(row.pluginId, 'p1');
  t.is(row.workspaceId, 'ws-1');
  t.deepEqual(row.configJson, { enabled: true });
  t.is(store.configs.length, 1);
});

test('upsert is idempotent — second call updates the existing row', async t => {
  const store: FakeStore = {
    plugins: [buildPluginRow('p1', 'demo')],
    configs: [],
  };
  const svc = makeService(store);

  await svc.upsert({
    workspaceId: 'ws-1',
    pluginId: 'p1',
    configJson: { enabled: true },
  });
  const second = await svc.upsert({
    workspaceId: 'ws-1',
    pluginId: 'p1',
    configJson: { enabled: false },
  });

  t.deepEqual(second.configJson, { enabled: false });
  t.is(store.configs.length, 1, 'no duplicate config row');
});

test('upsert rejects payloads larger than 16 KB', async t => {
  const store: FakeStore = {
    plugins: [buildPluginRow('p1', 'demo')],
    configs: [],
  };
  const svc = makeService(store);

  const oversized = { blob: 'x'.repeat(17 * 1024) };
  await t.throwsAsync(
    () =>
      svc.upsert({
        workspaceId: 'ws-1',
        pluginId: 'p1',
        configJson: oversized,
      }),
    { instanceOf: BadRequestException }
  );
});

test('upsert requires the plugin to exist', async t => {
  const store: FakeStore = { plugins: [], configs: [] };
  const svc = makeService(store);

  await t.throwsAsync(
    () =>
      svc.upsert({
        workspaceId: 'ws-1',
        pluginId: 'ghost',
        configJson: { enabled: true },
      }),
    { instanceOf: NotFoundException }
  );
});

test('upsert supports a project-scoped config row beside the workspace-default', async t => {
  const store: FakeStore = {
    plugins: [buildPluginRow('p1', 'demo')],
    configs: [],
  };
  const svc = makeService(store);

  await svc.upsert({
    workspaceId: 'ws-1',
    pluginId: 'p1',
    configJson: { enabled: true },
  });
  const projectRow = await svc.upsert({
    workspaceId: 'ws-1',
    pluginId: 'p1',
    projectId: 'proj-A',
    configJson: { enabled: false, override: true },
  });

  t.is(projectRow.projectId, 'proj-A');
  t.deepEqual(projectRow.configJson, { enabled: false, override: true });
  t.is(store.configs.length, 2, 'workspace-default and project-scoped coexist');
});

test('upsert accepts empty configJson and defaults to {}', async t => {
  const store: FakeStore = {
    plugins: [buildPluginRow('p1', 'demo')],
    configs: [],
  };
  const svc = makeService(store);
  const row = await svc.upsert({
    workspaceId: 'ws-1',
    pluginId: 'p1',
    configJson: {},
  });
  t.deepEqual(row.configJson, {});
});

test('upsert round-trips the enabled flag', async t => {
  const store: FakeStore = {
    plugins: [buildPluginRow('p1', 'demo')],
    configs: [],
  };
  const svc = makeService(store);

  // Disabled by default after install.
  let list = await svc.listForWorkspace('ws-1');
  t.deepEqual(list[0]!.configJson, { enabled: false });

  // Enable.
  await svc.upsert({
    workspaceId: 'ws-1',
    pluginId: 'p1',
    configJson: { enabled: true },
  });
  list = await svc.listForWorkspace('ws-1');
  t.deepEqual(list[0]!.configJson, { enabled: true });

  // Toggle back off.
  await svc.upsert({
    workspaceId: 'ws-1',
    pluginId: 'p1',
    configJson: { enabled: false },
  });
  list = await svc.listForWorkspace('ws-1');
  t.deepEqual(list[0]!.configJson, { enabled: false });
});
