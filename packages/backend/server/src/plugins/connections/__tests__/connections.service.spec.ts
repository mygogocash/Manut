import { randomUUID } from 'node:crypto';

import test from 'ava';
import Sinon from 'sinon';

import {
  ConnectionsService,
  ConnectionTokenExpiredError,
} from '../connections.service.js';
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
    delete: Sinon.stub().callsFake(async (key: string) => {
      return store.delete(key);
    }),
    setnx: Sinon.stub().callsFake(async (key: string, value: unknown) => {
      if (store.has(key)) return false;
      store.set(key, value);
      return true;
    }),
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
      updateTokens: Sinon.stub().resolves(),
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
  const providerName = `test-${randomUUID()}`;
  const provider = makeProvider(providerName);

  providerRegistry.set(providerName, provider as any);

  try {
    const service = new ConnectionsService(models as any, cache as any);
    const url = await service.initiateOAuth(
      'user-1',
      'ws-1',
      providerName,
      'https://app.example.com/callback'
    );

    t.true(url.startsWith('https://oauth.example.com/?state='));
    t.true(cache.set.calledOnce);

    const [key, storedState] = cache.set.firstCall.args as [string, any];
    t.true(key.startsWith('CONN_OAUTH_STATE:'));
    t.is(storedState.userId, 'user-1');
    t.is(storedState.workspaceId, 'ws-1');
    t.is(storedState.provider, providerName);
    t.is(storedState.redirectUri, 'https://app.example.com/callback');
  } finally {
    providerRegistry.delete(providerName);
  }
});

test('initiateOAuth: should throw for unknown provider', async t => {
  const cache = makeCache();
  const models = makeModels();
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
  const providerName = `test-${randomUUID()}`;
  const provider = makeProvider(providerName);

  providerRegistry.set(providerName, provider as any);

  const stateToken = 'test-state-token-abc';
  cache.store.set(`CONN_OAUTH_STATE:${stateToken}`, {
    userId: 'user-1',
    workspaceId: 'ws-1',
    provider: providerName,
    redirectUri: 'https://app.example.com/callback',
  });

  try {
    const service = new ConnectionsService(models as any, cache as any);
    const result = await service.handleCallback('oauth-code-xyz', stateToken);

    t.is(result.provider, providerName);
    t.is(result.displayName, 'Test User');

    t.true(models.integrationConnection.upsert.calledOnce);
    const upsertArg = models.integrationConnection.upsert.firstCall.args[0];
    t.is(upsertArg.userId, 'user-1');
    t.is(upsertArg.workspaceId, 'ws-1');
    t.is(upsertArg.provider, providerName);
    t.is(upsertArg.externalId, 'ext-user-001');
    t.is(upsertArg.displayName, 'Test User');
    t.is(upsertArg.accessToken, 'access-token-123');
  } finally {
    providerRegistry.delete(providerName);
  }
});

test('handleCallback: should DELETE state token to prevent replay', async t => {
  const cache = makeCache();
  const models = makeModels();
  const providerName = `test-${randomUUID()}`;
  const provider = makeProvider(providerName);
  providerRegistry.set(providerName, provider as any);

  const stateToken = `replay-${randomUUID()}`;
  const stateKey = `CONN_OAUTH_STATE:${stateToken}`;
  cache.store.set(stateKey, {
    userId: 'user-1',
    workspaceId: 'ws-1',
    provider: providerName,
    redirectUri: 'https://app.example.com/callback',
  });

  try {
    const service = new ConnectionsService(models as any, cache as any);
    await service.handleCallback('oauth-code', stateToken);

    // The state must have been deleted exactly once during handleCallback.
    t.true(cache.delete.calledWith(stateKey));
    t.false(cache.store.has(stateKey));

    // A second call with the same state must fail (no record left in cache).
    await t.throwsAsync(service.handleCallback('replayed-code', stateToken), {
      message: 'OAuth state expired or invalid',
    });
  } finally {
    providerRegistry.delete(providerName);
  }
});

test('handleCallback: should DELETE state even if exchange throws', async t => {
  const cache = makeCache();
  const models = makeModels();
  const providerName = `test-${randomUUID()}`;
  const provider = makeProvider(providerName);
  provider.exchangeCode.rejects(new Error('upstream rate limited'));
  providerRegistry.set(providerName, provider as any);

  const stateToken = `fail-${randomUUID()}`;
  const stateKey = `CONN_OAUTH_STATE:${stateToken}`;
  cache.store.set(stateKey, {
    userId: 'user-1',
    workspaceId: 'ws-1',
    provider: providerName,
    redirectUri: 'https://app.example.com/callback',
  });

  try {
    const service = new ConnectionsService(models as any, cache as any);
    await t.throwsAsync(service.handleCallback('code', stateToken));

    // Even on failure, the state was deleted at the top of handleCallback so
    // the same code+state cannot be retried by an attacker who races the
    // legitimate user.
    t.false(cache.store.has(stateKey));
  } finally {
    providerRegistry.delete(providerName);
  }
});

