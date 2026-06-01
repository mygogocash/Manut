import {
  ConnectionStatus as PrismaConnectionStatus,
  SocialPlatform,
} from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';

import {
  LEGACY_SOCIAL_TOKEN_PREFIX,
  SocialConnectionBridgeService,
} from '../social-connection-bridge';
import { TokenStore } from '../token-store';

const crypto = {
  encrypt: (value: string) => `encrypted(${value})`,
  decrypt: (value: string) => value.replace(/^encrypted\((.*)\)$/, '$1'),
};

function createBridgeHarness() {
  const socialConnection = {
    upsert: Sinon.stub(),
    updateMany: Sinon.stub(),
    findFirst: Sinon.stub(),
  };
  const bridge = new SocialConnectionBridgeService(
    { socialConnection } as never,
    crypto as never
  );
  return { bridge, socialConnection };
}

test('upsertFromIntegration mirrors OAuth credentials into SocialConnection', async t => {
  const { bridge, socialConnection } = createBridgeHarness();
  socialConnection.upsert.resolves({ id: 'social-1' });
  const expiresAt = new Date('2026-07-01T00:00:00Z');

  await bridge.upsertFromIntegration({
    userId: 'user-1',
    workspaceId: 'workspace-1',
    platform: SocialPlatform.TIKTOK,
    externalAccountId: 'open-123',
    externalAccountName: 'Tik User',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt,
    scopes: ['user.info.basic', 'video.list'],
  });

  t.true(socialConnection.upsert.calledOnce);
  const args = socialConnection.upsert.firstCall.firstArg;
  t.deepEqual(args.where.workspaceId_platform_externalAccountId, {
    workspaceId: 'workspace-1',
    platform: SocialPlatform.TIKTOK,
    externalAccountId: 'open-123',
  });
  t.like(args.create, {
    workspaceId: 'workspace-1',
    platform: SocialPlatform.TIKTOK,
    status: PrismaConnectionStatus.ACTIVE,
    externalAccountId: 'open-123',
    externalAccountName: 'Tik User',
    connectedByUserId: 'user-1',
    expiresAt,
  });
  t.deepEqual(args.create.scopes, ['user.info.basic', 'video.list']);
  t.is(
    args.create.accessTokenEnc,
    `${LEGACY_SOCIAL_TOKEN_PREFIX}encrypted(access-token)`
  );
  t.is(
    args.create.refreshTokenEnc,
    `${LEGACY_SOCIAL_TOKEN_PREFIX}encrypted(refresh-token)`
  );
  t.is(args.update.status, PrismaConnectionStatus.ACTIVE);
  t.is(args.update.lastError, null);
  t.is(args.update.lastErrorAt, null);
});

test('getHealthForIntegration distinguishes saved, verified, expired, and error states', async t => {
  const { bridge, socialConnection } = createBridgeHarness();

  socialConnection.findFirst.resolves(null);
  t.deepEqual(
    await bridge.getHealthForIntegration({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      platform: SocialPlatform.FACEBOOK,
      externalAccountId: 'fb-1',
    }),
    { verified: false, healthStatus: 'saved' }
  );

  socialConnection.findFirst.resolves({
    status: PrismaConnectionStatus.ACTIVE,
  });
  t.deepEqual(
    await bridge.getHealthForIntegration({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      platform: SocialPlatform.FACEBOOK,
      externalAccountId: 'fb-1',
    }),
    { verified: true, healthStatus: 'verified' }
  );

  socialConnection.findFirst.resolves({
    status: PrismaConnectionStatus.EXPIRED,
  });
  t.deepEqual(
    await bridge.getHealthForIntegration({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      platform: SocialPlatform.FACEBOOK,
      externalAccountId: 'fb-1',
    }),
    { verified: false, healthStatus: 'expired' }
  );

  socialConnection.findFirst.resolves({ status: PrismaConnectionStatus.ERROR });
  t.deepEqual(
    await bridge.getHealthForIntegration({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      platform: SocialPlatform.FACEBOOK,
      externalAccountId: 'fb-1',
    }),
    { verified: false, healthStatus: 'error' }
  );
});

test('pauseFromIntegration soft-disconnects mirrored SocialConnection rows', async t => {
  const { bridge, socialConnection } = createBridgeHarness();
  socialConnection.updateMany.resolves({ count: 2 });

  const count = await bridge.pauseFromIntegration({
    userId: 'user-1',
    workspaceId: 'workspace-1',
    platform: SocialPlatform.LINE_VOOM,
  });

  t.is(count, 2);
  t.true(socialConnection.updateMany.calledOnce);
  t.deepEqual(socialConnection.updateMany.firstCall.firstArg, {
    where: {
      workspaceId: 'workspace-1',
      platform: SocialPlatform.LINE_VOOM,
      connectedByUserId: 'user-1',
      status: { not: PrismaConnectionStatus.PAUSED },
    },
    data: { status: PrismaConnectionStatus.PAUSED },
  });
});

test('TokenStore decrypts legacy bridge ciphertext without requiring KMS', async t => {
  const auditCreate = Sinon.stub().resolves({});
  const tokenStore = new TokenStore(
    {} as never,
    { socialAuditLog: { create: auditCreate } } as never,
    crypto as never
  );
  const encrypted = `${LEGACY_SOCIAL_TOKEN_PREFIX}encrypted(legacy-token)`;

  const decrypted = await tokenStore.decryptWithAudit(encrypted, {
    workspaceId: 'workspace-test',
    userId: 'user-test',
    platform: SocialPlatform.FACEBOOK,
    reason: 'unit-test',
  });

  t.is(decrypted, 'legacy-token');
  t.true(auditCreate.calledOnce);
});
