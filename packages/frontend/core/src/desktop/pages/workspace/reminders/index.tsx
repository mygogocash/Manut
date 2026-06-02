import {
  Button,
  Input,
  Modal,
  notify,
  useConfirmModal,
} from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  cancelMnReminderMutation,
  createMnReminderMutation,
  type CreateMnReminderRuleInput,
  createMnReminderRuleMutation,
  deleteMnReminderRuleMutation,
  type MnReminderDto,
  type MnReminderRuleDto,
  mnReminderRulesQuery,
  mnRemindersQuery,
  type MnReminderStatus,
  type UpdateMnReminderRuleInput,
  updateMnReminderRuleMutation,
} from '@affine/core/modules/manut-reminders';
import { MANUT_LIVE_QUERY_OPTIONS } from '@affine/core/modules/manut-shared';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { DownloadIcon, TodayIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import { Header } from '../../../../components/pure/header';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import {
  buildReminderCsv,
  buildReminderRulesCsv,
  downloadCsv,
  reminderExportFilename,
} from './csv-export';
import { RuleList } from './rule-list';
import { RuleModal } from './rule-modal';
import * as styles from './styles.css';

type TabKey = 'due' | 'upcoming' | 'done' | 'rules';

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

const ACTIVE_STATUSES: ReadonlySet<MnReminderStatus> = new Set([
  'SCHEDULED',
  'PROCESSING',
]);

function classifyReminder(reminder: MnReminderDto, now: number): TabKey {
  if (!ACTIVE_STATUSES.has(reminder.status)) {
    return 'done';
  }
  const fireAt = Date.parse(reminder.fireAt);
  if (Number.isNaN(fireAt) || fireAt <= now) {
    return 'due';
  }
  return 'upcoming';
}

function statusBadgeClass(status: MnReminderStatus, isDue: boolean): string {
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
      title={t['com.manut.reminders.modal.title']()}
      description={t['com.manut.reminders.modal.description']()}
      width={480}
      persistent={submitting}
    >
      <div className={styles.modalBody}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="sf-reminder-title">
            {t['com.manut.reminders.field.title.label']()}
          </label>
          <Input
            id="sf-reminder-title"
            value={form.title}
            placeholder={t['com.manut.reminders.field.title.placeholder']()}
            onChange={(value: string) =>
              setForm(prev => ({ ...prev, title: value }))
            }
            disabled={submitting}
            autoFocus
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="sf-reminder-fire-at">
            {t['com.manut.reminders.field.dueAt.label']()}
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
            {t['com.manut.reminders.field.dueAt.hint']()}
          </div>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="sf-reminder-body">
            {t['com.manut.reminders.field.body.label']()}
          </label>
          <textarea
            id="sf-reminder-body"
            className={styles.textarea}
            value={form.body}
            placeholder={t['com.manut.reminders.field.body.placeholder']()}
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
          {t['com.manut.reminders.modal.cancel']()}
        </Button>
        <Button
          variant="primary"
          disabled={!canSubmit}
          loading={submitting}
          onClick={() => void handleSubmit()}
        >
          {t['com.manut.reminders.modal.submit']()}
        </Button>
      </div>
    </Modal>
  );
};

interface ReminderCardProps {
  reminder: MnReminderDto;
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
      return t['com.manut.reminders.status.completed']();
    if (reminder.status === 'CANCELLED')
      return t['com.manut.reminders.status.cancelled']();
    if (reminder.status === 'FAILED')
      return t['com.manut.reminders.status.failed']();
    if (isDue) return t['com.manut.reminders.status.due']();
    return t['com.manut.reminders.status.scheduled']();
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
          {t['com.manut.reminders.card.dueAt']()}{' '}
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
            {t['com.manut.reminders.action.markDone']()}
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

type ReminderTabKey = 'due' | 'upcoming' | 'done';

interface EmptyStateProps {
  tab: ReminderTabKey;
}

const EmptyState = ({ tab }: EmptyStateProps) => {
  const t = useI18n();
  const message =
    tab === 'due'
      ? t['com.manut.reminders.empty.due']()
      : tab === 'upcoming'
        ? t['com.manut.reminders.empty.upcoming']()
        : t['com.manut.reminders.empty.done']();
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
        {t['com.manut.reminders.error.retry']()}
      </Button>
    </div>
  );
};

interface RemindersResponse {
  mnReminders?: MnReminderDto[];
}

interface RulesResponse {
  mnReminderRules?: MnReminderRuleDto[];
}

