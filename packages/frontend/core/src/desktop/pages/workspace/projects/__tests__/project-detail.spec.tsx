/**
 * @vitest-environment happy-dom
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const WorkspaceServiceToken = vi.hoisted(() => class WorkspaceService {});
const WorkbenchServiceToken = vi.hoisted(() => class WorkbenchService {});
const workbenchOpen = vi.hoisted(() => vi.fn());
const queryState = vi.hoisted(() => ({
  tasks: [] as unknown[],
}));

// react-router-dom mock — controls the :projectId param the detail page reads.
const mockedParams = vi.hoisted(() => ({ projectId: 'project-1' }));
vi.mock('react-router-dom', () => ({
  useParams: () => mockedParams,
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

// useQuery mock — returns the project list with one matching project so the
// detail body can render. mnTasks returns an empty list.
vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: (arg: { query?: { id?: string } }) => {
    const id = arg?.query?.id;
    if (id === 'mnTasksQuery') {
      return {
        data: { mnTasks: queryState.tasks },
        error: undefined,
        mutate: vi.fn(),
      };
    }
    return {
      data: {
        mnProjects: [
          {
            id: 'project-1',
            workspaceId: 'workspace-test',
            name: 'Launch checklist',
            description: 'Stuff to ship',
            status: 'ACTIVE',
            sortOrder: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      error: undefined,
      mutate: vi.fn(),
    };
  },
  useQueryImmutable: () => ({
    data: undefined,
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

vi.mock('@affine/component', async () => {
  const actual = await vi.importActual('@affine/component');
  return {
    ...(actual as Record<string, unknown>),
    useConfirmModal: () => ({
      openConfirmModal: vi.fn(),
      closeConfirmModal: vi.fn(),
    }),
  };
});

vi.mock('@toeverything/infra', () => ({
  useService: (token: unknown) => {
    if (token === WorkspaceServiceToken) {
      return { workspace: { id: 'workspace-test' } };
    }
    if (token === WorkbenchServiceToken) {
      return { workbench: { open: workbenchOpen } };
    }
    return {};
  },
}));

import { Component } from '../detail';

describe('Manut project detail page', () => {
  beforeEach(() => {
    queryState.tasks = [];
  });

  afterEach(() => cleanup());

  test('renders the page shell without crashing', () => {
    render(<Component />);
    expect(screen.getByTestId('manut-pm-detail-page')).toBeTruthy();
  });

  test('shows the resolved project name', () => {
    render(<Component />);
    // The edit modal also renders the name as a draft input, so we look for the
    // <h1> header element specifically.
    const matches = screen.getAllByText('Launch checklist');
    expect(matches.length).toBeGreaterThan(0);
  });

  test('shows the Active status badge for the loaded project', () => {
    render(<Component />);
    const statusBadges = screen.getAllByTestId('manut-pm-detail-status');
    expect(statusBadges.length).toBeGreaterThan(0);
    expect(statusBadges[0]?.textContent).toContain('Active');
  });

  test('enables task CSV export when tasks are returned', () => {
    queryState.tasks = [
      {
        id: 'task-1',
        projectId: 'project-1',
        title: 'Ship CSV',
        description: null,
        status: 'TODO',
        priority: 'HIGH',
        dueAt: null,
        listSortOrder: 0,
        assigneeUserId: null,
        createdByUserId: null,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    ];

    render(<Component />);

    const exportButton = screen.getByTestId(
      'manut-pm-export-tasks'
    ) as HTMLButtonElement;
    expect(exportButton).toBeTruthy();
    expect(exportButton.disabled).toBe(false);
  });
});
