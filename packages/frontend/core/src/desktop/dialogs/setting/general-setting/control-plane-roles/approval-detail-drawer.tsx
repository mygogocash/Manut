import { Button, Modal, notify } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  createMnApprovalCommentMutation,
  decideMnApprovalMutation,
  type MnApprovalCommentDto,
  mnApprovalCommentsQuery,
  type MnApprovalDto,
  type MnApprovalStatus,
  submitMnApprovalRevisionMutation,
} from '@affine/core/modules/manut-control-plane';
import { Suspense, useCallback, useMemo, useState } from 'react';

import * as styles from './approval-detail-drawer.css';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error';
}

function formatTimestamp(value: string | null): string {
  if (!value) return '-';
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return '-';
  return new Date(ms).toLocaleString();
}

interface ApprovalDetailDrawerProps {
  open: boolean;
  workspaceId: string;
  approval: MnApprovalDto;
  onClose: () => void;
}

interface CommentsSectionProps {
  workspaceId: string;
  approvalId: string;
}

const CommentsTable = ({ workspaceId, approvalId }: CommentsSectionProps) => {
  const queryArg = {
    query: mnApprovalCommentsQuery,
    variables: { workspaceId, approvalId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, error } = useQuery(queryArg);
  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        Could not load comments: {errorMessage(error)}
      </div>
    );
  }
  const comments =
    (
      data as unknown as
        | { mnApprovalComments?: MnApprovalCommentDto[] }
        | undefined
    )?.mnApprovalComments ?? [];
  if (comments.length === 0) {
    return (
      <div className={styles.meta} data-testid="cp-approval-comments-empty">
        No comments yet.
      </div>
    );
  }
  return (
    <div className={styles.commentList} data-testid="cp-approval-comments">
      {comments.map(c => (
        <div key={c.id} className={styles.commentRow}>
          <div className={styles.commentMeta}>
            {c.authorUserId
              ? `user:${c.authorUserId.slice(0, 8)}`
              : c.authorAgentId
                ? `agent:${c.authorAgentId.slice(0, 8)}`
                : 'system'}{' '}
            · {formatTimestamp(c.createdAt)}
          </div>
          <div className={styles.commentBody}>{c.body}</div>
        </div>
      ))}
    </div>
  );
};

