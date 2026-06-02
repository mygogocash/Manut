import { ConnectionStatus, SocialPlatform } from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';

import { ConnectionService } from '../connection.service';

function signedState(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );
  return `${encoded},signature`;
}

test('completeOAuth stores LINE Messaging API channel credentials after validating LINE Login code', async t => {
  const upsert = Sinon.stub().callsFake(async args => ({
    id: 'connection-1',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
    ...args.create,
  }));
  const encrypt = Sinon.stub().callsFake(async (plaintext: string) => {
    return `enc:${plaintext}`;
  });
  const exchangeCode = Sinon.stub().resolves({
    accessToken: 'line-login-user-token',
    scopes: ['profile', 'openid'],
    externalAccountId: 'line-user-id',
    externalAccountName: 'LINE User',
  });
  const getMessagingChannelConnection = Sinon.stub().returns({
    accessToken: 'line-channel-token',
    scopes: ['messaging-api'],
    externalAccountId: 'line-channel-id',
    externalAccountName: 'LINE Messaging API Channel',
  });
  const service = new ConnectionService(
    { socialConnection: { upsert } } as never,
    { encrypt } as never,
    { verify: () => true } as never,
    { baseUrl: 'https://manut.example' } as never,
    {} as never,
    {} as never,
    { exchangeCode, getMessagingChannelConnection } as never,
    {} as never
  );
  const state = signedState({
    v: 1,
    workspaceId: 'workspace-1',
    userId: 'user-1',
    platform: SocialPlatform.LINE_VOOM,
    nonce: 'nonce-1',
    expiresAt: Date.now() + 60_000,
  });

  const result = await service.completeOAuth(state, 'line-login-code');

  t.true(
    exchangeCode.calledOnceWithExactly(
      'line-login-code',
      'https://manut.example/api/integrations/oauth/callback/line'
    )
  );
  t.true(exchangeCode.calledBefore(getMessagingChannelConnection));
  t.true(getMessagingChannelConnection.calledOnce);
  t.true(encrypt.calledOnceWithExactly('line-channel-token'));
  t.is(
    upsert.firstCall.firstArg.create.accessTokenEnc,
    'enc:line-channel-token'
  );
  t.is(upsert.firstCall.firstArg.create.refreshTokenEnc, null);
  t.deepEqual(upsert.firstCall.firstArg.create.scopes, ['messaging-api']);
  t.is(upsert.firstCall.firstArg.create.externalAccountId, 'line-channel-id');
  t.is(
    upsert.firstCall.firstArg.create.externalAccountName,
    'LINE Messaging API Channel'
  );
  t.is(upsert.firstCall.firstArg.create.status, ConnectionStatus.ACTIVE);
  t.is(upsert.firstCall.firstArg.create.expiresAt, null);
  t.is(result.kind, 'completed');
  if (result.kind !== 'completed') return;
  t.is(result.connection.externalAccountId, 'line-channel-id');
  t.is(result.connection.accessTokenEnc, 'enc:line-channel-token');
});
