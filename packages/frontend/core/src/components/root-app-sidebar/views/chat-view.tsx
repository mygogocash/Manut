import { GlobalStateService } from '@affine/core/modules/storage';
import { WorkspaceService } from '@affine/core/modules/workspace';
import {
  FADE_UP_VARIANTS,
  SPRING_GENTLE,
  STAGGER_30MS,
} from '@affine/core/utils/motion';
import { AiIcon, ChatPanelIcon, PlusIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import * as styles from './chat-view.css';
import type { ChatHistoryRow } from './use-chat-history';
import { useChatHistory } from './use-chat-history';

// Persistence keys must match `components/floating-ai-chat-anchor/use-chat-tabs.ts`.
// The hook lives in a sibling component and we deliberately don't import its
// internals here — the contract is the GlobalState shape, not the hook
// surface. If those keys move, this file moves with them (search the repo
// for `floatingChat.tabs.` to find both call sites).
const tabsKey = (workspaceId: string): string =>
  `floatingChat.tabs.${workspaceId}`;
const activeKey = (workspaceId: string): string =>
  `floatingChat.activeTab.${workspaceId}`;
const metaKey = (workspaceId: string, sessionId: string): string =>
  `floatingChat.tabMeta.${workspaceId}.${sessionId}`;

interface StoredMeta {
  title: string | null;
  pinnedDocId: string | null;
}

// Per-row timestamp pill — "today", "yesterday", or "mar 24" style. The
// Notion screenshot uses lowercase abbreviations on the right edge of
// each row, with no year unless the row is from a prior calendar year.
function formatRelative(updatedAt: number, now: number): string {
  if (!updatedAt) return '';
  const target = new Date(updatedAt);
  const ref = new Date(now);
  // Compare at day granularity by zeroing the time portion of both refs.
  const targetDay = new Date(target);
  targetDay.setHours(0, 0, 0, 0);
  const refDay = new Date(ref);
  refDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (refDay.getTime() - targetDay.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  const sameYear = target.getFullYear() === ref.getFullYear();
  const month = target
    .toLocaleString('en-US', { month: 'short' })
    .toLowerCase();
  const day = target.getDate();
  if (sameYear) return `${month} ${day}`;
  return `${month} ${day} ${target.getFullYear()}`;
}

interface ChatHistoryRowButtonProps {
  row: ChatHistoryRow;
  active: boolean;
  now: number;
  onSelect: (id: string, title: string) => void;
}

function ChatHistoryRowButton({
  row,
  active,
  now,
  onSelect,
}: ChatHistoryRowButtonProps): ReactElement {
  // React 19 preserve-manual-memo: read the row id + title fresh from props
  // inside the click handler so the callback isn't re-bound per render and
  // the dispatched values track the latest row data.
  const handleClick = useCallback(() => {
    onSelect(row.id, row.title);
  }, [onSelect, row.id, row.title]);

  return (
    <button
      type="button"
      className={styles.historyRow}
      data-active={active ? 'true' : 'false'}
      data-testid={`sidebar-chat-history-row-${row.id}`}
      onClick={handleClick}
      title={row.title}
    >
      <span className={styles.historyIcon} aria-hidden="true">
        <ChatPanelIcon />
      </span>
      <span className={styles.historyTitle}>{row.title}</span>
      <span className={styles.historyTimestamp}>
        {formatRelative(row.updatedAt, now)}
      </span>
    </button>
  );
}

/**
 * Chat tab body — Notion-style "Notion AI" header card row + chat history
 * grouped by recency. Reads sessions from the workspace copilot via
 * `useChatHistory`, projects them into `Today / Yesterday / Past 7 days /
 * Past 30 days / Older` buckets, and lets the user activate any row.
 *
 * Activating a row writes the floating-chat-anchor's tab persistence keys
 * so the user's next ⌘J / floating-button open lands on the selected
 * conversation. We don't toggle the panel open from here — the panel is
 * a peer surface, and the activation flow stays consistent with the
 * existing "click M button" entry point.
 */
export function ChatView(): ReactElement {
  const workspaceService = useService(WorkspaceService);
  const globalStateService = useService(GlobalStateService);
  const workspaceId = workspaceService.workspace.id;
  const globalState = globalStateService.globalState;

  const { status, buckets, totalCount, now } = useChatHistory();

  // The active row is whichever session is the active floating-chat tab.
  // Reads via `globalState.get` (sync) inside a useMemo so the selection
  // mirrors the persistence layer without subscribing to a LiveData — the
  // sidebar list re-renders on workspace switch + reload, which is when
  // the selection could plausibly change from this surface's point of view.
  const activeId = useMemo<string | null>(() => {
    const raw = globalState.get<string | null>(activeKey(workspaceId));
    return typeof raw === 'string' ? raw : null;
  }, [globalState, workspaceId]);

  const handleSelect = useCallback(
    (sessionId: string, title: string) => {
      // Mirror `useChatTabs.registerTab` semantics: dedupe into the tab
      // list, persist the meta snapshot, then set the active tab. Read
      // fresh from globalState inside the callback (R19 manual-memo
      // discipline — see CLAUDE.md hook scars) so concurrent registrations
      // from other surfaces don't get clobbered.
      const current = globalState.get<string[]>(tabsKey(workspaceId)) ?? [];
      const safeList = Array.isArray(current)
        ? current.filter((v): v is string => typeof v === 'string')
        : [];
      const next = safeList.includes(sessionId)
        ? safeList
        : [...safeList, sessionId];
      globalState.set(tabsKey(workspaceId), next);
      globalState.set<StoredMeta>(metaKey(workspaceId, sessionId), {
        title: title.length > 0 ? title : null,
        pinnedDocId: null,
      });
      globalState.set(activeKey(workspaceId), sessionId);
    },
    [globalState, workspaceId]
  );

  const handleNewAgent = useCallback(() => {
    // Wire to the existing agents-section flow once it ships a global
    // open-create hook. For now the "+ New agent" plate is a visual
    // anchor — clicking it is a no-op until the agents M3 work lands.
    // Keeping the affordance visible so the Notion layout stays whole.
  }, []);

  const handleOpenMainAgent = useCallback(() => {
    // Same future-wire: the avatar tile will deep-link to the workspace's
    // default agent once we have one. Quiet no-op for now.
  }, []);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className={styles.viewRoot} data-testid="sidebar-chat-view">
        <AgentSection
          onOpenMain={handleOpenMainAgent}
          onNewAgent={handleNewAgent}
        />
        <div className={styles.loadingState} aria-busy="true">
          <div className={styles.loadingRow} />
          <div className={styles.loadingRow} />
          <div className={styles.loadingRow} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.viewRoot} data-testid="sidebar-chat-view">
      <AgentSection
        onOpenMain={handleOpenMainAgent}
        onNewAgent={handleNewAgent}
      />
      {totalCount === 0 ? (
        <div className={styles.emptyState} data-testid="sidebar-chat-empty">
          <div className={styles.emptyIcon}>
            <AiIcon />
          </div>
          <div className={styles.emptyTitle}>No chats yet.</div>
          <div className={styles.emptyCopy}>
            Press <kbd>Cmd</kbd>+<kbd>J</kbd> to start one.
          </div>
        </div>
      ) : (
        <HistoryList
          buckets={buckets}
          activeId={activeId}
          now={now}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}

// Motion polish — chat history list with FADE_UP cascade. Each row
// fades up 8px with SPRING_GENTLE; the parent container staggers
// children by 30ms. Reduced-motion users see the list render
// instantly (no opacity, no transform, no stagger).
interface HistoryListProps {
  buckets: ReturnType<typeof useChatHistory>['buckets'];
  activeId: string | null;
  now: number;
  onSelect: (id: string, title: string) => void;
}

function HistoryList({
  buckets,
  activeId,
  now,
  onSelect,
}: HistoryListProps): ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const containerVariants = useMemo(
    () => ({
      hidden: { opacity: 1 },
      visible: {
        opacity: 1,
        transition: prefersReducedMotion ? {} : STAGGER_30MS,
      },
    }),
    [prefersReducedMotion]
  );

  return (
    <motion.div
      className={styles.historySection}
      variants={containerVariants}
      initial={prefersReducedMotion ? false : 'hidden'}
      animate="visible"
    >
      {buckets.map(bucket => (
        <div key={bucket.id}>
          <div
            className={styles.groupHeading}
            data-testid={`sidebar-chat-bucket-${bucket.id}`}
          >
            {bucket.label}
          </div>
          <div className={styles.historyList}>
            {bucket.rows.map(row => (
              <motion.div
                key={row.id}
                variants={prefersReducedMotion ? undefined : FADE_UP_VARIANTS}
                transition={
                  prefersReducedMotion ? { duration: 0 } : SPRING_GENTLE
                }
              >
                <ChatHistoryRowButton
                  row={row}
                  active={row.id === activeId}
                  now={now}
                  onSelect={onSelect}
                />
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

interface AgentSectionProps {
  onOpenMain: () => void;
  onNewAgent: () => void;
}

function AgentSection({
  onOpenMain,
  onNewAgent,
}: AgentSectionProps): ReactElement {
  return (
    <div className={styles.agentSection} data-testid="sidebar-chat-agent-row">
      <div className={styles.agentHeader}>Manut AI</div>
      <div className={styles.agentRow}>
        <button
          type="button"
          className={`${styles.agentCardBase} ${styles.agentCardPrimary}`}
          onClick={onOpenMain}
          data-testid="sidebar-chat-agent-main"
        >
          <span className={styles.agentAvatarPlate} aria-hidden="true">
            M
          </span>
          <span className={styles.agentCardLabel}>Manut AI</span>
        </button>
        <button
          type="button"
          className={`${styles.agentCardBase} ${styles.agentCardPlus}`}
          onClick={onNewAgent}
          data-testid="sidebar-chat-agent-new"
        >
          <span className={styles.agentAvatarPlate} aria-hidden="true">
            <PlusIcon />
          </span>
          <span className={styles.agentCardLabel}>New agent</span>
        </button>
      </div>
    </div>
  );
}
