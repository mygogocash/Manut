import test from 'ava';
import Sinon from 'sinon';

import { THROTTLER_PROTECTED } from '../../../base/throttler/index.js';
import { SocialPlatform } from '../../analytics/connections/connection.entity.js';
import { AnalyticsResolver } from '../../analytics/graphql/analytics.resolver.js';
import { FacebookOAuthResolver } from '../../facebook-oauth/facebook-oauth.resolver.js';
import { GoGoCashConnectionResolver } from '../../gogocash-connection/gogocash-connection.resolver.js';
import { MongoDbConnectionResolver } from '../../mongodb-connection/mongodb-connection.resolver.js';
import { PostHogConnectionResolver } from '../../posthog-connection/posthog-connection.resolver.js';
import { ConnectionsResolver } from '../connections.resolver.js';

const USER = { id: 'user-1' } as any;
const WORKSPACE_ID = 'workspace-1';

function makeAccessController() {
  const assert = Sinon.stub().resolves();
  const workspace = Sinon.stub().returns({ assert });
  const user = Sinon.stub().returns({ workspace });
  return {
    ac: { user } as any,
    assert,
    user,
    workspace,
  };
}

function assertPermission(
  t: { true(value: boolean, message?: string): void },
  guard: ReturnType<typeof makeAccessController>,
  permission: 'Workspace.Read' | 'Workspace.Settings.Update'
) {
  t.true(guard.user.calledWith(USER.id));
  t.true(guard.workspace.calledWith(WORKSPACE_ID));
  t.true(guard.assert.calledWith(permission));
}

test('connection resolver authz > given generic list query > then asserts Workspace.Read', async t => {
  const guard = makeAccessController();
  const service = {
    listConnections: Sinon.stub().resolves([]),
    disconnectProvider: Sinon.stub().resolves(true),
  };
  const resolver = new ConnectionsResolver(service as any, guard.ac);

  await resolver.listConnections(USER, WORKSPACE_ID);

  assertPermission(t, guard, 'Workspace.Read');
  t.true(guard.assert.calledBefore(service.listConnections));
  t.true(service.listConnections.calledWith(USER.id, WORKSPACE_ID));
});

test('connection resolver authz > given generic disconnect mutation > then asserts Workspace.Settings.Update', async t => {
  const guard = makeAccessController();
  const service = {
    listConnections: Sinon.stub().resolves([]),
    disconnectProvider: Sinon.stub().resolves(true),
  };
  const resolver = new ConnectionsResolver(service as any, guard.ac);

  await resolver.disconnectProvider(USER, WORKSPACE_ID, 'github');

  assertPermission(t, guard, 'Workspace.Settings.Update');
  t.true(guard.assert.calledBefore(service.disconnectProvider));
  t.true(
    service.disconnectProvider.calledWith(USER.id, WORKSPACE_ID, 'github')
  );
});

test('connection resolver authz > given PostHog write mutation > then asserts Workspace.Settings.Update', async t => {
  const guard = makeAccessController();
  const service = {
    setConnection: Sinon.stub().resolves({
      connected: true,
      host: 'https://posthog.example.com',
      projectCount: 2,
    }),
    disconnect: Sinon.stub().resolves(true),
    getStatus: Sinon.stub().resolves({ connected: true }),
  };
  const resolver = new PostHogConnectionResolver(service as any, guard.ac);

  await resolver.setPostHogConnection(USER, WORKSPACE_ID, {
    apiKey: 'ph-key',
    host: 'https://posthog.example.com',
  });

  assertPermission(t, guard, 'Workspace.Settings.Update');
  t.true(guard.assert.calledBefore(service.setConnection));
});

test('connection resolver authz > given PostHog stateless test mutation > then asserts Workspace.Settings.Update before probing', async t => {
  const guard = makeAccessController();
  const service = {
    testConnection: Sinon.stub().resolves({
      ok: true,
      host: 'https://posthog.example.com',
      projectCount: 2,
    }),
  };
  const resolver = new PostHogConnectionResolver(service as any, guard.ac);

  await resolver.testPostHogConnection(USER, WORKSPACE_ID, {
    apiKey: 'ph-key',
    host: 'https://posthog.example.com',
  });

  assertPermission(t, guard, 'Workspace.Settings.Update');
  t.true(guard.assert.calledBefore(service.testConnection));
});

test('connection resolver authz > given MongoDB stateless test mutation > then asserts Workspace.Settings.Update before probing', async t => {
  const guard = makeAccessController();
  const service = {
    testConnection: Sinon.stub().resolves({
      ok: true,
      host: 'cluster.mongodb.net',
      database: 'analytics',
      pingMs: 4,
    }),
  };
  const resolver = new MongoDbConnectionResolver(service as any, guard.ac);

  await resolver.testMongoDbConnection(USER, WORKSPACE_ID, {
    uri: 'mongodb+srv://user:pass@cluster.mongodb.net/analytics',
  });

  assertPermission(t, guard, 'Workspace.Settings.Update');
  t.true(guard.assert.calledBefore(service.testConnection));
});

