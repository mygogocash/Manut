import type {
  MnDoDPredicate,
  MnDoDPredicateKind,
  MnDoDVerificationResult,
} from '@affine/core/modules/manut-pm';
import { MN_DOD_PREDICATE_KINDS } from '@affine/core/modules/manut-pm';
import { useCallback, useMemo, useState } from 'react';

import * as styles from './definition-of-done-panel.css';

/**
 * M11 — Definition of Done panel.
 *
 * Two concerns in one component:
 *  1. RENDER the verifier result — each predicate gets a coloured pill,
 *     a one-line summary derived from the predicate kind + payload,
 *     and the verifier's `reason` (if any).
 *  2. EDIT the predicate list — add/remove/swap predicates and call
 *     `onSave(predicates)` so the parent can fire the
 *     `setMnTaskDefinitionOfDone` mutation. Parent handles the
 *     mutation + re-fetch; this component is data-in / events-out.
 *
 * Style rules: every `style({...})` lives in the `.css.ts` sibling
 * (CLAUDE.md vanilla-extract scar). No animation-killing layout
 * thrash — surface mutations live on `background-color` only.
 */

interface DefinitionOfDonePanelProps {
  /** Latest verification result from `verifyMnTaskDone`. */
  verification: MnDoDVerificationResult | null;
  /** True while the parent is awaiting the verifier or a save. */
  loading?: boolean;
  /** Most recent error, if any. */
  error?: string | null;
  /** Fired when the user persists a new predicate list. */
  onSave: (predicates: MnDoDPredicate[]) => void;
  /** Fired when the user clears the DoD. */
  onClear: () => void;
}

interface DraftPredicate {
  kind: MnDoDPredicateKind;
  docId: string;
  url: string;
  expectedStatus: string;
  taskId: string;
  productKind: string;
  sourceText: string;
  threshold: string;
  description: string;
}

function emptyDraft(kind: MnDoDPredicateKind = 'DOC_EXISTS'): DraftPredicate {
  return {
    kind,
    docId: '',
    url: '',
    expectedStatus: '',
    taskId: '',
    productKind: '',
    sourceText: '',
    threshold: '0.8',
    description: '',
  };
}

function draftToPredicate(draft: DraftPredicate): MnDoDPredicate | null {
  switch (draft.kind) {
    case 'DOC_EXISTS': {
      if (!draft.docId.trim()) return null;
      return { kind: 'DOC_EXISTS', docId: draft.docId.trim() };
    }
    case 'URL_REACHABLE': {
      if (!draft.url.trim()) return null;
      const parsed: MnDoDPredicate = {
        kind: 'URL_REACHABLE',
        url: draft.url.trim(),
      };
      const code = Number.parseInt(draft.expectedStatus.trim(), 10);
      if (!Number.isNaN(code) && code >= 100 && code <= 599) {
        parsed.expectedStatus = code;
      }
      return parsed;
    }
    case 'WORK_PRODUCT_EXISTS': {
      if (!draft.taskId.trim()) return null;
      const parsed: MnDoDPredicate = {
        kind: 'WORK_PRODUCT_EXISTS',
        taskId: draft.taskId.trim(),
      };
      if (draft.productKind.trim())
        parsed.productKind = draft.productKind.trim();
      return parsed;
    }
    case 'EMBEDDING_SIMILARITY': {
      if (!draft.sourceText.trim()) return null;
      const threshold = Number.parseFloat(draft.threshold.trim());
      if (Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
        return null;
      }
      return {
        kind: 'EMBEDDING_SIMILARITY',
        sourceText: draft.sourceText.trim(),
        threshold,
      };
    }
    case 'CUSTOM': {
      if (!draft.description.trim()) return null;
      return { kind: 'CUSTOM', description: draft.description.trim() };
    }
  }
}

function summarisePredicate(p: MnDoDPredicate): string {
  switch (p.kind) {
    case 'DOC_EXISTS':
      return `Doc ${p.docId} must exist`;
    case 'URL_REACHABLE': {
      const suffix =
        p.expectedStatus !== undefined ? ` (status ${p.expectedStatus})` : '';
      return `URL ${p.url} must be reachable${suffix}`;
    }
    case 'WORK_PRODUCT_EXISTS':
      return `Work product for task ${p.taskId}${
        p.productKind ? ` (${p.productKind})` : ''
      } must exist`;
    case 'EMBEDDING_SIMILARITY':
      return `Output must match "${p.sourceText.slice(0, 40)}…" with ≥${p.threshold}`;
    case 'CUSTOM':
      return p.description;
  }
}

