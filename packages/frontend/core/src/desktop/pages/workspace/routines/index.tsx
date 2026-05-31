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
  type CreateMnRoutineInput,
  createMnRoutineMutation,
  deleteMnRoutineMutation,
  type MnRoutineDto,
  type MnRoutineRunDto,
  mnRoutineRunsQuery,
  mnRoutinesQuery,
  type MnRoutineStatus,
  type MnRoutineVisibility,
  pauseMnRoutineMutation,
  resumeMnRoutineMutation,
  runMnRoutineMutation,
  type UpdateMnRoutineInput,
  updateMnRoutineMutation,
} from '@affine/core/modules/manut-routines';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { RotateIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import { Header } from '../../../../components/pure/header';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import * as styles from './styles.css';

type StatusFilter = 'all' | 'active' | 'paused' | 'error';

interface RoutineFormState {
  name: string;
  description: string;
  prompt: string;
  cronSchedule: string;
  timezone: string;
  visibility: MnRoutineVisibility;
}

const EMPTY_FORM: RoutineFormState = {
  name: '',
  description: '',
  prompt: '',
  cronSchedule: '',
  timezone: '',
  visibility: 'PERSONAL',
};

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

function statusBadgeClass(status: MnRoutineStatus): string {
  if (status === 'ACTIVE') return styles.badgeActive;
  if (status === 'PAUSED') return styles.badgePaused;
  return styles.badgeError;
}

function statusLabel(status: MnRoutineStatus): string {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'PAUSED') return 'Paused';
  return 'Error';
}

function visibilityLabel(visibility: MnRoutineVisibility): string {
  return visibility === 'WORKSPACE_SHARED' ? 'Workspace' : 'Personal';
}

function runStatusLabel(status: MnRoutineRunDto['status']): string {
  if (status === 'QUEUED') return 'Queued';
  if (status === 'RUNNING') return 'Running';
  if (status === 'SUCCESS') return 'Succeeded';
  if (status === 'FAILED') return 'Failed';
  return 'Timed out';
}

function runTriggerLabel(trigger: MnRoutineRunDto['triggerType']): string {
  if (trigger === 'MANUAL') return 'Manual';
  if (trigger === 'SCHEDULED') return 'Scheduled';
  return 'MCP';
}

const RoutinesHeader = ({ title }: { title: string }) => (
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
        <RotateIcon /> {title}
      </span>
    }
  />
);

interface RoutineModalProps {
  open: boolean;
  initial: RoutineFormState | null;
  submitting: boolean;
  mode: 'create' | 'edit';
  onSubmit: (form: RoutineFormState) => Promise<void>;
  onClose: () => void;
}

