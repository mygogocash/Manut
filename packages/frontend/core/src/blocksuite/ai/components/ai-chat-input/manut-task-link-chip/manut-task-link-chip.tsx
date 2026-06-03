import type { MnApprovalDto } from '@affine/core/modules/manut-control-plane';
import type {
  MnDoDVerificationResult,
  MnTaskDto,
  MnTaskPlanDto,
  MnWorkProductDto,
} from '@affine/core/modules/manut-pm';
import { trackEvent } from '@affine/core/modules/telemetry';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AgentTaskCockpitPanel } from './agent-task-cockpit';
import * as styles from './manut-task-link-chip.css';

interface ManutTaskLinkChipProps {
  /**
   * Currently bound task, if any. `null` renders the empty
   * "Link to task" state; non-null renders the task title plus a clear
   * button.
   */
  boundTask: MnTaskDto | null;
  /** Pool of project tasks the picker can search across. */
  candidateTasks: readonly MnTaskDto[];
  /**
   * Called when the user picks a task. Bind flow: caller invokes the
   * `bindAiSessionToTask` mutation and on success updates `boundTask`.
   */
  onSelectTask: (taskId: string) => void;
  /** Called when the user clears the binding. */
  onClearTask: () => void;
  cockpitPlans?: readonly MnTaskPlanDto[];
  cockpitApprovals?: readonly MnApprovalDto[];
  cockpitWorkProducts?: readonly MnWorkProductDto[];
  cockpitVerification?: MnDoDVerificationResult | null;
  onOpenTask?: (taskId: string) => void;
  onVerifyTaskDone?: (taskId: string) => void;
}

/**
 * Compact task-link chip that lives near the AI chat input. Clicking
 * the chip opens an inline picker over the project's tasks. The chip
 * is purely presentational — wiring to the `bindAiSessionToTask`
 * mutation happens in the caller so this stays portable across the
 * desktop / mobile / embed surfaces.
 *
 * Branch C owns the approval-mode toggle in the same area. This chip
 * is deliberately implemented as a standalone React component so the
 * two PRs don't collide on the Lit-based preference-popup file.
 */
export const ManutTaskLinkChip = ({
  boundTask,
  candidateTasks,
  cockpitApprovals,
  cockpitPlans,
  cockpitVerification,
  cockpitWorkProducts,
  onSelectTask,
  onClearTask,
  onOpenTask,
  onVerifyTaskDone,
}: ManutTaskLinkChipProps) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const closePicker = useCallback(() => {
    setIsPickerOpen(false);
    setQuery('');
  }, []);

  const togglePicker = useCallback(() => {
    setIsPickerOpen(open => !open);
  }, []);

  const handlePick = useCallback(
    (taskId: string) => {
      setIsPickerOpen(false);
      setQuery('');
      trackEvent('ai_agent_completion_event', {
        action: 'task_linked',
        surface: 'chat',
        mode: 'unknown',
        status: 'selected',
      });
      onSelectTask(taskId);
    },
    [onSelectTask]
  );

  // M17 a11y: close the picker on Escape and on a click/focus outside the
  // chip root. Listeners are only attached while the picker is open so a
  // closed chip costs nothing. Escape returns focus to the chip's trigger so
  // keyboard users aren't dropped at the top of the document.
  useEffect(() => {
    if (!isPickerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closePicker();
        const trigger = rootRef.current?.querySelector('button');
        if (trigger instanceof HTMLElement) trigger.focus();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) {
        return;
      }
      closePicker();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [isPickerOpen, closePicker]);

  const handleClear = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onClearTask();
    },
    [onClearTask]
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return candidateTasks;
    return candidateTasks.filter(t =>
      t.title.toLowerCase().includes(normalized)
    );
  }, [candidateTasks, query]);

  const listboxId = 'manut-task-link-listbox';

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={styles.chipRoot}
        data-bound={!!boundTask}
        onClick={togglePicker}
        // M17 a11y: announce this as a popup-owning toggle so screen
        // readers convey both the collapsed/expanded state and that
        // activating it opens a listbox.
        aria-haspopup="listbox"
        aria-expanded={isPickerOpen}
        aria-controls={isPickerOpen ? listboxId : undefined}
        title={
          boundTask
            ? `Linked to: ${boundTask.title}`
            : 'Link this chat to a task'
        }
      >
        <span aria-hidden>{boundTask ? '🔗' : '＋'}</span>
        <span className={styles.chipLabel}>
          {boundTask ? boundTask.title : 'Link to task'}
        </span>
        {boundTask ? (
          <button
            type="button"
            className={styles.chipClearButton}
            onClick={handleClear}
            aria-label="Unlink task"
          >
            ×
          </button>
        ) : null}
      </button>
      {isPickerOpen ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 1000,
            background: 'var(--affine-white)',
            border: '1px solid var(--affine-border-color)',
            borderRadius: 6,
            boxShadow:
              '0 4px 12px var(--affine-shadow-color, rgba(0,0,0,0.08))',
          }}
        >
          {boundTask ? (
            <div className={styles.cockpitSlot}>
              <AgentTaskCockpitPanel
                task={boundTask}
                plans={cockpitPlans}
                approvals={cockpitApprovals}
                workProducts={cockpitWorkProducts}
                verification={cockpitVerification}
                onOpenTask={onOpenTask}
                onVerifyDone={onVerifyTaskDone}
              />
            </div>
          ) : null}
          <div className={styles.pickerRoot}>
            <input
              type="text"
              autoFocus
              placeholder="Search tasks…"
              className={styles.pickerSearchInput}
              value={query}
              onChange={ev => setQuery(ev.target.value)}
              aria-label="Search tasks"
              aria-controls={listboxId}
            />
            {filtered.length === 0 ? (
              <div className={styles.pickerEmpty}>No matching tasks</div>
            ) : (
              // M17 a11y: expose the option list with listbox/option roles
              // so assistive tech announces it as a single-select list. Each
              // row carries aria-selected so the currently-bound task reads
              // as selected.
              <div role="listbox" id={listboxId} aria-label="Project tasks">
                {filtered.map(task => (
                  <button
                    key={task.id}
                    type="button"
                    role="option"
                    aria-selected={boundTask?.id === task.id}
                    className={styles.pickerOption}
                    onClick={() => handlePick(task.id)}
                  >
                    <span className={styles.pickerOptionTitle}>
                      {task.title}
                    </span>
                    <span className={styles.pickerOptionMeta}>
                      {task.status} · {task.priority}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
