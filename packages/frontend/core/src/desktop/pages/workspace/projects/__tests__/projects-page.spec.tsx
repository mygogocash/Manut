/**
 * @vitest-environment happy-dom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const WorkspaceServiceToken = vi.hoisted(() => class WorkspaceService {});
const WorkbenchServiceToken = vi.hoisted(() => class WorkbenchService {});
const queryState = vi.hoisted(() => ({
  projects: [] as unknown[],
  tasks: [] as unknown[],
}));

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
  useQuery: ({ query }: { query: { id: string } }) => {
    if (query.id === 'mnTasksQuery') {
      return {
        data: { mnTasks: queryState.tasks },
        error: undefined,
        mutate: vi.fn(),
      };
    }
    return {
      data: { mnProjects: queryState.projects },
      error: undefined,
      mutate: vi.fn(),
    };
  },
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

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-1',
    workspaceId: 'workspace-test',
    name: 'Launch checklist',
    description: 'Stuff to ship',
    status: 'ACTIVE',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Manut projects page', () => {
  beforeEach(() => {
    queryState.projects = [];
    queryState.tasks = [];
  });

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

  test('enables project CSV export when projects are returned', () => {
    queryState.projects = [makeProject()];

    render(<Component />);

    const exportButton = screen.getByTestId(
      'manut-pm-export-projects'
    ) as HTMLButtonElement;
    expect(exportButton).toBeTruthy();
    expect(exportButton.disabled).toBe(false);
  });
});
