import type {
  MnTaskPlanDecision,
  MnTaskPlanDto,
  MnTaskPlanReviewerComment,
  MnTaskPlanStatus,
} from '@affine/core/modules/manut-pm';
import { useCallback, useMemo, useState } from 'react';

import * as styles from './task-plans-panel.css';

/**
 * M13 — Task Plans panel.
 *
 * Two concerns in one component:
 *   1. RENDER the revision timeline — each plan revision gets a card
 *      with a status badge (DRAFT / UNDER_REVIEW / APPROVED / REJECTED
 *      / SUPERSEDED), the markdown body in a monospace preview, the
 *      reviewer comment audit log, and per-revision action buttons.
 *   2. EDIT a new draft — a monospace textarea that, on save, fires
 *      `onCreate(bodyMd)` so the parent can call the
 *      `createMnTaskPlan` mutation. The parent owns the network round
 *      trip and re-fetch; this component is data-in / events-out.
 *
 * The decision controls (Approve / Reject) only render on
 * UNDER_REVIEW rows. The Submit-for-review control only renders on
 * DRAFT rows. The state machine is enforced on the backend too — the
 * UI is just hiding the controls that would be guaranteed to fail.
 *
 * Style rules: every `style({...})` lives in the `.css.ts` sibling
 * (CLAUDE.md vanilla-extract scar). The textarea is intentionally
 * monospace because plan bodies are markdown — operators copy/paste
 * them into other tools and a proportional font wrecks the layout.
 */

interface TaskPlansPanelProps {
  /** The revision list, newest-first. */
  plans: MnTaskPlanDto[];
  /** True while the parent is awaiting a query or mutation. */
  loading?: boolean;
  /** Most recent error, if any. */
  error?: string | null;
  /** Fired when the user saves a new DRAFT revision. */
  onCreate: (bodyMd: string) => void;
  /** Fired when the user submits a DRAFT for review. */
  onSubmitForReview: (planId: string) => void;
  /** Fired when a reviewer decides an UNDER_REVIEW plan. */
  onDecide: (
    planId: string,
    decision: MnTaskPlanDecision,
    comment: string | null
  ) => void;
}

interface DraftCommentState {
  planId: string;
  body: string;
}

/**
 * Defensively narrow the JSONB `reviewerComments` column into a typed
 * array. Bad rows (corrupt, legacy) render as empty rather than
 * crashing the panel — same defensive pattern as
 * `MnOutcomeVerifierService.parsePredicates`.
 */
function narrowComments(raw: unknown): MnTaskPlanReviewerComment[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is MnTaskPlanReviewerComment =>
      entry !== null && typeof entry === 'object'
  );
}

function statusLabel(status: MnTaskPlanStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'UNDER_REVIEW':
      return 'Under Review';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'SUPERSEDED':
      return 'Superseded';
  }
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString();
  } catch {
    return iso;
  }
}

