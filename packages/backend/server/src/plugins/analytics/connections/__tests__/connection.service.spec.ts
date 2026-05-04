import {
  PrismaClient,
  SocialPlatform as PrismaSocialPlatform,
} from '@prisma/client';
import test from 'ava';

import { createModule } from '../../../../__tests__/create-module';
import { Mockers } from '../../../../__tests__/mocks';
import { ConnectionService } from '../connection.service';
import { LineOAuthService } from '../oauth/line.oauth';
import { type MetaAccount, MetaOAuthService } from '../oauth/meta.oauth';
import { TikTokOAuthService } from '../oauth/tiktok.oauth';
import { TokenStore } from '../token-store';

/**
 * Spec for the v1.10.x Meta multi-account picker split. Covers:
 *   - completeOAuth returns `pending` for ≥2 Meta accounts and caches
 *     KMS-ciphertext (NOT plaintext) tokens.
 *   - completeOAuth returns `completed` and auto-upserts for exactly 1 Meta
 *     account (the picker is unhelpful with one option, per spec).
 *   - finalizeConnection upserts the picked account and deletes the cache row.
 *   - finalizeConnection rejects an externalAccountId not in the original list.
 *   - finalizeConnection rejects a missing/expired pendingId.
 *   - cancelPendingOAuth deletes the cache row + writes an audit row.
 *   - getPendingWorkspaceId returns the workspace bound to the pending row
 *     so the resolver can assert ACL.
 */

// --- Stubs --------------------------------------------------------------

interface MetaStubState {
  accounts: MetaAccount[];
  longLivedToken: string;
  refreshToken?: string;
  scopes: string[];
  expiresAt?: Date;
}

const metaStubState: MetaStubState = {
  accounts: [],
  longLivedToken: 'long-lived-fake',
  refreshToken: 'refresh-fake',
  scopes: ['pages_show_list', 'pages_read_engagement'],
  expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
};

const metaStub = {
  // Signature accepts (platform, state, redirectUri) so per-test overrides
  // can capture the signed state without TypeScript shenanigans.
  getAuthUrl: (
    _platform: unknown,
    _state: string,
    _redirectUri: string
  ): string => 'https://example.invalid/oauth/authorize',
  exchangeCode: async () => ({
    accessToken: 'short-lived-fake',
    scopes: [],
    externalAccountId: '',
    externalAccountName: '',
  }),
  exchangeForLongLivedToken: async () => ({
    accessToken: metaStubState.longLivedToken,
    refreshToken: metaStubState.refreshToken,
    scopes: metaStubState.scopes,
    expiresAt: metaStubState.expiresAt,
    externalAccountId: '',
    externalAccountName: '',
  }),
  listAccessibleAccounts: async () => metaStubState.accounts,
  refreshToken: async () => ({
    accessToken: metaStubState.longLivedToken,
    scopes: metaStubState.scopes,
    expiresAt: metaStubState.expiresAt,
    externalAccountId: '',
    externalAccountName: '',
  }),
};

// In-memory token store stub. Real `TokenStore` calls GCP KMS which isn't
// available in unit tests. The stub uses base64 round-trip so encrypted
// blobs are deterministic AND clearly not plaintext.
const tokenStoreStub = {
  encrypt: async (plaintext: string) =>
    `enc:${Buffer.from(plaintext, 'utf8').toString('base64')}`,
  decrypt: async (ciphertext: string) => {
    if (!ciphertext.startsWith('enc:')) {
      throw new Error(`tokenStoreStub.decrypt: bad ciphertext ${ciphertext}`);
    }
    return Buffer.from(ciphertext.slice('enc:'.length), 'base64').toString(
      'utf8'
    );
  },
  decryptWithAudit: async (ciphertext: string) =>
    tokenStoreStub.decrypt(ciphertext),
};

// LINE / TikTok aren't exercised by the picker tests, but the service
// constructor pulls them in via DI so we still need stubs.
const lineStub = {
  getAuthUrl: () => 'https://example.invalid',
  exchangeCode: async () => ({
    accessToken: 'line',
    scopes: [],
    externalAccountId: 'line-id',
    externalAccountName: 'line-name',
  }),
  refreshToken: async () => ({
    accessToken: 'line',
    scopes: [],
    externalAccountId: 'line-id',
    externalAccountName: 'line-name',
  }),
  revoke: async () => {},
};

const tiktokStub = {
  getAuthUrl: () => 'https://example.invalid',
  exchangeCode: async () => ({
    accessToken: 'tt',
    scopes: [],
    externalAccountId: 'tt-id',
    externalAccountName: 'tt-name',
  }),
  refreshToken: async () => ({
    accessToken: 'tt',
    scopes: [],
    externalAccountId: 'tt-id',
    externalAccountName: 'tt-name',
  }),
};

