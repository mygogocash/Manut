import { Modal } from '@affine/component';
import { i18nTime } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { DocsService } from '../../modules/doc';
import { DocDisplayMetaService } from '../../modules/doc-display-meta';
import { RecentDocsService } from '../../modules/quicksearch';
import { WorkbenchService } from '../../modules/workbench';
import * as styles from './quick-switcher.css';
import { useGlobalShortcuts } from './use-global-shortcuts';

/**
 * Quick switcher (Cmd+P) — recent docs + a 3-line preview pane.
 *
 * Per IMPLEMENTATION_PLAN.md §B11 (M2 E2.8). Different module from
 * the E2.3 CMDK search modal preview pane — we don't import the
 * shared `PreviewPane` because the data shape is different (we read
 * doc body markdown lazily, the CMDK pane reads `payload.blockContent`
 * which comes from the search index).
 *
 * Conflict notes:
 *   - macOS Safari/Chrome bind ⌘P to "Print." We preventDefault
 *     inside the keydown handler when the editable-target guard
 *     allows the binding to fire, so print only opens if you're
 *     focused inside an input/contenteditable (intentional escape
 *     hatch for the user to print a page).
 *   - Electron desktop reroutes Cmd+P to its own menu before web
 *     handlers run; we still register the binding for parity with
 *     the web build but it's effectively shadowed in Electron unless
 *     the underlying menu binding gets removed. Acceptable for E2.8
 *     — power-users on Electron already have Cmd+K.
 */

const PREVIEW_CHAR_CAP = 600; // ~3 lines worth at typical doc widths

interface RecentDoc {
  id: string;
  title: string;
  icon: ReactNode;
  updatedDate: number | undefined;
}

interface PreviewState {
  docId: string | null;
  loading: boolean;
  content: string | null;
  error: boolean;
}

const EMPTY_PREVIEW: PreviewState = {
  docId: null,
  loading: false,
  content: null,
  error: false,
};

