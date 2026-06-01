/**
 * @vitest-environment happy-dom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type * as Infra from '@toeverything/infra';
import type { HTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const remindersQueryState = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  error: null as Error | null,
}));
const rulesQueryState = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  error: null as Error | null,
}));

const triggerCreate = vi.hoisted(() => vi.fn(async () => undefined));
const triggerCancel = vi.hoisted(() => vi.fn(async () => undefined));
const triggerCreateRule = vi.hoisted(() => vi.fn(async () => undefined));
const triggerUpdateRule = vi.hoisted(() => vi.fn(async () => undefined));
const triggerDeleteRule = vi.hoisted(() => vi.fn(async () => undefined));
const mutateReminders = vi.hoisted(() => vi.fn(async () => undefined));
const mutateRules = vi.hoisted(() => vi.fn(async () => undefined));
const openConfirmModal = vi.hoisted(() => vi.fn());

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
  Input: () => <input />,
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
  Switch: ({ checked }: { checked: boolean }) => (
    <span data-testid="switch" data-checked={checked} />
  ),
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
  useConfirmModal: () => ({
    openConfirmModal,
    closeConfirmModal: vi.fn(),
  }),
}));

vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: (arg: { query: { id: string } }) => {
    if (arg.query.id === 'mnReminderRulesQuery') {
      return {
        data: rulesQueryState.data,
        isLoading: rulesQueryState.isLoading,
        error: rulesQueryState.error,
        mutate: mutateRules,
      };
    }
    return {
      data: remindersQueryState.data,
      isLoading: remindersQueryState.isLoading,
      error: remindersQueryState.error,
      mutate: mutateReminders,
    };
  },
}));

vi.mock('@affine/core/components/hooks/use-mutation', () => ({
  useMutation: ({ mutation }: { mutation: { id: string } }) => {
    switch (mutation.id) {
      case 'createMnReminderMutation':
        return { trigger: triggerCreate };
      case 'cancelMnReminderMutation':
        return { trigger: triggerCancel };
      case 'createMnReminderRuleMutation':
        return { trigger: triggerCreateRule };
      case 'updateMnReminderRuleMutation':
        return { trigger: triggerUpdateRule };
      case 'deleteMnReminderRuleMutation':
        return { trigger: triggerDeleteRule };
      default:
        return { trigger: vi.fn() };
    }
  },
}));

vi.mock('@affine/core/modules/manut-reminders', () => ({
  mnRemindersQuery: { id: 'mnRemindersQuery' },
  createMnReminderMutation: { id: 'createMnReminderMutation' },
  cancelMnReminderMutation: { id: 'cancelMnReminderMutation' },
  mnReminderRulesQuery: { id: 'mnReminderRulesQuery' },
  createMnReminderRuleMutation: { id: 'createMnReminderRuleMutation' },
  updateMnReminderRuleMutation: { id: 'updateMnReminderRuleMutation' },
  deleteMnReminderRuleMutation: { id: 'deleteMnReminderRuleMutation' },
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

import { Component } from '../index';
import { presetToCron, summarizeCron } from '../rule-modal';

const sampleRule = {
  id: 'rule-1',
  workspaceId: 'workspace-1',
  name: 'Weekly Monday standup',
  enabled: true,
  trigger: 'DATETIME' as const,
  cronExpression: '0 9 * * 1',
  timezone: null,
  config: { body: 'Plan your week.', channel: 'EMAIL' as const },
  lastEvaluatedAt: null,
  nextRunAt: null,
  createdByUserId: 'user-1',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
};

describe('RemindersPage > Rules tab', () => {
  beforeEach(() => {
    remindersQueryState.data = { mnReminders: [] };
    remindersQueryState.isLoading = false;
    remindersQueryState.error = null;
    rulesQueryState.data = { mnReminderRules: [] };
    rulesQueryState.isLoading = false;
    rulesQueryState.error = null;
    triggerCreate.mockClear();
    triggerCancel.mockClear();
    triggerCreateRule.mockClear();
    triggerUpdateRule.mockClear();
    triggerDeleteRule.mockClear();
    mutateReminders.mockClear();
    mutateRules.mockClear();
    openConfirmModal.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  test('renders the Rules tab button in the toolbar', () => {
    render(<Component />);
    expect(screen.getByTestId('reminders-tab-rules')).toBeTruthy();
  });

  test('shows the empty state when there are no rules', async () => {
    rulesQueryState.data = { mnReminderRules: [] };
    render(<Component />);

    const tab = screen.getByTestId('reminders-tab-rules');
    (tab as HTMLButtonElement).click();

    expect(await screen.findByTestId('reminder-rules-empty')).toBeTruthy();
    expect(screen.queryByTestId('reminder-rule-card')).toBeNull();
  });

  test('renders rule cards when rules exist', async () => {
    rulesQueryState.data = { mnReminderRules: [sampleRule] };
    render(<Component />);

    const tab = screen.getByTestId('reminders-tab-rules');
    (tab as HTMLButtonElement).click();

    const card = await screen.findByTestId('reminder-rule-card');
    expect(card).toBeTruthy();
    expect((card as HTMLElement).dataset.ruleId).toBe('rule-1');
    expect(screen.getByText('Weekly Monday standup')).toBeTruthy();
  });

  test('new rule modal only offers backend-supported reminder channels', async () => {
    render(<Component />);

    fireEvent.click(screen.getByTestId('reminders-tab-rules'));
    fireEvent.click(await screen.findByTestId('reminders-new-rule'));
    await screen.findByTestId('modal');

    const channelSelect = document.querySelector(
      '#sf-rule-channel'
    ) as HTMLSelectElement | null;
    expect(channelSelect).toBeTruthy();
    expect(
      Array.from(channelSelect?.options ?? []).map(option => option.value)
    ).toEqual(['EMAIL']);
  });
});

describe('presetToCron', () => {
  test('daily preset at 9:00 yields "0 9 * * *"', () => {
    expect(
      presetToCron({
        frequency: 'daily',
        hour: 9,
        minute: 0,
        weekday: 1,
        monthDay: 1,
      })
    ).toBe('0 9 * * *');
  });

  test('weekly preset Monday at 9:00 yields "0 9 * * 1"', () => {
    expect(
      presetToCron({
        frequency: 'weekly',
        hour: 9,
        minute: 0,
        weekday: 1,
        monthDay: 1,
      })
    ).toBe('0 9 * * 1');
  });

  test('weekly preset Friday at 17:30 yields "30 17 * * 5"', () => {
    expect(
      presetToCron({
        frequency: 'weekly',
        hour: 17,
        minute: 30,
        weekday: 5,
        monthDay: 1,
      })
    ).toBe('30 17 * * 5');
  });

  test('monthly preset day 15 at 8:00 yields "0 8 15 * *"', () => {
    expect(
      presetToCron({
        frequency: 'monthly',
        hour: 8,
        minute: 0,
        weekday: 1,
        monthDay: 15,
      })
    ).toBe('0 8 15 * *');
  });

  test('clamps out-of-range hours and minutes', () => {
    expect(
      presetToCron({
        frequency: 'daily',
        hour: 99,
        minute: 200,
        weekday: 0,
        monthDay: 1,
      })
    ).toBe('59 23 * * *');
  });

  test('clamps monthDay above 28 so every month is valid', () => {
    expect(
      presetToCron({
        frequency: 'monthly',
        hour: 0,
        minute: 0,
        weekday: 0,
        monthDay: 31,
      })
    ).toBe('0 0 28 * *');
  });
});

describe('summarizeCron', () => {
  const weekdayName = (day: number) =>
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day] ?? '';

  test('describes daily schedule', () => {
    expect(summarizeCron('0 9 * * *', weekdayName)).toBe('Daily at 09:00');
  });

  test('describes weekly schedule', () => {
    expect(summarizeCron('0 9 * * 1', weekdayName)).toBe('Every Mon at 09:00');
  });

  test('describes monthly schedule', () => {
    expect(summarizeCron('30 8 15 * *', weekdayName)).toBe(
      'Day 15 of each month at 08:30'
    );
  });

  test('returns the raw expression when shape is non-preset', () => {
    expect(summarizeCron('*/15 * * * *', weekdayName)).toBe('*/15 * * * *');
  });

  test('returns empty string when expression is missing', () => {
    expect(summarizeCron(null, weekdayName)).toBe('');
    expect(summarizeCron('', weekdayName)).toBe('');
  });
});
