/**
 * @vitest-environment happy-dom
 */

import { describe, expect, test, vi } from 'vitest';

vi.mock('@affine/component', () => ({
  Button: () => null,
  ErrorMessage: () => null,
  Skeleton: () => null,
  notify: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@affine/core/components/hooks/affine-async-hooks', () => ({
  useAsyncCallback: (callback: unknown) => callback,
}));

vi.mock('@affine/core/modules/cloud', () => ({
  AccessTokenService: class AccessTokenService {},
  ServerService: class ServerService {},
}));

vi.mock('@affine/core/modules/workspace', () => ({
  WorkspaceService: class WorkspaceService {},
}));

vi.mock('@affine/error', () => ({
  UserFriendlyError: {
    fromAny: vi.fn(),
  },
}));

vi.mock('@affine/i18n', () => ({
  useI18n: () =>
    new Proxy(
      {},
      {
        get: () => () => '',
      }
    ),
}));

vi.mock('@toeverything/infra', () => ({
  useLiveData: (value: unknown) => value,
  useService: vi.fn(),
}));

vi.mock('../../setting', () => ({
  IntegrationSettingHeader: () => null,
}));

import { buildMcpServerConfigJson } from '../setting-panel';

describe('MCP server setting panel config copy', () => {
  test('uses Manut-facing note while preserving the internal affine workspace key', () => {
    const config = JSON.parse(
      buildMcpServerConfigJson({
        baseUrl: 'https://manut.example',
        token: 'token-1',
        workspaceId: 'workspace-1',
        workspaceName: 'Launch Plan',
      })
    );

    expect(Object.keys(config.mcpServers)).toEqual([
      'affine_workspace_workspace-1',
    ]);

    const server = config.mcpServers['affine_workspace_workspace-1'];
    expect(server.note).toBe('Read docs from Manut workspace "Launch Plan"');
    expect(server.note).not.toContain('AFFiNE');
    expect(server.note).not.toContain('Superflow');
  });
});
