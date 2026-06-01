import test from 'ava';
import Sinon from 'sinon';

import { LineOAuthService } from '../analytics/connections/oauth/line.oauth.js';
import { LineVoomOAuthService } from '../line-voom-oauth/line-voom-oauth.service.js';
import { jsonForInlineScript } from '../oauth-callback-script.js';

test('jsonForInlineScript escapes script-breaking payloads without changing parsed JSON', t => {
  const dangerous =
    '</script><img src=x onerror=alert(1)>&' +
    String.fromCharCode(0x2028) +
    String.fromCharCode(0x2029);

  const encoded = jsonForInlineScript({ dangerous });

  t.false(encoded.includes('</script>'));
  t.false(encoded.includes('<'));
  t.false(encoded.includes('>'));
  t.false(encoded.includes('&'));
  t.false(encoded.includes(String.fromCharCode(0x2028)));
  t.false(encoded.includes(String.fromCharCode(0x2029)));
  t.true(encoded.includes('\\u003c/script\\u003e'));
  t.deepEqual(JSON.parse(encoded), { dangerous });
});

test('LINE analytics OAuth errors omit raw provider response bodies', async t => {
  const fetchStub = Sinon.stub(globalThis, 'fetch').resolves(
    new Response('super-secret-line-body refresh_token=abc', {
      status: 400,
      statusText: 'Bad Request',
    })
  );
  const service = new LineOAuthService({
    analytics: {
      line: {
        channelId: 'line-channel',
        channelSecret: 'line-secret',
      },
    },
  } as any);

  try {
    const error = await t.throwsAsync(() =>
      service.exchangeCode('code-1', 'https://app.example.com/callback')
    );

    t.truthy(error);
    t.regex(error!.message, /LINE OAuth request .* failed: 400 Bad Request/);
    t.false(error!.message.includes('super-secret-line-body'));
    t.false(error!.message.includes('refresh_token=abc'));
  } finally {
    fetchStub.restore();
  }
});

test('LINE VOOM OAuth errors omit raw provider response bodies', async t => {
  const fetchStub = Sinon.stub(globalThis, 'fetch').resolves(
    new Response('super-secret-line-voom-body access_token=abc', {
      status: 400,
      statusText: 'Bad Request',
    })
  );
  const cache = {
    get: Sinon.stub().resolves({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      redirectUri: 'https://app.example.com/oauth/line-voom/callback',
      nonce: 'nonce-1',
    }),
    delete: Sinon.stub().resolves(true),
  };
  const models = {
    integrationConnection: {
      upsert: Sinon.stub().resolves(),
    },
  };
  const socialBridge = {
    upsertFromIntegration: Sinon.stub().resolves(),
  };
  const service = new LineVoomOAuthService(
    models as any,
    cache as any,
    socialBridge as any
  );
  Sinon.stub(service, 'isConfigured').returns(true);

  try {
    const error = await t.throwsAsync(() =>
      service.handleCallback('code-1', 'state-1')
    );

    t.truthy(error);
    t.regex(error!.message, /LINE VOOM token exchange failed: 400 Bad Request/);
    t.false(error!.message.includes('super-secret-line-voom-body'));
    t.false(error!.message.includes('access_token=abc'));
  } finally {
    fetchStub.restore();
  }
});
