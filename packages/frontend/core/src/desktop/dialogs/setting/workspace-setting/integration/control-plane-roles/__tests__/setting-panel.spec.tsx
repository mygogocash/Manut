/**
 * @vitest-environment happy-dom
 */

import type * as AffineComponent from '@affine/component';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const WorkspaceServiceToken = vi.hoisted(() => class WorkspaceService {});
const WorkbenchServiceToken = vi.hoisted(() => class WorkbenchService {});
const useQueryMock = vi.hoisted(() => vi.fn());

const FIVE_ROLES = [
  {
    id: 'role-1',
    workspaceId: 'workspace-test',
    slug: 'release-captain',
    displayName: 'Release Captain',
    adapter: 'github-actions',
    responsibility: 'Names the release, records commit/image facts.',
    escalation: null,
    lastSuccessfulRunId: null,
    lastSeenAt: null,
    createdAt: '2026-05-13T10:00:00.000Z',
    updatedAt: '2026-05-13T10:00:00.000Z',
  },
  {
    id: 'role-2',
    workspaceId: 'workspace-test',
    slug: 'builder',
    displayName: 'Builder',
    adapter: 'github-actions',
    responsibility: 'Produces the immutable Linux amd64 image.',
    escalation: null,
    lastSuccessfulRunId: 'run-42',
    lastSeenAt: '2026-05-13T11:00:00.000Z',
    createdAt: '2026-05-13T10:00:00.000Z',
    updatedAt: '2026-05-13T10:00:00.000Z',
  },
  {
    id: 'role-3',
    workspaceId: 'workspace-test',
    slug: 'verifier',
    displayName: 'Verifier',
    adapter: 'github-actions',
    responsibility: 'Checks build, bundle, prompt seed, GraphQL, smoke.',
    escalation: 'page on-call',
    lastSuccessfulRunId: null,
    lastSeenAt: null,
    createdAt: '2026-05-13T10:00:00.000Z',
    updatedAt: '2026-05-13T10:00:00.000Z',
  },
  {
    id: 'role-4',
    workspaceId: 'workspace-test',
    slug: 'deployer',
    displayName: 'Deployer',
    adapter: 'deploy.sh',
    responsibility: 'Swaps production only after sidecar validation.',
    escalation: null,
    lastSuccessfulRunId: null,
    lastSeenAt: null,
    createdAt: '2026-05-13T10:00:00.000Z',
    updatedAt: '2026-05-13T10:00:00.000Z',
  },
  {
    id: 'role-5',
    workspaceId: 'workspace-test',
    slug: 'historian',
    displayName: 'Historian',
    adapter: 'docs',
    responsibility: 'Keeps durable docs current; lists follow-up risk.',
    escalation: null,
    lastSuccessfulRunId: null,
    lastSeenAt: null,
    createdAt: '2026-05-13T10:00:00.000Z',
    updatedAt: '2026-05-13T10:00:00.000Z',
  },
];

const triggerMock = vi.fn();

vi.mock('@affine/core/modules/workspace', () => ({
  WorkspaceService: WorkspaceServiceToken,
}));

vi.mock('@affine/core/modules/workbench', () => ({
  WorkbenchService: WorkbenchServiceToken,
}));

vi.mock('@affine/error', () => ({
  isGraphQLSchemaValidationError: () => false,
}));

vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: useQueryMock,
}));

vi.mock('@affine/core/components/hooks/use-mutation', () => ({
  useMutation: () => ({
    trigger: triggerMock,
    isMutating: false,
  }),
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

// Stub the integration setting wrapper so we don't need the global CSS.
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

// Stub Modal so we can interact with the form synchronously without
// portal mount complexity.
vi.mock('@affine/component', async () => {
  const actual =
    await vi.importActual<typeof AffineComponent>('@affine/component');
  return {
    ...actual,
    Modal: ({
      open,
      children,
    }: {
      open: boolean;
      children: React.ReactNode;
    }) => (open ? <div data-stub="Modal">{children}</div> : null),
    Input: ({
      value,
      onChange,
      ...rest
    }: {
      value: string;
      onChange: (next: string) => void;
      [key: string]: unknown;
    }) => (
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    ),
    notify: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

import { ControlPlaneRolesSettingPanel } from '../setting-panel';

describe('Control Plane roles setting panel', () => {
  beforeEach(() => {
    triggerMock.mockReset();
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue({
      data: { agentRoles: FIVE_ROLES },
      error: undefined,
      mutate: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  test('renders all five role rows', () => {
    render(<ControlPlaneRolesSettingPanel />);

    const rows = screen.getAllByTestId('cp-role-row');
    expect(rows).toHaveLength(5);

    const names = screen
      .getAllByTestId('cp-role-display-name')
      .map(el => el.textContent);
    expect(names).toEqual([
      'Release Captain',
      'Builder',
      'Verifier',
      'Deployer',
      'Historian',
    ]);
  });

  test('renders a local control-plane error instead of bubbling query failures', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    useQueryMock.mockImplementation(() => {
      throw new Error('Unhandled error raised. Please contact us for help.');
    });

    render(<ControlPlaneRolesSettingPanel />);

    const alert = await screen.findByTestId('cp-roles-error-boundary');
    expect(alert.textContent).toContain('Failed to load control plane');
    expect(alert.textContent).toContain('Unhandled error raised');
    expect(screen.queryByText('Something is wrong...')).toBeNull();
    consoleError.mockRestore();
  });

  test('clicking Edit opens the modal with the role pre-filled', () => {
    render(<ControlPlaneRolesSettingPanel />);

    const editButtons = screen.getAllByTestId('cp-role-edit-button');
    fireEvent.click(editButtons[0]);

    const slug = screen.getByTestId('cp-role-edit-slug') as HTMLInputElement;
    const displayName = screen.getByTestId(
      'cp-role-edit-display-name'
    ) as HTMLInputElement;
    const adapter = screen.getByTestId(
      'cp-role-edit-adapter'
    ) as HTMLInputElement;

    expect(slug.value).toBe('release-captain');
    expect(slug).toHaveProperty('disabled', true);
    expect(displayName.value).toBe('Release Captain');
    expect(adapter.value).toBe('github-actions');
  });

  test('submitting an updated display name calls the mutation', async () => {
    triggerMock.mockResolvedValue({
      updateAgentRole: {
        ...FIVE_ROLES[0],
        displayName: 'Lead Captain',
      },
    });

    render(<ControlPlaneRolesSettingPanel />);

    const editButtons = screen.getAllByTestId('cp-role-edit-button');
    fireEvent.click(editButtons[0]);

    const displayName = screen.getByTestId(
      'cp-role-edit-display-name'
    ) as HTMLInputElement;
    fireEvent.change(displayName, { target: { value: 'Lead Captain' } });

    const submit = screen.getByTestId('cp-role-edit-submit');
    fireEvent.click(submit);

    await waitFor(() => {
      expect(triggerMock).toHaveBeenCalledTimes(1);
    });
    const callArg = triggerMock.mock.calls[0][0] as {
      workspaceId: string;
      slug: string;
      input: {
        displayName: string;
        adapter: string;
        escalation: string | null;
      };
    };
    expect(callArg.workspaceId).toBe('workspace-test');
    expect(callArg.slug).toBe('release-captain');
    expect(callArg.input.displayName).toBe('Lead Captain');
    expect(callArg.input.adapter).toBe('github-actions');
  });
});