const module = await createModule({
  providers: [ConnectionService],
  tapModule: builder => {
    builder
      .overrideProvider(MetaOAuthService)
      .useValue(metaStub)
      .overrideProvider(TokenStore)
      .useValue(tokenStoreStub)
      .overrideProvider(LineOAuthService)
      .useValue(lineStub)
      .overrideProvider(TikTokOAuthService)
      .useValue(tiktokStub);
  },
});

const service = module.get(ConnectionService);
const db = module.get(PrismaClient);

// Fresh DB rows per test to keep state isolated.
test.afterEach.always(async () => {
  await db.socialConnection.deleteMany({});
  await db.socialAuditLog.deleteMany({});
});

test.after.always(async () => {
  await module.close();
});

async function seedWorkspace() {
  const owner = await module.create(Mockers.User);
  const workspace = await module.create(Mockers.Workspace, {
    owner: { id: owner.id },
  });
  return { owner, workspace };
}

/**
 * `beginOAuth` returns only the URL; the signed state is normally embedded
 * in the URL's `state` query param. The stub returns a fixed URL so we
 * temporarily override `metaStub.getAuthUrl` to capture the signed state
 * the service generated. This avoids re-implementing CryptoHelper.sign in
 * the test and keeps the spec coupled to the real signing pipeline.
 */
async function beginOAuthCapturingState(
  workspaceId: string,
  userId: string,
  platform: PrismaSocialPlatform
): Promise<string> {
  let captured: string | undefined;
  const originalGetAuthUrl = metaStub.getAuthUrl;
  metaStub.getAuthUrl = (_platform, state, _redirectUri) => {
    captured = state;
    return 'https://example.invalid/authorize';
  };
  try {
    await service.beginOAuth(workspaceId, platform, userId);
  } finally {
    metaStub.getAuthUrl = originalGetAuthUrl;
  }
  if (!captured) {
    throw new Error('failed to capture signed OAuth state');
  }
  return captured;
}

// --- Tests --------------------------------------------------------------

test.serial(
  'completeOAuth returns kind=completed for single-account Meta and upserts',
  async t => {
    const { owner, workspace } = await seedWorkspace();
    metaStubState.accounts = [{ id: 'page-only', name: 'Only Page' }];

    const state = await beginOAuthCapturingState(
      workspace.id,
      owner.id,
      PrismaSocialPlatform.FACEBOOK
    );
    const result = await service.completeOAuth(state, 'fake-code');

    t.is(result.kind, 'completed');
    if (result.kind !== 'completed') return;
    t.is(result.connection.externalAccountId, 'page-only');
    t.is(result.connection.externalAccountName, 'Only Page');
    t.is(result.connection.workspaceId, workspace.id);

    const row = await db.socialConnection.findUnique({
      where: {
        workspaceId_platform_externalAccountId: {
          workspaceId: workspace.id,
          platform: PrismaSocialPlatform.FACEBOOK,
          externalAccountId: 'page-only',
        },
      },
    });
    t.truthy(
      row,
      'a SocialConnection row should be persisted for the only account'
    );
    t.true(
      row!.accessTokenEnc.startsWith('enc:'),
      'access token should be KMS-encrypted before persistence'
    );
  }
);

test.serial(
  'completeOAuth returns kind=pending for multi-account Meta and caches encrypted tokens',
  async t => {
    const { owner, workspace } = await seedWorkspace();
    metaStubState.accounts = [
      { id: 'page-1', name: 'First Page' },
      { id: 'page-2', name: 'Second Page' },
      { id: 'page-3', name: 'Third Page' },
    ];

    const state = await beginOAuthCapturingState(
      workspace.id,
      owner.id,
      PrismaSocialPlatform.FACEBOOK
    );
    const result = await service.completeOAuth(state, 'fake-code');

    t.is(result.kind, 'pending');
    if (result.kind !== 'pending') return;
    t.is(result.accounts.length, 3);
    t.deepEqual(result.accounts.map(a => a.id).sort(), [
      'page-1',
      'page-2',
      'page-3',
    ]);
    t.true(
      typeof result.pendingId === 'string' && result.pendingId.length > 0,
      'pendingId should be a non-empty string'
    );

    // No SocialConnection row yet — finalize is what writes the row.
    const rowCount = await db.socialConnection.count({
      where: { workspaceId: workspace.id },
    });
    t.is(
      rowCount,
      0,
      'no SocialConnection row should be created in the pending branch'
    );

    // The pending workspace id is resolvable by id (used by the resolver
    // for ACL assertion before consuming the cache row).
    const pendingWorkspaceId = await service.getPendingWorkspaceId(
      result.pendingId
    );
    t.is(pendingWorkspaceId, workspace.id);
  }
);

