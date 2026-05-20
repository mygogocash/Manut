import { InboxIcon } from '@blocksuite/icons/rc';
import type { ReactElement } from 'react';

import {
  placeholderCopy,
  placeholderIcon,
  placeholderRoot,
  placeholderTitle,
} from '../tab-strip.css';

/**
 * Placeholder for the Inbox tab — unified notification + assignment
 * inbox lands in M2. Same brand-violet icon plate as the other
 * placeholder views so the tab strip behaves consistently.
 */
export function InboxView(): ReactElement {
  return (
    <div className={placeholderRoot} data-testid="sidebar-inbox-view">
      <div className={placeholderIcon}>
        <InboxIcon />
      </div>
      <div className={placeholderTitle}>Inbox coming in M2</div>
      <div className={placeholderCopy}>
        Stay tuned — workspace notifications, mentions, and action items
        consolidate here.
      </div>
    </div>
  );
}
