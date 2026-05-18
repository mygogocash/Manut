/**
 * M8 — HTTP webhook adapter tests. RED-first.
 *
 * We do not hit a real network. Tests stub `globalThis.fetch` with a
 * recording function so the assertions can examine the exact request
 * shape (headers, body, HMAC signature) that the adapter sends.
 */

import { createHmac } from 'node:crypto';

import test from 'ava';

import {
  AGENT_HEADER,
  buildSignaturePayload,
  computeSignature,
  MnHttpWebhookAdapter,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  WORKSPACE_HEADER,
} from '../../plugins/manut/adapters/manut-http-webhook-adapter.service';

// ---------------------------------------------------------------------
// Helpers: stub fetch + capture the last call
// ---------------------------------------------------------------------

interface CapturedRequest {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body: string;
}

function stubFetch(opts: {
  status?: number;
  responseBody?: string;
  throwError?: Error;
  delayMs?: number;
}): { restore: () => void; last: () => CapturedRequest | null } {
  let last: CapturedRequest | null = null;
  const original = globalThis.fetch;
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    const url = typeof input === 'string' ? input : input.toString();
    const headersInit = init?.headers ?? {};
    const headers: Record<string, string> = {};
    if (headersInit instanceof Headers) {
      headersInit.forEach((v, k) => (headers[k.toLowerCase()] = v));
    } else if (Array.isArray(headersInit)) {
      for (const [k, v] of headersInit) headers[k.toLowerCase()] = v;
    } else {
      for (const [k, v] of Object.entries(headersInit)) {
        headers[k.toLowerCase()] = String(v);
      }
    }
    last = {
      url,
      method: init?.method,
      headers,
      body: typeof init?.body === 'string' ? init.body : '',
    };

    if (opts.delayMs) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, opts.delayMs);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }

    if (opts.throwError) {
      throw opts.throwError;
    }

    const status = opts.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => opts.responseBody ?? '',
      json: async () =>
        opts.responseBody ? JSON.parse(opts.responseBody) : {},
    } as Response;
  }) as typeof fetch;

  return {
    restore: () => {
      globalThis.fetch = original;
    },
    last: () => last,
  };
}

// ---------------------------------------------------------------------

test('validateConfig rejects missing webhookUrl', t => {
  const adapter = new MnHttpWebhookAdapter();
  const result = adapter.validateConfig({
    signingSecret: 'a'.repeat(32),
  });
  t.false(result.valid);
  t.true(result.errors.some(e => e.includes('webhookUrl')));
});

test('validateConfig rejects signingSecret shorter than 16 chars', t => {
  const adapter = new MnHttpWebhookAdapter();
  const result = adapter.validateConfig({
    webhookUrl: 'https://example.com/hook',
    signingSecret: 'short',
  });
  t.false(result.valid);
  t.true(result.errors.some(e => e.includes('signingSecret')));
});

test('validateConfig rejects non-http(s) webhook URL', t => {
  const adapter = new MnHttpWebhookAdapter();
  const result = adapter.validateConfig({
    webhookUrl: 'ftp://example.com/hook',
    signingSecret: 'a'.repeat(32),
  });
  t.false(result.valid);
  t.true(result.errors.some(e => e.includes('protocol') || e.includes('http')));
});

test('validateConfig accepts well-formed config', t => {
  const adapter = new MnHttpWebhookAdapter();
  const result = adapter.validateConfig({
    webhookUrl: 'https://example.com/hook',
    signingSecret: 'a'.repeat(32),
    timeoutMs: 5000,
  });
  t.true(result.valid);
  t.deepEqual(result.errors, []);
});

test('invoke includes HMAC signature in headers and identifies agent + workspace', async t => {
  const adapter = new MnHttpWebhookAdapter();
  const secret = 'super-secret-shared-key-for-hmac';
  const stub = stubFetch({ status: 200, responseBody: '{"deliveryId":"d-1"}' });
  try {
    const result = await adapter.invoke({
      agentId: 'agent-1',
      workspaceId: 'ws-1',
      payload: { hello: 'world' },
      adapterConfig: {
        webhookUrl: 'https://example.com/hook',
        signingSecret: secret,
      },
    });

    t.true(result.ok);
    t.is(result.externalRunId, 'd-1');

    const captured = stub.last();
    if (!captured) {
      t.fail('expected stub to capture a request');
      return;
    }
    t.is(captured.method, 'POST');
    t.is(captured.headers[WORKSPACE_HEADER], 'ws-1');
    t.is(captured.headers[AGENT_HEADER], 'agent-1');

    const signature = captured.headers[SIGNATURE_HEADER];
    const timestamp = Number(captured.headers[TIMESTAMP_HEADER]);
    t.truthy(signature);
    t.true(Number.isInteger(timestamp));

    const expected = computeSignature(
      secret,
      buildSignaturePayload(timestamp, captured.body)
    );
    t.is(signature, expected);

    const bodyParsed = JSON.parse(captured.body);
    t.is(bodyParsed.agentId, 'agent-1');
    t.is(bodyParsed.workspaceId, 'ws-1');
    t.deepEqual(bodyParsed.payload, { hello: 'world' });
  } finally {
    stub.restore();
  }
});

test('signature uses HMAC-SHA256 keyed by signingSecret', t => {
  const sig = computeSignature('key', '12345.{"a":1}');
  const expected = createHmac('sha256', 'key')
    .update('12345.{"a":1}')
    .digest('hex');
  t.is(sig, expected);
});

test('invoke maps non-2xx response to ok:false with the HTTP status in the error', async t => {
  const adapter = new MnHttpWebhookAdapter();
  const stub = stubFetch({ status: 500, responseBody: 'oops' });
  try {
    const result = await adapter.invoke({
      agentId: 'a-1',
      workspaceId: 'w-1',
      payload: {},
      adapterConfig: {
        webhookUrl: 'https://example.com/hook',
        signingSecret: 'a'.repeat(32),
      },
    });
    t.false(result.ok);
    t.true(result.error?.includes('500') ?? false, `error: ${result.error}`);
    t.true(typeof result.durationMs === 'number' && result.durationMs >= 0);
  } finally {
    stub.restore();
  }
});

test('invoke times out when the receiver hangs longer than timeoutMs', async t => {
  const adapter = new MnHttpWebhookAdapter();
  const stub = stubFetch({ status: 200, delayMs: 500 });
  try {
    const result = await adapter.invoke({
      agentId: 'a-1',
      workspaceId: 'w-1',
      payload: {},
      adapterConfig: {
        webhookUrl: 'https://example.com/hook',
        signingSecret: 'a'.repeat(32),
        timeoutMs: 50,
      },
    });
    t.false(result.ok);
    t.true(
      (result.error ?? '').toLowerCase().includes('time') ||
        (result.error ?? '').toLowerCase().includes('abort'),
      `error: ${result.error}`
    );
  } finally {
    stub.restore();
  }
});

test('invoke rejects invalid config without making a network call', async t => {
  const adapter = new MnHttpWebhookAdapter();
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    called = true;
    return new Response();
  }) as typeof fetch;
  try {
    const result = await adapter.invoke({
      agentId: 'a',
      workspaceId: 'w',
      payload: {},
      adapterConfig: { webhookUrl: 'not-a-url' },
    });
    t.false(result.ok);
    t.false(called);
  } finally {
    globalThis.fetch = original;
  }
});