export const TaskPlansPanel = ({
  plans,
  loading,
  error,
  onCreate,
  onSubmitForReview,
  onDecide,
}: TaskPlansPanelProps) => {
  const [draftBody, setDraftBody] = useState('');
  const [decisionDrafts, setDecisionDrafts] = useState<
    Record<string, DraftCommentState>
  >({});

  const summary = useMemo(() => {
    if (plans.length === 0) return 'No plan revisions yet';
    const approved = plans.filter(p => p.status === 'APPROVED').length;
    const draft = plans.filter(p => p.status === 'DRAFT').length;
    const review = plans.filter(p => p.status === 'UNDER_REVIEW').length;
    const parts = [`${plans.length} revision(s)`];
    if (approved > 0) parts.push(`${approved} approved`);
    if (review > 0) parts.push(`${review} under review`);
    if (draft > 0) parts.push(`${draft} draft`);
    return parts.join(' · ');
  }, [plans]);

  const handleCreate = useCallback(() => {
    const trimmed = draftBody.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setDraftBody('');
  }, [draftBody, onCreate]);

  const setDecisionComment = useCallback((planId: string, body: string) => {
    setDecisionDrafts(prev => ({
      ...prev,
      [planId]: { planId, body },
    }));
  }, []);

  const handleDecide = useCallback(
    (planId: string, decision: MnTaskPlanDecision) => {
      const comment = decisionDrafts[planId]?.body?.trim() ?? '';
      onDecide(planId, decision, comment.length > 0 ? comment : null);
      setDecisionDrafts(prev => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
    },
    [decisionDrafts, onDecide]
  );

  return (
    <div className={styles.panelRoot} data-testid="task-plans-panel">
      <div className={styles.header}>
        <span className={styles.title}>Task Plans</span>
        <span className={styles.summary} data-testid="task-plans-summary">
          {summary}
        </span>
      </div>

      {error ? (
        <div className={styles.errorMessage} data-testid="task-plans-error">
          {error}
        </div>
      ) : null}

      {plans.length === 0 ? (
        <div className={styles.emptyState}>
          Draft a plan below to capture the strategy reviewers will sign off on.
        </div>
      ) : (
        <div
          className={styles.revisionList}
          data-testid="task-plans-revision-list"
        >
          {plans.map(plan => {
            const comments = narrowComments(plan.reviewerComments);
            const decisionDraft = decisionDrafts[plan.id]?.body ?? '';
            return (
              <div
                key={plan.id}
                className={styles.revisionRow}
                data-testid="task-plans-revision-row"
                data-revision={plan.revisionNumber}
              >
                <div className={styles.revisionHeader}>
                  <span className={styles.revisionLabel}>
                    Revision {plan.revisionNumber}
                  </span>
                  <span
                    className={styles.statusBadge}
                    data-status={plan.status}
                    data-testid="task-plan-status"
                  >
                    {statusLabel(plan.status)}
                  </span>
                </div>
                <span className={styles.revisionMeta}>
                  Created {formatDate(plan.createdAt)}
                  {plan.authorUserId ? ' by user' : null}
                  {plan.authorAgentId ? ' by agent' : null}
                </span>
                <div
                  className={styles.bodyPreview}
                  data-testid="task-plan-body"
                >
                  {plan.bodyMd}
                </div>
                {comments.length > 0 ? (
                  <div
                    className={styles.commentList}
                    data-testid="task-plan-comments"
                  >
                    {comments.map((c, idx) => (
                      <span
                        key={idx}
                        className={styles.commentEntry}
                        data-decision={c.decision ?? ''}
                      >
                        {c.decision ? `[${c.decision}] ` : null}
                        {c.comment ?? '(no comment)'}
                        {c.decidedAt ? ` — ${formatDate(c.decidedAt)}` : null}
                      </span>
                    ))}
                  </div>
                ) : null}

                {plan.status === 'DRAFT' ? (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={loading}
                      onClick={() => onSubmitForReview(plan.id)}
                      data-testid="task-plan-submit-review"
                    >
                      Submit for review
                    </button>
                  </div>
                ) : null}

                {plan.status === 'UNDER_REVIEW' ? (
                  <div className={styles.actions}>
                    <input
                      type="text"
                      className={styles.commentInput}
                      placeholder="Optional reviewer comment"
                      value={decisionDraft}
                      onChange={e =>
                        setDecisionComment(plan.id, e.target.value)
                      }
                      data-testid="task-plan-comment-input"
                    />
                    <button
                      type="button"
                      className={styles.approveButton}
                      disabled={loading}
                      onClick={() => handleDecide(plan.id, 'APPROVE')}
                      data-testid="task-plan-approve"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className={styles.rejectButton}
                      disabled={loading}
                      onClick={() => handleDecide(plan.id, 'REJECT')}
                      data-testid="task-plan-reject"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.editorRoot}>
        <span className={styles.editorLabel}>New plan revision</span>
        <textarea
          className={styles.textarea}
          value={draftBody}
          onChange={e => setDraftBody(e.target.value)}
          placeholder="# Plan&#10;&#10;## Context&#10;...&#10;&#10;## Approach&#10;..."
          data-testid="task-plan-draft-textarea"
        />
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={loading || draftBody.trim().length === 0}
            onClick={handleCreate}
            data-testid="task-plan-create"
          >
            Save draft
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={loading || draftBody.length === 0}
            onClick={() => setDraftBody('')}
            data-testid="task-plan-clear-draft"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};
