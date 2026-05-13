/**
 * @vitest-environment happy-dom
 */

import { cleanup, render, screen } from '@testing-library/react';
import type * as Infra from '@toeverything/infra';
import type {
  HTMLAttributes,
  InputHTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const useQueryState = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  error: null as Error | null,
}));
const triggerCreate = vi.hoisted(() => vi.fn(async () => undefined));
const triggerCancel = vi.hoisted(() => vi.fn(async () => undefined));
const mutateQuery = vi.hoisted(() => vi.fn(async () => undefined));
const WorkspaceServiceToken = vi.hoisted(() => class WorkspaceService {});

vi.mock('@affine/component', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    loading,
    ...rest
  }: {
    children: ReactNode;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    loading?: boolean;
  } & HTMLAttributes<HTMLButtonElement>) => (
    <button {...rest} disabled={disabled} onClick={onClick}>
      {loading ? 'loading…' : children}
    </button>
  ),
  Input: ({
    onChange,
    ...rest
  }: {
    onChange?: (value: string) => void;
  } & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'>) => (
    <input
      {...rest}
      onChange={event => {
        onChange?.(event.target.value);
      }}
    />
  ),
  Modal: ({
    open,
    children,
    title,
  }: {
    open: boolean;
    children: ReactNode;
    title?: ReactNode;
  }) =>
    open ? (
      <div data-testid="modal">
        {title}
        {children}
      </div>
    ) : null,
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: () => ({
    data: useQueryState.data,
    isLoading: useQueryState.isLoading,
    error: useQueryState.error,
    mutate: mutateQuery,
  }),
}));

vi.mock('@affine/core/components/hooks/use-mutation', () => ({
  useMutation: ({ mutation }: { mutation: { id: string } }) => ({
    trigger:
      mutation.id === 'createMnReminderMutation'
        ? triggerCreate
        : triggerCancel,
  }),
}));

vi.mock('@affine/core/modules/superflow-reminders', () => ({
  mnRemindersQuery: { id: 'mnRemindersQuery' },
  createMnReminderMutation: { id: 'createMnReminderMutation' },
  cancelMnReminderMutation: { id: 'cancelMnReminderMutation' },
}));

vi.mock('@affine/core/modules/workbench', () => ({
  ViewBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ViewHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ViewIcon: () => null,
  ViewTitle: () => null,
}));

vi.mock('@affine/core/modules/workspace', () => ({
  WorkspaceService: WorkspaceServiceToken,
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
  TodayIcon: () => <span>today-icon</span>,
}));

vi.mock('../../../../../components/pure/header', () => ({
  Header: ({ left }: { left: ReactNode }) => <header>{left}</header>,
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
        return {
          workspace: { id: 'workspace-1' },
        };
      }
      return {};
    },
  };
});

import { classifyReminder, Component } from '../index';

describe('RemindersPage', () => {
  beforeEach(() => {
    useQueryState.data = { mnReminders: [] };
    useQueryState.isLoading = false;
    useQueryState.error = null;
    triggerCreate.mockClear();
    triggerCancel.mockClear();
    mutateQuery.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  test('renders the empty state for the default Due tab when there are no reminders', () => {
    render(<Component />);

    expect(screen.getByTestId('reminders-page')).toBeTruthy();
    expect(screen.getByTestId('reminders-empty')).toBeTruthy();
    expect(screen.getByTestId('reminders-tab-due')).toBeTruthy();
    expect(screen.getByTestId('reminders-tab-upcoming')).toBeTruthy();
    expect(screen.getByTestId('reminders-tab-done')).toBeTruthy();
    expect(screen.queryByTestId('reminders-loading')).toBeNull();
    expect(screen.queryByTestId('reminders-error')).toBeNull();
    expect(screen.queryByTestId('reminder-card')).toBeNull();
  });

  test('shows the loading skeleton when the query is loading and there is no data yet', () => {
    useQueryState.data = undefined;
    useQueryState.isLoading = true;

    render(<Component />);

    expect(screen.getByTestId('reminders-loading')).toBeTruthy();
  });

  test('shows the error state when the query fails', () => {
    useQueryState.data = undefined;
    useQueryState.error = new Error('boom');

    render(<Component />);

    expect(screen.getByTestId('reminders-error')).toBeTruthy();
    expect(screen.getByText('boom')).toBeTruthy();
  });
});

describe('classifyReminder', () => {
  const baseReminder = {
    id: 'r1',
    workspaceId: 'w1',
    userId: 'u1',
    title: 'Test',
    body: null,
    channel: 'EMAIL' as const,
    status: 'SCHEDULED' as const,
    relatedEntityType: null,
    relatedEntityId: null,
    ruleId: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    fireAt: '2026-01-01T00:00:00Z',
  };

  test('returns "due" when a SCHEDULED reminder is at or past its fire time', () => {
    const now = Date.parse('2026-01-01T01:00:00Z');
    expect(classifyReminder(baseReminder, now)).toBe('due');
  });

  test('returns "upcoming" when a SCHEDULED reminder fires in the future', () => {
    const now = Date.parse('2025-12-31T00:00:00Z');
    expect(classifyReminder(baseReminder, now)).toBe('upcoming');
  });

  test('returns "done" for COMPLETED reminders regardless of fireAt', () => {
    const now = Date.parse('2026-01-01T01:00:00Z');
    expect(
      classifyReminder({ ...baseReminder, status: 'COMPLETED' }, now)
    ).toBe('done');
  });

  test('returns "done" for CANCELLED reminders', () => {
    const now = Date.parse('2026-01-01T01:00:00Z');
    expect(
      classifyReminder({ ...baseReminder, status: 'CANCELLED' }, now)
    ).toBe('done');
  });

  test('returns "done" for FAILED reminders', () => {
    const now = Date.parse('2026-01-01T01:00:00Z');
    expect(classifyReminder({ ...baseReminder, status: 'FAILED' }, now)).toBe(
      'done'
    );
  });
});
