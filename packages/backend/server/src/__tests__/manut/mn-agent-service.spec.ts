import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MnAgentAdapterType, MnAgentStatus } from '@prisma/client';
import test from 'ava';

import { MnAgentService } from '../../plugins/manut/manut-agent.service';

/**
 * Mn agent service — invariant coverage.
 *
 * Uses a hand-rolled in-memory Prisma stub. The stub keeps the same
 * three tables the service actually touches (mnAgent, mnProject,
 * mnAgentRole) and lets each test plant fixture rows before the
 * service call.
 */

interface FakeProject {
  id: string;
  workspaceId: string;
}

interface FakeRole {
  id: string;
  workspaceId: string;
  slug: string;
}

interface FakeAgent {
  id: string;
  workspaceId: string;
  projectId: string;
  roleId: string | null;
  name: string;
  adapterType: MnAgentAdapterType;
  adapterConfig: object;
  runtimeConfig: object;
  status: MnAgentStatus;
  reportsToAgentId: string | null;
  capabilities: string | null;
  lastHeartbeatAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function createFakeDb() {
  const projects: FakeProject[] = [];
  const roles: FakeRole[] = [];
  const agents: FakeAgent[] = [];

  const db = {
    mnProject: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        projects.find(p => p.id === where.id) ?? null,
    },
    mnAgentRole: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        roles.find(r => r.id === where.id) ?? null,
    },
    mnAgent: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        agents.find(a => a.id === where.id) ?? null,
      findMany: async ({
        where,
        orderBy: _orderBy,
      }: {
        where: { workspaceId: string; projectId?: string };
        orderBy?: unknown;
      }) =>
        agents
          .filter(a => a.workspaceId === where.workspaceId)
          .filter(a =>
            where.projectId ? a.projectId === where.projectId : true
          ),
      create: async ({
        data,
      }: {
        data: Partial<FakeAgent> & { id: string };
      }) => {
        const now = new Date();
        const row: FakeAgent = {
          id: data.id,
          workspaceId: data.workspaceId!,
          projectId: data.projectId!,
          roleId: data.roleId ?? null,
          name: data.name!,
          adapterType:
            data.adapterType ?? MnAgentAdapterType.COPILOT_CHAT_SESSION,
          adapterConfig: data.adapterConfig ?? {},
          runtimeConfig: data.runtimeConfig ?? {},
          status: data.status ?? MnAgentStatus.IDLE,
          reportsToAgentId: data.reportsToAgentId ?? null,
          capabilities: data.capabilities ?? null,
          lastHeartbeatAt: data.lastHeartbeatAt ?? null,
          createdByUserId: data.createdByUserId ?? null,
          createdAt: now,
          updatedAt: now,
        };
        agents.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeAgent>;
      }) => {
        const idx = agents.findIndex(a => a.id === where.id);
        if (idx < 0) throw new Error('not found');
        agents[idx] = { ...agents[idx], ...data, updatedAt: new Date() };
        return agents[idx];
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = agents.findIndex(a => a.id === where.id);
        if (idx < 0) throw new Error('not found');
        const [removed] = agents.splice(idx, 1);
        return removed;
      },
    },
  };

  return { db, projects, roles, agents };
}

