import {
  definePlugin,
  type HostRPC,
  type PluginManifest,
} from '@manut/plugin-sdk';

/**
 * Example plugin used by the runtime test suite. Declares the minimum
 * surface that exercises every host code path:
 *
 *   - One tool (`echo`) — exercises the tool-dispatch path
 *   - One POST route — exercises the API-route path
 *   - Declares `read.workspace` so it can call `host.workspaces.list`
 *
 * The factory body is intentionally trivial so a failure in the test
 * suite points at the runtime, not the plugin.
 */
const manifest: PluginManifest = {
  name: 'example',
  version: '0.1.0',
  hostApiVersion: '1.0',
  capabilities: ['read.workspace'],
  description: 'Reference plugin for the Manut plugin runtime.',
  tools: [
    {
      name: 'echo',
      description: 'Echoes back the provided message.',
      factory: './tools/echo.js',
    },
  ],
  apiRoutes: [
    {
      method: 'POST',
      path: '/echo',
      capability: 'read.workspace',
      handler: './routes/echo.js',
    },
  ],
};

export default definePlugin<HostRPC>(manifest, async host => {
  /**
   * Optional bootstrap. Real plugins might warm caches or subscribe to
   * server-sent events here. We probe `workspaces.list` so the test
   * suite can assert that the host RPC bridge is alive.
   */
  await host.workspaces.list();
});
