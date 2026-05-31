import test from 'ava';

import {
  assertSafeOutboundHost,
  assertSafeOutboundUrl,
  BlockedHostError,
} from '../../plugins/connections/ssrf-guard';

// --- BLOCKED: literal private / loopback / metadata IPv4 ---

test('assertSafeOutboundHost > given loopback 127.0.0.1 > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('127.0.0.1'), {
    instanceOf: BlockedHostError,
  });
});

test('assertSafeOutboundHost > given hostname localhost > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('localhost'), {
    instanceOf: BlockedHostError,
  });
});

test('assertSafeOutboundHost > given RFC1918 10.0.0.1 > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('10.0.0.1'), {
    instanceOf: BlockedHostError,
  });
});

test('assertSafeOutboundHost > given RFC1918 172.16.0.1 > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('172.16.0.1'), {
    instanceOf: BlockedHostError,
  });
});

test('assertSafeOutboundHost > given RFC1918 192.168.1.1 > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('192.168.1.1'), {
    instanceOf: BlockedHostError,
  });
});

test('assertSafeOutboundHost > given cloud metadata 169.254.169.254 > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('169.254.169.254'), {
    instanceOf: BlockedHostError,
  });
});

// --- BLOCKED: alternate IPv4 encodings that decode to loopback ---

test('assertSafeOutboundHost > given decimal-encoded loopback 2130706433 > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('2130706433'), {
    instanceOf: BlockedHostError,
  });
});

test('assertSafeOutboundHost > given hex-encoded loopback 0x7f.0.0.1 > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('0x7f.0.0.1'), {
    instanceOf: BlockedHostError,
  });
});

test('assertSafeOutboundHost > given octal-encoded loopback 0177.0.0.1 > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('0177.0.0.1'), {
    instanceOf: BlockedHostError,
  });
});

// --- BLOCKED: IPv6 (parsed to integers, not string-prefix matched) ---

test('assertSafeOutboundHost > given IPv6 loopback ::1 > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('::1'), {
    instanceOf: BlockedHostError,
  });
});

test('assertSafeOutboundHost > given IPv4-mapped loopback ::ffff:127.0.0.1 > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('::ffff:127.0.0.1'), {
    instanceOf: BlockedHostError,
  });
});

test('assertSafeOutboundHost > given link-local fe80::1 > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('fe80::1'), {
    instanceOf: BlockedHostError,
  });
});

test('assertSafeOutboundHost > given unique-local fc00::1 > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('fc00::1'), {
    instanceOf: BlockedHostError,
  });
});

// --- BLOCKED: internal-only hostnames ---

test('assertSafeOutboundHost > given metadata.google.internal > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('metadata.google.internal'), {
    instanceOf: BlockedHostError,
  });
});

test('assertSafeOutboundHost > given .internal TLD foo.internal > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('foo.internal'), {
    instanceOf: BlockedHostError,
  });
});

test('assertSafeOutboundHost > given .local TLD something.local > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundHost('something.local'), {
    instanceOf: BlockedHostError,
  });
});

// --- BLOCKED: URL form (loopback host + non-http scheme) ---

test('assertSafeOutboundUrl > given http loopback http://127.0.0.1/ > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundUrl('http://127.0.0.1/'), {
    instanceOf: BlockedHostError,
  });
});

test('assertSafeOutboundUrl > given non-http scheme file:///etc/passwd > throws BlockedHostError', t => {
  t.throws(() => assertSafeOutboundUrl('file:///etc/passwd'), {
    instanceOf: BlockedHostError,
  });
});

// --- ALLOWED: public IPs and hostnames ---

test('assertSafeOutboundHost > given public DNS 8.8.8.8 > does not throw', t => {
  t.notThrows(() => assertSafeOutboundHost('8.8.8.8'));
});

test('assertSafeOutboundHost > given mongodb atlas host > does not throw', t => {
  t.notThrows(() => assertSafeOutboundHost('gogocash.4prpd9j.mongodb.net'));
});

test('assertSafeOutboundHost > given example.com > does not throw', t => {
  t.notThrows(() => assertSafeOutboundHost('example.com'));
});

test('assertSafeOutboundHost > given public DNS 1.1.1.1 > does not throw', t => {
  t.notThrows(() => assertSafeOutboundHost('1.1.1.1'));
});

test('assertSafeOutboundUrl > given https://example.com/api > does not throw', t => {
  t.notThrows(() => assertSafeOutboundUrl('https://example.com/api'));
});