function seed(
  fake: ReturnType<typeof createFakeDb>,
  values: {
    projects?: FakeProject[];
    roles?: FakeRole[];
    agents?: Partial<FakeAgent>[];
  }
) {
  fake.projects.push(...(values.projects ?? []));
  fake.roles.push(...(values.roles ?? []));
  for (const partial of values.agents ?? []) {
    const now = new Date();
    fake.agents.push({
      id: partial.id ?? `agent-${fake.agents.length + 1}`,
      workspaceId: partial.workspaceId ?? 'workspace-1',
      projectId: partial.projectId ?? 'project-1',
      roleId: partial.roleId ?? null,
      name: partial.name ?? 'test-agent',
      adapterType:
        partial.adapterType ?? MnAgentAdapterType.COPILOT_CHAT_SESSION,
      adapterConfig: partial.adapterConfig ?? {},
      runtimeConfig: partial.runtimeConfig ?? {},
      status: partial.status ?? MnAgentStatus.IDLE,
      reportsToAgentId: partial.reportsToAgentId ?? null,
      capabilities: partial.capabilities ?? null,
      lastHeartbeatAt: partial.lastHeartbeatAt ?? null,
      createdByUserId: partial.createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }
}

test('create persists a new agent with defaults', async t => {
  const fake = createFakeDb();
  seed(fake, {
    projects: [{ id: 'project-1', workspaceId: 'workspace-1' }],
  });
  const svc = new MnAgentService(fake.db as any);

  const row = await svc.create('workspace-1', 'user-1', {
    projectId: 'project-1',
    name: 'Builder Agent',
  });

  t.is(row.workspaceId, 'workspace-1');
  t.is(row.projectId, 'project-1');
  t.is(row.name, 'Builder Agent');
  t.is(row.adapterType, MnAgentAdapterType.COPILOT_CHAT_SESSION);
  t.is(row.status, MnAgentStatus.IDLE);
  t.is(row.createdByUserId, 'user-1');
});

test('create rejects a project that belongs to another workspace', async t => {
  const fake = createFakeDb();
  seed(fake, {
    projects: [{ id: 'project-elsewhere', workspaceId: 'workspace-other' }],
  });
  const svc = new MnAgentService(fake.db as any);

  await t.throwsAsync(
    () =>
      svc.create('workspace-1', null, {
        projectId: 'project-elsewhere',
        name: 'x',
      }),
    { instanceOf: BadRequestException, message: /workspace/i }
  );
});

test('create rejects a roleId that belongs to another workspace', async t => {
  const fake = createFakeDb();
  seed(fake, {
    projects: [{ id: 'project-1', workspaceId: 'workspace-1' }],
    roles: [
      { id: 'role-elsewhere', workspaceId: 'workspace-other', slug: 'foo' },
    ],
  });
  const svc = new MnAgentService(fake.db as any);

  await t.throwsAsync(
    () =>
      svc.create('workspace-1', null, {
        projectId: 'project-1',
        roleId: 'role-elsewhere',
        name: 'x',
      }),
    { instanceOf: BadRequestException, message: /workspace/i }
  );
});

test('create rejects a reportsTo agent in another workspace', async t => {
  const fake = createFakeDb();
  seed(fake, {
    projects: [{ id: 'project-1', workspaceId: 'workspace-1' }],
    agents: [
      {
        id: 'agent-elsewhere',
        workspaceId: 'workspace-other',
        projectId: 'project-1',
      },
    ],
  });
  const svc = new MnAgentService(fake.db as any);

  await t.throwsAsync(
    () =>
      svc.create('workspace-1', null, {
        projectId: 'project-1',
        name: 'x',
        reportsToAgentId: 'agent-elsewhere',
      }),
    { instanceOf: BadRequestException, message: /workspace/i }
  );
});

test('list scopes to workspace and optionally filters by project', async t => {
  const fake = createFakeDb();
  seed(fake, {
    agents: [
      { id: 'a', workspaceId: 'workspace-1', projectId: 'project-1' },
      { id: 'b', workspaceId: 'workspace-1', projectId: 'project-2' },
      { id: 'c', workspaceId: 'workspace-other', projectId: 'project-1' },
    ],
  });
  const svc = new MnAgentService(fake.db as any);

  const all = await svc.list('workspace-1');
  t.is(all.length, 2);

  const filtered = await svc.list('workspace-1', 'project-1');
  t.is(filtered.length, 1);
  t.is(filtered[0].id, 'a');
});

test('get returns null when the agent belongs to another workspace', async t => {
  const fake = createFakeDb();
  seed(fake, {
    agents: [{ id: 'agent-1', workspaceId: 'workspace-other' }],
  });
  const svc = new MnAgentService(fake.db as any);

  const row = await svc.get('workspace-1', 'agent-1');
  t.is(row, null);
});

test('getOrThrow surfaces NotFoundException on miss', async t => {
  const fake = createFakeDb();
  const svc = new MnAgentService(fake.db as any);

  await t.throwsAsync(() => svc.getOrThrow('workspace-1', 'nope'), {
    instanceOf: NotFoundException,
  });
});

test('update rejects all writes on a TERMINATED agent', async t => {
  const fake = createFakeDb();
  seed(fake, {
    agents: [
      {
        id: 'agent-1',
        workspaceId: 'workspace-1',
        status: MnAgentStatus.TERMINATED,
      },
    ],
  });
  const svc = new MnAgentService(fake.db as any);

  await t.throwsAsync(
    () => svc.update('workspace-1', 'agent-1', { name: 'still allowed?' }),
    { instanceOf: BadRequestException, message: /TERMINATED/i }
  );
});

test('update rejects a status flip from TERMINATED to IDLE explicitly', async t => {
  const fake = createFakeDb();
  seed(fake, {
    agents: [
      {
        id: 'agent-1',
        workspaceId: 'workspace-1',
        status: MnAgentStatus.TERMINATED,
      },
    ],
  });
  const svc = new MnAgentService(fake.db as any);

  await t.throwsAsync(
    () => svc.update('workspace-1', 'agent-1', { status: MnAgentStatus.IDLE }),
    {
      instanceOf: BadRequestException,
      message: /cannot be resumed|TERMINATED/i,
    }
  );
});

test('update rejects setting reportsTo to self', async t => {
  const fake = createFakeDb();
  seed(fake, {
    agents: [{ id: 'agent-1', workspaceId: 'workspace-1' }],
  });
  const svc = new MnAgentService(fake.db as any);

  await t.throwsAsync(
    () =>
      svc.update('workspace-1', 'agent-1', {
        reportsToAgentId: 'agent-1',
      }),
    { instanceOf: BadRequestException, message: /cycle|itself/i }
  );
});

test('update rejects a reportsTo edge that would create a cycle', async t => {
  const fake = createFakeDb();
  // a -> b -> c; if we try c.reportsTo = a, walking up from a gives a → b → c → ...
  // and that loop is the cycle we want to refuse.
  seed(fake, {
    agents: [
      {
        id: 'a',
        workspaceId: 'workspace-1',
        reportsToAgentId: 'b',
      },
      {
        id: 'b',
        workspaceId: 'workspace-1',
        reportsToAgentId: 'c',
      },
      { id: 'c', workspaceId: 'workspace-1' },
    ],
  });
  const svc = new MnAgentService(fake.db as any);

  await t.throwsAsync(
    () => svc.update('workspace-1', 'c', { reportsToAgentId: 'a' }),
    { instanceOf: BadRequestException, message: /cycle/i }
  );
});

test('update accepts a legal reportsTo edge', async t => {
  const fake = createFakeDb();
  seed(fake, {
    agents: [
      { id: 'a', workspaceId: 'workspace-1' },
      { id: 'b', workspaceId: 'workspace-1' },
    ],
  });
  const svc = new MnAgentService(fake.db as any);

  const updated = await svc.update('workspace-1', 'b', {
    reportsToAgentId: 'a',
  });
  t.is(updated.reportsToAgentId, 'a');
});

test('delete fails when the agent is in another workspace', async t => {
  const fake = createFakeDb();
  seed(fake, {
    agents: [{ id: 'agent-1', workspaceId: 'workspace-other' }],
  });
  const svc = new MnAgentService(fake.db as any);

  await t.throwsAsync(() => svc.delete('workspace-1', 'agent-1'), {
    instanceOf: NotFoundException,
  });
  t.is(fake.agents.length, 1, 'agent untouched');
});

test('delete removes the agent', async t => {
  const fake = createFakeDb();
  seed(fake, {
    agents: [{ id: 'agent-1', workspaceId: 'workspace-1' }],
  });
  const svc = new MnAgentService(fake.db as any);

  await svc.delete('workspace-1', 'agent-1');
  t.is(fake.agents.length, 0);
});
