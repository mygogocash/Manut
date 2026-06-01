import { SocialPlatform } from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';

import { FacebookOAuthService } from '../../../facebook-oauth/facebook-oauth.service';
import { FACEBOOK_PROVIDER_NAME } from '../../../facebook-oauth/types';
import { InstagramOAuthService } from '../../../instagram-oauth/instagram-oauth.service';
import { INSTAGRAM_PROVIDER_NAME } from '../../../instagram-oauth/types';
import { LineVoomOAuthService } from '../../../line-voom-oauth/line-voom-oauth.service';
import { LINE_VOOM_PROVIDER_NAME } from '../../../line-voom-oauth/types';
import { ThreadsOAuthService } from '../../../threads-oauth/threads-oauth.service';
import { THREADS_PROVIDER_NAME } from '../../../threads-oauth/types';
import { TiktokOAuthService } from '../../../tiktok-oauth/tiktok-oauth.service';
import { TIKTOK_PROVIDER_NAME } from '../../../tiktok-oauth/types';

function createHarness() {
  const integrationConnection = {
    upsert: Sinon.stub().resolves({ id: 'integration-1' }),
    getByProvider: Sinon.stub(),
    delete: Sinon.stub(),
    decryptTokens: Sinon.stub(),
  };
  const models = { integrationConnection };
  const cache = {
    get: Sinon.stub().resolves({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      redirectUri: 'https://manut.test/oauth/callback',
      nonce: 'nonce-1',
    }),
    delete: Sinon.stub().resolves(undefined),
    set: Sinon.stub(),
  };
  const socialBridge = {
    upsertFromIntegration: Sinon.stub().resolves({ id: 'social-1' }),
    pauseFromIntegration: Sinon.stub(),
    getHealthForIntegration: Sinon.stub(),
  };

  return { models, integrationConnection, cache, socialBridge };
}

test('Facebook callback keeps IntegrationConnection and mirrors SocialConnection', async t => {
  const { models, integrationConnection, cache, socialBridge } =
    createHarness();
  const service = new FacebookOAuthService(
    models as never,
    cache as never,
    socialBridge as never
  );
  const serviceInternals = service as unknown as {
    exchangeCode: () => unknown;
    fetchUserInfo: () => unknown;
  };
  Sinon.stub(service, 'isConfigured').returns(true);
  Sinon.stub(serviceInternals, 'exchangeCode').resolves({
    access_token: 'fb-access',
    token_type: 'bearer',
    expires_in: 3600,
  });
  Sinon.stub(serviceInternals, 'fetchUserInfo').resolves({
    id: 'fb-123',
    name: 'Facebook User',
    email: 'fb@example.test',
  });

  await service.handleCallback('code-1', 'state-1');

  t.true(integrationConnection.upsert.calledOnce);
  t.like(integrationConnection.upsert.firstCall.firstArg, {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    provider: FACEBOOK_PROVIDER_NAME,
    externalId: 'fb-123',
    displayName: 'Facebook User',
    accessToken: 'fb-access',
  });
  t.true(socialBridge.upsertFromIntegration.calledOnce);
  t.like(socialBridge.upsertFromIntegration.firstCall.firstArg, {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    platform: SocialPlatform.FACEBOOK,
    externalAccountId: 'fb-123',
    externalAccountName: 'Facebook User',
    accessToken: 'fb-access',
  });
});

test('TikTok callback keeps IntegrationConnection and mirrors SocialConnection', async t => {
  const { models, integrationConnection, cache, socialBridge } =
    createHarness();
  const service = new TiktokOAuthService(
    models as never,
    cache as never,
    socialBridge as never
  );
  const serviceInternals = service as unknown as {
    exchangeCode: () => unknown;
    fetchUserInfo: () => unknown;
  };
  Sinon.stub(service, 'isConfigured').returns(true);
  Sinon.stub(serviceInternals, 'exchangeCode').resolves({
    access_token: 'tt-access',
    refresh_token: 'tt-refresh',
    expires_in: 86_400,
    refresh_expires_in: 31_536_000,
    open_id: 'tt-open-id',
    scope: 'user.info.basic,video.list',
    token_type: 'Bearer',
  });
  Sinon.stub(serviceInternals, 'fetchUserInfo').resolves({
    data: {
      user: {
        open_id: 'tt-open-id',
        display_name: 'TikTok User',
        username: 'tiktok_user',
      },
    },
    error: { code: 'ok' },
  });

  await service.handleCallback('code-1', 'state-1');

  t.true(integrationConnection.upsert.calledOnce);
  t.like(integrationConnection.upsert.firstCall.firstArg, {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    provider: TIKTOK_PROVIDER_NAME,
    externalId: 'tt-open-id',
    displayName: 'TikTok User',
    accessToken: 'tt-access',
    refreshToken: 'tt-refresh',
  });
  t.true(socialBridge.upsertFromIntegration.calledOnce);
  t.like(socialBridge.upsertFromIntegration.firstCall.firstArg, {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    platform: SocialPlatform.TIKTOK,
    externalAccountId: 'tt-open-id',
    externalAccountName: 'TikTok User',
    accessToken: 'tt-access',
    refreshToken: 'tt-refresh',
  });
});

