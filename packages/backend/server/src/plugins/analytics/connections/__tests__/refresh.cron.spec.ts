import type { SocialConnection } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';

import { createModule } from '../../../../__tests__/create-module';
import { Mockers } from '../../../../__tests__/mocks';
import { LineOAuthService } from '../oauth/line.oauth';
import { MetaOAuthService } from '../oauth/meta.oauth';
import { TikTokOAuthService } from '../oauth/tiktok.oauth';
import { TokenRefreshCron } from '../refresh.cron';
import { TokenStore } from '../token-store';

const metaRefreshStub = Sinon.stub();
const lineRefreshStub = Sinon.stub();
const tiktokRefreshStub = Sinon.stub();
const encryptStub = Sinon.stub();
const decryptStub = Sinon.stub();

const module = await createModule({
  providers: [
    TokenRefreshCron,
    {
      provide: TokenStore,
      useValue: {
        encrypt: encryptStub,
        decrypt: decryptStub,
        decryptWithAudit: decryptStub,
      },
    },
    {
      provide: MetaOAuthService,
      useValue: { refreshToken: metaRefreshStub },
    },
    {
      provide: LineOAuthService,
      useValue: { refreshToken: lineRefreshStub },
    },
    {
      provide: TikTokOAuthService,
      useValue: { refreshToken: tiktokRefreshStub },
    },
  ],
});

const cron = module.get(TokenRefreshCron);
const db = module.get(PrismaClient);

let userId: string;
let workspaceId: string;

test.beforeEach(async () => {
  metaRefreshStub.reset();
  lineRefreshStub.reset();
  tiktokRefreshStub.reset();
  encryptStub.reset();
  decryptStub.reset();

  decryptStub.resolves('decrypted-token');
  encryptStub.callsFake(async (plain: string) => `enc(${plain})`);

  const user = await module.create(Mockers.User);
  userId = user.id;
  const workspace = await module.create(Mockers.Workspace);
  workspaceId = workspace.id;
});

test.afterEach.always(async () => {
  if (workspaceId) {
    await db.socialAuditLog.deleteMany({ where: { workspaceId } });
    await db.socialConnection.deleteMany({ where: { workspaceId } });
  }
});

test.after.always(async () => {
  await module.close();
});

interface SeedArgs {
  expiresAt: Date | null;
  status?: 'ACTIVE' | 'EXPIRED';
  platform?: 'FACEBOOK' | 'TIKTOK' | 'LINE_VOOM';
  refreshTokenEnc?: string | null;
}

