import { randomBytes } from 'node:crypto';

import test from 'ava';

import {
  SCRUBBED_VALUE,
  scrubSecrets,
} from '../../plugins/manut/manut-secret-scrubber';

/**
 * M5.2 — Adversarial fuzz coverage for the secret scrubber.
 *
 * The scrubber is the only thing standing between a portability
 * export and a real credential leak. Treat every test here as a
 * regression that captures a real attack scenario.
 */

const HIGH_ENTROPY_TOKEN = (n = 40): string =>
  randomBytes(n)
    .toString('base64')
    .replace(/[^A-Za-z0-9+/=_-]/g, 'A')
    .slice(0, n);

test('scrubs field whose name contains "secret"', t => {
  const input = { apiSecret: 'abc' };
  const out = scrubSecrets(input) as Record<string, unknown>;
  t.is(out.apiSecret, SCRUBBED_VALUE);
});

test('scrubs case-insensitively (SECRET, Secret, sEcReT)', t => {
  const input = { API_SECRET: 'a', Secret: 'b', sEcReT: 'c' };
  const out = scrubSecrets(input) as Record<string, unknown>;
  t.is(out.API_SECRET, SCRUBBED_VALUE);
  t.is(out.Secret, SCRUBBED_VALUE);
  t.is(out.sEcReT, SCRUBBED_VALUE);
});

test('scrubs key, token, password, credential, auth field names', t => {
  const input = {
    publicKey: 'pk',
    accessToken: 'at',
    dbPassword: 'pw',
    userCredentials: 'uc',
    authHeader: 'ah',
  };
  const out = scrubSecrets(input) as Record<string, unknown>;
  for (const v of Object.values(out)) {
    t.is(v, SCRUBBED_VALUE);
  }
});

test('does not scrub innocent short string values without secret-named keys', t => {
  const input = { displayName: 'Alice', count: 42 };
  const out = scrubSecrets(input);
  t.deepEqual(out, input);
});

test('scrubs high-entropy string values regardless of key name', t => {
  const token = HIGH_ENTROPY_TOKEN(48);
  const input = { notes: token };
  const out = scrubSecrets(input) as Record<string, unknown>;
  t.is(out.notes, SCRUBBED_VALUE);
});

test('does not scrub short, low-entropy values', t => {
  const input = { notes: 'short note text', uuid: 'abc-123' };
  const out = scrubSecrets(input);
  t.deepEqual(out, input);
});

test('walks nested objects deeply', t => {
  const input = {
    a: { b: { c: { apiKey: 'leak' } } },
  };
  const out = scrubSecrets(input) as { a: { b: { c: { apiKey: string } } } };
  t.is(out.a.b.c.apiKey, SCRUBBED_VALUE);
});

test('walks arrays of objects', t => {
  const input = {
    providers: [
      { name: 'p1', secret: 's1' },
      { name: 'p2', secret: 's2' },
    ],
  };
  const out = scrubSecrets(input) as {
    providers: Array<{ name: string; secret: string }>;
  };
  t.is(out.providers[0].secret, SCRUBBED_VALUE);
  t.is(out.providers[1].secret, SCRUBBED_VALUE);
  t.is(out.providers[0].name, 'p1');
});

test('returns a new object, never mutates input', t => {
  const input = { token: 'abc', name: 'leave-me' };
  const before = JSON.parse(JSON.stringify(input)) as typeof input;
  scrubSecrets(input);
  t.deepEqual(input, before);
});

test('preserves null and undefined and numeric/boolean primitives', t => {
  const input = { a: null, b: undefined, c: 7, d: true, e: false };
  const out = scrubSecrets(input);
  t.deepEqual(out, input);
});

test('cycle guard: replaces back-reference with null instead of throwing', t => {
  interface CycIn {
    name: string;
    self?: CycIn;
  }
  interface CycOut {
    name: string;
    self?: CycIn | null;
  }
  const cyc: CycIn = { name: 'x' };
  cyc.self = cyc;
  const out = scrubSecrets(cyc) as CycOut;
  t.is(out.name, 'x');
  t.is(out.self, null);
});

test('adversarial fuzz: 50 random objects with secret keys all scrubbed', t => {
  let scrubbedAny = false;
  for (let i = 0; i < 50; i++) {
    const keyChoices = [
      'apiSecret',
      'authToken',
      'dbPassword',
      'oauthCredential',
      'publicKey',
      'sessionToken',
    ];
    const key = keyChoices[i % keyChoices.length];
    const obj: Record<string, unknown> = {
      [key]: randomBytes(8).toString('hex'),
      benign: `note-${i}`,
    };
    const out = scrubSecrets(obj) as Record<string, unknown>;
    t.is(
      out[key],
      SCRUBBED_VALUE,
      `secret-named field ${key} on iteration ${i}`
    );
    t.is(out.benign, `note-${i}`);
    scrubbedAny = true;
  }
  t.true(scrubbedAny);
});

test('adversarial fuzz: high-entropy values across 50 nested shapes', t => {
  for (let i = 0; i < 50; i++) {
    const token = HIGH_ENTROPY_TOKEN(32 + (i % 16));
    const shape = {
      level1: {
        level2: {
          level3: {
            randomField: token,
          },
        },
      },
    };
    const out = scrubSecrets(shape) as {
      level1: { level2: { level3: { randomField: string } } };
    };
    t.is(
      out.level1.level2.level3.randomField,
      SCRUBBED_VALUE,
      `high-entropy value on iteration ${i}`
    );
  }
});

test('high-entropy detection floors at 32 chars', t => {
  const tooShort = 'abcd1234abcd1234abcd1234abcd123'; // 31 chars
  const justRight = 'abcd1234abcd1234abcd1234abcd1234'; // 32 chars
  const out = scrubSecrets({ a: tooShort, b: justRight }) as Record<
    string,
    unknown
  >;
  t.is(out.a, tooShort);
  t.is(out.b, SCRUBBED_VALUE);
});

test('mixed: secret-named key with low-entropy value still scrubs', t => {
  const out = scrubSecrets({ password: '1234' }) as Record<string, unknown>;
  t.is(out.password, SCRUBBED_VALUE);
});

test('null root and array root are handled', t => {
  t.is(scrubSecrets(null), null);
  t.deepEqual(scrubSecrets([1, 2, 3]), [1, 2, 3]);
  t.deepEqual(scrubSecrets([{ token: 'x' }]), [{ token: SCRUBBED_VALUE }]);
});

test('top-level string value with high entropy is scrubbed (not just inside objects)', t => {
  const token = HIGH_ENTROPY_TOKEN(48);
  t.is(scrubSecrets(token), SCRUBBED_VALUE);
});
