/**
 * @vitest-environment happy-dom
 */

import { cleanup, render, screen } from '@testing-library/react';
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

vi.mock('@affine/component', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: ReactNode;
    onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Input: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (value: string) => void;
  }) => (
    <input
      value={value ?? ''}
      onChange={event => onChange?.(event.target.value)}
    />
  ),
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
  useQuery: ({ query }: { query: { id: string } }) => {
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
  useMutation: () => ({ trigger: vi.fn(async () => undefined) }),
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

describe('CrmPage', () => {
  beforeEach(() => {
    cleanup();
    queryState.accounts = [];
    queryState.contacts = [];
    queryState.deals = [];
    queryState.stages = [];
    queryState.activities = [];
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

  test('shows the accounts empty state when no accounts exist', () => {
    render(<Component />);

    expect(screen.getByTestId('crm-accounts-empty')).toBeTruthy();
  });

  test('renders an account row when accounts are returned', () => {
    queryState.accounts = [
      {
        id: 'account-1',
        workspaceId: 'workspace-1',
        name: 'Acme Inc.',
        website: null,
        industry: null,
        notes: null,
        ownerUserId: null,
        createdAt: '2026-05-12T00:00:00.000Z',
        updatedAt: '2026-05-12T00:00:00.000Z',
      },
    ];

    render(<Component />);

    expect(screen.getByText('Acme Inc.')).toBeTruthy();
    expect(screen.queryByTestId('crm-accounts-empty')).toBeNull();
  });
});