const RemindersPage = () => {
  const t = useI18n();
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;
  const { openConfirmModal } = useConfirmModal();

  const [activeTab, setActiveTab] = useState<TabKey>('due');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleSubmitting, setRuleSubmitting] = useState(false);
  const [editingRule, setEditingRule] = useState<MnReminderRuleDto | null>(
    null
  );
  const [ruleTogglingId, setRuleTogglingId] = useState<string | null>(null);
  const [ruleDeletingId, setRuleDeletingId] = useState<string | null>(null);

  // The local mnReminders operation is not part of the codegen'd
  // discriminated union, so we cast at the boundary — same trick the
  // Gmail/Drive panels use.
  const queryArg = {
    query: mnRemindersQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, isLoading, error, mutate } = useQuery(queryArg, {
    ...MANUT_LIVE_QUERY_OPTIONS,
    suspense: false,
  });

  const reminders = useMemo<MnReminderDto[]>(() => {
    const typed = data as unknown as RemindersResponse | undefined;
    return typed?.mnReminders ?? [];
  }, [data]);

  const { trigger: triggerCreate } = useMutation({
    mutation: createMnReminderMutation,
  });
  const { trigger: triggerCancel } = useMutation({
    mutation: cancelMnReminderMutation,
  });

  // Rules data + mutations. Same casting pattern as the local mnReminders
  // operation above.
  const ruleQueryArg = {
    query: mnReminderRulesQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const {
    data: rulesData,
    isLoading: rulesLoading,
    error: rulesError,
    mutate: rulesMutate,
  } = useQuery(ruleQueryArg, {
    ...MANUT_LIVE_QUERY_OPTIONS,
    suspense: false,
  });

  const rules = useMemo<MnReminderRuleDto[]>(() => {
    const typed = rulesData as unknown as RulesResponse | undefined;
    return typed?.mnReminderRules ?? [];
  }, [rulesData]);

  const { trigger: triggerCreateRule } = useMutation({
    mutation: createMnReminderRuleMutation,
  });
  const { trigger: triggerUpdateRule } = useMutation({
    mutation: updateMnReminderRuleMutation,
  });
  const { trigger: triggerDeleteRule } = useMutation({
    mutation: deleteMnReminderRuleMutation,
  });

  const bucketed = useMemo(() => {
    const now = Date.now();
    const due: MnReminderDto[] = [];
    const upcoming: MnReminderDto[] = [];
    const done: MnReminderDto[] = [];
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
        throw new Error(t['com.manut.reminders.error.invalidDate']());
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
          title: t['com.manut.reminders.notify.created.title'](),
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
          title: t['com.manut.reminders.notify.cancelled.title'](),
        });
        await mutate();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t['com.manut.reminders.error.cancel']();
        notify.error({
          title: t['com.manut.reminders.notify.cancelled.error'](),
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
    rulesMutate().catch(() => {});
  }, [mutate, rulesMutate]);

  const handleNewClick = useCallback(() => {
    if (activeTab === 'rules') {
      setEditingRule(null);
      setRuleModalOpen(true);
    } else {
      setModalOpen(true);
    }
  }, [activeTab]);

  const handleModalClose = useCallback(() => {
    if (!submitting) setModalOpen(false);
  }, [submitting]);

  const handleRuleModalClose = useCallback(() => {
    if (!ruleSubmitting) {
      setRuleModalOpen(false);
      setEditingRule(null);
    }
  }, [ruleSubmitting]);

  const handleEditRule = useCallback((rule: MnReminderRuleDto) => {
    setEditingRule(rule);
    setRuleModalOpen(true);
  }, []);

  const handleRuleSubmit = useCallback(
    async (input: CreateMnReminderRuleInput | UpdateMnReminderRuleInput) => {
      setRuleSubmitting(true);
      try {
        if (editingRule) {
          await (triggerUpdateRule as (args: unknown) => Promise<unknown>)({
            ruleId: editingRule.id,
            input: input as UpdateMnReminderRuleInput,
          });
          notify.success({
            title: t['com.manut.reminders.rules.notify.updated.title'](),
          });
        } else {
          await (triggerCreateRule as (args: unknown) => Promise<unknown>)({
            workspaceId,
            input: input as CreateMnReminderRuleInput,
          });
          notify.success({
            title: t['com.manut.reminders.rules.notify.created.title'](),
          });
        }
        await rulesMutate();
        setRuleModalOpen(false);
        setEditingRule(null);
      } finally {
        setRuleSubmitting(false);
      }
    },
    [
      editingRule,
      rulesMutate,
      t,
      triggerCreateRule,
      triggerUpdateRule,
      workspaceId,
    ]
  );

  const handleRuleToggle = useCallback(
    (rule: MnReminderRuleDto, next: boolean) => {
      setRuleTogglingId(rule.id);
      (triggerUpdateRule as (args: unknown) => Promise<unknown>)({
        ruleId: rule.id,
        input: { enabled: next } satisfies UpdateMnReminderRuleInput,
      })
        .then(() => rulesMutate())
        .then(() => undefined)
        .catch((err: unknown) => {
          const message =
            err instanceof Error
              ? err.message
              : t['com.manut.reminders.rules.error.toggle']();
          notify.error({
            title: t['com.manut.reminders.rules.notify.toggle.error'](),
            message,
          });
        })
        .finally(() => setRuleTogglingId(null));
    },
    [rulesMutate, t, triggerUpdateRule]
  );

  const handleRuleDelete = useCallback(
    (rule: MnReminderRuleDto) => {
      openConfirmModal({
        title: t['com.manut.reminders.rules.delete.confirm.title'](),
        description: t['com.manut.reminders.rules.delete.confirm.description']({
          name: rule.name,
        }),
        confirmText: t['com.manut.reminders.rules.delete.confirm.submit'](),
        cancelText: t['com.manut.reminders.rules.delete.confirm.cancel'](),
        confirmButtonOptions: { variant: 'error' },
        onConfirm: async () => {
          setRuleDeletingId(rule.id);
          try {
            await (triggerDeleteRule as (args: unknown) => Promise<unknown>)({
              ruleId: rule.id,
            });
            notify.success({
              title: t['com.manut.reminders.rules.notify.deleted.title'](),
            });
            await rulesMutate();
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : t['com.manut.reminders.rules.error.delete']();
            notify.error({
              title: t['com.manut.reminders.rules.notify.deleted.error'](),
              message,
            });
          } finally {
            setRuleDeletingId(null);
          }
        },
      });
    },
    [openConfirmModal, rulesMutate, t, triggerDeleteRule]
  );

  const renderReminderList = (list: MnReminderDto[], tab: ReminderTabKey) => {
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

  const activeReminderList = useMemo<MnReminderDto[]>(() => {
    if (activeTab === 'due') return bucketed.due;
    if (activeTab === 'upcoming') return bucketed.upcoming;
    if (activeTab === 'done') return bucketed.done;
    return [];
  }, [activeTab, bucketed]);
  const activeReminderTab: ReminderTabKey =
    activeTab === 'rules' ? 'due' : (activeTab as ReminderTabKey);
  const activeExportCount =
    activeTab === 'rules' ? rules.length : activeReminderList.length;
  const handleExport = useCallback(() => {
    try {
      if (activeTab === 'rules') {
        downloadCsv(
          reminderExportFilename('rules'),
          buildReminderRulesCsv(rules)
        );
        notify.success({
          title: 'CSV exported',
          message: `${rules.length} reminder rule${
            rules.length === 1 ? '' : 's'
          } exported.`,
        });
        return;
      }
      downloadCsv(
        reminderExportFilename('reminders'),
        buildReminderCsv(activeReminderList)
      );
      notify.success({
        title: 'CSV exported',
        message: `${activeReminderList.length} reminder${
          activeReminderList.length === 1 ? '' : 's'
        } exported.`,
      });
    } catch (err) {
      notify.error({
        title: 'Could not export CSV',
        message: err instanceof Error ? err.message : 'Download failed.',
      });
    }
  }, [activeReminderList, activeTab, rules]);

  const headerTitle = t['com.manut.reminders.title']();

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
              aria-label={t['com.manut.reminders.tabs.label']()}
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
                {t['com.manut.reminders.tab.due']()}
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
                {t['com.manut.reminders.tab.upcoming']()}
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
                {t['com.manut.reminders.tab.done']()}
                <span className={styles.tabCount}>{bucketed.done.length}</span>
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={activeTab === 'rules'}
                data-active={activeTab === 'rules'}
                className={styles.tabButton}
                onClick={() => setActiveTab('rules')}
                data-testid="reminders-tab-rules"
              >
                {t['com.manut.reminders.tab.rules']()}
                <span className={styles.tabCount}>{rules.length}</span>
              </button>
            </div>
            <div className={styles.toolbarActions}>
              <Button
                variant="secondary"
                prefix={<DownloadIcon />}
                disabled={activeExportCount === 0}
                onClick={handleExport}
                data-testid="reminders-export-csv"
              >
                Export CSV
              </Button>
              <Button
                variant="primary"
                onClick={handleNewClick}
                data-testid={
                  activeTab === 'rules' ? 'reminders-new-rule' : 'reminders-new'
                }
              >
                {activeTab === 'rules'
                  ? t['com.manut.reminders.rules.action.new']()
                  : t['com.manut.reminders.action.new']()}
              </Button>
            </div>
          </div>
          {activeTab === 'rules' ? (
            rulesError ? (
              <ErrorState message={rulesError.message} onRetry={handleRetry} />
            ) : rulesLoading && rules.length === 0 ? (
              <LoadingSkeleton />
            ) : (
              <RuleList
                rules={rules}
                togglingId={ruleTogglingId}
                deletingId={ruleDeletingId}
                onToggle={handleRuleToggle}
                onEdit={handleEditRule}
                onDelete={handleRuleDelete}
              />
            )
          ) : error ? (
            <ErrorState message={error.message} onRetry={handleRetry} />
          ) : isLoading && reminders.length === 0 ? (
            <LoadingSkeleton />
          ) : (
            renderReminderList(activeReminderList, activeReminderTab)
          )}
        </div>
        <NewReminderModal
          open={modalOpen}
          submitting={submitting}
          onSubmit={handleCreate}
          onClose={handleModalClose}
        />
        <RuleModal
          open={ruleModalOpen}
          rule={editingRule}
          submitting={ruleSubmitting}
          onSubmit={handleRuleSubmit}
          onClose={handleRuleModalClose}
        />
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

// Exposed for unit tests; uses backend status enum and `fireAt` field name.
export { classifyReminder };

export const Component = () => <RemindersPage />;
