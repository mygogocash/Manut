/**
 * M17 — CEO Chat page.
 *
 * Top-level chat surface that resolves every USER turn to a typed work
 * object. Two-pane shell:
 *
 *   [conversation list rail] [ thread + composer ]
 *
 * After the USER submits a turn the page:
 *   1. POSTs `addMnCeoTurn` with role=USER
 *   2. POSTs `resolveMnCeoTurn` with the new turn's id — backend
 *      classifies + creates the matching work object + sets the
 *      `resolutionKind` + `resolutionRefId` on the turn.
 *   3. Reloads the turn list to surface the resolution badge + link.
 *
 * The page does NOT render an LLM-style CEO_AGENT reply yet — that
 * lands in the follow-up that wires the Vertex auto-router. The
 * resolution badge is the "every turn resolves to a typed work
 * object" invariant made visible in v1.
 *
 * CLAUDE.md scars honored:
 *  - All vanilla-extract `style({...})` lives in `ceo-chat-page.css.ts`
 *    (the `.tsx` only consumes the exported style names).
 *  - `useQuery` / `useMutation` calls use the same `as unknown as`
 *    cast pattern that projects/index.tsx uses, because the codegen
 *    hasn't been re-run for the new operations.
 */
import { Button, notify } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  addMnCeoTurnMutation,
  createMnCeoConversationMutation,
  type MnCeoConversationDto,
  mnCeoConversationsQuery,
  type MnCeoResolutionKind,
  type MnCeoTurnDto,
  mnCeoTurnsQuery,
  resolveMnCeoTurnMutation,
} from '@affine/core/modules/manut-control-plane';
import {
  ViewBody,
  ViewHeader,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { Header } from '../../../components/pure/header';
import * as styles from './ceo-chat-page.css';

const RESOLUTION_LABEL: Record<MnCeoResolutionKind, string> = {
  NONE: 'Recorded',
  TASK_CREATED: 'Task created',
  APPROVAL_REQUESTED: 'Approval requested',
  PLAN_DRAFTED: 'Plan drafted',
  DECISION_RECORDED: 'Decision recorded',
  BUDGET_QUERY: 'Budget query',
  STATUS_QUERY: 'Status query',
};

function workObjectPath(
  kind: MnCeoResolutionKind,
  refId: string | null
): string | null {
  if (!refId) return null;
  switch (kind) {
    case 'TASK_CREATED':
      // The work object is a task — its parent project is the canonical
      // surface for opening it. The detail page handles the deep-link.
      return `/all`;
    case 'APPROVAL_REQUESTED':
      // Approvals are in the workspace settings inbox; deep linking
      // there lands as a follow-up. Return null until that surface
      // exposes a routable id.
      return null;
    case 'PLAN_DRAFTED':
      return `/all`;
    default:
      return null;
  }
}

interface ConversationListProps {
  conversations: readonly MnCeoConversationDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  creating: boolean;
}

const ConversationList = ({
  conversations,
  selectedId,
  onSelect,
  onNew,
  creating,
}: ConversationListProps) => (
  <aside className={styles.leftRail} data-testid="m17-ceo-chat-rail">
    <div className={styles.leftRailHeader}>
      <span>Conversations</span>
      <button
        type="button"
        className={styles.newButton}
        onClick={onNew}
        disabled={creating}
        data-testid="m17-ceo-chat-new-conversation"
      >
        + New
      </button>
    </div>
    <div className={styles.conversationList}>
      {conversations.length === 0 ? (
        <div
          style={{ padding: '8px 14px', fontSize: 12, opacity: 0.6 }}
          data-testid="m17-ceo-chat-rail-empty"
        >
          No conversations yet. Start one with the New button above.
        </div>
      ) : (
        conversations.map(conv => (
          <button
            key={conv.id}
            type="button"
            className={styles.conversationItem}
            data-active={selectedId === conv.id ? 'true' : 'false'}
            onClick={() => onSelect(conv.id)}
            data-testid="m17-ceo-chat-conversation-item"
          >
            <span className={styles.conversationTitle}>
              {conv.title?.trim() ? conv.title : 'Untitled chat'}
            </span>
            <span className={styles.conversationMeta}>
              {conv.lastResolutionKind
                ? RESOLUTION_LABEL[conv.lastResolutionKind]
                : 'No turns yet'}
            </span>
          </button>
        ))
      )}
    </div>
  </aside>
);

interface TurnRowProps {
  turn: MnCeoTurnDto;
}

const TurnRow = ({ turn }: TurnRowProps) => {
  const isUser = turn.role === 'USER';
  const refPath = workObjectPath(turn.resolutionKind, turn.resolutionRefId);
  return (
    <div
      className={`${styles.turn} ${isUser ? styles.turnUser : styles.turnAgent}`}
      data-testid="m17-ceo-chat-turn"
      data-role={turn.role}
    >
      <span className={styles.turnRoleLabel}>
        {isUser ? 'You' : turn.role === 'CEO_AGENT' ? 'CEO agent' : 'System'}
      </span>
      <div className={styles.turnBody}>{turn.bodyMd}</div>
      {turn.resolutionKind !== 'NONE' ? (
        <div className={styles.resolutionRow}>
          <span
            className={styles.resolutionBadge}
            data-testid="m17-ceo-chat-resolution-badge"
          >
            {RESOLUTION_LABEL[turn.resolutionKind]}
          </span>
          {refPath ? (
            <a
              href={refPath}
              className={styles.resolutionLink}
              data-testid="m17-ceo-chat-resolution-link"
            >
              View linked work object
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

interface ComposerProps {
  onSubmit: (body: string) => void | Promise<void>;
  disabled: boolean;
}

const Composer = ({ onSubmit, disabled }: ComposerProps) => {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmed = body.trim();
  const canSubmit = !disabled && !submitting && trimmed.length > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setBody('');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, onSubmit, trimmed]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === 'Enter' &&
        (event.metaKey || event.ctrlKey) &&
        canSubmit
      ) {
        event.preventDefault();
        handleSubmit().catch(() => {
          /* error surfaced via UI state */
        });
      }
    },
    [canSubmit, handleSubmit]
  );

  return (
    <div className={styles.composer} data-testid="m17-ceo-chat-composer">
      <textarea
        className={styles.composerTextarea}
        value={body}
        placeholder="What do you want to do? (e.g. create a task to ship the launch checklist; approve the design budget; draft a plan for Q3)"
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          setBody(event.target.value)
        }
        onKeyDown={handleKeyDown}
        disabled={disabled}
        data-testid="m17-ceo-chat-composer-input"
      />
      <div className={styles.composerActions}>
        <span className={styles.composerHint}>⌘/Ctrl + Enter to send</span>
        <Button
          variant="primary"
          loading={submitting}
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
          data-testid="m17-ceo-chat-composer-submit"
        >
          Send
        </Button>
      </div>
    </div>
  );
};

const CeoChatPage = () => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationsQueryArg = useMemo(
    () =>
      ({
        query: mnCeoConversationsQuery,
        variables: { workspaceId },
      }) as unknown as NonNullable<Parameters<typeof useQuery>[0]>,
    [workspaceId]
  );
  const { data: conversationsData, mutate: refetchConversations } = useQuery(
    conversationsQueryArg
  );
  const conversations = useMemo(
    () =>
      (
        conversationsData as unknown as
          | { mnCeoConversations?: MnCeoConversationDto[] }
          | undefined
      )?.mnCeoConversations ?? [],
    [conversationsData]
  );

  // Auto-select the first conversation when it appears.
  useEffect(() => {
    if (!selectedId && conversations.length > 0 && conversations[0]) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  const turnsQueryArg = useMemo(
    () =>
      ({
        query: mnCeoTurnsQuery,
        variables: { workspaceId, conversationId: selectedId ?? '' },
      }) as unknown as NonNullable<Parameters<typeof useQuery>[0]>,
    [workspaceId, selectedId]
  );
  const { data: turnsData, mutate: refetchTurns } = useQuery(
    selectedId
      ? turnsQueryArg
      : ({
          query: mnCeoTurnsQuery,
          variables: { workspaceId, conversationId: '' },
          // Skip the actual fetch when no conversation selected — react-query
          // honours `enabled: false` on the underlying SWR.
          enabled: false,
        } as unknown as NonNullable<Parameters<typeof useQuery>[0]>)
  );
  const turns: MnCeoTurnDto[] =
    (turnsData as unknown as { mnCeoTurns?: MnCeoTurnDto[] } | undefined)
      ?.mnCeoTurns ?? [];

  const { trigger: triggerCreateConv } = useMutation({
    mutation: createMnCeoConversationMutation,
  });
  const { trigger: triggerAddTurn } = useMutation({
    mutation: addMnCeoTurnMutation,
  });
  const { trigger: triggerResolveTurn } = useMutation({
    mutation: resolveMnCeoTurnMutation,
  });

  const handleNew = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const response = (await (
        triggerCreateConv as (args: unknown) => Promise<unknown>
      )({
        input: { workspaceId, title: null },
      })) as { createMnCeoConversation?: MnCeoConversationDto } | undefined;
      const created = response?.createMnCeoConversation;
      if (!created) {
        throw new Error('Server did not return the created conversation.');
      }
      await refetchConversations();
      setSelectedId(created.id);
      notify.success({ title: 'Started new CEO Chat' });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not start chat';
      setError(message);
      notify.error({ title: 'Could not start chat', message });
    } finally {
      setCreating(false);
    }
  }, [creating, refetchConversations, triggerCreateConv, workspaceId]);

  const handleSubmitTurn = useCallback(
    async (body: string) => {
      if (!selectedId) return;
      setError(null);
      try {
        const addResp = (await (
          triggerAddTurn as (args: unknown) => Promise<unknown>
        )({
          workspaceId,
          input: {
            conversationId: selectedId,
            role: 'USER',
            bodyMd: body,
          },
        })) as { addMnCeoTurn?: MnCeoTurnDto } | undefined;
        const addedTurn = addResp?.addMnCeoTurn;
        if (!addedTurn) {
          throw new Error('Server did not return the new turn.');
        }
        // Fire the resolver — it classifies + creates the work object
        // and stamps the resolution back onto the turn row.
        await (triggerResolveTurn as (args: unknown) => Promise<unknown>)({
          workspaceId,
          turnId: addedTurn.id,
        });
        await refetchTurns();
        await refetchConversations();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not send the message';
        setError(message);
        notify.error({ title: 'Could not send', message });
      }
    },
    [
      refetchConversations,
      refetchTurns,
      selectedId,
      triggerAddTurn,
      triggerResolveTurn,
      workspaceId,
    ]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  return (
    <>
      <ViewTitle title="CEO Chat" />
      <ViewHeader>
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
              CEO Chat
            </span>
          }
        />
      </ViewHeader>
      <ViewBody>
        <div className={styles.root} data-testid="m17-ceo-chat-page">
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={handleSelect}
            onNew={() => void handleNew()}
            creating={creating}
          />
          <section className={styles.rightPane}>
            {error ? (
              <div className={styles.errorBox} role="alert">
                {error}
              </div>
            ) : null}
            <div className={styles.thread} data-testid="m17-ceo-chat-thread">
              {!selectedId ? (
                <div className={styles.emptyThread}>
                  Start a conversation from the left rail. Each message resolves
                  to a typed work item — a task, an approval, a plan, or a
                  decision record.
                </div>
              ) : turns.length === 0 ? (
                <div className={styles.emptyThread}>
                  No turns in this conversation yet. Drop the first message
                  below.
                </div>
              ) : (
                turns.map(turn => <TurnRow key={turn.id} turn={turn} />)
              )}
            </div>
            <Composer
              onSubmit={handleSubmitTurn}
              disabled={!selectedId || creating}
            />
          </section>
        </div>
      </ViewBody>
    </>
  );
};

export const Component = () => <CeoChatPage />;
