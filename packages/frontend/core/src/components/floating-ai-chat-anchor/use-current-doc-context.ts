import { DocsService } from '@affine/core/modules/doc';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { LiveData, useLiveData, useService } from '@toeverything/infra';
import { useMemo } from 'react';
import { matchPath } from 'react-router-dom';

// `LiveData` is imported for the `LiveData.computed(...)` call that drives
// the reactive doc-id derivation below. Keep the import even if the editor
// shows it as bare — the `.computed` member is accessed via the namespace.

/**
 * Snapshot of the currently visible document, derived reactively from
 * `WorkbenchService.workbench.activeView$.location$`. Returns `null` when
 * the user is on a non-doc route (e.g. /all, /collection, /trash, /chat).
 *
 * Shape is intentionally minimal — the floating chat panel only needs
 * `docId` to attach to the AI chat session, `docType` so the prompt knows
 * whether it's looking at a doc vs. an edgeless board, and `title` to
 * render in the context chip. Heavier metadata (icon, modified-at, etc.)
 * can be derived from `DocsService.list.doc$(docId)` if needed downstream.
 */
export interface CurrentDocContext {
  docId: string;
  docType: 'page' | 'edgeless';
  title: string;
}

// Routes that look like `/{docId}` inside the workbench shell. Other workbench
// routes (`/all`, `/chat`, etc.) DON'T match because react-router segments
// are matched literally — `/all` won't match `:pageId` unless we strip our
// explicit prefixes first.
//
// We sniff the pathname directly rather than calling matchPath against every
// workbench route, because the workbench mounts its routes nested under
// `/workspace/:workspaceId/*` (see desktop/router.tsx) and the location we
// get from `activeView.location$` is already relative to that split.
const NON_DOC_PREFIXES = [
  '/all',
  '/chat',
  '/graph',
  '/collection',
  '/tag',
  '/trash',
  '/journals',
  '/agents',
  '/analytics',
  '/projects',
  '/crm',
  '/reminders',
  '/routines',
  '/release-runs',
  '/ceo-chat',
  '/settings',
];

function extractDocIdFromPath(pathname: string): string | null {
  for (const prefix of NON_DOC_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return null;
    }
  }
  // matchPath returns { params: { pageId } } for `/:pageId` shapes.
  const match = matchPath('/:pageId', pathname);
  if (!match) return null;
  const pageId = match.params.pageId;
  if (!pageId) return null;
  return pageId;
}

export function useCurrentDocContext(): CurrentDocContext | null {
  const workbench = useService(WorkbenchService).workbench;
  const docsService = useService(DocsService);

  // We can't just read .location$.pathname — we need it reactive. Compose a
  // LiveData and let useLiveData drive React renders.
  const docId = useLiveData(
    useMemo(
      () =>
        LiveData.computed(get => {
          const location = get(get(workbench.activeView$).location$);
          return extractDocIdFromPath(location.pathname);
        }),
      [workbench]
    )
  );

  // DocsService stores live records keyed by docId. Subscribe so the chip
  // title updates when the doc gets renamed.
  const docRecord = useLiveData(
    useMemo(
      () => (docId ? docsService.list.doc$(docId) : undefined),
      [docId, docsService]
    )
  );
  const title = useLiveData(docRecord?.title$);
  const primaryMode = useLiveData(docRecord?.primaryMode$);

  return useMemo(() => {
    if (!docId) return null;
    return {
      docId,
      docType: primaryMode === 'edgeless' ? 'edgeless' : 'page',
      title: title?.trim() || 'Untitled',
    };
  }, [docId, primaryMode, title]);
}
