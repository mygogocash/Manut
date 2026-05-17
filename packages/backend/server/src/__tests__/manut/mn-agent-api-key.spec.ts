import { createHash } from 'node:crypto';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import test from 'ava';

import {
  API_KEY_PREFIX,
  hashApiKey,
  MnAgentApiKeyService,
} from '../../plugins/manut/manut-agent-api-key.service';

interface FakeKey {
  id: string;
  agentId: string;
  workspaceId: string;
  projectId: string;
  name: string;
  keyHash: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

interface FakeAgent {
  id: string;
  workspaceId: string;
  projectId: string;
}

function createFakeDb(_agents: FakeAgent[]) {
  const keys: FakeKey[] = [];
  const db = {
    mnAgentApiKey: {
      findMany: async ({ where }: { where: { agentId: string } }) =>
        keys.filter(k => k.agentId === where.agentId),
      findUnique: async ({
        where,
      }: {
        where: { id?: string; keyHash?: string };
      }) => {
        if (where.id) return keys.find(k => k.id === where.id) ?? null;
        if (where.keyHash)
          return keys.find(k => k.keyHash === where.keyHash) ?? null;
        return null;
      },
      create: async ({ data }: { data: Partial<FakeKey> & { id: string } }) => {
        const row: FakeKey = {
          id: data.id,
          agentId: data.agentId!,
          workspaceId: data.workspaceId!,
          projectId: data.projectId!,
          name: data.name!,
          keyHash: data.keyHash!,
          lastUsedAt: data.lastUsedAt ?? null,
          revokedAt: data.revokedAt ?? null,
          createdAt: new Date(),
        };
        keys.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeKey>;
      }) => {
        const idx = keys.findIndex(k => k.id === where.id);
        if (idx < 0) throw new Error('not found');
        keys[idx] = { ...keys[idx], ...data };
        return keys[idx];
      },
    },
  };
  return { db, keys };
}

/**
 * Lightweight stand-in for MnAgentService that the API key service
 * depends on for ownership checks. We mock just enough — `getOrThrow`
 * — to mirror the real behavior without dragging in the full service.
 */
class FakeAgents {
  constructor(private readonly agents: FakeAgent[]) {}
  async getOrThrow(workspaceId: string, agentId: string) {
    const a = this.agents.find(
      ag => ag.id === agentId && ag.workspaceId === workspaceId
    );
    if (!a) throw new NotFoundException('agent not found');
    return a;
  }
}

test('mint returns a plaintext token starting with mn_ak_', async t => {
  const agents: FakeAgent[] = [
    { id: 'agent-1', workspaceId: 'workspace-1', projectId: 'project-1' },
  ];
  const fake = createFakeDb(agents);
  const svc = new MnAgentApiKeyService(
    fake.db as any,
    new FakeAgents(agents) as any
  );

  const { key, plaintext } = await svc.mint('workspace-1', 'agent-1', {
    name: 'cli-key',
  });

  t.true(plaintext.startsWith(API_KEY_PREFIX));
  t.true(plaintext.length > API_KEY_PREFIX.length + 30);
  t.is(key.agentId, 'agent-1');
  t.is(key.workspaceId, 'workspace-1');
  t.is(key.projectId, 'project-1');
  t.is(key.name, 'cli-key');
});

test('mint stores a hashed value, not the plaintext', async t => {
  const agents: FakeAgent[] = [
    { id: 'agent-1', workspaceId: 'workspace-1', projectId: 'project-1' },
  ];
  const fake = createFakeDb(agents);
  const svc = new MnAgentApiKeyService(
    fake.db as any,
    new FakeAgents(agents) as any
  );

  const { plaintext } = await svc.mint('workspace-1', 'agent-1', {
    name: 'k',
  });

  // Stored row's keyHash must be the SHA-256 of plaintext, NOT the
  // plaintext itself. (See the hash design note in the service.)
  const storedHash = fake.keys[0].keyHash;
  t.not(storedHash, plaintext, 'plaintext is never persisted');
  const expected = createHash('sha256').update(plaintext, 'utf8').digest('hex');
  t.is(storedHash, expected);
});

test('mint fails on a cross-tenant agentId', async t => {
  const agents: FakeAgent[] = [
    {
      id: 'agent-elsewhere',
      workspaceId: 'workspace-other',
      projectId: 'project-1',
    },
  ];
  const fake = createFakeDb(agents);
  const svc = new MnAgentApiKeyService(
    fake.db as any,
    new FakeAgents(agents) as any
  );

  await t.throwsAsync(
    () => svc.mint('workspace-1', 'agent-elsewhere', { name: 'k' }),
    { instanceOf: NotFoundException }
  );
  t.is(fake.keys.length, 0);
});

