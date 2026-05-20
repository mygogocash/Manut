/**
 * Manut-branded 404 page — "This page wandered off."
 *
 * Wave 2 B12 / M3 E3.4 brand polish. Replaces the upstream
 * `<NotFoundPage>` for the catch-all route (`*`) and `/404`. The
 * upstream `<NoPermissionOrNotFound>` flow (sign-in prompt for
 * unauthenticated visitors hitting a workspace they can't see) is
 * preserved by re-using the upstream component when `noPermission`
 * is true — that path has auth-server bouncing semantics we should
 * not reimplement.
 *
 * Suggested actions:
 *   1. "Go home" → `/workspace/{lastId}/all` (or `/` if no last id)
 *   2. "Open last doc" → uses `last_workspace_id` + `last_doc_id`
 *      from localStorage (best-effort; fades out the button if neither
 *      is set)
 *   3. "Search" → toggles the CMDK quick-search modal
 *
 * Mascot: inline SVG (no asset deps) — a soft violet+cream geometric
 * blob that gently floats. Cheap to ship and easy to retheme.
 */

import { NoPermissionOrNotFound } from '@affine/component/not-found-page';
import { useSignOut } from '@affine/core/components/hooks/affine/use-sign-out';
import { DesktopApiService } from '@affine/core/modules/desktop-api';
import { WorkspacesService } from '@affine/core/modules/workspace';
import {
  FrameworkScope,
  useLiveData,
  useService,
  useServiceOptional,
} from '@toeverything/infra';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import {
  RouteLogic,
  useNavigateHelper,
} from '../../../components/hooks/use-navigate-helper';
import { ServersService } from '../../../modules/cloud';
import { SignIn } from '../auth/sign-in';
import * as styles from './styles.css';

/**
 * Mascot — a simple violet + cream geometric "wanderer". Inline SVG
 * so the page has zero asset dependencies and renders even on the
 * coldest 404 (no chunks downloaded yet beyond this lazy bundle).
 */
const ManutWandererMascot = (): ReactElement => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 120 120"
    fill="none"
    aria-hidden="true"
  >
    {/* Warm-neutral cream surface — soft underlay */}
    <circle cx="60" cy="60" r="48" fill="var(--manut-accent-cream-bg)" />
    {/* Violet blob — the wanderer's body */}
    <path
      d="M40 50C40 38 48 30 60 30C72 30 82 38 82 52C82 64 76 74 64 78C56 80 50 84 46 90C42 84 38 76 38 66C38 60 39 55 40 50Z"
      fill="var(--manut-accent-violet-fg)"
      opacity="0.85"
    />
    {/* Two cream "eyes" — the wanderer looking puzzled */}
    <circle cx="54" cy="54" r="4" fill="var(--manut-accent-cream-bg)" />
    <circle cx="68" cy="54" r="4" fill="var(--manut-accent-cream-bg)" />
    {/* Tiny floating dot — the lost path */}
    <circle
      cx="92"
      cy="32"
      r="3"
      fill="var(--manut-accent-violet-fg)"
      opacity="0.5"
    />
    <circle
      cx="100"
      cy="44"
      r="2"
      fill="var(--manut-accent-violet-fg)"
      opacity="0.35"
    />
  </svg>
);

/**
 * The Manut-branded 404 body. Used both for the explicit `/404` route
 * and the catch-all `*` route — both come through this component via
 * `lazy: () => import('./pages/404')`.
 */
