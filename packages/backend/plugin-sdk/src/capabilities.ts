/**
 * Capability gates for Manut plugins.
 *
 * A capability is a coarse-grained permission a plugin declares in its
 * manifest. The host enforces every host-RPC call against the granted
 * capabilities; a denied call returns a structured error (never throws
 * into the plugin process), so the supervisor can log the offence and
 * the plugin can degrade gracefully.
 *
 * Intentionally a small, finite set. Each new capability needs a host
 * RPC that gates on it (see host-rpc.ts) AND a check in
 * `manut-plugin-host-rpc.service.ts`.
 */
export const PLUGIN_CAPABILITIES = [
  'read.workspace',
  'write.doc',
  'network.outbound',
  'secrets.read',
  'tasks.create',
  'agents.invoke',
  'budget.read',
] as const;

export type PluginCapability = (typeof PLUGIN_CAPABILITIES)[number];

export function isPluginCapability(value: string): value is PluginCapability {
  return (PLUGIN_CAPABILITIES as readonly string[]).includes(value);
}

/**
 * Error thrown by `assertCapability` when a plugin attempts an RPC it
 * did not declare in its manifest. The host RPC bridge catches this
 * and returns a structured `{ code: 'capability_denied', ... }` error
 * back through IPC, so the plugin never crashes the host.
 */
export class CapabilityDeniedError extends Error {
  readonly code = 'capability_denied' as const;
  readonly required: PluginCapability;
  readonly granted: ReadonlyArray<string>;

  constructor(required: PluginCapability, granted: ReadonlyArray<string>) {
    super(
      `Plugin tried to use capability '${required}' but only declared: ${
        granted.length ? granted.join(', ') : '(none)'
      }`
    );
    this.name = 'CapabilityDeniedError';
    this.required = required;
    this.granted = granted;
  }
}

/**
 * Throws `CapabilityDeniedError` when `required` is not in `granted`.
 * No-op when the capability is present.
 */
export function assertCapability(
  granted: ReadonlyArray<string>,
  required: PluginCapability
): void {
  if (!granted.includes(required)) {
    throw new CapabilityDeniedError(required, granted);
  }
}
