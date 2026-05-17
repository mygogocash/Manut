import type { MnTaskDto } from '@affine/core/modules/manut-pm';
import { useCallback, useMemo, useState } from 'react';

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
  onSelectTask,
  onClearTask,
}: ManutTaskLinkChipProps) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const togglePicker = useCallback(() => {
    setIsPickerOpen(open => !open);
  }, []);

  const handlePick = useCallback(
    (taskId: string) => {
      setIsPickerOpen(false);
      setQuery('');
      onSelectTask(taskId);
    },
    [onSelectTask]
  );

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

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className={styles.chipRoot}
        data-bound={!!boundTask}
        onClick={togglePicker}
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
          <div className={styles.pickerRoot}>
            <input
              type="text"
              autoFocus
              placeholder="Search tasks…"
              className={styles.pickerSearchInput}
              value={query}
              onChange={ev => setQuery(ev.target.value)}
            />
            {filtered.length === 0 ? (
              <div className={styles.pickerEmpty}>No matching tasks</div>
            ) : (
              filtered.map(task => (
                <button
                  key={task.id}
                  type="button"
                  className={styles.pickerOption}
                  onClick={() => handlePick(task.id)}
                >
                  <span className={styles.pickerOptionTitle}>{task.title}</span>
                  <span className={styles.pickerOptionMeta}>
                    {task.status} · {task.priority}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
