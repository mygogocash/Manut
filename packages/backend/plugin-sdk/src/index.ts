/**
 * @manut/plugin-sdk — public surface for Manut plugin authors.
 *
 * This package exports:
 *   - Manifest schema + `definePlugin` helper for declaring a plugin
 *   - Capability enum + helpers for declaring + asserting permissions
 *   - Host RPC type contracts the plugin can call back into
 *
 * The SDK is purely declarative. It ships no runtime that talks to the
 * host directly — the worker entrypoint provided by the Manut server
 * (`manut-plugin-runtime.service.ts`) wires up the IPC bridge and
 * injects a typed client matching `HostRPC` into the plugin's factory.
 *
 * Trust boundary: see README.md. The SDK assumes the plugin process is
 * isolated from the host via `child_process.fork`; UI assets a plugin
 * eventually ships will run same-origin on the host page and need a
 * SEPARATE sandboxing story (CSP iframe + postMessage) — that's M6b,
 * not M6a.
 */

export type { PluginCapability } from './capabilities.js';
export {
  assertCapability,
  CapabilityDeniedError,
  isPluginCapability,
  PLUGIN_CAPABILITIES,
} from './capabilities.js';
export type {
  HostDocSummary,
  HostRPC,
  HostRpcError,
  HostRpcMethod,
  HostRpcRequest,
  HostRpcResponse,
  HostRpcSuccess,
  HostTaskInput,
  HostTaskSummary,
  HostWorkspaceSummary,
  PluginRpcRequest,
  PluginRpcResponse,
} from './host-rpc.js';
export { HOST_RPC_CAPABILITIES } from './host-rpc.js';
export type {
  PluginApiRoute,
  PluginHttpMethod,
  PluginManifest,
  PluginRegistration,
  PluginTool,
} from './manifest.js';
export {
  definePlugin,
  PluginApiRouteSchema,
  PluginManifestSchema,
  PluginToolSchema,
} from './manifest.js';