test('hashApiKey is deterministic for the same plaintext', t => {
  t.is(hashApiKey('mn_ak_abc'), hashApiKey('mn_ak_abc'));
  t.not(hashApiKey('mn_ak_abc'), hashApiKey('mn_ak_def'));
});

test('resolve returns the row for a known plaintext token', async t => {
  const agents: FakeAgent[] = [
    { id: 'agent-1', workspaceId: 'workspace-1', projectId: 'project-1' },
  ];
  const fake = createFakeDb(agents);
  const svc = new MnAgentApiKeyService(
    fake.db as any,
    new FakeAgents(agents) as any
  );
  const { plaintext } = await svc.mint('workspace-1', 'agent-1', {
    name: 'k',
  });

  const resolved = await svc.resolve(plaintext);
  t.truthy(resolved);
  t.is(resolved?.agentId, 'agent-1');
});

test('resolve returns null when the token has been revoked', async t => {
  const agents: FakeAgent[] = [
    { id: 'agent-1', workspaceId: 'workspace-1', projectId: 'project-1' },
  ];
  const fake = createFakeDb(agents);
  const svc = new MnAgentApiKeyService(
    fake.db as any,
    new FakeAgents(agents) as any
  );
  const { key, plaintext } = await svc.mint('workspace-1', 'agent-1', {
    name: 'k',
  });
  await svc.revoke('workspace-1', 'agent-1', key.id);

  const resolved = await svc.resolve(plaintext);
  t.is(resolved, null);
});

test('resolve returns null on unknown plaintext', async t => {
  const fake = createFakeDb([]);
  const svc = new MnAgentApiKeyService(
    fake.db as any,
    new FakeAgents([]) as any
  );

  const resolved = await svc.resolve('mn_ak_does_not_exist');
  t.is(resolved, null);
});

test('resolve returns null when prefix is missing', async t => {
  const fake = createFakeDb([]);
  const svc = new MnAgentApiKeyService(
    fake.db as any,
    new FakeAgents([]) as any
  );

  const resolved = await svc.resolve('no_prefix_here');
  t.is(resolved, null);
});

test('revoke is idempotent', async t => {
  const agents: FakeAgent[] = [
    { id: 'agent-1', workspaceId: 'workspace-1', projectId: 'project-1' },
  ];
  const fake = createFakeDb(agents);
  const svc = new MnAgentApiKeyService(
    fake.db as any,
    new FakeAgents(agents) as any
  );
  const { key } = await svc.mint('workspace-1', 'agent-1', { name: 'k' });

  const first = await svc.revoke('workspace-1', 'agent-1', key.id);
  const second = await svc.revoke('workspace-1', 'agent-1', key.id);

  t.truthy(first.revokedAt);
  t.is(
    second.revokedAt?.getTime(),
    first.revokedAt?.getTime(),
    'second revoke is a no-op'
  );
});

test('revoke rejects a keyId belonging to a different agent', async t => {
  const agents: FakeAgent[] = [
    { id: 'agent-1', workspaceId: 'workspace-1', projectId: 'project-1' },
    { id: 'agent-2', workspaceId: 'workspace-1', projectId: 'project-1' },
  ];
  const fake = createFakeDb(agents);
  const svc = new MnAgentApiKeyService(
    fake.db as any,
    new FakeAgents(agents) as any
  );
  const { key } = await svc.mint('workspace-1', 'agent-1', { name: 'k' });

  await t.throwsAsync(() => svc.revoke('workspace-1', 'agent-2', key.id), {
    instanceOf: BadRequestException,
  });
});

test('list returns keys for the agent only, scoped to workspace', async t => {
  const agents: FakeAgent[] = [
    { id: 'agent-1', workspaceId: 'workspace-1', projectId: 'project-1' },
    { id: 'agent-2', workspaceId: 'workspace-1', projectId: 'project-1' },
  ];
  const fake = createFakeDb(agents);
  const svc = new MnAgentApiKeyService(
    fake.db as any,
    new FakeAgents(agents) as any
  );
  await svc.mint('workspace-1', 'agent-1', { name: 'k1' });
  await svc.mint('workspace-1', 'agent-1', { name: 'k2' });
  await svc.mint('workspace-1', 'agent-2', { name: 'k3' });

  const list = await svc.list('workspace-1', 'agent-1');
  t.is(list.length, 2);
  t.true(list.every(k => k.agentId === 'agent-1'));
});

test('list throws when the agentId belongs to another workspace', async t => {
  const agents: FakeAgent[] = [
    {
      id: 'agent-elsewhere',
      workspaceId: 'workspace-other',
      projectId: 'project-1',
    },
  ];
  const fake = createFakeDb(agents);
  const svc = new MnAgentApiKeyService(
    fake.db as any,
    new FakeAgents(agents) as any
  );

  await t.throwsAsync(() => svc.list('workspace-1', 'agent-elsewhere'), {
    instanceOf: NotFoundException,
  });
});
