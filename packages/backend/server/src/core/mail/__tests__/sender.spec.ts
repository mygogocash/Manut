import { mock } from 'node:test';

import test from 'ava';

import type { Config } from '../../../base';
import { MailSender } from '../sender';

function createResendSender() {
  return new MailSender({
    mailer: {
      SMTP: {
        name: '',
        host: '',
        port: 465,
        username: '',
        password: '',
        ignoreTLS: false,
        sender: '',
      },
      fallbackDomains: [],
      fallbackSMTP: {
        name: '',
        host: '',
        port: 465,
        username: '',
        password: '',
        ignoreTLS: false,
        sender: '',
      },
      provider: 'resend',
      resend: {
        apiKey: 're_test',
        from: 'Manut <noreply@gogocash.co>',
      },
    },
  } as unknown as Config);
}

test.afterEach.always(() => {
  mock.reset();
});

test('resend sender > given inline attachment > then serializes cid attachment payload', async t => {
  let payload: Record<string, unknown> | undefined;
  let authHeader: string | null | undefined;

  mock.method(
    globalThis,
    'fetch',
    async (_url: string | URL | Request, init?: RequestInit) => {
      authHeader = new Headers(init?.headers).get('Authorization');
      payload = JSON.parse(String(init?.body));

      return new Response(JSON.stringify({ id: 'email_test' }), {
        status: 200,
      });
    }
  );

  const result = await createResendSender().send('MemberInvitation', {
    to: 'member@example.com',
    subject: 'Workspace invitation',
    html: '<img src="cid:workspaceAvatar" />',
    attachments: [
      {
        filename: 'workspaceAvatar',
        content: 'YXZhdGFy',
        encoding: 'base64',
        cid: 'workspaceAvatar',
      },
    ],
  });

  t.true(result);
  t.is(authHeader, 'Bearer re_test');
  t.deepEqual(payload, {
    from: 'Manut <noreply@gogocash.co>',
    to: ['member@example.com'],
    subject: 'Workspace invitation',
    html: '<img src="cid:workspaceAvatar" />',
    attachments: [
      {
        filename: 'workspaceAvatar',
        content: 'YXZhdGFy',
        contentId: 'workspaceAvatar',
      },
    ],
  });
});

test('resend sender > given buffer attachment > then base64 encodes content', async t => {
  let payload: Record<string, unknown> | undefined;

  mock.method(
    globalThis,
    'fetch',
    async (_url: string | URL | Request, init?: RequestInit) => {
      payload = JSON.parse(String(init?.body));

      return new Response(JSON.stringify({ id: 'email_test' }), {
        status: 200,
      });
    }
  );

  const result = await createResendSender().send('SignIn', {
    to: 'member@example.com',
    subject: 'Sign in',
    html: '<p>Sign in</p>',
    attachments: [
      {
        filename: 'avatar.png',
        content: Buffer.from('avatar-bytes'),
        contentType: 'image/png',
      },
    ],
  });

  t.true(result);
  t.deepEqual(payload?.attachments, [
    {
      filename: 'avatar.png',
      content: Buffer.from('avatar-bytes').toString('base64'),
      contentType: 'image/png',
    },
  ]);
});
