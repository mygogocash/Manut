import test from 'ava';

import type { CurrentUser } from '../../core/auth/session';
import { MongoIngestionConfigResolver } from '../../plugins/mongodb-connection/ingestion-config.resolver';
import { MongoDbDriverMissingError } from '../../plugins/mongodb-connection/schema-explorer.service';

const user: CurrentUser = {
  id: 'user-1',
  email: 'user@example.com',
  avatarUrl: null,
  name: 'Test User',
  disabled: false,
  completedOnboarding: true,
  hasPassword: true,
  emailVerified: true,
};
const workspaceId = 'workspace-1';

function createAccessController() {
  return {
    user: () => ({
      workspace: () => ({
        assert: async () => {},
      }),
    }),
  };
}

function createResolver() {
  const explorer = {
    listCollections: async () => {
      throw new MongoDbDriverMissingError();
    },
    sampleDocs: async () => {
      throw new MongoDbDriverMissingError();
    },
  };
  const configs = {
    list: async () => [
      {
        id: 'config-1',
        workspaceId,
        collectionName: 'orders',
        enabled: true,
        cursorField: 'updatedAt',
        consecutiveFailures: 2,
        createdAt: new Date('2026-05-25T00:00:00Z'),
        updatedAt: new Date('2026-05-25T01:00:00Z'),
        lastError: 'previous connection error',
        lastErrorAt: new Date('2026-05-25T02:00:00Z'),
      },
    ],
  };

  return new MongoIngestionConfigResolver(
    explorer as never,
    configs as never,
    createAccessController() as never
  );
}

test('Mongo ingestion config > given missing driver > then list returns saved configs instead of throwing', async t => {
  const resolver = createResolver();

  const result = await resolver.listMongoCollections(user, workspaceId);

  t.deepEqual(result, [
    {
      name: 'orders',
      estimatedCount: undefined,
      enabled: true,
      cursorField: 'updatedAt',
      lastSyncedAt: undefined,
      consecutiveFailures: 2,
      lastError: 'previous connection error',
      lastErrorAt: new Date('2026-05-25T02:00:00Z'),
    },
  ]);
});

test('Mongo ingestion config > given missing driver > then sample returns empty documents instead of throwing', async t => {
  const resolver = createResolver();

  const result = await resolver.sampleMongoCollection(
    user,
    workspaceId,
    'orders',
    5
  );

  t.deepEqual(result, {
    collectionName: 'orders',
    documents: [],
  });
});
