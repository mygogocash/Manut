/**
 * M8 — Adapter registry tests. RED-first.
 *
 * Constructs the registry by hand (no NestJS container) and exercises
 * the resolver against every new MnAgentAdapterType variant + asserts
 * the COPILOT_CHAT_SESSION variant intentionally is NOT registered.
 */

import { MnAgentAdapterType } from '@prisma/client';
import test from 'ava';

import { MnAdapterRegistryService } from '../../plugins/manut/adapters/manut-adapter-registry.service';
import { MnCursorCloudAdapter } from '../../plugins/manut/adapters/manut-cursor-cloud-adapter.service';
import { MnE2bAdapter } from '../../plugins/manut/adapters/manut-e2b-adapter.service';
import { MnHttpWebhookAdapter } from '../../plugins/manut/adapters/manut-http-webhook-adapter.service';
import { MnProcessAdapter } from '../../plugins/manut/adapters/manut-process-adapter.service';

function buildRegistry(): MnAdapterRegistryService {
  return new MnAdapterRegistryService(
    new MnE2bAdapter(),
    new MnCursorCloudAdapter(),
    new MnHttpWebhookAdapter(),
    new MnProcessAdapter()
  );
}

test('resolve(E2B_SANDBOX) returns the E2B adapter', t => {
  const registry = buildRegistry();
  const adapter = registry.resolve(MnAgentAdapterType.E2B_SANDBOX);
  t.true(adapter instanceof MnE2bAdapter);
  t.is(adapter.adapterType, MnAgentAdapterType.E2B_SANDBOX);
});

test('resolve(CURSOR_CLOUD) returns the Cursor adapter', t => {
  const registry = buildRegistry();
  const adapter = registry.resolve(MnAgentAdapterType.CURSOR_CLOUD);
  t.true(adapter instanceof MnCursorCloudAdapter);
  t.is(adapter.adapterType, MnAgentAdapterType.CURSOR_CLOUD);
});

test('resolve(HTTP_WEBHOOK) returns the HTTP webhook adapter', t => {
  const registry = buildRegistry();
  const adapter = registry.resolve(MnAgentAdapterType.HTTP_WEBHOOK);
  t.true(adapter instanceof MnHttpWebhookAdapter);
  t.is(adapter.adapterType, MnAgentAdapterType.HTTP_WEBHOOK);
});

test('resolve(PROCESS_COMMAND) returns the process adapter', t => {
  const registry = buildRegistry();
  const adapter = registry.resolve(MnAgentAdapterType.PROCESS_COMMAND);
  t.true(adapter instanceof MnProcessAdapter);
  t.is(adapter.adapterType, MnAgentAdapterType.PROCESS_COMMAND);
});

test('resolve(COPILOT_CHAT_SESSION) throws — not an external adapter', t => {
  const registry = buildRegistry();
  t.throws(() => registry.resolve(MnAgentAdapterType.COPILOT_CHAT_SESSION), {
    message: /no adapter registered/i,
  });
  t.false(registry.has(MnAgentAdapterType.COPILOT_CHAT_SESSION));
});

test('registeredTypes lists exactly the four external adapter types', t => {
  const registry = buildRegistry();
  const types = registry.registeredTypes().sort();
  t.deepEqual(
    types,
    [
      MnAgentAdapterType.CURSOR_CLOUD,
      MnAgentAdapterType.E2B_SANDBOX,
      MnAgentAdapterType.HTTP_WEBHOOK,
      MnAgentAdapterType.PROCESS_COMMAND,
    ].sort()
  );
});