async function seed(args: SeedArgs): Promise<SocialConnection> {
  return await db.socialConnection.create({
    data: {
      workspaceId,
      platform: args.platform ?? 'FACEBOOK',
      status: args.status ?? 'ACTIVE',
      accessTokenEnc: 'enc-access-original',
      refreshTokenEnc:
        args.refreshTokenEnc === undefined
          ? 'enc-refresh-original'
          : args.refreshTokenEnc,
      scopes: ['scope-original'],
      externalAccountId: `acc-${Math.random().toString(36).slice(2, 10)}`,
      externalAccountName: 'Test Account',
      connectedByUserId: userId,
      expiresAt: args.expiresAt,
    },
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

test('refreshes only ACTIVE connections within the 7-day window', async t => {
  const now = new Date('2026-05-04T12:00:00Z');

  const safe = await seed({
    expiresAt: new Date(now.getTime() + 30 * DAY_MS),
  });
  const expiring = await seed({
    expiresAt: new Date(now.getTime() + 3 * DAY_MS),
  });
  const expired = await seed({
    expiresAt: new Date(now.getTime() - 1 * DAY_MS),
    status: 'EXPIRED',
  });

  const newExpiry = new Date(now.getTime() + 60 * DAY_MS);
  metaRefreshStub.resolves({
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    scopes: ['new-scope'],
    expiresAt: newExpiry,
    externalAccountId: '',
    externalAccountName: '',
  });

  await cron.runOnce(now);

  t.is(metaRefreshStub.callCount, 1, 'only the expiring row should refresh');

  const safeAfter = await db.socialConnection.findUniqueOrThrow({
    where: { id: safe.id },
  });
  t.is(safeAfter.accessTokenEnc, 'enc-access-original');
  t.is(safeAfter.refreshTokenEnc, 'enc-refresh-original');
  t.deepEqual(safeAfter.scopes, ['scope-original']);
  t.is(safeAfter.expiresAt?.getTime(), safe.expiresAt?.getTime());

  const expiringAfter = await db.socialConnection.findUniqueOrThrow({
    where: { id: expiring.id },
  });
  t.is(expiringAfter.accessTokenEnc, 'enc(new-access-token)');
  t.is(expiringAfter.refreshTokenEnc, 'enc(new-refresh-token)');
  t.deepEqual(expiringAfter.scopes, ['new-scope']);
  t.is(expiringAfter.status, 'ACTIVE');
  t.is(expiringAfter.expiresAt?.getTime(), newExpiry.getTime());
  t.is(expiringAfter.lastError, null);
  t.is(expiringAfter.lastErrorAt, null);

  const expiredAfter = await db.socialConnection.findUniqueOrThrow({
    where: { id: expired.id },
  });
  t.is(expiredAfter.accessTokenEnc, 'enc-access-original');
  t.is(expiredAfter.status, 'EXPIRED');

  const audits = await db.socialAuditLog.findMany({
    where: { workspaceId, action: 'TOKEN_REFRESH' },
  });
  t.is(audits.length, 1);
});

test('marks EXPIRED + writes TOKEN_REFRESH_FAILED audit when refresh throws', async t => {
  const now = new Date('2026-05-04T12:00:00Z');
  const conn = await seed({
    expiresAt: new Date(now.getTime() + 2 * DAY_MS),
  });

  metaRefreshStub.rejects(new Error('Meta API 400: token revoked'));

  await cron.runOnce(now);

  const after = await db.socialConnection.findUniqueOrThrow({
    where: { id: conn.id },
  });
  t.is(after.status, 'EXPIRED');
  t.regex(after.lastError ?? '', /token revoked/);
  t.truthy(after.lastErrorAt);

  const audits = await db.socialAuditLog.findMany({
    where: { workspaceId, action: 'TOKEN_REFRESH_FAILED' },
  });
  t.is(audits.length, 1);
});

test('routes Meta connections to MetaOAuthService.refreshToken with the access-token ciphertext', async t => {
  const now = new Date('2026-05-04T12:00:00Z');
  await seed({
    expiresAt: new Date(now.getTime() + 2 * DAY_MS),
    platform: 'FACEBOOK',
  });

  metaRefreshStub.resolves({
    accessToken: 'meta-new',
    scopes: [],
    expiresAt: new Date(now.getTime() + 60 * DAY_MS),
    externalAccountId: '',
    externalAccountName: '',
  });

  await cron.runOnce(now);

  t.is(metaRefreshStub.callCount, 1);
  t.is(lineRefreshStub.callCount, 0);
  t.is(tiktokRefreshStub.callCount, 0);
  // Meta uses fb_exchange_token — the input is the long-lived access token.
  // Confirm the cron decrypted the access-token ciphertext, not refresh.
  t.is(decryptStub.firstCall.firstArg, 'enc-access-original');
});

test('routes TikTok connections to TikTokOAuthService.refreshToken with the refresh-token ciphertext', async t => {
  const now = new Date('2026-05-04T12:00:00Z');
  await seed({
    expiresAt: new Date(now.getTime() + 2 * DAY_MS),
    platform: 'TIKTOK',
    refreshTokenEnc: 'enc-refresh-tiktok',
  });

  tiktokRefreshStub.resolves({
    accessToken: 'tiktok-new',
    refreshToken: 'tiktok-new-refresh',
    scopes: [],
    expiresAt: new Date(now.getTime() + 60 * DAY_MS),
    externalAccountId: 'tt-1',
    externalAccountName: 'tt-1',
  });

  await cron.runOnce(now);

  t.is(tiktokRefreshStub.callCount, 1);
  t.is(metaRefreshStub.callCount, 0);
  t.is(decryptStub.firstCall.firstArg, 'enc-refresh-tiktok');
});

test('skips TikTok/LINE rows that have no stored refresh token', async t => {
  const now = new Date('2026-05-04T12:00:00Z');
  const conn = await seed({
    expiresAt: new Date(now.getTime() + 2 * DAY_MS),
    platform: 'TIKTOK',
    refreshTokenEnc: null,
  });

  await cron.runOnce(now);

  t.is(tiktokRefreshStub.callCount, 0);
  const after = await db.socialConnection.findUniqueOrThrow({
    where: { id: conn.id },
  });
  // We never tried to refresh, so the row stays ACTIVE — not EXPIRED.
  t.is(after.status, 'ACTIVE');
});

test('skips connections with NULL expiresAt (cannot decide when to refresh)', async t => {
  const now = new Date('2026-05-04T12:00:00Z');
  const conn = await seed({ expiresAt: null });

  await cron.runOnce(now);

  t.is(metaRefreshStub.callCount, 0);
  const after = await db.socialConnection.findUniqueOrThrow({
    where: { id: conn.id },
  });
  t.is(after.accessTokenEnc, 'enc-access-original');
});

test('one bad row does not block others in the same run', async t => {
  const now = new Date('2026-05-04T12:00:00Z');
  const a = await seed({ expiresAt: new Date(now.getTime() + 2 * DAY_MS) });
  const b = await seed({ expiresAt: new Date(now.getTime() + 4 * DAY_MS) });

  metaRefreshStub.onFirstCall().rejects(new Error('first call fails'));
  metaRefreshStub.onSecondCall().resolves({
    accessToken: 'second-call-ok',
    refreshToken: 'second-refresh-ok',
    scopes: [],
    expiresAt: new Date(now.getTime() + 60 * DAY_MS),
    externalAccountId: '',
    externalAccountName: '',
  });

  await cron.runOnce(now);

  t.is(metaRefreshStub.callCount, 2);

  const aAfter = await db.socialConnection.findUniqueOrThrow({
    where: { id: a.id },
  });
  const bAfter = await db.socialConnection.findUniqueOrThrow({
    where: { id: b.id },
  });

  // Exactly one should be EXPIRED, exactly one should be ACTIVE with new
  // ciphertext. Order isn't guaranteed because the SELECT has no ORDER BY,
  // so check both possibilities.
  const [failed, refreshed] =
    aAfter.status === 'EXPIRED' ? [aAfter, bAfter] : [bAfter, aAfter];
  t.is(failed.status, 'EXPIRED');
  t.is(refreshed.status, 'ACTIVE');
  t.is(refreshed.accessTokenEnc, 'enc(second-call-ok)');
});
