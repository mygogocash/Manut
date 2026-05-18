# @manut/example-plugin

Reference plugin for the Manut plugin runtime (M6a).

Declares one tool (`echo`) and one route (`POST /echo`) with the
minimum capability (`read.workspace`). The integration tests in
`packages/backend/server/src/__tests__/manut/m6a-*.spec.ts` import
this plugin to exercise the runtime end-to-end.

## Install (against a running Manut server)

```bash
# As an instance admin
yarn affine ctl plugins install @manut/example-plugin --version 0.1.0
yarn affine ctl plugins enable @manut/example-plugin
```

The runtime resolves `packages/backend/example-plugin/src/index.ts`
through the workspace dependency, spawns it via `child_process.fork`,
and wires up the JSON-RPC bridge over stdio.

## Disable / uninstall

```bash
yarn affine ctl plugins disable @manut/example-plugin
yarn affine ctl plugins uninstall @manut/example-plugin
```
