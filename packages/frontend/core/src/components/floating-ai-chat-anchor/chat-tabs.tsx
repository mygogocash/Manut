import { SPRING_WOBBLY } from '@affine/core/utils/motion';
import { CloseIcon, PinedIcon, PinIcon, PlusIcon } from '@blocksuite/icons/rc';
import { motion, useReducedMotion } from 'framer-motion';
import { type MouseEvent, useCallback, useId } from 'react';

import * as styles from './chat-tabs.css';
import type { ChatTabSnapshot } from './use-chat-tabs';

interface ChatTabsProps {
  tabs: readonly ChatTabSnapshot[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCreate: () => void;
  // The "+" button is disabled while a creation is in flight so the
  // user can't double-click and spawn two ghost tabs (the create
  // mutation is debounced + lock-guarded at the resolver but the UI
  // should reflect the in-flight state anyway).
  isCreating: boolean;
}

/**
 * Manut Wave 6 E2.5 — horizontal tab strip for the floating chat panel.
 *
 * Lives at the top of the panel above the context chip row. Each tab maps
 * 1:1 to an existing chat session row in the AI sessions metadata table;
 * tabs persist via the GlobalState-backed hook in {@link useChatTabs}.
 *
 * Render contract:
 *  - title is truncated to a single line with ellipsis (see chat-tabs.css.ts)
 *  - a pin glyph appears when the session has a non-null `pinnedDocId`;
 *    the glyph stays muted on unpinned tabs so users can see at a glance
 *    which tabs are locked to a doc context
 *  - the × close button is shown on every tab regardless of pin state
 *  - the "+" button sits at the right edge and creates a new chat
 *  - overflow scrolls horizontally with the native browser track hidden
 */
export const ChatTabs = ({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onCreate,
  isCreating,
}: ChatTabsProps) => {
  // Each tab's close button must NOT bubble into the surrounding select
  // handler — otherwise clicking × would also activate the tab right
  // before it gets removed, which causes a redundant re-render. Memoise
  // the per-tab callback factories so the JSX stays stable.
  const handleClose = useCallback(
    (id: string) => (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onClose(id);
    },
    [onClose]
  );

  const handleSelect = useCallback(
    (id: string) => () => {
      onSelect(id);
    },
    [onSelect]
  );

  // Manut M2 E2.7 — magic-line indicator. A shared layoutId across all
  // tabs glides the active-tab underline between tabs via Framer Motion's
  // FLIP layout animation. The `useId()` hook keeps the layoutId unique
  // per ChatTabs instance so two strips on the same page (devtools
  // overlay, split-pane) don't share an indicator.
  const reactId = useId();
  const layoutId = `manut-chat-tabs-indicator-${reactId}`;
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={styles.tabStrip}
      role="tablist"
      aria-label="Manut AI chat tabs"
      data-testid="floating-ai-chat-tabs"
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        const isPinned = tab.pinnedDocId !== null;
        const title = tab.title?.trim() || 'New chat';
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`Chat tab: ${title}`}
            data-active={isActive}
            data-testid="floating-ai-chat-tab"
            data-tab-id={tab.id}
            className={styles.tab}
            onClick={handleSelect(tab.id)}
            title={title}
          >
            <span
              className={styles.tabPinIcon}
              data-pinned={isPinned}
              aria-hidden="true"
            >
              {isPinned ? (
                <PinedIcon width={12} height={12} />
              ) : (
                <PinIcon width={12} height={12} />
              )}
            </span>
            <span className={styles.tabTitle}>{title}</span>
            <button
              type="button"
              className={styles.tabCloseButton}
              onClick={handleClose(tab.id)}
              aria-label={`Close ${title}`}
              data-testid="floating-ai-chat-tab-close"
              tabIndex={isActive ? 0 : -1}
            >
              <CloseIcon width={10} height={10} />
            </button>
            {isActive ? (
              <motion.span
                aria-hidden="true"
                layoutId={layoutId}
                className={styles.tabActiveIndicator}
                // SPRING_WOBBLY gives the indicator a tiny overshoot that
                // makes the glide feel intentional. Under reduced-motion
                // we collapse to an instant transition so the indicator
                // snaps to the new tab without movement.
                transition={
                  prefersReducedMotion ? { duration: 0 } : SPRING_WOBBLY
                }
              />
            ) : null}
          </button>
        );
      })}
      <button
        type="button"
        className={styles.addTabButton}
        onClick={onCreate}
        disabled={isCreating}
        aria-label="New chat"
        data-testid="floating-ai-chat-tab-create"
      >
        <PlusIcon width={14} height={14} />
      </button>
    </div>
  );
};
