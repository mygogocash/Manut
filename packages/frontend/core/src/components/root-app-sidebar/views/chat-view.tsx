import { ChatPanelIcon } from '@blocksuite/icons/rc';
import type { ReactElement } from 'react';

import {
  placeholderCopy,
  placeholderIcon,
  placeholderRoot,
  placeholderTitle,
} from '../tab-strip.css';

/**
 * Placeholder for the Chat tab — full chat experience ships in M2 of the
 * Wave-2 sidebar rollout. Renders a brand-accented icon plate plus a
 * one-line "stay tuned" copy so the tab strip never feels empty when a
 * user clicks it.
 */
export function ChatView(): ReactElement {
  return (
    <div className={placeholderRoot} data-testid="sidebar-chat-view">
      <div className={placeholderIcon}>
        <ChatPanelIcon />
      </div>
      <div className={placeholderTitle}>Chat coming in M2</div>
      <div className={placeholderCopy}>
        Stay tuned — the always-on conversation surface ships next.
      </div>
    </div>
  );
}
