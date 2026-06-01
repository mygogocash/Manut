import test from 'ava';

import { WorkspaceMcpProvider } from '../provider.js';

const originalEnv = globalThis.env;

test.beforeEach(() => {
  globalThis.env = {
    dev: false,
    namespaces: {
      canary: false,
    },
  } as typeof globalThis.env;
});

test.after.always(() => {
  globalThis.env = originalEnv;
});

test('workspace MCP server metadata uses Manut-facing branding', async t => {
  const provider = new WorkspaceMcpProvider(
    {
      user: () => ({
        workspace: () => ({
          assert: async () => {},
        }),
      }),
    } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );

  const server = await provider.for('user-1', 'workspace-1');

  t.is(server.name, 'Manut MCP Server for Workspace workspace-1');
  t.false(server.name.includes('AFFiNE'));
  t.false(server.name.includes('Superflow'));
});