test('connection resolver authz > stateless connection tests are throttled', t => {
  t.is(
    Reflect.getMetadata(
      THROTTLER_PROTECTED,
      MongoDbConnectionResolver.prototype.testMongoDbConnection
    ),
    'default'
  );
  t.is(
    Reflect.getMetadata(
      THROTTLER_PROTECTED,
      PostHogConnectionResolver.prototype.testPostHogConnection
    ),
    'default'
  );
});

test('connection resolver authz > given PostHog read query > then asserts Workspace.Read', async t => {
  const guard = makeAccessController();
  const service = {
    setConnection: Sinon.stub().resolves({ connected: true }),
    disconnect: Sinon.stub().resolves(true),
    getStatus: Sinon.stub().resolves({ connected: true }),
  };
  const resolver = new PostHogConnectionResolver(service as any, guard.ac);

  await resolver.postHogConnection(USER, WORKSPACE_ID);

  assertPermission(t, guard, 'Workspace.Read');
  t.true(guard.assert.calledBefore(service.getStatus));
});

test('connection resolver authz > given GoGoCash write mutation > then asserts Workspace.Settings.Update', async t => {
  const guard = makeAccessController();
  const service = {
    setConnection: Sinon.stub().resolves({
      connected: true,
      label: 'Production',
    }),
    disconnect: Sinon.stub().resolves(true),
    getStatus: Sinon.stub().resolves({ connected: true }),
  };
  const resolver = new GoGoCashConnectionResolver(service as any, guard.ac);

  await resolver.setGoGoCashConnection(USER, WORKSPACE_ID, {
    apiKey: 'ggc-key',
    label: 'Production',
  });

  assertPermission(t, guard, 'Workspace.Settings.Update');
  t.true(guard.assert.calledBefore(service.setConnection));
});

test('connection resolver authz > given GoGoCash read query > then asserts Workspace.Read', async t => {
  const guard = makeAccessController();
  const service = {
    setConnection: Sinon.stub().resolves({ connected: true }),
    disconnect: Sinon.stub().resolves(true),
    getStatus: Sinon.stub().resolves({ connected: true }),
  };
  const resolver = new GoGoCashConnectionResolver(service as any, guard.ac);

  await resolver.goGoCashConnection(USER, WORKSPACE_ID);

  assertPermission(t, guard, 'Workspace.Read');
  t.true(guard.assert.calledBefore(service.getStatus));
});

test('connection resolver authz > given Facebook OAuth write mutation > then asserts Workspace.Settings.Update', async t => {
  const guard = makeAccessController();
  const service = {
    resolveRedirectUri: Sinon.stub().returns(
      'https://app.example.com/callback'
    ),
    initiateOAuth: Sinon.stub().resolves('https://facebook.example.com/oauth'),
    disconnect: Sinon.stub().resolves(true),
    getStatus: Sinon.stub().resolves({ connected: true }),
  };
  const url = { requestOrigin: 'https://app.example.com' };
  const resolver = new FacebookOAuthResolver(
    service as any,
    url as any,
    guard.ac
  );

  await resolver.connectFacebook(USER, WORKSPACE_ID);

  assertPermission(t, guard, 'Workspace.Settings.Update');
  t.true(guard.assert.calledBefore(service.initiateOAuth));
});

test('connection resolver authz > given Facebook OAuth read query > then asserts Workspace.Read', async t => {
  const guard = makeAccessController();
  const service = {
    resolveRedirectUri: Sinon.stub().returns(
      'https://app.example.com/callback'
    ),
    initiateOAuth: Sinon.stub().resolves('https://facebook.example.com/oauth'),
    disconnect: Sinon.stub().resolves(true),
    getStatus: Sinon.stub().resolves({ connected: true }),
  };
  const url = { requestOrigin: 'https://app.example.com' };
  const resolver = new FacebookOAuthResolver(
    service as any,
    url as any,
    guard.ac
  );

  await resolver.facebookConnection(USER, WORKSPACE_ID);

  assertPermission(t, guard, 'Workspace.Read');
  t.true(guard.assert.calledBefore(service.getStatus));
});

test('connection resolver authz > given paid content recommendation mutation > then asserts Workspace.Settings.Update', async t => {
  const guard = makeAccessController();
  const strategist = {
    generateContentRecommendation: Sinon.stub().resolves({
      id: 'insight-1',
      workspaceId: WORKSPACE_ID,
      insightType: 'CONTENT_RECOMMENDATION',
      platforms: ['GOGOCASH'],
      title: 'Recommendation',
      body: 'Post more winner content.',
      severity: 'INFO',
      modelUsed: 'gemini-2.5-flash',
      costUsd: 0.05,
      createdAt: new Date('2026-06-01T00:00:00Z'),
      acknowledgedAt: null,
    }),
  };
  const resolver = new AnalyticsResolver(
    {} as any,
    guard.ac,
    strategist as any,
    {} as any
  );

  await resolver.runContentRecommendation(USER, {
    workspaceId: WORKSPACE_ID,
    platform: SocialPlatform.GOGOCASH,
    tone: 'concise',
  });

  assertPermission(t, guard, 'Workspace.Settings.Update');
  t.true(guard.assert.calledBefore(strategist.generateContentRecommendation));
});
