import { Button, Input, Modal, notify } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  cancelSfReminderMutation,
  createSfReminderMutation,
  type SfReminderDto,
  sfRemindersQuery,
  type SfReminderStatus,
} from '@affine/core/modules/superflow-reminders';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { TodayIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import { Header } from '../../../../components/pure/header';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import * as styles from './styles.css';

type TabKey = 'due' | 'upcoming' | 'done';

interface NewReminderFormState {
  title: string;
  body: string;
  fireAtLocal: string;
}

const EMPTY_FORM: NewReminderFormState = {
  title: '',
  body: '',
  fireAtLocal: '',
};

const ACTIVE_STATUSES: ReadonlySet<SfReminderStatus> = new Set([
  'SCHEDULED',
  'PROCESSING',
]);

function classifyReminder(reminder: SfReminderDto, now: number): TabKey {
  if (!ACTIVE_STATUSES.has(reminder.status)) {
    return 'done';
  }
  const fireAt = Date.parse(reminder.fireAt);
  if (Number.isNaN(fireAt) || fireAt <= now) {
    return 'due';
  }
  return 'upcoming';
}

function statusBadgeClass(status: SfReminderStatus, isDue: boolean): string {
  if (status === 'COMPLETED') return styles.badgeDone;
  if (status === 'CANCELLED') return styles.badgeScheduled;
  if (status === 'FAILED') return styles.badgeFailed;
  if (isDue) return styles.badgeDue;
  return styles.badgeScheduled;
}

function formatFireAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function defaultFireAtLocalInputValue(): string {
  // Default the picker to one hour from now, in the user's local timezone,
  // formatted for <input type="datetime-local">.
  const now = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}`
  );
}

function localInputValueToIsoString(value: string): string | null {
  // <input type="datetime-local"> emits "YYYY-MM-DDTHH:MM" in local time.
  // Date() interprets that as local, which is what we want; then toISOString
  // gives the UTC string the backend expects (GraphQLISODateTime).
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

const RemindersHeader = ({ title }: { title: string }) => (
  <Header
    left={
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        <TodayIcon /> {title}
      </span>
    }
  />
);

interface NewReminderModalProps {
  open: boolean;
  submitting: boolean;
  onSubmit: (form: NewReminderFormState) => Promise<void>;
  onClose: () => void;
}

const NewReminderModal = ({
  open,
  submitting,
  onSubmit,
  onClose,
}: NewReminderModalProps) => {
  const t = useI18n();
  const [form, setForm] = useState<NewReminderFormState>(() => ({
    ...EMPTY_FORM,
    fireAtLocal: defaultFireAtLocalInputValue(),
  }));
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && !submitting) {
        setForm({ ...EMPTY_FORM, fireAtLocal: defaultFireAtLocalInputValue() });
        setSubmitError(null);
        onClose();
      }
    },
    [onClose, submitting]
  );

  const trimmedTitle = form.title.trim();
  const isoFireAt = localInputValueToIsoString(form.fireAtLocal);
  const canSubmit =
    trimmedTitle.length > 0 && isoFireAt !== null && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      await onSubmit({
        title: trimmedTitle,
        body: form.body.trim(),
        fireAtLocal: form.fireAtLocal,
      });
      setForm({ ...EMPTY_FORM, fireAtLocal: defaultFireAtLocalInputValue() });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create reminder.';
      setSubmitError(message);
    }
  }, [canSubmit, form.body, form.fireAtLocal, onSubmit, trimmedTitle]);

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={t['com.superflow.reminders.modal.title']()}
      description={t['com.superflow.reminders.modal.description']()}
      width={480}
      persistent={submitting}
    >
      <div className={styles.modalBody}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="sf-reminder-title">
            {t['com.superflow.reminders.field.title.label']()}
          </label>
          <Input
            id="sf-reminder-title"
            value={form.title}
            placeholder={t['com.superflow.reminders.field.title.placeholder']()}
            onChange={value => setForm(prev => ({ ...prev, title: value }))}
            disabled={submitting}
            autoFocus
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="sf-reminder-fire-at">
            {t['com.superflow.reminders.field.dueAt.label']()}
          </label>
          <input
            id="sf-reminder-fire-at"
            type="datetime-local"
            className={styles.datetimeInput}
            value={form.fireAtLocal}
            onChange={event =>
              setForm(prev => ({
                ...prev,
                fireAtLocal: event.target.value,
              }))
            }
            disabled={submitting}
          />
          <div className={styles.fieldHint}>
            {t['com.superflow.reminders.field.dueAt.hint']()}
          </div>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="sf-reminder-body">
            {t['com.superflow.reminders.field.body.label']()}
          </label>
          <textarea
            id="sf-reminder-body"
            className={styles.textarea}
            value={form.body}
            placeholder={t['com.superflow.reminders.field.body.placeholder']()}
            onChange={event =>
              setForm(prev => ({ ...prev, body: event.target.value }))
            }
            disabled={submitting}
          />
        </div>
        {submitError ? (
          <div className={styles.errorState} role="alert">
            {submitError}
          </div>
        ) : null}
      </div>
      <div className={styles.modalActions}>
        <Button
          variant="secondary"
          disabled={submitting}
          onClick={() => handleOpenChange(false)}
        >
          {t['com.superflow.reminders.modal.cancel']()}
        </Button>
        <Button
          variant="primary"
          disabled={!canSubmit}
          loading={submitting}
          onClick={() => void handleSubmit()}
        >
          {t['com.superflow.reminders.modal.submit']()}
        </Button>
      </div>
    </Modal>
  );
};

interface ReminderCardProps {
  reminder: SfReminderDto;
  isDue: boolean;
  cancelling: boolean;
  onCancel: (reminderId: string) => Promise<void>;
}

const ReminderCard = ({
  reminder,
  isDue,
  cancelling,
  onCancel,
}: ReminderCardProps) => {
  const t = useI18n();
  const isActive = ACTIVE_STATUSES.has(reminder.status);
  const badgeLabel: string = (() => {
    if (reminder.status === 'COMPLETED')
      return t['com.superflow.reminders.status.completed']();
    if (reminder.status === 'CANCELLED')
      return t['com.superflow.reminders.status.cancelled']();
    if (reminder.status === 'FAILED')
      return t['com.superflow.reminders.status.failed']();
    if (isDue) return t['com.superflow.reminders.status.due']();
    return t['com.superflow.reminders.status.scheduled']();
  })();

  return (
    <article className={styles.card} data-testid="reminder-card">
      <header className={styles.cardHeader}>
        <div className={styles.cardTitle}>{reminder.title}</div>
        <span
          className={clsx(
            styles.badge,
            statusBadgeClass(reminder.status, isDue)
          )}
        >
          {badgeLabel}
        </span>
      </header>
      {reminder.body ? (
        <div className={styles.cardBody}>{reminder.body}</div>
      ) : null}
      <div className={styles.cardMeta}>
        <span>
          {t['com.superflow.reminders.card.dueAt']()}{' '}
          {formatFireAt(reminder.fireAt)}
        </span>
        <span>·</span>
        <span>{reminder.channel}</span>
      </div>
      {isActive ? (
        <div className={styles.cardActions}>
          <Button
            variant="secondary"
            size="default"
            loading={cancelling}
            disabled={cancelling}
            onClick={() => void onCancel(reminder.id)}
            data-testid="reminder-mark-done"
          >
            {t['com.superflow.reminders.action.markDone']()}
          </Button>
        </div>
      ) : null}
    </article>
  );
};

const LoadingSkeleton = () => (
  <div className={styles.skeleton} data-testid="reminders-loading">
    <div className={styles.skeletonCard} />
    <div className={styles.skeletonCard} />
    <div className={styles.skeletonCard} />
  </div>
);

interface EmptyStateProps {
  tab: TabKey;
}

const EmptyState = ({ tab }: EmptyStateProps) => {
  const t = useI18n();
  const message =
    tab === 'due'
      ? t['com.superflow.reminders.empty.due']()
      : tab === 'upcoming'
        ? t['com.superflow.reminders.empty.upcoming']()
        : t['com.superflow.reminders.empty.done']();
  return (
    <div className={styles.emptyState} data-testid="reminders-empty">
      {message}
    </div>
  );
};

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

const ErrorState = ({ message, onRetry }: ErrorStateProps) => {
  const t = useI18n();
  return (
    <div className={styles.errorState} data-testid="reminders-error">
      <div>{message}</div>
      <Button variant="secondary" onClick={onRetry}>
        {t['com.superflow.reminders.error.retry']()}
      </Button>
    </div>
  );
};

interface RemindersResponse {
  sfReminders?: SfReminderDto[];
}

const RemindersPage = () => {
  const t = useI18n();
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const [activeTab, setActiveTab] = useState<TabKey>('due');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // The local sfReminders operation is not part of the codegen'd
  // discriminated union, so we cast at the boundary — same trick the
  // Gmail/Drive panels use.
  const queryArg = {
    query: sfRemindersQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, isLoading, error, mutate } = useQuery(queryArg, {
    suspense: false,
  });

  const reminders = useMemo<SfReminderDto[]>(() => {
    const typed = data as unknown as RemindersResponse | undefined;
    return typed?.sfReminders ?? [];
  }, [data]);

  const { trigger: triggerCreate } = useMutation({
    mutation: createSfReminderMutation,
  });
  const { trigger: triggerCancel } = useMutation({
    mutation: cancelSfReminderMutation,
  });

  const bucketed = useMemo(() => {
    const now = Date.now();
    const due: SfReminderDto[] = [];
    const upcoming: SfReminderDto[] = [];
    const done: SfReminderDto[] = [];
    for (const reminder of reminders) {
      const bucket = classifyReminder(reminder, now);
      if (bucket === 'due') due.push(reminder);
      else if (bucket === 'upcoming') upcoming.push(reminder);
      else done.push(reminder);
    }
    return { due, upcoming, done };
  }, [reminders]);

  const handleCreate = useCallback(
    async (form: NewReminderFormState) => {
      const isoFireAt = localInputValueToIsoString(form.fireAtLocal);
      if (!isoFireAt) {
        throw new Error(t['com.superflow.reminders.error.invalidDate']());
      }
      setSubmitting(true);
      try {
        await (triggerCreate as (args: unknown) => Promise<unknown>)({
          workspaceId,
          input: {
            title: form.title,
            body: form.body || null,
            fireAt: isoFireAt,
          },
        });
        notify.success({
          title: t['com.superflow.reminders.notify.created.title'](),
          message: form.title,
        });
        await mutate();
        setModalOpen(false);
      } finally {
        setSubmitting(false);
      }
    },
    [mutate, t, triggerCreate, workspaceId]
  );

  const handleCancel = useCallback(
    async (reminderId: string) => {
      setCancellingId(reminderId);
      try {
        await (triggerCancel as (args: unknown) => Promise<unknown>)({
          reminderId,
        });
        notify.success({
          title: t['com.superflow.reminders.notify.cancelled.title'](),
        });
        await mutate();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t['com.superflow.reminders.error.cancel']();
        notify.error({
          title: t['com.superflow.reminders.notify.cancelled.error'](),
          message,
        });
      } finally {
        setCancellingId(null);
      }
    },
    [mutate, t, triggerCancel]
  );

  const handleRetry = useCallback(() => {
    // mutate() returns a Promise<unknown> but we explicitly don't await it —
    // SWR handles the lifecycle and renders revalidation state. .catch is
    // required by the no-floating-promises rule even though SWR's own error
    // surface already exposes failures via the `error` field.
    mutate().catch(() => {});
  }, [mutate]);

  const handleNewClick = useCallback(() => setModalOpen(true), []);
  const handleModalClose = useCallback(() => {
    if (!submitting) setModalOpen(false);
  }, [submitting]);

  const renderList = (list: SfReminderDto[], tab: TabKey) => {
    if (list.length === 0) return <EmptyState tab={tab} />;
    return (
      <div className={styles.list}>
        {list.map(reminder => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            isDue={tab === 'due'}
            cancelling={cancellingId === reminder.id}
            onCancel={handleCancel}
          />
        ))}
      </div>
    );
  };

  const activeList =
    activeTab === 'due'
      ? bucketed.due
      : activeTab === 'upcoming'
        ? bucketed.upcoming
        : bucketed.done;

  const headerTitle = t['com.superflow.reminders.title']();

  return (
    <>
      <ViewTitle title={headerTitle} />
      <ViewIcon icon="allDocs" />
      <ViewHeader>
        <RemindersHeader title={headerTitle} />
      </ViewHeader>
      <ViewBody>
        <div className={styles.root} data-testid="reminders-page">
          <div className={styles.toolbar}>
            <div
              role="tablist"
              aria-label={t['com.superflow.reminders.tabs.label']()}
              className={styles.tabsList}
            >
              <button
                role="tab"
                type="button"
                aria-selected={activeTab === 'due'}
                data-active={activeTab === 'due'}
                className={styles.tabButton}
                onClick={() => setActiveTab('due')}
                data-testid="reminders-tab-due"
              >
                {t['com.superflow.reminders.tab.due']()}
                <span className={styles.tabCount}>{bucketed.due.length}</span>
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={activeTab === 'upcoming'}
                data-active={activeTab === 'upcoming'}
                className={styles.tabButton}
                onClick={() => setActiveTab('upcoming')}
                data-testid="reminders-tab-upcoming"
              >
                {t['com.superflow.reminders.tab.upcoming']()}
                <span className={styles.tabCount}>
                  {bucketed.upcoming.length}
                </span>
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={activeTab === 'done'}
                data-active={activeTab === 'done'}
                className={styles.tabButton}
                onClick={() => setActiveTab('done')}
                data-testid="reminders-tab-done"
              >
                {t['com.superflow.reminders.tab.done']()}
                <span className={styles.tabCount}>{bucketed.done.length}</span>
              </button>
            </div>
            <Button
              variant="primary"
              onClick={handleNewClick}
              data-testid="reminders-new"
            >
              {t['com.superflow.reminders.action.new']()}
            </Button>
          </div>
          {error ? (
            <ErrorState message={error.message} onRetry={handleRetry} />
          ) : isLoading && reminders.length === 0 ? (
            <LoadingSkeleton />
          ) : (
            renderList(activeList, activeTab)
          )}
        </div>
        <NewReminderModal
          open={modalOpen}
          submitting={submitting}
          onSubmit={handleCreate}
          onClose={handleModalClose}
        />
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

// Exposed for unit tests; uses backend status enum and `fireAt` field name.
export { classifyReminder };

export const Component = () => <RemindersPage />;
