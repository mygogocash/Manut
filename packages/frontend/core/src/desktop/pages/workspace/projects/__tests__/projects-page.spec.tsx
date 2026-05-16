/**
 * @vitest-environment happy-dom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

const WorkspaceServiceToken = vi.hoisted(() => class WorkspaceService {});
const WorkbenchServiceToken = vi.hoisted(() => class WorkbenchService {});

vi.mock('@affine/core/modules/workspace', () => ({
  WorkspaceService: WorkspaceServiceToken,
}));

vi.mock('@affine/core/modules/workbench', () => ({
  ViewBody: ({ children }: { children: React.ReactNode }) => (
    <div data-stub="ViewBody">{children}</div>
  ),
  ViewHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-stub="ViewHeader">{children}</div>
  ),
  ViewIcon: () => null,
  ViewTitle: () => null,
  WorkbenchService: WorkbenchServiceToken,
}));

vi.mock('../../layouts/all-doc-sidebar-tabs', () => ({
  AllDocSidebarTabs: () => null,
}));

vi.mock('../../../../../components/pure/header', () => ({
  Header: ({
    left,
    right,
  }: {
    left?: React.ReactNode;
    right?: React.ReactNode;
  }) => (
    <header>
      {left}
      {right}
    </header>
  ),
}));

vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: () => ({
    data: { mnProjects: [] },
    error: undefined,
    mutate: vi.fn(),
  }),
  useQueryImmutable: () => ({
    data: { mnProjects: [] },
    error: undefined,
    mutate: vi.fn(),
  }),
  useQueryInfinite: () => ({
    data: undefined,
    error: undefined,
    loadingMore: false,
    loadMore: vi.fn(),
  }),
}));

vi.mock('@affine/core/components/hooks/use-mutation', () => ({
  useMutation: () => ({
    trigger: vi.fn().mockResolvedValue({}),
    isMutating: false,
  }),
  useMutateQueryResource: () => vi.fn(),
}));

vi.mock('@toeverything/infra', () => ({
  useService: (token: unknown) => {
    if (token === WorkspaceServiceToken) {
      return { workspace: { id: 'workspace-test' } };
    }
    if (token === WorkbenchServiceToken) {
      return { workbench: { open: vi.fn() } };
    }
    return {};
  },
}));

import { Component } from '../index';

describe('Manut projects page', () => {
  afterEach(() => cleanup());

  test('renders the empty state when there are no projects', () => {
    render(<Component />);

    const empty = screen.getByTestId('manut-pm-empty');
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain('No projects yet');
    expect(empty.textContent).toContain('Create your first project');
  });

  test('renders the list/kanban view toggle in the header', () => {
    render(<Component />);

    expect(screen.getByTestId('manut-pm-view-list')).toBeTruthy();
    expect(screen.getByTestId('manut-pm-view-kanban')).toBeTruthy();
    // Default is the list view so the kanban container shouldn't be in the DOM.
    expect(screen.queryByTestId('manut-pm-kanban')).toBeNull();
  });

  test('switches to the Kanban view when the toggle is clicked', () => {
    render(<Component />);

    fireEvent.click(screen.getByTestId('manut-pm-view-kanban'));

    // We still see the empty state because no projects exist, but the
    // toggle reflects the active mode via `data-active`.
    expect(
      (screen.getByTestId('manut-pm-view-kanban') as HTMLElement).dataset[
        'active'
      ]
    ).toBe('true');
    expect(
      (screen.getByTestId('manut-pm-view-list') as HTMLElement).dataset[
        'active'
      ]
    ).toBe('false');
  });
});
