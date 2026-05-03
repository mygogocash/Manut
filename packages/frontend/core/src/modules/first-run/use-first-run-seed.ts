import { useService } from '@toeverything/infra';
import { useEffect, useRef } from 'react';

import { DocsService } from '../doc';
import { WorkbenchService } from '../workbench';
import { WorkspaceService } from '../workspace';
import { seedWelcomeDoc, workspaceIsEmpty } from './seed-doc';

/**
 * Mounts inside a workspace and, if the workspace has no docs yet, creates the
 * "Getting started with GoGoCash AFFiNE" welcome doc and opens it.
 *
 * Safe to call on every render; the seed runs at most once per workspace
 * instance and only when the workspace is genuinely empty.
 */
export function useFirstRunSeed(): void {
  const workspaceService = useService(WorkspaceService);
  const docsService = useService(DocsService);
  const workbenchService = useService(WorkbenchService);

  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    const workspace = workspaceService.workspace;
    if (!workspace) return;
    const docCollection = workspace.docCollection;
    if (!docCollection) return;

    // The docCollection emits doc add/remove events; we only seed if the
    // workspace is verifiably empty at the moment of mount. We do NOT rely on
    // localStorage here because the seed should run per workspace, not per
    // browser - opening a fresh empty workspace later should still get a
    // welcome doc.
    if (!workspaceIsEmpty(docCollection)) {
      ranRef.current = true;
      return;
    }

    try {
      const docId = seedWelcomeDoc(docCollection, docsService);
      if (docId) {
        // Open the welcome doc so the user sees it immediately.
        workbenchService.workbench.openDoc(docId);
      }
    } catch (err) {
      console.warn('[first-run] failed to seed welcome doc', err);
    }
    ranRef.current = true;
  }, [docsService, workbenchService, workspaceService]);
}
