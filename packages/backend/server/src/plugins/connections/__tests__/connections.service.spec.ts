import test from 'ava';
import Sinon from 'sinon';

import { ConnectionsService } from '../connections.service.js';
import { providerRegistry } from '../providers/registry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCache() {
  const store = new Map<string, unknown>();
  return {
    set: Sinon.stub().callsFake(async (key: string, value: unknown) => {
      store.set(key, value);
      return true;
    }),
    get: Sinon.stub().callsFake(
      async <T>(key: string): Promise<T | undefined> => {
        return store.get(key) as T | undefined;
      }
    ),
    store,
  };
}

function makeModels() {
  return {
    integrationConnection: {
      upsert: Sinon.stub().resolves(),
      listByWorkspace: Sinon.stub().resolves([]),
      delete: Sinon.stub().resolves(),
      getByProvider: Sinon.stub().resolves(null),
      decryptTokens: Sinon.stub().returns(null),
    },
  };
}

function makeProvider(name = 'google') {
  return {
    name,
    displayName: 'Google',
    scopes: ['read'],
    getAuthorizationUrl: Sinon.stub().callsFake(
      (state: string, _redirectUri: string) =>
        `https://oauth.example.com/?state=${state}`
    ),
    exchangeCode: Sinon.stub().resolves({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456',
      expiresAt: new Date(Date.now() + 3600_000),
      scopes: ['read'],
    }),
    getUserInfo: Sinon.stub().resolves({
      externalId: 'ext-user-001',
      displayName: 'Test User',
    }),
  };
}

// ---------------------------------------------------------------------------
// initiateOAuth
// ---------------------------------------------------------------------------

test('initiateOAuth: should return authorization URL and store state', async t => {
  const cache = makeCache();
  const models = makeModels();
  const provider = makeProvider('google');

  providerRegistry.set('google', provider as any);

  try {
    const service = new ConnectionsService(models as any, cache as any);
    const url = await service.initiateOAuth(
      'user-1',
      'ws-1',
      'google',
      'https://app.example.com/callback'
    );

    t.true(url.startsWith('https://oauth.example.com/?state='));
    t.true(cache.set.calledOnce);

    // Verify state was stored in cache
    const [key, storedState] = cache.set.firstCall.args as [string, any];
    t.true(key.startsWith('CONN_OAUTH_STATE:'));
    t.is(storedState.userId, 'user-1');
    t.is(storedState.workspaceId, 'ws-1');
    t.is(storedState.provider, 'google');
    t.is(storedState.redirectUri, 'https://app.example.com/callback');
  } finally {
    providerRegistry.delete('google');
  }
});

test('initiateOAuth: should throw for unknown provider', async t => {
  const cache = makeCache();
  const models = makeModels();

  // Ensure 'nonexistent' is not in registry
  providerRegistry.delete('nonexistent');

  const service = new ConnectionsService(models as any, cache as any);

  await t.throwsAsync(
    service.initiateOAuth(
      'user-1',
      'ws-1',
      'nonexistent',
      'https://app.example.com/callback'
    ),
    { message: 'Unknown provider: nonexistent' }
  );
});

// ---------------------------------------------------------------------------
// handleCallback
// ---------------------------------------------------------------------------

test('handleCallback: should exchange code and save connection', async t => {
  const cache = makeCache();
  const models = makeModels();
  const provider = makeProvider('google');

  providerRegistry.set('google', provider as any);

  // Pre-seed state in cache
  const stateToken = 'test-state-token-abc';
  const stateData = {
    userId: 'user-1',
    workspaceId: 'ws-1',
    provider: 'google',
    redirectUri: 'https://app.example.com/callback',
  };
  cache.store.set(`CONN_OAUTH_STATE:${stateToken}`, stateData);

  try {
    const service = new ConnectionsService(models as any, cache as any);
    const result = await service.handleCallback('oauth-code-xyz', stateToken);

    t.is(result.provider, 'google');
    t.is(result.displayName, 'Test User');

    // Verify upsert was called with correct arguments
    t.true(models.integrationConnection.upsert.calledOnce);
    const upsertArg = models.integrationConnection.upsert.firstCall.args[0];
    t.is(upsertArg.userId, 'user-1');
    t.is(upsertArg.workspaceId, 'ws-1');
    t.is(upsertArg.provider, 'google');
    t.is(upsertArg.externalId, 'ext-user-001');
    t.is(upsertArg.displayName, 'Test User');
    t.is(upsertArg.accessToken, 'access-token-123');
  } finally {
    providerRegistry.delete('google');
  }
});