test('Instagram callback keeps IntegrationConnection and mirrors SocialConnection', async t => {
  const { models, integrationConnection, cache, socialBridge } =
    createHarness();
  const service = new InstagramOAuthService(
    models as never,
    cache as never,
    socialBridge as never
  );
  const serviceInternals = service as unknown as {
    exchangeCode: () => unknown;
    fetchUserInfo: () => unknown;
  };
  Sinon.stub(service, 'isConfigured').returns(true);
  Sinon.stub(serviceInternals, 'exchangeCode').resolves({
    access_token: 'ig-access',
    user_id: 123,
  });
  Sinon.stub(serviceInternals, 'fetchUserInfo').resolves({
    id: 'ig-user-id',
    username: 'instagram_user',
  });

  await service.handleCallback('code-1', 'state-1');

  t.true(integrationConnection.upsert.calledOnce);
  t.like(integrationConnection.upsert.firstCall.firstArg, {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    provider: INSTAGRAM_PROVIDER_NAME,
    externalId: 'ig-user-id',
    displayName: 'instagram_user',
    accessToken: 'ig-access',
  });
  t.true(socialBridge.upsertFromIntegration.calledOnce);
  t.like(socialBridge.upsertFromIntegration.firstCall.firstArg, {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    platform: SocialPlatform.INSTAGRAM,
    externalAccountId: 'ig-user-id',
    externalAccountName: 'instagram_user',
    accessToken: 'ig-access',
  });
});

test('Threads callback keeps IntegrationConnection and mirrors SocialConnection', async t => {
  const { models, integrationConnection, cache, socialBridge } =
    createHarness();
  const service = new ThreadsOAuthService(
    models as never,
    cache as never,
    socialBridge as never
  );
  const serviceInternals = service as unknown as {
    exchangeCode: () => unknown;
    fetchUserInfo: () => unknown;
  };
  Sinon.stub(service, 'isConfigured').returns(true);
  Sinon.stub(serviceInternals, 'exchangeCode').resolves({
    access_token: 'threads-access',
    user_id: 456,
  });
  Sinon.stub(serviceInternals, 'fetchUserInfo').resolves({
    id: 'threads-user-id',
    username: 'threads_user',
  });

  await service.handleCallback('code-1', 'state-1');

  t.true(integrationConnection.upsert.calledOnce);
  t.like(integrationConnection.upsert.firstCall.firstArg, {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    provider: THREADS_PROVIDER_NAME,
    externalId: 'threads-user-id',
    displayName: 'threads_user',
    accessToken: 'threads-access',
  });
  t.true(socialBridge.upsertFromIntegration.calledOnce);
  t.like(socialBridge.upsertFromIntegration.firstCall.firstArg, {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    platform: SocialPlatform.THREADS,
    externalAccountId: 'threads-user-id',
    externalAccountName: 'threads_user',
    accessToken: 'threads-access',
  });
});

test('LINE VOOM callback keeps IntegrationConnection and mirrors SocialConnection', async t => {
  const { models, integrationConnection, cache, socialBridge } =
    createHarness();
  const service = new LineVoomOAuthService(
    models as never,
    cache as never,
    socialBridge as never
  );
  const serviceInternals = service as unknown as {
    exchangeCode: () => unknown;
    fetchProfile: () => unknown;
  };
  Sinon.stub(service, 'isConfigured').returns(true);
  Sinon.stub(serviceInternals, 'exchangeCode').resolves({
    access_token: 'line-access',
    refresh_token: 'line-refresh',
    expires_in: 2_592_000,
    scope: 'profile openid',
    token_type: 'Bearer',
  });
  Sinon.stub(serviceInternals, 'fetchProfile').resolves({
    userId: 'line-user-id',
    displayName: 'LINE User',
  });

  await service.handleCallback('code-1', 'state-1');

  t.true(integrationConnection.upsert.calledOnce);
  t.like(integrationConnection.upsert.firstCall.firstArg, {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    provider: LINE_VOOM_PROVIDER_NAME,
    externalId: 'line-user-id',
    displayName: 'LINE User',
    accessToken: 'line-access',
    refreshToken: 'line-refresh',
  });
  t.true(socialBridge.upsertFromIntegration.calledOnce);
  t.like(socialBridge.upsertFromIntegration.firstCall.firstArg, {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    platform: SocialPlatform.LINE_VOOM,
    externalAccountId: 'line-user-id',
    externalAccountName: 'LINE User',
    accessToken: 'line-access',
    refreshToken: 'line-refresh',
  });
});
