/**
 * M6a plugin runtime — capability gates, IPC bridge, crash recovery,
 * backpressure overflow.
 *
 * RED-first. These tests use a fake EventEmitter-based transport
 * instead of forking a real Node process so the suite stays under
 * a second and survives in CI without docker.
 */

import { EventEmitter } from 'node:events';

import {
  assertCapability,
  CapabilityDeniedError,
  definePlugin,
  isPluginCapability,
  PLUGIN_CAPABILITIES,
  type PluginManifest,
  PluginManifestSchema,
} from '@manut/plugin-sdk';
import test from 'ava';

import { ManutPluginHostRpcService } from '../../plugins/manut/plugin-runtime/manut-plugin-host-rpc.service';
import {
  ManutPluginRpcBridge,
  RpcOverflowError,
  type RpcTransport,
} from '../../plugins/manut/plugin-runtime/manut-plugin-rpc-bridge';
import { ManutPluginSupervisorService } from '../../plugins/manut/plugin-runtime/manut-plugin-supervisor.service';

// ---------------------------------------------------------------------
// Fake IPC transport — a duplex EventEmitter with controllable backlog
// ---------------------------------------------------------------------

interface FakeTransport extends RpcTransport {
  emitFromPeer(message: unknown): void;
  sent: unknown[];
  killSignals: string[];
  rejectSend: boolean;
}

function createFakeTransport(): FakeTransport {
  const emitter = new EventEmitter() as FakeTransport;
  emitter.sent = [];
  emitter.killSignals = [];
  emitter.rejectSend = false;
  Object.defineProperty(emitter, 'pid', { value: 42424 });
  Object.defineProperty(emitter, 'connected', {
    value: true,
    configurable: true,
  });
  emitter.send = ((message: unknown) => {
    if (emitter.rejectSend) return false;
    emitter.sent.push(message);
    return true;
  }) as RpcTransport['send'];
  emitter.kill = (signal?: NodeJS.Signals | number) => {
    emitter.killSignals.push(String(signal ?? 'SIGTERM'));
    return true;
  };
  emitter.emitFromPeer = (message: unknown) => {
    emitter.emit('message', message);
  };
  return emitter;
}

// ---------------------------------------------------------------------
// 1. Manifest schema
// ---------------------------------------------------------------------

test('manifest schema accepts a minimal valid plugin', t => {
  const manifest: PluginManifest = {
    name: 'hello',
    version: '0.1.0',
    hostApiVersion: '1.0',
    capabilities: ['read.workspace'],
    tools: [],
    apiRoutes: [],
  };
  const parsed = PluginManifestSchema.parse(manifest);
  t.is(parsed.name, 'hello');
  t.deepEqual(parsed.capabilities, ['read.workspace']);
});

test('manifest schema rejects an unknown capability', t => {
  t.throws(() =>
    PluginManifestSchema.parse({
      name: 'bad',
      version: '0.1.0',
      hostApiVersion: '1.0',
      capabilities: ['unknown.capability'],
      tools: [],
      apiRoutes: [],
    })
  );
});

test('definePlugin returns a registration with manifest + factory', t => {
  const reg = definePlugin(
    {
      name: 'reg',
      version: '0.1.0',
      hostApiVersion: '1.0',
      capabilities: [],
      tools: [],
      apiRoutes: [],
    },
    async () => undefined
  );
  t.is(reg.manifest.name, 'reg');
  t.truthy(reg.factory);
});

test('every PLUGIN_CAPABILITIES entry is recognized by isPluginCapability', t => {
  for (const cap of PLUGIN_CAPABILITIES) {
    t.true(isPluginCapability(cap));
  }
  t.false(isPluginCapability('not.a.real.capability'));
});

// ---------------------------------------------------------------------
// 2. Capability gates
// ---------------------------------------------------------------------

test('assertCapability throws CapabilityDeniedError when missing', t => {
  const err = t.throws(() => assertCapability([], 'read.workspace'), {
    instanceOf: CapabilityDeniedError,
  });
  t.is(err?.code, 'capability_denied');
  t.is(err?.required, 'read.workspace');
});

test('assertCapability is a no-op when granted', t => {
  t.notThrows(() => assertCapability(['read.workspace'], 'read.workspace'));
});

test('host RPC denies dispatch when capability is missing', async t => {
  const stubDb = {} as never;
  const service = new ManutPluginHostRpcService(stubDb);
  await t.throwsAsync(service.dispatch('workspaces.list', {}, []), {
    instanceOf: CapabilityDeniedError,
  });
});

test('host RPC dispatch with granted capability calls implementation', async t => {
  const fakeDb = {
    workspace: {
      findMany: async () => [
        { id: 'w1', slug: 'one', name: 'One' },
        { id: 'w2', slug: 'two', name: null },
      ],
    },
  } as never;
  const service = new ManutPluginHostRpcService(fakeDb);
  const result = (await service.dispatch('workspaces.list', {}, [
    'read.workspace',
  ])) as Array<{ id: string }>;
  t.is(result.length, 2);
  t.is(result[0]!.id, 'w1');
});

test('host RPC throws unknown_method for unrecognised dispatch', async t => {
  const stubDb = {} as never;
  const service = new ManutPluginHostRpcService(stubDb);
  await t.throwsAsync(service.dispatch('not.a.method', {}, []), {
    message: /unknown RPC method/,
  });
});