test('handleCallback: should update existing connection on reconnect', async t => {
  const cache = makeCache();
  const models = makeModels();
  const provider = makeProvider('google');

  providerRegistry.set('google', provider as any);

  const stateToken = 'reconnect-state-token';
  cache.store.set(`CONN_OAUTH_STATE:${stateToken}`, {
    userId: 'user-2',
    workspaceId: 'ws-2',
    provider: 'google',
    redirectUri: 'https://app.example.com/callback',
  });

  // Simulate already having a connection
  models.integrationConnection.upsert.resolves({
    id: 'conn-existing',
    provider: 'google',
  });

  try {
    const service = new ConnectionsService(models as any, cache as any);
    const result = await service.handleCallback('new-code', stateToken);

    t.is(result.provider, 'google');
    // upsert handles both create and update
    t.true(models.integrationConnection.upsert.calledOnce);
  } finally {
    providerRegistry.delete('google');
  }
});

test('handleCallback: should throw on invalid/expired state', async t => {
  const cache = makeCache();
  const models = makeModels();

  // cache.get returns undefined (no stored state)
  cache.get.resolves(undefined);

  const service = new ConnectionsService(models as any, cache as any);

  await t.throwsAsync(service.handleCallback('code', 'invalid-state-token'), {
    message: 'OAuth state expired or invalid',
  });
});

// ---------------------------------------------------------------------------
// listConnections
// ---------------------------------------------------------------------------

test('listConnections: should return connections for user+workspace', async t => {
  const cache = makeCache();
  const models = makeModels();

  const fakeConnections = [
    {
      id: 'conn-1',
      provider: 'google',
      displayName: 'Alice',
      scopes: 'read,write',
      createdAt: new Date('2024-01-01'),
    },
    {
      id: 'conn-2',
      provider: 'github',
      displayName: 'Alice GH',
      scopes: 'repo',
      createdAt: new Date('2024-02-01'),
    },
  ];
  models.integrationConnection.listByWorkspace.resolves(fakeConnections);

  const service = new ConnectionsService(models as any, cache as any);
  const result = await service.listConnections('user-1', 'ws-1');

  t.is(result.length, 2);
  t.is(result[0].provider, 'google');
  t.is(result[0].displayName, 'Alice');
  t.deepEqual(result[0].scopes, ['read', 'write']);
  t.is(result[1].provider, 'github');
  t.deepEqual(result[1].scopes, ['repo']);
});

test('listConnections: should return empty array when no connections', async t => {
  const cache = makeCache();
  const models = makeModels();

  models.integrationConnection.listByWorkspace.resolves([]);

  const service = new ConnectionsService(models as any, cache as any);
  const result = await service.listConnections('user-1', 'ws-1');

  t.deepEqual(result, []);
});

// ---------------------------------------------------------------------------
// disconnectProvider
// ---------------------------------------------------------------------------

test('disconnectProvider: should delete connection by userId+workspaceId+provider', async t => {
  const cache = makeCache();
  const models = makeModels();

  models.integrationConnection.delete.resolves({ id: 'conn-1' });

  const service = new ConnectionsService(models as any, cache as any);
  const result = await service.disconnectProvider('user-1', 'ws-1', 'google');

  t.true(result);
  t.true(
    models.integrationConnection.delete.calledOnceWith(
      'user-1',
      'ws-1',
      'google'
    )
  );
});

test('disconnectProvider: should return false if delete throws (connection not found)', async t => {
  const cache = makeCache();
  const models = makeModels();

  models.integrationConnection.delete.rejects(new Error('Record not found'));

  const service = new ConnectionsService(models as any, cache as any);
  const result = await service.disconnectProvider(
    'user-1',
    'ws-1',
    'nonexistent-provider'
  );

  t.false(result);
});