export const ManutPageNotFound = (): ReactElement => {
  const { jumpToIndex, jumpToPage } = useNavigateHelper();
  const desktopApi = useServiceOptional(DesktopApiService);
  const workspacesService = useService(WorkspacesService);
  const workspaces = useLiveData(workspacesService.list.workspaces$);

  useEffect(() => {
    desktopApi?.handler.ui.pingAppLayoutReady().catch(console.error);
  }, [desktopApi]);

  // Best-effort recovery target: prefer the last workspace the user
  // touched, fall back to the first workspace they have, finally to
  // the root index. Index page already knows how to handle "no
  // workspace yet".
  const lastWorkspaceId = useMemo<string | null>(() => {
    try {
      const stored = localStorage.getItem('last_workspace_id');
      if (stored && workspaces.some(w => w.id === stored)) {
        return stored;
      }
    } catch {
      // localStorage can throw in restricted contexts (iframes,
      // privacy mode). Swallow and fall back.
    }
    return workspaces[0]?.id ?? null;
  }, [workspaces]);

  // "Open last doc" is best-effort — the docId is not stored centrally;
  // some workbench commits land it in localStorage under a per-workspace
  // key. We probe the conventional keys and fall through gracefully if
  // none is set.
  const lastDocId = useMemo<string | null>(() => {
    if (!lastWorkspaceId) return null;
    try {
      // Try the workspace-scoped key first, then fall through to a
      // legacy "last_doc_id" if present. Both are best-effort — if
      // nothing is stored, the button still works but routes to
      // `/all` instead.
      return (
        localStorage.getItem(`last_doc_id:${lastWorkspaceId}`) ??
        localStorage.getItem('last_doc_id')
      );
    } catch {
      return null;
    }
  }, [lastWorkspaceId]);

  const handleGoHome = useCallback(() => {
    if (lastWorkspaceId) {
      jumpToPage(lastWorkspaceId, 'all', RouteLogic.REPLACE);
    } else {
      jumpToIndex(RouteLogic.REPLACE);
    }
  }, [lastWorkspaceId, jumpToIndex, jumpToPage]);

  const handleOpenLastDoc = useCallback(() => {
    if (lastWorkspaceId && lastDocId) {
      jumpToPage(lastWorkspaceId, lastDocId, RouteLogic.REPLACE);
    } else if (lastWorkspaceId) {
      jumpToPage(lastWorkspaceId, 'all', RouteLogic.REPLACE);
    } else {
      jumpToIndex(RouteLogic.REPLACE);
    }
  }, [lastWorkspaceId, lastDocId, jumpToIndex, jumpToPage]);

  // CMDK quick-search lives inside a WorkspaceScope; we may be outside
  // that scope here (catch-all route). Best we can do from outside is
  // jump back into the workspace's `/all` view — the workbench mounts
  // CMDK on that page and the user can fire ⌘K from there.
  const handleSearch = useCallback(() => {
    if (lastWorkspaceId) {
      jumpToPage(lastWorkspaceId, 'all', RouteLogic.REPLACE);
    } else {
      jumpToIndex(RouteLogic.REPLACE);
    }
  }, [lastWorkspaceId, jumpToIndex, jumpToPage]);

  // Strip the origin from the URL for the breadcrumb. Mirrors the
  // upstream behavior in the prior 404 implementation.
  const currentUrl =
    typeof window !== 'undefined'
      ? window.location.href.replace(window.location.origin, '')
      : '';

  return (
    <div className={styles.root} data-testid="manut-404">
      <div className={styles.card}>
        <div className={styles.mascotWrapper}>
          <ManutWandererMascot />
        </div>
        <h1 className={styles.headline}>This page wandered off</h1>
        <p className={styles.subCopy}>
          The doc you&apos;re looking for might have been deleted, renamed, or
          never existed. Try one of these instead:
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.primaryAction}`}
            onClick={handleGoHome}
            data-testid="manut-404-home"
          >
            Go home
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleOpenLastDoc}
            disabled={!lastWorkspaceId}
            data-testid="manut-404-last-doc"
          >
            Open last doc
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleSearch}
            disabled={!lastWorkspaceId}
            data-testid="manut-404-search"
          >
            Search
          </button>
        </div>
        {currentUrl ? <p className={styles.url}>{currentUrl}</p> : null}
      </div>
    </div>
  );
};

/**
 * Authorised-but-can't-see-this surface goes through the upstream
 * `<NoPermissionOrNotFound>` flow — that path has sign-in popovers
 * + sign-out wiring we don't want to reimplement here. Brand-polish
 * only the public 404 surface.
 */
export const PageNotFound = ({
  noPermission,
}: {
  noPermission?: boolean;
}): ReactElement => {
  const serversService = useService(ServersService);
  const serversWithAccount = useLiveData(serversService.serversWithAccount$);
  const desktopApi = useServiceOptional(DesktopApiService);
  const firstLogged = serversWithAccount.find(
    ({ account }) => account !== null
  );
  const { jumpToIndex } = useNavigateHelper();
  const openSignOutModal = useSignOut();

  const handleBackButtonClick = useCallback(
    () => jumpToIndex(RouteLogic.REPLACE),
    [jumpToIndex]
  );

  useEffect(() => {
    desktopApi?.handler.ui.pingAppLayoutReady().catch(console.error);
  }, [desktopApi]);

  const currentUrl =
    typeof window !== 'undefined'
      ? window.location.href.replace(window.location.origin, '')
      : '';

  if (noPermission) {
    return (
      <FrameworkScope scope={firstLogged?.server.scope}>
        <NoPermissionOrNotFound
          user={firstLogged?.account}
          onBack={handleBackButtonClick}
          onSignOut={openSignOutModal}
          signInComponent={<SignIn redirectUrl={currentUrl} />}
        />
      </FrameworkScope>
    );
  }

  return (
    <FrameworkScope scope={firstLogged?.server.scope}>
      <ManutPageNotFound />
    </FrameworkScope>
  );
};

export const Component = () => {
  return <PageNotFound />;
};
