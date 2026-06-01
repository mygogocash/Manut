import { createHmac } from 'node:crypto';

import { SocialPlatform } from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';

import { LineWebhookController } from '../line.controller';

function sign(rawBody: Buffer, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('base64');
}

test('LINE webhook resolves connections by destination before source user id', async t => {
  const rawBody = Buffer.from(
    JSON.stringify({
      destination: 'line-channel-destination',
      events: [
        {
          type: 'message',
          webhookEventId: 'evt-1',
          timestamp: Date.parse('2026-06-01T00:00:00Z'),
          source: { type: 'user', userId: 'line-user-id' },
          message: { id: 'msg-1', type: 'text', text: 'hello' },
        },
      ],
    })
  );
  const findFirst = Sinon.stub().resolves({
    id: 'conn-1',
    workspaceId: 'ws-1',
  });
  const normalizeAndStore = Sinon.stub().resolves(undefined);
  const toSocialEvent = Sinon.stub().returns({
    workspaceId: 'ws-1',
    platform: 'LINE_VOOM',
    eventType: 'message',
    externalId: 'evt-1',
    occurredAt: new Date('2026-06-01T00:00:00Z'),
    payload: {},
    raw: {},
  });
  const controller = new LineWebhookController(
    {
      analytics: {
        line: { channelSecret: 'line-secret' },
      },
    } as never,
    { socialConnection: { findFirst } } as never,
    { normalizeAndStore } as never,
    { toSocialEvent } as never
  );

  await controller.receive({ rawBody } as never, sign(rawBody, 'line-secret'));

  t.deepEqual(findFirst.firstCall.firstArg, {
    where: {
      platform: SocialPlatform.LINE_VOOM,
      externalAccountId: 'line-channel-destination',
    },
  });
  t.true(normalizeAndStore.calledOnce);
  t.is(normalizeAndStore.firstCall.args[2], 'conn-1');
});