export const DefinitionOfDonePanel = ({
  verification,
  loading,
  error,
  onSave,
  onClear,
}: DefinitionOfDonePanelProps) => {
  const [draft, setDraft] = useState<DraftPredicate>(emptyDraft());

  const existingPredicates = useMemo(
    () => verification?.results.map(r => r.predicate) ?? [],
    [verification]
  );

  const summaryState: 'empty' | 'ok' | 'fail' | 'loading' = loading
    ? 'loading'
    : !verification
      ? 'loading'
      : !verification.hasDefinition
        ? 'empty'
        : verification.satisfied
          ? 'ok'
          : 'fail';

  const summaryLabel =
    summaryState === 'loading'
      ? 'Verifying…'
      : summaryState === 'empty'
        ? 'No Definition of Done'
        : summaryState === 'ok'
          ? `All ${verification?.results.length ?? 0} predicate(s) satisfied`
          : `${
              verification?.results.filter(r => !r.satisfied).length ?? 0
            } of ${verification?.results.length ?? 0} unsatisfied`;

  const handleAdd = useCallback(() => {
    const parsed = draftToPredicate(draft);
    if (!parsed) return;
    onSave([...existingPredicates, parsed]);
    setDraft(emptyDraft(draft.kind));
  }, [draft, existingPredicates, onSave]);

  const handleRemove = useCallback(
    (index: number) => {
      const next = existingPredicates.filter((_, i) => i !== index);
      onSave(next);
    },
    [existingPredicates, onSave]
  );

  return (
    <div className={styles.panelRoot} data-testid="definition-of-done-panel">
      <div className={styles.header}>
        <span className={styles.title}>Definition of Done</span>
        <span
          className={styles.summary}
          data-state={summaryState}
          data-testid="dod-summary"
        >
          {summaryLabel}
        </span>
      </div>

      {error ? (
        <div className={styles.errorMessage} data-testid="dod-error">
          {error}
        </div>
      ) : null}

      {verification?.hasDefinition && verification.results.length > 0 ? (
        <div className={styles.predicateList} data-testid="dod-predicate-list">
          {verification.results.map((result, index) => (
            <div
              key={`${result.kind}-${index}`}
              className={styles.predicateRow}
              data-satisfied={String(result.satisfied)}
              data-testid="dod-predicate-row"
            >
              <span
                className={styles.predicateStatus}
                data-satisfied={String(result.satisfied)}
                aria-hidden="true"
              />
              <div className={styles.predicateBody}>
                <span className={styles.predicateKind}>{result.kind}</span>
                <span className={styles.predicateSummaryLine}>
                  {summarisePredicate(result.predicate)}
                </span>
                {result.reason ? (
                  <span className={styles.predicateReason}>
                    {result.reason}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => handleRemove(index)}
                disabled={loading}
                data-testid="dod-remove-predicate"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          Add a predicate to enforce what &quot;done&quot; means for this task.
        </div>
      )}

      <div className={styles.editorRoot}>
        <div className={styles.editorRow}>
          <label htmlFor="dod-kind">Kind</label>
          <select
            id="dod-kind"
            className={styles.select}
            value={draft.kind}
            onChange={e =>
              setDraft({
                ...emptyDraft(e.target.value as MnDoDPredicateKind),
                kind: e.target.value as MnDoDPredicateKind,
              })
            }
            data-testid="dod-kind-select"
          >
            {MN_DOD_PREDICATE_KINDS.map(kind => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
          <span />
        </div>

        {draft.kind === 'DOC_EXISTS' ? (
          <div className={styles.editorRow}>
            <label htmlFor="dod-doc-id">Doc ID</label>
            <input
              id="dod-doc-id"
              className={styles.input}
              value={draft.docId}
              onChange={e => setDraft({ ...draft, docId: e.target.value })}
              placeholder="page-uuid"
            />
            <span />
          </div>
        ) : null}

        {draft.kind === 'URL_REACHABLE' ? (
          <>
            <div className={styles.editorRow}>
              <label htmlFor="dod-url">URL</label>
              <input
                id="dod-url"
                className={styles.input}
                value={draft.url}
                onChange={e => setDraft({ ...draft, url: e.target.value })}
                placeholder="https://example.com/health"
              />
              <span />
            </div>
            <div className={styles.editorRow}>
              <label htmlFor="dod-status">Expected status</label>
              <input
                id="dod-status"
                className={styles.input}
                value={draft.expectedStatus}
                onChange={e =>
                  setDraft({ ...draft, expectedStatus: e.target.value })
                }
                placeholder="200 (default: any 2xx)"
              />
              <span />
            </div>
          </>
        ) : null}

        {draft.kind === 'WORK_PRODUCT_EXISTS' ? (
          <>
            <div className={styles.editorRow}>
              <label htmlFor="dod-wp-task">Task ID</label>
              <input
                id="dod-wp-task"
                className={styles.input}
                value={draft.taskId}
                onChange={e => setDraft({ ...draft, taskId: e.target.value })}
                placeholder="task-uuid"
              />
              <span />
            </div>
            <div className={styles.editorRow}>
              <label htmlFor="dod-wp-kind">Product kind</label>
              <input
                id="dod-wp-kind"
                className={styles.input}
                value={draft.productKind}
                onChange={e =>
                  setDraft({ ...draft, productKind: e.target.value })
                }
                placeholder="optional"
              />
              <span />
            </div>
          </>
        ) : null}

        {draft.kind === 'EMBEDDING_SIMILARITY' ? (
          <>
            <div className={styles.editorRow}>
              <label htmlFor="dod-source">Source text</label>
              <input
                id="dod-source"
                className={styles.input}
                value={draft.sourceText}
                onChange={e =>
                  setDraft({ ...draft, sourceText: e.target.value })
                }
                placeholder="What the output should resemble"
              />
              <span />
            </div>
            <div className={styles.editorRow}>
              <label htmlFor="dod-threshold">Threshold (0-1)</label>
              <input
                id="dod-threshold"
                className={styles.input}
                value={draft.threshold}
                onChange={e =>
                  setDraft({ ...draft, threshold: e.target.value })
                }
                placeholder="0.8"
              />
              <span />
            </div>
          </>
        ) : null}

        {draft.kind === 'CUSTOM' ? (
          <div className={styles.editorRow}>
            <label htmlFor="dod-desc">Description</label>
            <input
              id="dod-desc"
              className={styles.input}
              value={draft.description}
              onChange={e =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="What an operator must approve"
            />
            <span />
          </div>
        ) : null}

        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={loading || !draftToPredicate(draft)}
            onClick={handleAdd}
            data-testid="dod-add-predicate"
          >
            Add predicate
          </button>
          {existingPredicates.length > 0 ? (
            <button
              type="button"
              className={styles.dangerButton}
              disabled={loading}
              onClick={onClear}
              data-testid="dod-clear"
            >
              Clear all
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