const RoutineModal = ({
  open,
  initial,
  submitting,
  mode,
  onSubmit,
  onClose,
}: RoutineModalProps) => {
  const [form, setForm] = useState<RoutineFormState>(initial ?? EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  // When the modal opens for a different routine, reset form to that initial.
  // Using a key-based remount upstream would also work; this is simpler.
  const initialKey = initial?.name ?? '';
  const [seededKey, setSeededKey] = useState(initialKey);
  if (open && initialKey !== seededKey) {
    setForm(initial ?? EMPTY_FORM);
    setError(null);
    setSeededKey(initialKey);
  }

  const trimmedName = form.name.trim();
  const trimmedPrompt = form.prompt.trim();
  const canSubmit =
    trimmedName.length > 0 && trimmedPrompt.length > 0 && !submitting;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && !submitting) {
        onClose();
      }
    },
    [onClose, submitting]
  );

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await onSubmit({
        ...form,
        name: trimmedName,
        prompt: trimmedPrompt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save routine.');
    }
  }, [canSubmit, form, onSubmit, trimmedName, trimmedPrompt]);

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={mode === 'create' ? 'New routine' : 'Edit routine'}
      description="Routines run a prompt against the workspace AI on a schedule, or on demand from Claude Code via MCP."
      width={560}
      persistent={submitting}
    >
      <div className={styles.modalBody}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="routine-name">
            Name
          </label>
          <Input
            id="routine-name"
            value={form.name}
            placeholder="Daily standup digest"
            onChange={(value: string) =>
              setForm(prev => ({ ...prev, name: value }))
            }
            disabled={submitting}
            autoFocus
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="routine-description">
            Description{' '}
            <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
          </label>
          <Input
            id="routine-description"
            value={form.description}
            placeholder="Short note for teammates"
            onChange={(value: string) =>
              setForm(prev => ({ ...prev, description: value }))
            }
            disabled={submitting}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="routine-prompt">
            Prompt
          </label>
          <textarea
            id="routine-prompt"
            className={styles.promptTextarea}
            value={form.prompt}
            placeholder="Summarize what changed in the workspace in the last 24 hours and post the digest to the Updates doc."
            onChange={event =>
              setForm(prev => ({ ...prev, prompt: event.target.value }))
            }
            disabled={submitting}
          />
          <div className={styles.fieldHint}>
            Anything Claude can do in the workspace — search, read, edit, create
            docs. Pretend you&apos;re chatting with the AI panel.
          </div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="routine-cron">
              Cron schedule{' '}
              <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
            </label>
            <input
              id="routine-cron"
              type="text"
              className={styles.textInput}
              value={form.cronSchedule}
              placeholder="0 9 * * MON-FRI"
              onChange={event =>
                setForm(prev => ({ ...prev, cronSchedule: event.target.value }))
              }
              disabled={submitting}
            />
            <div className={styles.fieldHint}>
              Leave blank for manual or MCP-only triggering.
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="routine-timezone">
              Timezone{' '}
              <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
            </label>
            <input
              id="routine-timezone"
              type="text"
              className={styles.textInput}
              value={form.timezone}
              placeholder="Asia/Bangkok"
              onChange={event =>
                setForm(prev => ({ ...prev, timezone: event.target.value }))
              }
              disabled={submitting}
            />
            <div className={styles.fieldHint}>IANA tz; defaults to UTC.</div>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="routine-visibility">
            Visibility
          </label>
          <select
            id="routine-visibility"
            className={styles.select}
            value={form.visibility}
            onChange={event =>
              setForm(prev => ({
                ...prev,
                visibility: event.target.value as MnRoutineVisibility,
              }))
            }
            disabled={submitting}
          >
            <option value="PERSONAL">
              Personal — only you can see and run
            </option>
            <option value="WORKSPACE_SHARED">
              Workspace — everyone in this workspace can see and run
            </option>
          </select>
        </div>

        {error ? (
          <div className={styles.errorState} role="alert">
            {error}
          </div>
        ) : null}
      </div>
      <div className={styles.modalActions}>
        <Button
          variant="secondary"
          disabled={submitting}
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!canSubmit}
          loading={submitting}
          onClick={() => void handleSubmit()}
        >
          {mode === 'create' ? 'Create routine' : 'Save changes'}
        </Button>
      </div>
    </Modal>
  );
};

interface RunHistoryModalProps {
  open: boolean;
  routine: MnRoutineDto | null;
  onClose: () => void;
}

interface RunsResponse {
  mnRoutineRuns?: MnRoutineRunDto[];
}