test('handleCallback: should throw on invalid/expired state', async t => {
  const cache = makeCache();
  const models = makeModels();

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

test('disconnectProvider: should return false on Prisma P2025 (not found)', async t => {
  const cache = makeCache();
  const models = makeModels();

  const notFound: Error & { code?: string } = new Error('Record not found');
  notFound.code = 'P2025';
  models.integrationConnection.delete.rejects(notFound);

  const service = new ConnectionsService(models as any, cache as any);
  const result = await service.disconnectProvider(
    'user-1',
    'ws-1',
    'nonexistent-provider'
  );

  t.false(result);
});

test('disconnectProvider: should re-throw on infra errors', async t => {
  const cache = makeCache();
  const models = makeModels();

  // Non-P2025 error means infra failure (DB unreachable, etc) — surfacing
  // as `false` would mask production incidents from operators.
  models.integrationConnection.delete.rejects(
    new Error('connection refused')
  );

  const service = new ConnectionsService(models as any, cache as any);
  await t.throwsAsync(
    service.disconnectProvider('user-1', 'ws-1', 'google'),
    { message: 'connection refused' }
  );
});

// ---------------------------------------------------------------------------
// getAccessToken
// ---------------------------------------------------------------------------

test('getAccessToken: returns null when no connection exists', async t => {
  const cache = makeCache();
  const models = makeModels();
  models.integrationConnection.getByProvider.resolves(null);

  const service = new ConnectionsService(models as any, cache as any);
  const token = await service.getAccessToken('user-1', 'ws-1', 'google');
  t.is(token, null);
});

test('getAccessToken: returns stored token when not expiring soon', async t => {
  const cache = makeCache();
  const models = makeModels();
  const farFuture = new Date(Date.now() + 24 * 3600 * 1000);
  models.integrationConnection.getByProvider.resolves({ id: 'conn-1' });
  models.integrationConnection.decryptTokens.returns({
    accessToken: 'fresh-token',
    refreshToken: 'refresh-1',
    tokenExpiresAt: farFuture,
  });

  const service = new ConnectionsService(models as any, cache as any);
  const token = await service.getAccessToken('user-1', 'ws-1', 'google');
  t.is(token, 'fresh-token');
});

test('getAccessToken: throws ConnectionTokenExpiredError when provider lacks refresh', async t => {
  const cache = makeCache();
  const models = makeModels();
  const past = new Date(Date.now() - 60_000);

  // Provider with no refreshAccessToken method.
  const providerName = `no-refresh-${randomUUID()}`;
  const provider = makeProvider(providerName);
  providerRegistry.set(providerName, provider as any);

  models.integrationConnection.getByProvider.resolves({ id: 'c' });
  models.integrationConnection.decryptTokens.returns({
    accessToken: 'old',
    refreshToken: 'r1',
    tokenExpiresAt: past,
  });

  try {
    const service = new ConnectionsService(models as any, cache as any);
    await t.throwsAsync(
      service.getAccessToken('user-1', 'ws-1', providerName),
      { instanceOf: ConnectionTokenExpiredError }
    );
  } finally {
    providerRegistry.delete(providerName);
  }
});

test('getAccessToken: refreshes via provider and stores new tokens', async t => {
  const cache = makeCache();
  const models = makeModels();
  const past = new Date(Date.now() - 60_000);
  const future = new Date(Date.now() + 3600_000);

  const providerName = `refreshable-${randomUUID()}`;
  const provider = makeProvider(providerName);
  (provider as any).refreshAccessToken = Sinon.stub().resolves({
    accessToken: 'newly-issued',
    refreshToken: 'rotated-refresh',
    expiresAt: future,
    scopes: ['read'],
  });
  providerRegistry.set(providerName, provider as any);

  models.integrationConnection.getByProvider.resolves({ id: 'c' });
  models.integrationConnection.decryptTokens.returns({
    accessToken: 'old',
    refreshToken: 'r1',
    tokenExpiresAt: past,
  });

  try {
    const service = new ConnectionsService(models as any, cache as any);
    const token = await service.getAccessToken('user-1', 'ws-1', providerName);
    t.is(token, 'newly-issued');
    t.true(models.integrationConnection.updateTokens.calledOnce);
    const args = models.integrationConnection.updateTokens.firstCall.args;
    t.is(args[0], 'user-1');
    t.is(args[1], 'ws-1');
    t.is(args[2], providerName);
    t.is(args[3].accessToken, 'newly-issued');
    t.is(args[3].refreshToken, 'rotated-refresh');
  } finally {
    providerRegistry.delete(providerName);
  }
});