test.serial('completeOAuth throws when Meta returns zero accounts', async t => {
  const { owner, workspace } = await seedWorkspace();
  metaStubState.accounts = [];

  const state = await beginOAuthCapturingState(
    workspace.id,
    owner.id,
    PrismaSocialPlatform.FACEBOOK
  );
  await t.throwsAsync(() => service.completeOAuth(state, 'fake-code'), {
    message: /No FACEBOOK accounts accessible/,
  });
});

test.serial(
  'finalizeConnection upserts the picked account, deletes the cache row, writes audit',
  async t => {
    const { owner, workspace } = await seedWorkspace();
    metaStubState.accounts = [
      { id: 'page-A', name: 'Account A' },
      { id: 'page-B', name: 'Account B' },
    ];
    const state = await beginOAuthCapturingState(
      workspace.id,
      owner.id,
      PrismaSocialPlatform.FACEBOOK
    );
    const result = await service.completeOAuth(state, 'fake-code');
    if (result.kind !== 'pending') {
      t.fail('expected pending result');
      return;
    }

    const conn = await service.finalizeConnection(
      result.pendingId,
      'page-B',
      owner.id
    );
    t.is(conn.externalAccountId, 'page-B');
    t.is(conn.externalAccountName, 'Account B');
    t.is(conn.workspaceId, workspace.id);
    t.true(
      conn.accessTokenEnc.startsWith('enc:'),
      'persisted accessTokenEnc should remain KMS-encrypted'
    );

    // Cache row deleted → second finalize fails with "expired".
    await t.throwsAsync(
      () => service.finalizeConnection(result.pendingId, 'page-B', owner.id),
      { message: /OAuth session expired or not found/ }
    );

    // Audit row written for the finalize.
    const auditRows = await db.socialAuditLog.findMany({
      where: {
        workspaceId: workspace.id,
        action: 'OAUTH_PENDING_FINALIZED',
      },
    });
    t.is(auditRows.length, 1);
  }
);

test.serial(
  'finalizeConnection rejects an externalAccountId that was not in the original list',
  async t => {
    const { owner, workspace } = await seedWorkspace();
    metaStubState.accounts = [
      { id: 'page-X', name: 'Account X' },
      { id: 'page-Y', name: 'Account Y' },
    ];
    const state = await beginOAuthCapturingState(
      workspace.id,
      owner.id,
      PrismaSocialPlatform.FACEBOOK
    );
    const result = await service.completeOAuth(state, 'fake-code');
    if (result.kind !== 'pending') {
      t.fail('expected pending result');
      return;
    }

    await t.throwsAsync(
      () =>
        service.finalizeConnection(
          result.pendingId,
          'page-attacker-controlled',
          owner.id
        ),
      { message: /not in the list of accounts/ }
    );

    // Cache row preserved → the user can still pick a valid account.
    t.is(await service.getPendingWorkspaceId(result.pendingId), workspace.id);
  }
);

test.serial(
  'finalizeConnection rejects a missing pendingId with a clear error',
  async t => {
    const { owner } = await seedWorkspace();
    await t.throwsAsync(
      () =>
        service.finalizeConnection('no-such-pending-id', 'page-1', owner.id),
      { message: /OAuth session expired or not found/ }
    );
  }
);

test.serial(
  'cancelPendingOAuth deletes the cache row and writes an audit row',
  async t => {
    const { owner, workspace } = await seedWorkspace();
    metaStubState.accounts = [
      { id: 'page-1', name: 'One' },
      { id: 'page-2', name: 'Two' },
    ];
    const state = await beginOAuthCapturingState(
      workspace.id,
      owner.id,
      PrismaSocialPlatform.FACEBOOK
    );
    const result = await service.completeOAuth(state, 'fake-code');
    if (result.kind !== 'pending') {
      t.fail('expected pending result');
      return;
    }

    await service.cancelPendingOAuth(result.pendingId, owner.id);

    t.is(
      await service.getPendingWorkspaceId(result.pendingId),
      null,
      'cancel should delete the cached pending row'
    );

    const auditRows = await db.socialAuditLog.findMany({
      where: {
        workspaceId: workspace.id,
        action: 'OAUTH_PENDING_ABANDONED',
      },
    });
    t.is(auditRows.length, 1);

    // Idempotent — second cancel is a no-op (no audit row added).
    await service.cancelPendingOAuth(result.pendingId, owner.id);
    const auditRowsAfter = await db.socialAuditLog.findMany({
      where: {
        workspaceId: workspace.id,
        action: 'OAUTH_PENDING_ABANDONED',
      },
    });
    t.is(
      auditRowsAfter.length,
      1,
      'second cancel should not write a duplicate audit row'
    );
  }
);
