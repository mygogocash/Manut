/**
 * M8 — Process command adapter tests. RED-first.
 *
 * Uses real `echo` for the happy path because it's POSIX-portable
 * and pulls in no fixtures. Allowlist enforcement is tested at the
 * validateConfig level — no child process is spawned for the failure
 * cases.
 */

import test from 'ava';

import { MnProcessAdapter } from '../../plugins/manut/adapters/manut-process-adapter.service';

test('validateConfig requires commandAllowlist', t => {
  const adapter = new MnProcessAdapter();
  const result = adapter.validateConfig({ command: 'echo' });
  t.false(result.valid);
  t.true(result.errors.some(e => e.includes('commandAllowlist')));
});

test('validateConfig rejects command outside the allowlist', t => {
  const adapter = new MnProcessAdapter();
  const result = adapter.validateConfig({
    command: 'curl',
    commandAllowlist: ['echo', 'date'],
  });
  t.false(result.valid);
  t.true(
    result.errors.some(e => e.includes('curl') && /allowlist/i.test(e)),
    `errors: ${result.errors.join(' | ')}`
  );
});

test('validateConfig accepts command listed in commandAllowlist', t => {
  const adapter = new MnProcessAdapter();
  const result = adapter.validateConfig({
    command: 'echo',
    commandAllowlist: ['echo'],
    args: ['hi'],
  });
  t.true(result.valid);
});

test('invoke captures stdout from echo and reports exitCode=0', async t => {
  const adapter = new MnProcessAdapter();
  const result = await adapter.invoke({
    agentId: 'agent-1',
    workspaceId: 'ws-1',
    payload: {},
    adapterConfig: {
      command: 'echo',
      args: ['hello-from-manut'],
      commandAllowlist: ['echo'],
    },
  });

  t.true(result.ok);
  const out = result.result as { stdout?: string; exitCode?: number };
  t.true((out?.stdout ?? '').includes('hello-from-manut'));
  t.is(out?.exitCode, 0);
  t.true(typeof result.durationMs === 'number' && result.durationMs >= 0);
});

test('invoke rejects out-of-allowlist command without spawning', async t => {
  const adapter = new MnProcessAdapter();
  const result = await adapter.invoke({
    agentId: 'agent-1',
    workspaceId: 'ws-1',
    payload: {},
    adapterConfig: {
      command: '/bin/rm',
      args: ['-rf', '/'],
      commandAllowlist: ['echo'],
    },
  });
  t.false(result.ok);
  t.true(/allowlist/i.test(result.error ?? ''), `error: ${result.error}`);
});

test('invoke times out a long-running process', async t => {
  // `sleep` is POSIX. We allowlist it explicitly + cap the timeout
  // to a sub-second value so the test stays fast.
  const adapter = new MnProcessAdapter();
  const result = await adapter.invoke({
    agentId: 'agent-1',
    workspaceId: 'ws-1',
    payload: {},
    adapterConfig: {
      command: 'sleep',
      args: ['10'],
      commandAllowlist: ['sleep'],
      timeoutMs: 100,
    },
  });
  t.false(result.ok);
  t.true(
    (result.error ?? '').toLowerCase().includes('time'),
    `error: ${result.error}`
  );
});