export interface QuickSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickSwitcher({
  open,
  onOpenChange,
}: QuickSwitcherProps): ReactNode {
  const recentDocsService = useService(RecentDocsService);
  const docDisplayMetaService = useService(DocDisplayMetaService);
  const docsService = useService(DocsService);
  const workbenchService = useService(WorkbenchService);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [preview, setPreview] = useState<PreviewState>(EMPTY_PREVIEW);
  const previewRequestRef = useRef(0);
  // Mirror the loaded docId in a ref so the preview-load effect can
  // check "already loaded for this doc?" WITHOUT subscribing to
  // `preview.docId`. Adding it to the effect's deps would cause the
  // effect to re-fire on every load completion → infinite re-load.
  const previewDocIdRef = useRef<string | null>(null);
  const docsList = useLiveData(docsService.list.docs$);

  // Build the visible doc list from the workspace's full docs list,
  // sorted by updatedDate desc. We don't use `RecentDocsService` here
  // because it caps at 3 — the switcher wants more. We DO ping
  // recentDocsService.addRecentDoc on submit so future cmd-K usage
  // benefits from the open.
  const docs = useMemo<RecentDoc[]>(() => {
    if (!docsList) return [];
    return docsList
      .filter(d => !d.trash$.value)
      .map(docRecord => {
        const { title, icon, updatedDate } =
          docDisplayMetaService.getDocDisplayMeta(docRecord);
        return {
          id: docRecord.id,
          title: typeof title === 'string' ? title : 'Untitled',
          icon: typeof icon === 'function' ? icon({}) : icon,
          updatedDate,
        };
      })
      .sort((a, b) => (b.updatedDate ?? 0) - (a.updatedDate ?? 0))
      .slice(0, 20);
  }, [docsList, docDisplayMetaService]);

  const filtered = useMemo<RecentDoc[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(d => d.title.toLowerCase().includes(q));
  }, [docs, query]);

  // Reset selected index when the visible list shrinks below it. We
  // do this in a layout pass via useEffect because React 19 prefers
  // committed state for derived selection.
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(0);
    }
  }, [filtered, selectedIndex]);

  // Lazy-load the preview body whenever the selected doc changes.
  // We bump `previewRequestRef` so an in-flight extract can detect
  // it's stale and drop the result on the floor.
  useEffect(() => {
    const selected = filtered[selectedIndex];
    if (!open || !selected) {
      setPreview(EMPTY_PREVIEW);
      return;
    }

    if (previewDocIdRef.current === selected.id) {
      // Already loaded for this doc — skip re-fetch.
      return;
    }

    const requestId = ++previewRequestRef.current;
    previewDocIdRef.current = selected.id;
    setPreview({
      docId: selected.id,
      loading: true,
      content: null,
      error: false,
    });

    let release: (() => void) | null = null;
    const extract = async () => {
      try {
        const opened = docsService.open(selected.id);
        release = opened.release;
        const store = opened.doc.blockSuiteDoc.getStore();
        if (!store) throw new Error('Store not available');
        const transformer = store.getTransformer();
        const { MarkdownAdapter } =
          await import('@blocksuite/affine/shared/adapters');
        const adapter = new MarkdownAdapter(transformer, store.provider);
        const extracted = await adapter.fromDoc(store);
        const body = extracted?.file ?? '';
        if (previewRequestRef.current !== requestId) {
          release?.();
          return;
        }
        setPreview({
          docId: selected.id,
          loading: false,
          content: body.slice(0, PREVIEW_CHAR_CAP),
          error: false,
        });
      } catch {
        if (previewRequestRef.current !== requestId) {
          release?.();
          return;
        }
        setPreview({
          docId: selected.id,
          loading: false,
          content: null,
          error: true,
        });
      } finally {
        // Always release — the pool will keep the doc alive only
        // while someone else holds a reference (the editor view).
        // For preview-only access, release immediately to avoid
        // pinning every previewed doc in memory.
        release?.();
      }
    };
    extract().catch(() => {
      // The async body already routes failures through `setPreview`;
      // this catch is for the rare case where extract() rejects
      // before entering the try block (e.g. synchronous throw on
      // the first statement). Swallow — we've already shown the
      // loading state.
    });
  }, [open, filtered, selectedIndex, docsService]);

  // Clear query + selection whenever the modal toggles open. Avoids
  // stale preview on next invocation.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      setPreview(EMPTY_PREVIEW);
      previewDocIdRef.current = null;
    }
  }, [open]);

  const handleOpen = useCallback(
    (docId: string) => {
      recentDocsService.addRecentDoc(docId);
      workbenchService.workbench.openDoc(docId);
      onOpenChange(false);
    },
    [recentDocsService, workbenchService, onOpenChange]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex(idx => Math.min(idx + 1, filtered.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(idx => Math.max(idx - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) handleOpen(selected.id);
      }
    },
    [filtered, selectedIndex, handleOpen]
  );

  const selectedDoc = filtered[selectedIndex] ?? null;

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={720}>
      <div
        className={styles.switcherRoot}
        data-testid="quick-switcher"
        onKeyDown={handleKeyDown}
      >
        <div className={styles.listColumn}>
          <div className={styles.switcherInputWrap}>
            <input
              className={styles.switcherInput}
              placeholder="Jump to a doc…"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              autoFocus
              data-testid="quick-switcher-input"
            />
          </div>
          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.emptyState}>No matching docs</div>
            ) : (
              filtered.map((d, idx) => (
                <div
                  key={d.id}
                  className={styles.row}
                  data-selected={idx === selectedIndex}
                  data-testid={`quick-switcher-row-${idx}`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => handleOpen(d.id)}
                >
                  <span className={styles.rowIcon}>{d.icon}</span>
                  <span className={styles.rowTitle}>{d.title}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <aside className={styles.previewColumn} aria-label="Doc preview">
          {selectedDoc ? (
            <>
              <h3 className={styles.previewTitle}>{selectedDoc.title}</h3>
              <div className={styles.previewMeta}>
                {selectedDoc.updatedDate
                  ? `Updated ${i18nTime(new Date(selectedDoc.updatedDate))}`
                  : null}
              </div>
              {preview.loading ? (
                <div className={styles.previewEmpty}>Loading preview…</div>
              ) : preview.error ? (
                <div className={styles.previewEmpty}>Preview unavailable</div>
              ) : preview.content ? (
                <div className={styles.previewBody}>{preview.content}</div>
              ) : (
                <div className={styles.previewEmpty}>Empty document</div>
              )}
            </>
          ) : (
            <div className={styles.previewEmpty}>Select a doc to preview</div>
          )}
          <div className={styles.previewHints}>
            <div className={styles.previewHintRow}>
              <span className={styles.hintKey}>↵</span>
              <span>Open</span>
            </div>
            <div className={styles.previewHintRow}>
              <span className={styles.hintKey}>↑</span>
              <span className={styles.hintKey}>↓</span>
              <span>Navigate</span>
            </div>
            <div className={styles.previewHintRow}>
              <span className={styles.hintKey}>esc</span>
              <span>Close</span>
            </div>
          </div>
        </aside>
      </div>
    </Modal>
  );
}

/**
 * Hook that opens the quick switcher on Cmd+P (Ctrl+P elsewhere).
 *
 * Conflict: web browsers bind Cmd+P to "Print." We preventDefault
 * inside the binding so the print dialog only opens when the user is
 * focused inside an editor (the editable-target guard skips us). On
 * Electron the OS menu shadows us; that's expected.
 */
export function useQuickSwitcher(): {
  open: boolean;
  setOpen: (open: boolean) => void;
} {
  const [open, setOpen] = useState(false);

  const bindings = useMemo(
    () => ({
      'Mod+p': (event: KeyboardEvent) => {
        event.preventDefault();
        setOpen(prev => !prev);
      },
      Escape: () => {
        setOpen(prev => (prev ? false : prev));
      },
    }),
    []
  );

  useGlobalShortcuts(bindings, { ignoreEditableGuard: false });

  return { open, setOpen };
}