// ---------------------------------------------------------------------
// 3. JSON-RPC bridge
// ---------------------------------------------------------------------

test('bridge round-trips a request and response', async t => {
  const transport = createFakeTransport();
  const bridge = new ManutPluginRpcBridge(transport, { callTimeoutMs: 500 });

  const pending = bridge.call('tool.call', { name: 'echo', input: { hi: 1 } });
  t.is(transport.sent.length, 1);
  const sent = transport.sent[0] as { id: number };
  transport.emitFromPeer({ jsonrpc: '2.0', id: sent.id, result: { pong: 1 } });
  const result = await pending;
  t.deepEqual(result, { pong: 1 });
  bridge.dispose('test done');
});

test('bridge surfaces JSON-RPC error envelopes back to the caller', async t => {
  const transport = createFakeTransport();
  const bridge = new ManutPluginRpcBridge(transport, { callTimeoutMs: 500 });
  const pending = bridge.call('tool.call', {});
  const sent = transport.sent[0] as { id: number };
  transport.emitFromPeer({
    jsonrpc: '2.0',
    id: sent.id,
    error: { code: 'capability_denied', message: 'denied' },
  });
  const err = await t.throwsAsync(pending);
  t.is((err as Error & { code?: string }).code, 'capability_denied');
  bridge.dispose('test done');
});

test('bridge dispatches inbound requests through the registered handler', async t => {
  const transport = createFakeTransport();
  const bridge = new ManutPluginRpcBridge(transport);
  bridge.setIncomingHandler(async (method, _params) => {
    if (method === 'workspaces.list') return ['demo'];
    throw new Error(`unexpected ${method}`);
  });
  transport.emitFromPeer({
    jsonrpc: '2.0',
    id: 7,
    method: 'workspaces.list',
    params: {},
  });
  // Allow microtask queue to flush the async handler.
  await new Promise<void>(r => setImmediate(r));
  t.is(transport.sent.length, 1);
  const response = transport.sent[0] as { id: number; result: unknown };
  t.is(response.id, 7);
  t.deepEqual(response.result, ['demo']);
  bridge.dispose('test done');
});

test('bridge kills the child when outbound queue overflows', async t => {
  const transport = createFakeTransport();
  // Block real send so the queue never drains.
  transport.send = () => true;
  const bridge = new ManutPluginRpcBridge(transport, {
    queueLimit: 2,
    callTimeoutMs: 100,
  });
  const p1 = bridge.call('one', {}).catch(() => null);
  const p2 = bridge.call('two', {}).catch(() => null);
  await t.throwsAsync(bridge.call('three', {}), {
    instanceOf: RpcOverflowError,
  });
  t.true(transport.killSignals.includes('SIGKILL'));
  bridge.dispose('overflow done');
  await Promise.all([p1, p2]);
});

test('bridge rejects all pending callers on dispose', async t => {
  const transport = createFakeTransport();
  const bridge = new ManutPluginRpcBridge(transport, { callTimeoutMs: 1_000 });
  const pending = bridge.call('slow', {});
  bridge.dispose('crash');
  const err = await t.throwsAsync(pending);
  t.is((err as Error & { code?: string }).code, 'rpc_disposed');
});

// ---------------------------------------------------------------------
// 4. Supervisor — exponential backoff + restart budget
// ---------------------------------------------------------------------

test('supervisor returns exponential delays on successive crashes', t => {
  const supervisor = new ManutPluginSupervisorService({
    baseMs: 100,
    maxBackoffMs: 10_000,
    maxAttempts: 5,
    windowMs: 60_000,
  });
  const d1 = supervisor.recordCrash('p1', 1_000);
  const d2 = supervisor.recordCrash('p1', 2_000);
  const d3 = supervisor.recordCrash('p1', 3_000);
  t.deepEqual(
    [d1.decision, d2.decision, d3.decision],
    ['restart', 'restart', 'restart']
  );
  t.is(d1.decision === 'restart' ? d1.delayMs : 0, 100);
  t.is(d2.decision === 'restart' ? d2.delayMs : 0, 200);
  t.is(d3.decision === 'restart' ? d3.delayMs : 0, 400);
});

test('supervisor parks plugin after exceeding maxAttempts', t => {
  const supervisor = new ManutPluginSupervisorService({
    baseMs: 100,
    maxAttempts: 2,
    windowMs: 60_000,
  });
  supervisor.recordCrash('p1', 1_000);
  supervisor.recordCrash('p1', 2_000);
  const third = supervisor.recordCrash('p1', 3_000);
  t.is(third.decision, 'park');
});

test('supervisor sliding window drops out-of-window crashes', t => {
  const supervisor = new ManutPluginSupervisorService({
    baseMs: 100,
    maxAttempts: 2,
    windowMs: 1_000,
  });
  supervisor.recordCrash('p1', 1_000);
  supervisor.recordCrash('p1', 1_100);
  // 5s later — the old crashes drop out of the window
  const fresh = supervisor.recordCrash('p1', 6_000);
  t.is(fresh.decision, 'restart');
  t.is(supervisor.crashCount('p1', 6_000), 1);
});

test('supervisor clear() resets the ledger', t => {
  const supervisor = new ManutPluginSupervisorService({
    baseMs: 100,
    maxAttempts: 2,
  });
  supervisor.recordCrash('p1');
  supervisor.recordCrash('p1');
  supervisor.clear('p1');
  t.is(supervisor.crashCount('p1'), 0);
});
