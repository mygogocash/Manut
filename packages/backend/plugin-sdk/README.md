# @manut/plugin-sdk

SDK for authoring Manut plugins.

## Trust boundary (read first)

Manut plugins run **out-of-process** in a Node `child_process.fork`
worker, supervised by the Manut server. The worker:

- Has its own V8 heap, event loop, and JSON-RPC bridge over stdio
- Can ONLY reach the host via the typed `HostRPC` surface
- Sees every RPC call gated by the capabilities declared in the
  manifest — a denied call returns a structured error, not access
- Cannot link into the host's Node module graph; the runtime spawns
  the worker with `--experimental-permission` semantics where supported
  (a hardening step explored in M6c, not relied on for M6a)

### What M6a covers

Only the **worker runtime + capability-gated host RPC**.

### What M6a does NOT cover

- **UI bundles** a plugin may ship eventually. Per the Paperclip-port
  caveat, those run same-origin on the host page and need a separate
  sandboxing story (CSP iframe + postMessage). That's M6b. Until M6b
  lands, do not load plugin-provided UI in the host shell.
- **WASI / network sandboxing** of the worker process itself. The
  worker shares the host's kernel namespace and can open arbitrary
  TCP sockets unless the operator configures node permission flags.
  The `network.outbound` capability gate covers RPC-mediated fetches
  but a malicious plugin could still open raw sockets. That's M6c.

## Authoring a plugin

```ts
import { definePlugin, type HostRPC, type PluginManifest } from '@manut/plugin-sdk';

const manifest: PluginManifest = {
  name: 'hello-world',
  version: '0.1.0',
  hostApiVersion: '1.0',
  capabilities: ['read.workspace'],
  tools: [
    {
      name: 'echo',
      description: 'Echoes the input string back to the caller.',
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

export default definePlugin(manifest, async (host: HostRPC) => {
  // Optional: long-lived setup runs once at process spawn.
  const workspaces = await host.workspaces.list();
  console.log(`Plugin sees ${workspaces.length} workspaces`);
});
```

## Capabilities

| Capability         | Grants access to                                      |
| ------------------ | ----------------------------------------------------- |
| `read.workspace`   | `workspaces.list`, `docs.read`, `tasks.list`          |
| `write.doc`        | `docs.write`                                          |
| `tasks.create`     | `tasks.create`                                        |
| `agents.invoke`    | `agents.invoke`                                       |
| `budget.read`      | `budget.snapshot`                                     |
| `secrets.read`     | `secrets.get`                                         |
| `network.outbound` | `network.fetch` (host-mediated, RPC; not raw sockets) |

Declare the minimum set. The host inspects the manifest at install
time and rejects calls outside the declared set at request time.

## Versioning

`hostApiVersion` is checked by the server at spawn. Major version
mismatches refuse to load — the operator must upgrade or downgrade
the plugin.
