/**
 * @vitest-environment happy-dom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type * as Infra from '@toeverything/infra';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const WorkspaceServiceToken = vi.hoisted(() => class WorkspaceService {});
const queryState = vi.hoisted(() => ({
  accounts: [] as unknown[],
  contacts: [] as unknown[],
  deals: [] as unknown[],
  stages: [] as unknown[],
  activities: [] as unknown[],
}));
const queryCalls = vi.hoisted(() => [] as Array<{ id: string; config: any }>);
// Tracks every useMutation trigger call so tests can assert that a
// specific mutation fired with the expected payload. Keyed by mutation
// `id` so tests don't have to thread the same trigger fn through React.
const mutationState = vi.hoisted(() => ({
  calls: [] as Array<{ id: string; vars: unknown }>,
  triggerImpl: vi.fn(async () => ({
    // Default: return a "successful update" envelope shaped like the
    // real response. Tests that want a different shape can override
    // via `mutationState.triggerImpl.mockImplementationOnce(...)`.
    updateMnCrmAccount: { id: 'account-1' },
  })),
}));

vi.mock('@affine/component', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
    disabled?: boolean;
    [key: string]: unknown;
  }) => {
    // Pass through any data-* attributes so tests can locate buttons by
    // their data-testid. The real Button forwards these onto the
    // rendered <button>; the stub needs to do the same.
    const dataProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (key.startsWith('data-')) dataProps[key] = value;
    }
    return (
      <button onClick={onClick} disabled={disabled} {...dataProps}>
        {children}
      </button>
    );
  },
  Input: ({
    value,
    onChange,
    ...rest
  }: {
    value?: string;
    onChange?: (value: string) => void;
    [key: string]: unknown;
  }) => {
    const dataProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (key.startsWith('data-')) dataProps[key] = value;
    }
    return (
      <input
        value={value ?? ''}
        onChange={event => onChange?.(event.target.value)}
        {...dataProps}
      />
    );
  },
  Menu: ({ children }: { children: ReactNode; items: ReactNode }) => (
    <div>{children}</div>
  ),
  MenuItem: ({
    children,
    onSelect,
  }: {
    children?: ReactNode;
    onSelect?: () => void;
  }) => <button onClick={onSelect}>{children}</button>,
  MenuTrigger: ({ children }: { children?: ReactNode }) => (
    <button>{children}</button>
  ),
  Modal: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? <div>{children}</div> : null,
  Skeleton: () => <div data-testid="skeleton" />,
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Tabs: {
    Root: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    List: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Trigger: ({ children }: { children?: ReactNode }) => (
      <button>{children}</button>
    ),
    Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: (
    { query }: { query: { id: string } },
    config?: Record<string, unknown>
  ) => {
    queryCalls.push({ id: query.id, config });
    switch (query.id) {
      case 'mnCrmAccountsQuery':
        return {
          data: { mnCrmAccounts: queryState.accounts },
          mutate: vi.fn(async () => undefined),
        };
      case 'mnCrmContactsQuery':
        return {
          data: { mnCrmContacts: queryState.contacts },
          mutate: vi.fn(async () => undefined),
        };
      case 'mnCrmDealStagesQuery':
        return {
          data: { mnCrmDealStages: queryState.stages },
          mutate: vi.fn(async () => undefined),
        };
      case 'mnCrmDealsQuery':
        return {
          data: { mnCrmDeals: queryState.deals },
          mutate: vi.fn(async () => undefined),
        };
      case 'mnCrmActivitiesQuery':
        return {
          data: { mnCrmActivities: queryState.activities },
          mutate: vi.fn(async () => undefined),
        };
      default:
        return { data: undefined, mutate: vi.fn(async () => undefined) };
    }
  },
}));

vi.mock('@affine/core/components/hooks/use-mutation', () => ({
  useMutation: ({ mutation }: { mutation: { id: string } }) => ({
    trigger: async (vars: unknown) => {
      mutationState.calls.push({ id: mutation.id, vars });
      return mutationState.triggerImpl();
    },
  }),
}));

vi.mock('@affine/core/components/pure/swr-error-bundary', () => ({
  SWRErrorBoundary: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@affine/core/modules/workspace', () => ({
  WorkspaceService: WorkspaceServiceToken,
}));

vi.mock('@affine/core/modules/workbench', () => ({
  ViewBody: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ViewHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ViewIcon: () => null,
  ViewTitle: () => null,
}));

vi.mock('@affine/i18n', () => ({
  useI18n: () =>
    new Proxy(
      {},
      {
        get: (_, key: string) => () => key,
      }
    ),
}));

vi.mock('@blocksuite/icons/rc', () => ({
  CollaborationIcon: () => <span>collab-icon</span>,
  DownloadIcon: () => <span>download-icon</span>,
}));

vi.mock('../../../../../components/pure/header', () => ({
  Header: ({ left }: { left?: ReactNode }) => <header>{left}</header>,
}));

vi.mock('../../layouts/all-doc-sidebar-tabs', () => ({
  AllDocSidebarTabs: () => null,
}));

vi.mock('@toeverything/infra', async importOriginal => {
  const actual = await importOriginal<typeof Infra>();
  return {
    ...actual,
    useService: (token: unknown) => {
      if (token === WorkspaceServiceToken) {
        return { workspace: { id: 'workspace-1' } };
      }
      return {};
    },
  };
});

import { Component } from '../index';

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'account-1',
    workspaceId: 'workspace-1',
    name: 'Acme Inc.',
    website: null,
    industry: null,
    notes: null,
    ownerUserId: null,
    createdAt: '2026-05-12T00:00:00.000Z',
    updatedAt: '2026-05-12T00:00:00.000Z',
    ...overrides,
  };
}

describe('CrmPage', () => {
  beforeEach(() => {
    cleanup();
    queryState.accounts = [];
    queryState.contacts = [];
    queryState.deals = [];
    queryState.stages = [];
    queryState.activities = [];
    queryCalls.length = 0;
    mutationState.calls = [];
    mutationState.triggerImpl.mockClear();
    mutationState.triggerImpl.mockImplementation(async () => ({
      updateMnCrmAccount: makeAccount({ name: 'Updated Inc.' }),
    }));
  });

  afterEach(() => {
    cleanup();
  });

  test('renders tab triggers for accounts, contacts, deals, and activities', () => {
    render(<Component />);

    expect(screen.getByText('com.manut.crm.tab.accounts')).toBeTruthy();
    expect(screen.getByText('com.manut.crm.tab.contacts')).toBeTruthy();
    expect(screen.getByText('com.manut.crm.tab.deals')).toBeTruthy();
    expect(screen.getByText('com.manut.crm.tab.activities')).toBeTruthy();
  });

  test('enables live refresh for CRM workspace data queries', () => {
    render(<Component />);

    const dataQueries = queryCalls.filter(call =>
      [
        'mnCrmAccountsQuery',
        'mnCrmContactsQuery',
        'mnCrmDealStagesQuery',
        'mnCrmDealsQuery',
        'mnCrmActivitiesQuery',
      ].includes(call.id)
    );
    expect(dataQueries.length).toBeGreaterThan(0);
    expect(
      dataQueries.every(call => call.config?.refreshInterval === 30_000)
    ).toBe(true);
  });

  test('shows the accounts empty state when no accounts exist', () => {
    render(<Component />);

    expect(screen.getByTestId('crm-accounts-empty')).toBeTruthy();
  });

  test('renders an account row when accounts are returned', () => {
    queryState.accounts = [makeAccount()];

    render(<Component />);

    expect(screen.getByText('Acme Inc.')).toBeTruthy();
    expect(screen.queryByTestId('crm-accounts-empty')).toBeNull();
  });

  test('enables CSV export when accounts are returned', () => {
    queryState.accounts = [makeAccount()];

    render(<Component />);

    const exportButton = screen.getByTestId(
      'crm-export-accounts'
    ) as HTMLButtonElement;
    expect(exportButton).toBeTruthy();
    expect(exportButton.disabled).toBe(false);
  });

  test('renders a Kanban column per deal stage with linked deals', () => {
    queryState.stages = [
      {
        id: 'stage-discover',
        workspaceId: 'workspace-1',
        pipelineKey: 'default',
        name: 'Discovery',
        sortOrder: 0,
        createdAt: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'stage-won',
        workspaceId: 'workspace-1',
        pipelineKey: 'default',
        name: 'Won',
        sortOrder: 1,
        createdAt: '2026-05-01T00:00:00.000Z',
      },
    ];
    queryState.deals = [
      {
        id: 'deal-1',
        workspaceId: 'workspace-1',
        accountId: null,
        contactId: null,
        stageId: 'stage-discover',
        name: 'Big launch',
        value: 5000,
        currency: 'USD',
        probability: null,
        expectedCloseAt: null,
        ownerUserId: null,
        createdAt: '2026-05-10T00:00:00.000Z',
        updatedAt: '2026-05-10T00:00:00.000Z',
      },
    ];

    render(<Component />);

    // The Kanban replaces the previous grouped list — both stages render
    // as columns and the deal lands in the right one.
    expect(
      screen.getByTestId('crm-deals-kanban-column-stage-discover')
    ).toBeTruthy();
    expect(
      screen.getByTestId('crm-deals-kanban-column-stage-won')
    ).toBeTruthy();
    expect(screen.getByTestId('crm-deals-kanban-card-deal-1')).toBeTruthy();
    expect(screen.getByText('Big launch')).toBeTruthy();
  });

  // -- detail panel ----------------------------------------------------------

  test('clicking an account row opens its detail panel', () => {
    queryState.accounts = [makeAccount({ industry: 'Saas' })];

    render(<Component />);

    // Before click: detail panel header is hidden because Modal mock
    // gates content on `open`. The row should be present though.
    expect(screen.queryByTestId('account-detail-name')).toBeNull();

    fireEvent.click(screen.getByTestId('crm-account-row-account-1'));

    // After click: the AccountDetailBody renders. The name + industry
    // fields are rendered as DetailField children with the matching
    // test IDs.
    expect(screen.getByTestId('account-detail-name')).toBeTruthy();
  });

  // -- edit flow -------------------------------------------------------------

  test('saving from the account edit modal fires updateMnCrmAccount with the right input', async () => {
    queryState.accounts = [
      makeAccount({ name: 'Original Inc.', industry: 'Saas' }),
    ];

    render(<Component />);

    // Open detail panel.
    fireEvent.click(screen.getByTestId('crm-account-row-account-1'));
    // Open edit modal.
    fireEvent.click(screen.getByTestId('crm-detail-edit'));
    // Modify the name field.
    const nameInput = screen.getByTestId(
      'account-edit-name'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Renamed Inc.' } });
    // Click save.
    fireEvent.click(screen.getByTestId('account-edit-save'));

    // Let the async submit resolve. handleSubmit returns a promise but
    // the click handler doesn't await it, so we yield a microtask.
    await Promise.resolve();

    const updateCalls = mutationState.calls.filter(
      c => c.id === 'updateMnCrmAccountMutation'
    );
    expect(updateCalls.length).toBe(1);
    const vars = updateCalls[0]?.vars as
      | { accountId: string; input: { name: string; industry: string | null } }
      | undefined;
    expect(vars).toBeTruthy();
    expect(vars?.accountId).toBe('account-1');
    expect(vars?.input.name).toBe('Renamed Inc.');
    // The industry field was untouched — should be preserved as-is.
    expect(vars?.input.industry).toBe('Saas');
  });
});
