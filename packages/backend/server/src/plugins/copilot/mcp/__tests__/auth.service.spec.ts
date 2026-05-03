import { createHash } from 'node:crypto';

import test from 'ava';
import Sinon from 'sinon';

import { generateApiKey, McpApiKeyService } from '../auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb() {
  return {
    mcpApiKey: {
      create: Sinon.stub().resolves(),
      findUnique: Sinon.stub().resolves(null),
      findMany: Sinon.stub().resolves([]),
      update: Sinon.stub().resolves(),
      deleteMany: Sinon.stub().resolves(),
    },
  };
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// ---------------------------------------------------------------------------
// createApiKey
// ---------------------------------------------------------------------------

test('createApiKey: should return plaintext key and store hashed version', async t => {
  const db = makeDb();
  let capturedData: Record<string, unknown> | null = null;

  db.mcpApiKey.create.callsFake(
    async ({ data }: { data: Record<string, unknown> }) => {
      capturedData = data;
      return { id: 'key-id-1', ...data };
    }
  );

  const service = new McpApiKeyService(db as any);
  const plaintextKey = await service.createApiKey('user-1', 'My API Key');

  // Plaintext key should follow expected format
  t.true(plaintextKey.startsWith('affine_mcp_'));

  // Stored hash must be sha256 of the returned key
  t.truthy(capturedData);
  const storedHash = capturedData!.keyHash as string;
  t.is(storedHash, hashKey(plaintextKey));

  // Plaintext must NOT be stored
  t.not(capturedData!.keyHash, plaintextKey);
});

test('createApiKey: should store userId and optional workspaceId', async t => {
  const db = makeDb();
  let capturedData: Record<string, unknown> | null = null;

  db.mcpApiKey.create.callsFake(
    async ({ data }: { data: Record<string, unknown> }) => {
      capturedData = data;
      return { id: 'key-id-2', ...data };
    }
  );

  const service = new McpApiKeyService(db as any);

  // Without workspaceId
  await service.createApiKey('user-1', 'Key without workspace');
  t.is(capturedData!.userId, 'user-1');
  t.is(capturedData!.workspaceId, null);

  // With workspaceId
  await service.createApiKey('user-2', 'Key with workspace', 'ws-42');
  t.is(capturedData!.userId, 'user-2');
  t.is(capturedData!.workspaceId, 'ws-42');
});

// ---------------------------------------------------------------------------
// validateApiKey
// ---------------------------------------------------------------------------

test('validateApiKey: should return userId for valid key', async t => {
  const db = makeDb();

  const { key, hash } = generateApiKey();

  db.mcpApiKey.findUnique.resolves({
    keyHash: hash,
    userId: 'user-1',
    workspaceId: null,
    expiresAt: null,
  });
  // update is fire-and-forget – stub resolves quietly
  db.mcpApiKey.update.resolves({ keyHash: hash, lastUsedAt: new Date() });

  const service = new McpApiKeyService(db as any);
  const result = await service.validateApiKey(key);

  t.truthy(result);
  t.is(result!.userId, 'user-1');
  t.is(result!.workspaceId, null);

  // Verify lookup was performed with correct hash
  const lookupArg = db.mcpApiKey.findUnique.firstCall.args[0] as any;
  t.is(lookupArg.where.keyHash, hash);
});

test('validateApiKey: should return null for invalid key', async t => {
  const db = makeDb();
  db.mcpApiKey.findUnique.resolves(null);

  const service = new McpApiKeyService(db as any);
  const result = await service.validateApiKey(
    'affine_mcp_invalid_key_that_does_not_exist'
  );

  t.is(result, null);
});

test('validateApiKey: should return null for expired key', async t => {
  const db = makeDb();

  const { key, hash } = generateApiKey();
  const pastDate = new Date(Date.now() - 1000); // 1 second in the past

  db.mcpApiKey.findUnique.resolves({
    keyHash: hash,
    userId: 'user-1',
    workspaceId: null,
    expiresAt: pastDate,
  });

  const service = new McpApiKeyService(db as any);
  const result = await service.validateApiKey(key);

  t.is(result, null);
  // update should NOT be called for expired keys
  t.false(db.mcpApiKey.update.called);
});

test('validateApiKey: should update lastUsedAt on successful validation', async t => {
  const db = makeDb();

  const { key, hash } = generateApiKey();

  db.mcpApiKey.findUnique.resolves({
    keyHash: hash,
    userId: 'user-1',
    workspaceId: 'ws-5',
    expiresAt: null,
  });
  db.mcpApiKey.update.resolves({ keyHash: hash, lastUsedAt: new Date() });

  const service = new McpApiKeyService(db as any);
  await service.validateApiKey(key);

  // Give the fire-and-forget promise a tick to settle
  await new Promise(resolve => setTimeout(resolve, 10));

  t.true(db.mcpApiKey.update.calledOnce);
  const updateArg = db.mcpApiKey.update.firstCall.args[0] as any;
  t.is(updateArg.where.keyHash, hash);
  t.truthy(updateArg.data.lastUsedAt);
});

// ---------------------------------------------------------------------------
// listApiKeys
// ---------------------------------------------------------------------------

test('listApiKeys: should return keys for a user (without keyHash)', async t => {
  const db = makeDb();

  const fakeKeys = [
    {
      id: 'key-1',
      name: 'My Key',
      workspaceId: null,
      lastUsedAt: null,
      createdAt: new Date('2024-01-01'),
      expiresAt: null,
    },
    {
      id: 'key-2',
      name: 'Another Key',
      workspaceId: 'ws-1',
      lastUsedAt: new Date('2024-06-01'),
      createdAt: new Date('2024-05-01'),
      expiresAt: null,
    },
  ];

  db.mcpApiKey.findMany.resolves(fakeKeys);

  const service = new McpApiKeyService(db as any);
  const result = await service.listApiKeys('user-1');

  t.is(result.length, 2);
  t.is(result[0].id, 'key-1');
  t.is(result[1].id, 'key-2');

  // Verify the query targets the correct userId with select (no keyHash)
  const queryArg = db.mcpApiKey.findMany.firstCall.args[0] as any;
  t.is(queryArg.where.userId, 'user-1');
  t.truthy(queryArg.select);
  t.falsy(queryArg.select.keyHash);
});

// ---------------------------------------------------------------------------
// deleteApiKey
// ---------------------------------------------------------------------------

test('deleteApiKey: should delete key by id', async t => {
  const db = makeDb();
  db.mcpApiKey.deleteMany.resolves({ count: 1 });

  const service = new McpApiKeyService(db as any);
  await service.deleteApiKey('user-1', 'key-id-99');

  t.true(db.mcpApiKey.deleteMany.calledOnce);
  const deleteArg = db.mcpApiKey.deleteMany.firstCall.args[0] as any;
  t.is(deleteArg.where.id, 'key-id-99');
  t.is(deleteArg.where.userId, 'user-1');
});
