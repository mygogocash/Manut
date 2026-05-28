/**
 * @vitest-environment happy-dom
 */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const WorkspaceServiceToken = vi.hoisted(() => class WorkspaceService {});
const useQueryMock = vi.hoisted(() => vi.fn());
const triggerMock = vi.fn();

vi.mock('@affine/core/modules/workspace', () => ({
  WorkspaceService: WorkspaceServiceToken,
}));

vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: useQueryMock,
}));

vi.mock('@affine/core/components/hooks/use-mutation', () => ({
  useMutation: () => ({
    trigger: triggerMock,
  }),
}));

vi.mock('@toeverything/infra', () => ({
  useService: (token: unknown) => {
    if (token === WorkspaceServiceToken) {
      return { workspace: { id: 'workspace-test' } };
    }
    return {};
  },
}));

vi.mock('../../setting', () => ({
  IntegrationSettingHeader: ({
    name,
    desc,
  }: {
    name: string;
    desc: string;
  }) => (
    <header data-stub="IntegrationSettingHeader">
      <h1>{name}</h1>
      <p>{desc}</p>
    </header>
  ),
}));

vi.mock('@affine/component', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

import { MongoDbSettingPanel } from '../setting-panel';

describe('MongoDB setting panel', () => {
  beforeEach(() => {
    triggerMock.mockReset();
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue({
      data: { mongoDbConnection: null },
      mutate: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  test('renders connection form when MongoDB is disconnected', () => {
    render(<MongoDbSettingPanel />);

    expect(screen.getByText('MongoDB')).toBeTruthy();
    expect(screen.getByText('Connection string')).toBeTruthy();
  });

  test('renders a local MongoDB settings error instead of bubbling query failures', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    useQueryMock.mockImplementation(() => {
      throw new Error('An internal error occurred.');
    });

    render(<MongoDbSettingPanel />);

    const alert = await screen.findByTestId('mongodb-settings-error-boundary');
    expect(alert.textContent).toContain('Failed to load MongoDB settings');
    expect(alert.textContent).toContain('An internal error occurred.');
    expect(screen.queryByText('Something is wrong...')).toBeNull();
    consoleError.mockRestore();
  });
});