const RunHistoryModal = ({ open, routine, onClose }: RunHistoryModalProps) => {
  const queryArg = {
    query: mnRoutineRunsQuery,
    variables: { routineId: routine?.id ?? '', limit: 30 },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  // SWR-keyed by query+vars; when routine is null we still mount the hook but
  // the empty routineId returns nothing useful — the modal is hidden anyway.
  const { data, isLoading, error } = useQuery(queryArg, {
    suspense: false,
  });

  const runs = useMemo<MnRoutineRunDto[]>(() => {
    const typed = data as unknown as RunsResponse | undefined;
    return typed?.mnRoutineRuns ?? [];
  }, [data]);

  return (
    <Modal
      open={open && routine !== null}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
      title="Run history"
      description={routine?.name ?? ''}
      width={520}
    >
      <div className={styles.modalBody}>
        <div className={styles.banner}>
          PR 1 stores a queued run record but doesn&apos;t execute against
          Vertex yet — that lands in PR 4.
        </div>
        {error ? (
          <div className={styles.errorState}>{error.message}</div>
        ) : isLoading && runs.length === 0 ? (
          <div className={styles.skeleton}>
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
          </div>
        ) : runs.length === 0 ? (
          <div className={styles.emptyState}>No runs yet.</div>
        ) : (
          <div className={styles.runList}>
            {runs.map(run => (
              <div key={run.id} className={styles.runRow}>
                <div className={styles.runMeta}>
                  <span>{runStatusLabel(run.status)}</span>
                  <span>·</span>
                  <span>{runTriggerLabel(run.triggerType)}</span>
                  <span>·</span>
                  <span>{formatRelative(run.createdAt)}</span>
                </div>
                {run.durationMs !== null ? (
                  <span style={{ opacity: 0.7 }}>{run.durationMs}ms</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={styles.modalActions}>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
};

interface RoutineCardProps {
  routine: MnRoutineDto;
  busy: boolean;
  onRunNow: (routine: MnRoutineDto) => Promise<void>;
  onTogglePause: (routine: MnRoutineDto) => Promise<void>;
  onEdit: (routine: MnRoutineDto) => void;
  onDelete: (routine: MnRoutineDto) => void;
  onHistory: (routine: MnRoutineDto) => void;
}

const RoutineCard = ({
  routine,
  busy,
  onRunNow,
  onTogglePause,
  onEdit,
  onDelete,
  onHistory,
}: RoutineCardProps) => {
  const isPaused = routine.status === 'PAUSED';
  const isError = routine.status === 'ERROR';
  return (
    <article className={styles.card} data-testid="routine-card">
      <header className={styles.cardHeader}>
        <div className={styles.cardTitleBlock}>
          <div className={styles.cardTitle}>{routine.name}</div>
          {routine.description ? (
            <div className={styles.cardDescription}>{routine.description}</div>
          ) : null}
        </div>
        <div style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
          <span className={styles.badgeVisibility}>
            {visibilityLabel(routine.visibility)}
          </span>
          <span
            className={clsx(styles.badge, statusBadgeClass(routine.status))}
          >
            {statusLabel(routine.status)}
          </span>
        </div>
      </header>
      <div className={styles.cardPrompt}>{routine.prompt}</div>
      <div className={styles.cardMeta}>
        <span>
          Schedule:{' '}
          {routine.cronSchedule ? (
            <code>{routine.cronSchedule}</code>
          ) : (
            'on-demand'
          )}
        </span>
        {routine.timezone ? (
          <>
            <span>·</span>
            <span>{routine.timezone}</span>
          </>
        ) : null}
        <span>·</span>
        <span>Last run: {formatRelative(routine.lastRunAt)}</span>
      </div>
      {isError ? (
        <div className={styles.errorState} role="alert">
          This routine errored on its last run. Open History to see why, then
          Retry to set it back to active.
        </div>
      ) : null}
      <div className={styles.cardActions}>
        <Button
          variant="primary"
          size="default"
          disabled={busy}
          loading={busy}
          onClick={() => void onRunNow(routine)}
          data-testid="routine-run-now"
        >
          Run now
        </Button>
        <Button
          variant="secondary"
          size="default"
          disabled={busy}
          onClick={() => void onTogglePause(routine)}
          data-testid={
            isError
              ? 'routine-retry'
              : isPaused
                ? 'routine-resume'
                : 'routine-pause'
          }
        >
          {isError ? 'Retry' : isPaused ? 'Resume' : 'Pause'}
        </Button>
        <Button
          variant="secondary"
          size="default"
          disabled={busy}
          onClick={() => onHistory(routine)}
          data-testid="routine-history"
        >
          History
        </Button>
        <Button
          variant="secondary"
          size="default"
          disabled={busy}
          onClick={() => onEdit(routine)}
          data-testid="routine-edit"
        >
          Edit
        </Button>
        <Button
          variant="secondary"
          size="default"
          disabled={busy}
          onClick={() => onDelete(routine)}
          data-testid="routine-delete"
        >
          Delete
        </Button>
      </div>
    </article>
  );
};

const LoadingSkeleton = () => (
  <div className={styles.skeleton} data-testid="routines-loading">
    <div className={styles.skeletonCard} />
    <div className={styles.skeletonCard} />
    <div className={styles.skeletonCard} />
  </div>
);

const EmptyState = () => (
  <div className={styles.emptyState} data-testid="routines-empty">
    <div style={{ fontWeight: 500 }}>No routines yet.</div>
    <div>
      Create one to schedule prompts, or expose them to Claude Code over MCP.
    </div>
  </div>
);

const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <div className={styles.errorState} data-testid="routines-error">
    <div>{message}</div>
    <Button variant="secondary" onClick={onRetry}>
      Retry
    </Button>
  </div>
);

interface RoutinesResponse {
  mnRoutines?: MnRoutineDto[];
}

const RoutinesPage = () => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;
  const { openConfirmModal } = useConfirmModal();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MnRoutineDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyRoutineId, setBusyRoutineId] = useState<string | null>(null);
  const [historyRoutine, setHistoryRoutine] = useState<MnRoutineDto | null>(
    null
  );

  // Cast at the boundary — local mnRoutines op isn't part of the codegen'd
  // discriminated union. Same trick as Reminders.
  const queryArg = {
    query: mnRoutinesQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, isLoading, error, mutate } = useQuery(queryArg, {
    suspense: false,
  });

  const routines = useMemo<MnRoutineDto[]>(() => {
    const typed = data as unknown as RoutinesResponse | undefined;
    return typed?.mnRoutines ?? [];
  }, [data]);

  const { trigger: triggerCreate } = useMutation({
    mutation: createMnRoutineMutation,
  });
  const { trigger: triggerUpdate } = useMutation({
    mutation: updateMnRoutineMutation,
  });
  const { trigger: triggerDelete } = useMutation({
    mutation: deleteMnRoutineMutation,
  });
  const { trigger: triggerPause } = useMutation({
    mutation: pauseMnRoutineMutation,
  });
  const { trigger: triggerResume } = useMutation({
    mutation: resumeMnRoutineMutation,
  });
  const { trigger: triggerRun } = useMutation({
    mutation: runMnRoutineMutation,
  });

  const counts = useMemo(() => {
    const all = routines.length;
    let active = 0;
    let paused = 0;
    let error = 0;
    for (const r of routines) {
      if (r.status === 'ACTIVE') active++;
      else if (r.status === 'PAUSED') paused++;
      else error++;
    }
    return { all, active, paused, error };
  }, [routines]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return routines;
    if (statusFilter === 'active')
      return routines.filter(r => r.status === 'ACTIVE');
    if (statusFilter === 'paused')
      return routines.filter(r => r.status === 'PAUSED');
    return routines.filter(r => r.status === 'ERROR');
  }, [routines, statusFilter]);

  const handleRetry = useCallback(() => {
    mutate().catch(() => {});
  }, [mutate]);

  const handleCreate = useCallback(
    async (form: RoutineFormState) => {
      setSubmitting(true);
      try {
        const input: CreateMnRoutineInput = {
          name: form.name,
          description: form.description.trim() || null,
          prompt: form.prompt,
          cronSchedule: form.cronSchedule.trim() || null,
          timezone: form.timezone.trim() || null,
          visibility: form.visibility,
        };
        await (triggerCreate as (args: unknown) => Promise<unknown>)({
          workspaceId,
          input,
        });
        notify.success({ title: 'Routine created', message: form.name });
        await mutate();
        setCreateOpen(false);
      } finally {
        setSubmitting(false);
      }
    },
    [mutate, triggerCreate, workspaceId]
  );

  const handleEditSubmit = useCallback(
    async (form: RoutineFormState) => {
      if (!editing) return;
      setSubmitting(true);
      try {
        const input: UpdateMnRoutineInput = {
          name: form.name,
          description: form.description.trim() || null,
          prompt: form.prompt,
          cronSchedule: form.cronSchedule.trim() || null,
          timezone: form.timezone.trim() || null,
          visibility: form.visibility,
        };
        await (triggerUpdate as (args: unknown) => Promise<unknown>)({
          id: editing.id,
          input,
        });
        notify.success({ title: 'Routine saved' });
        await mutate();
        setEditing(null);
      } finally {
        setSubmitting(false);
      }
    },
    [editing, mutate, triggerUpdate]
  );

  const handleRunNow = useCallback(
    async (routine: MnRoutineDto) => {
      setBusyRoutineId(routine.id);
      try {
        await (triggerRun as (args: unknown) => Promise<unknown>)({
          id: routine.id,
        });
        notify.success({
          title: 'Run queued',
          message: 'Execution will happen once the Vertex runner lands (PR 4).',
        });
        await mutate();
      } catch (err) {
        notify.error({
          title: 'Could not run routine',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setBusyRoutineId(null);
      }
    },
    [mutate, triggerRun]
  );

  const handleTogglePause = useCallback(
    async (routine: MnRoutineDto) => {
      setBusyRoutineId(routine.id);
      // An ACTIVE routine pauses; a PAUSED *or* ERRORED routine resumes
      // (Retry). Only 'ACTIVE' should hit the pause branch.
      const shouldResume = routine.status !== 'ACTIVE';
      try {
        if (shouldResume) {
          await (triggerResume as (args: unknown) => Promise<unknown>)({
            id: routine.id,
          });
          notify.success({ title: 'Routine resumed' });
        } else {
          await (triggerPause as (args: unknown) => Promise<unknown>)({
            id: routine.id,
          });
          notify.success({ title: 'Routine paused' });
        }
        await mutate();
      } catch (err) {
        notify.error({
          title: shouldResume ? 'Could not resume' : 'Could not pause',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setBusyRoutineId(null);
      }
    },
    [mutate, triggerPause, triggerResume]
  );

  const handleDelete = useCallback(
    (routine: MnRoutineDto) => {
      openConfirmModal({
        title: 'Delete routine?',
        description: `"${routine.name}" will be removed. Run history is deleted with it.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmButtonOptions: { variant: 'error' },
        onConfirm: async () => {
          setBusyRoutineId(routine.id);
          try {
            await (triggerDelete as (args: unknown) => Promise<unknown>)({
              id: routine.id,
            });
            notify.success({ title: 'Routine deleted' });
            await mutate();
          } catch (err) {
            notify.error({
              title: 'Could not delete',
              message: err instanceof Error ? err.message : 'Unknown error',
            });
          } finally {
            setBusyRoutineId(null);
          }
        },
      });
    },
    [mutate, openConfirmModal, triggerDelete]
  );

  const editingInitial = useMemo<RoutineFormState | null>(() => {
    if (!editing) return null;
    return {
      name: editing.name,
      description: editing.description ?? '',
      prompt: editing.prompt,
      cronSchedule: editing.cronSchedule ?? '',
      timezone: editing.timezone ?? '',
      visibility: editing.visibility,
    };
  }, [editing]);

  return (
    <>
      <ViewTitle title="Routines" />
      <ViewIcon icon="allDocs" />
      <ViewHeader>
        <RoutinesHeader title="Routines" />
      </ViewHeader>
      <ViewBody>
        <div className={styles.root} data-testid="routines-page">
          <div className={styles.toolbar}>
            <div
              role="tablist"
              aria-label="Routine status filter"
              className={styles.tabsList}
            >
              {(
                [
                  ['all', 'All', counts.all],
                  ['active', 'Active', counts.active],
                  ['paused', 'Paused', counts.paused],
                  ['error', 'Error', counts.error],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  role="tab"
                  type="button"
                  aria-selected={statusFilter === key}
                  data-active={statusFilter === key}
                  className={styles.tabButton}
                  onClick={() => setStatusFilter(key)}
                  data-testid={`routines-filter-${key}`}
                >
                  {label}
                  <span className={styles.tabCount}>{count}</span>
                </button>
              ))}
            </div>
            <Button
              variant="primary"
              onClick={() => setCreateOpen(true)}
              data-testid="routines-new"
            >
              New routine
            </Button>
          </div>

          <div className={styles.banner}>
            Routines are gated behind <code>ENABLE_MANUT_ROUTINES=true</code>{' '}
            during PR&nbsp;1. PR&nbsp;2 syncs them with Anthropic
            scheduled-tasks; PR&nbsp;3 exposes them to Claude Code via MCP;
            PR&nbsp;4 wires real Vertex execution into the Run-now button.
          </div>

          {error ? (
            <ErrorState message={error.message} onRetry={handleRetry} />
          ) : isLoading && routines.length === 0 ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className={styles.list}>
              {filtered.map(routine => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  busy={busyRoutineId === routine.id}
                  onRunNow={handleRunNow}
                  onTogglePause={handleTogglePause}
                  onEdit={r => setEditing(r)}
                  onDelete={handleDelete}
                  onHistory={r => setHistoryRoutine(r)}
                />
              ))}
            </div>
          )}
        </div>

        <RoutineModal
          open={createOpen}
          initial={null}
          mode="create"
          submitting={submitting}
          onSubmit={handleCreate}
          onClose={() => {
            if (!submitting) setCreateOpen(false);
          }}
        />
        <RoutineModal
          open={editing !== null}
          initial={editingInitial}
          mode="edit"
          submitting={submitting}
          onSubmit={handleEditSubmit}
          onClose={() => {
            if (!submitting) setEditing(null);
          }}
        />
        <RunHistoryModal
          open={historyRoutine !== null}
          routine={historyRoutine}
          onClose={() => setHistoryRoutine(null)}
        />
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => <RoutinesPage />;
