import { i18nTime } from '@affine/i18n';
import type { ReactNode } from 'react';

import type { QuickSearchItem } from '../types/item';
import * as styles from './preview-pane.css';

// Right-side preview pane. Renders a snippet of the currently-selected
// row. Arrow keys + Enter / Cmd+Enter are handled by the parent (cmdk's
// own keyboard primitives — we just read `selectedItem`).

interface PreviewPanePayloadLike {
  blockContent?: unknown;
  description?: unknown;
}

function readSnippet(item: QuickSearchItem | null): string | null {
  if (!item) return null;
  // Most doc/search items carry a `blockContent` snippet on payload; tolerate
  // both shapes so we don't crash on arbitrary sources.
  const payload = item.payload as PreviewPanePayloadLike | undefined;
  const candidate =
    typeof payload?.blockContent === 'string'
      ? payload.blockContent
      : typeof payload?.description === 'string'
        ? payload.description
        : null;
  if (candidate) return candidate;

  // Fall back to subTitle from the label.
  const label = item.label;
  if (
    label &&
    typeof label === 'object' &&
    'subTitle' in label &&
    typeof label.subTitle === 'string'
  ) {
    return label.subTitle;
  }
  return null;
}

function readTitle(item: QuickSearchItem | null): string {
  if (!item) return '';
  const label = item.label;
  if (typeof label === 'string') return label;
  if (label && typeof label === 'object' && 'title' in label) {
    const t = label.title;
    return typeof t === 'string' ? t : '';
  }
  return '';
}

export interface PreviewPaneProps {
  selectedItem: QuickSearchItem | null;
  emptyHint?: string;
}

export function PreviewPane({
  selectedItem,
  emptyHint = 'Select a result to preview',
}: PreviewPaneProps): ReactNode {
  if (!selectedItem) {
    return (
      <aside
        className={styles.previewPane}
        aria-label="Result preview"
        data-testid="cmdk-preview-pane"
      >
        <div className={styles.previewEmpty}>{emptyHint}</div>
        <PreviewHints />
      </aside>
    );
  }

  const title = readTitle(selectedItem);
  const snippet = readSnippet(selectedItem);
  const Icon = selectedItem.icon;

  return (
    <aside
      className={styles.previewPane}
      aria-label="Result preview"
      data-testid="cmdk-preview-pane"
    >
      <div className={styles.previewTitle} data-testid="cmdk-preview-title">
        {Icon ? (
          <span className={styles.previewTitleIcon}>
            {typeof Icon === 'function' ? <Icon /> : Icon}
          </span>
        ) : null}
        {title || 'Untitled'}
      </div>
      <div className={styles.previewMeta}>
        {selectedItem.timestamp ? (
          <span>Updated {i18nTime(new Date(selectedItem.timestamp))}</span>
        ) : null}
      </div>
      {snippet ? (
        <div className={styles.previewSnippet}>{snippet}</div>
      ) : (
        <div className={styles.previewEmpty}>No preview available</div>
      )}
      <PreviewHints />
    </aside>
  );
}

function PreviewHints(): ReactNode {
  const isMac = environment.isMacOs;
  const modKey = isMac ? '⌘' : 'Ctrl';
  return (
    <div className={styles.previewHints}>
      <div className={styles.previewHintRow}>
        <span className={styles.previewHintKey}>↵</span>
        <span>Open</span>
      </div>
      <div className={styles.previewHintRow}>
        <span className={styles.previewHintKey}>{modKey}</span>
        <span>+</span>
        <span className={styles.previewHintKey}>↵</span>
        <span>Open in new tab</span>
      </div>
      <div className={styles.previewHintRow}>
        <span className={styles.previewHintKey}>↑</span>
        <span className={styles.previewHintKey}>↓</span>
        <span>Navigate</span>
      </div>
      <div className={styles.previewHintRow}>
        <span className={styles.previewHintKey}>esc</span>
        <span>Close</span>
      </div>
    </div>
  );
}