export const ApprovalDetailDrawer = ({
  open,
  workspaceId,
  approval,
  onClose,
}: ApprovalDetailDrawerProps) => {
  const [decisionNote, setDecisionNote] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  const { trigger: decide, isMutating: isDeciding } = useMutation({
    mutation: decideMnApprovalMutation,
  } as unknown as Parameters<typeof useMutation>[0]);
  const { trigger: submitRevision, isMutating: isResubmitting } = useMutation({
    mutation: submitMnApprovalRevisionMutation,
  } as unknown as Parameters<typeof useMutation>[0]);
  const { trigger: comment, isMutating: isCommenting } = useMutation({
    mutation: createMnApprovalCommentMutation,
  } as unknown as Parameters<typeof useMutation>[0]);

  const terminal = useMemo(() => {
    return (
      approval.status === 'APPROVED' ||
      approval.status === 'REJECTED' ||
      approval.status === 'CANCELLED'
    );
  }, [approval.status]);

  const handleDecide = useCallback(
    async (status: MnApprovalStatus) => {
      setErrorText(null);
      try {
        await decide({
          workspaceId,
          approvalId: approval.id,
          input: {
            status,
            decisionNote: decisionNote || null,
          },
        } as never);
        notify.success({ title: `Approval ${status.toLowerCase()}.` });
        setDecisionNote('');
        onClose();
      } catch (err) {
        setErrorText(errorMessage(err));
      }
    },
    [approval.id, decide, decisionNote, onClose, workspaceId]
  );

  const handleResubmit = useCallback(async () => {
    setErrorText(null);
    try {
      await submitRevision({
        workspaceId,
        approvalId: approval.id,
        payload: approval.payload ?? null,
      } as never);
      notify.success({ title: 'Approval resubmitted.' });
      onClose();
    } catch (err) {
      setErrorText(errorMessage(err));
    }
  }, [approval.id, approval.payload, onClose, submitRevision, workspaceId]);

  const handleComment = useCallback(async () => {
    if (!commentDraft.trim()) return;
    setErrorText(null);
    try {
      await comment({
        workspaceId,
        approvalId: approval.id,
        input: { body: commentDraft },
      } as never);
      setCommentDraft('');
    } catch (err) {
      setErrorText(errorMessage(err));
    }
  }, [approval.id, comment, commentDraft, workspaceId]);

  return (
    <Modal open={open} onOpenChange={onClose} title="Approval detail">
      <div className={styles.drawer} data-testid="cp-approval-drawer">
        <div className={styles.headerRow}>
          <div className={styles.sectionTitle}>Type</div>
          <div className={styles.meta} data-testid="cp-approval-type">
            {approval.type.replace(/_/g, ' ').toLowerCase()}
          </div>
          <div className={styles.sectionTitle}>Status</div>
          <div className={styles.meta} data-testid="cp-approval-status">
            {approval.status}
            {approval.decisionNote ? ` — ${approval.decisionNote}` : ''}
          </div>
          <div className={styles.sectionTitle}>Project</div>
          <div className={styles.meta}>{approval.projectId}</div>
          <div className={styles.sectionTitle}>Requester</div>
          <div className={styles.meta}>
            {approval.requestedByAgentId
              ? `agent:${approval.requestedByAgentId}`
              : approval.requestedByUserId
                ? `user:${approval.requestedByUserId}`
                : 'unknown'}
          </div>
          <div className={styles.sectionTitle}>Created</div>
          <div className={styles.meta}>
            {formatTimestamp(approval.createdAt)}
          </div>
          {approval.decidedAt ? (
            <>
              <div className={styles.sectionTitle}>Decided</div>
              <div className={styles.meta}>
                {formatTimestamp(approval.decidedAt)}
                {approval.decidedByUserId
                  ? ` by user:${approval.decidedByUserId.slice(0, 8)}`
                  : ''}
              </div>
            </>
          ) : null}
        </div>

        <div>
          <div className={styles.sectionTitle}>Payload</div>
          <pre className={styles.monoBlock} data-testid="cp-approval-payload">
            {JSON.stringify(approval.payload, null, 2)}
          </pre>
        </div>

        {!terminal ? (
          <div>
            <div className={styles.sectionTitle}>Decision note (optional)</div>
            <textarea
              className={styles.textArea}
              data-testid="cp-approval-decision-note"
              placeholder="Optional context for the decision (required for Request changes)"
              value={decisionNote}
              onChange={ev => setDecisionNote(ev.target.value)}
            />
            <div className={styles.actionsRow}>
              <Button
                variant="primary"
                disabled={isDeciding}
                onClick={() => {
                  handleDecide('APPROVED').catch(() => {
                    /* error surfaced via errorText state */
                  });
                }}
                data-testid="cp-approval-approve-button"
              >
                Approve
              </Button>
              <Button
                disabled={isDeciding}
                onClick={() => {
                  handleDecide('REJECTED').catch(() => {
                    /* error surfaced via errorText state */
                  });
                }}
                data-testid="cp-approval-reject-button"
              >
                Reject
              </Button>
              <Button
                disabled={isDeciding || !decisionNote.trim()}
                onClick={() => {
                  handleDecide('REVISION_REQUESTED').catch(() => {
                    /* error surfaced via errorText state */
                  });
                }}
                data-testid="cp-approval-revise-button"
              >
                Request changes
              </Button>
              <Button
                disabled={isDeciding}
                onClick={() => {
                  handleDecide('CANCELLED').catch(() => {
                    /* error surfaced via errorText state */
                  });
                }}
                data-testid="cp-approval-cancel-button"
              >
                Cancel
              </Button>
              {approval.status === 'REVISION_REQUESTED' ? (
                <Button
                  variant="primary"
                  disabled={isResubmitting}
                  onClick={() => {
                    handleResubmit().catch(() => {
                      /* error surfaced via errorText state */
                    });
                  }}
                  data-testid="cp-approval-resubmit-button"
                >
                  Resubmit
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {errorText ? (
          <div className={styles.errorBox} role="alert">
            {errorText}
          </div>
        ) : null}

        <div>
          <div className={styles.sectionTitle}>Comments</div>
          <Suspense fallback={<div className={styles.meta}>Loading...</div>}>
            <CommentsTable workspaceId={workspaceId} approvalId={approval.id} />
          </Suspense>
        </div>

        <div className={styles.commentForm}>
          <textarea
            className={styles.textArea}
            data-testid="cp-approval-comment-input"
            placeholder="Add a comment..."
            value={commentDraft}
            onChange={ev => setCommentDraft(ev.target.value)}
          />
          <div className={styles.actionsRow}>
            <Button
              disabled={!commentDraft.trim() || isCommenting}
              onClick={() => {
                handleComment().catch(() => {
                  /* error surfaced via errorText state */
                });
              }}
              data-testid="cp-approval-comment-submit"
            >
              Add comment
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
