/**
 * @vitest-environment happy-dom
 */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const PermissionServiceToken = vi.hoisted(
  () => class WorkspacePermissionService {}
);
const panelState = vi.hoisted(() => ({ shouldThrow: false }));

vi.mock('@affine/core/modules/permissions', () => ({
  WorkspacePermissionService: PermissionServiceToken,
}));

vi.mock('@toeverything/infra', () => ({
  useLiveData: () => true,
  useService: (token: unknown) => {
    if (token === PermissionServiceToken) {
      return {
        permission: Object.fromEntries([
          ['isOwner$', {}],
          ['isAdmin$', {}],
        ]),
      };
    }
    return {};
  },
}));

vi.mock('@affine/component/setting-components', () => ({
  SettingHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
  SettingWrapper: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
}));

vi.mock('@affine/component', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('../panel', () => ({
  AnalyticsConnectionsPanel: () => {
    if (panelState.shouldThrow) {
      throw new Error('An internal error occurred.');
    }
    return (
      <div data-testid="analytics-connections-panel">Connections loaded</div>
    );
  },
}));

import { WorkspaceAnalyticsConnections } from '../index';

describe('Workspace analytics connections settings', () => {
  beforeEach(() => {
    panelState.shouldThrow = false;
  });

  afterEach(() => {
    cleanup();
  });

  test('renders the analytics connections panel when queries resolve', () => {
    render(<WorkspaceAnalyticsConnections />);

    expect(screen.getByText('Connections')).toBeTruthy();
    expect(screen.getByTestId('analytics-connections-panel')).toBeTruthy();
  });

  test('renders a local analytics connections error instead of bubbling query failures', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    panelState.shouldThrow = true;

    render(<WorkspaceAnalyticsConnections />);

    const alert = await screen.findByTestId(
      'analytics-connections-error-boundary'
    );
    expect(alert.textContent).toContain('Failed to load analytics connections');
    expect(alert.textContent).toContain('An internal error occurred.');
    expect(screen.queryByText('Something is wrong...')).toBeNull();
    consoleError.mockRestore();
  });
});
