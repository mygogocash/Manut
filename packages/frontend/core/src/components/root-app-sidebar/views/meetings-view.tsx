import { TodayIcon } from '@blocksuite/icons/rc';
import type { ReactElement } from 'react';

import {
  placeholderCopy,
  placeholderIcon,
  placeholderRoot,
  placeholderTitle,
} from '../tab-strip.css';

/**
 * Placeholder for the Meetings tab — calendar + transcript integration
 * lands in M2. We render the brand-violet icon plate so the tab strip
 * stays visually consistent across all four body views.
 */
export function MeetingsView(): ReactElement {
  return (
    <div className={placeholderRoot} data-testid="sidebar-meetings-view">
      <div className={placeholderIcon}>
        <TodayIcon />
      </div>
      <div className={placeholderTitle}>Meetings coming in M2</div>
      <div className={placeholderCopy}>
        Stay tuned — calendar sync, transcripts, and follow-ups arrive next.
      </div>
    </div>
  );
}
