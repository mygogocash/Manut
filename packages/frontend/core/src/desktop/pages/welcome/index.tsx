import { AffineOtherPageLayout } from '@affine/component/affine-other-page-layout';
import { Button } from '@affine/component/ui/button';
import { Input } from '@affine/component/ui/input';
import { useLiveData, useService } from '@toeverything/infra';
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAsyncCallback } from '../../../components/hooks/affine-async-hooks';
import {
  RouteLogic,
  useNavigateHelper,
} from '../../../components/hooks/use-navigate-helper';
import { AuthService } from '../../../modules/cloud';
import { WorkspacesService } from '../../../modules/workspace';
import * as styles from './styles.css';

/**
 * /welcome page — first-time workspace creation.
 *
 * Routed to after sign-up when `account.workspaces` is empty. Asks the
 * user to name their first workspace, calls
 * `WorkspacesService.create('affine-cloud', ...)` (same path used by
 * `index/index.tsx` for `initCloud=true`), and then jumps to
 * `/workspace/{wsId}/all`.
 *
 * The backend's `createWorkspace` GraphQL mutation does NOT take a
 * name argument; the workspace name lives inside the y-doc meta map
 * and is set through the `initial` callback handed to
 * `WorkspacesService.create`. See
 * `packages/frontend/core/src/utils/first-app-data.ts` for the
 * canonical pattern (and the `Getting Started` seed doc lives in the
 * backend — see `packages/backend/server/src/core/workspaces/service.ts`).
 */
export const WelcomePage = () => {
  const authService = useService(AuthService);
  const workspacesService = useService(WorkspacesService);
  const { jumpToPage, openPage, jumpToSignIn } = useNavigateHelper();

  const account = useLiveData(authService.session.account$);
  const status = useLiveData(authService.session.status$);
  const workspaces = useLiveData(workspacesService.list.workspaces$);

  const defaultName = useMemo(() => {
    const displayName = account?.info?.name?.trim() ?? '';
    if (displayName.length > 0) {
      return `${displayName}'s workspace`;
    }
    return 'My workspace';
  }, [account?.info?.name]);

  const [name, setName] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Seed the input with a sensible default once we know who the user is.
  // Honour any name the user has already typed by only seeding when the
  // field is still empty.
  useEffect(() => {
    setName(previous => (previous.length > 0 ? previous : defaultName));
  }, [defaultName]);

  // Unauthenticated users have no business on this page — bounce them
  // through sign-in. The redirect target is `/welcome` so they come
  // back here on success.
  useEffect(() => {
    if (status === 'unauthenticated') {
      jumpToSignIn('/welcome', RouteLogic.REPLACE);
    }
  }, [jumpToSignIn, status]);

  // If the user already has at least one workspace, /welcome isn't the
  // right destination. Send them back to the index router, which picks
  // the right landing workspace.
  useEffect(() => {
    if (status === 'authenticated' && workspaces.length > 0) {
      openPage(workspaces[0].id, 'all', RouteLogic.REPLACE);
    }
  }, [openPage, status, workspaces]);

  const handleCreate = useAsyncCallback(async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setErrorMessage('Please give your workspace a name.');
      return;
    }
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      // Mirrors `buildShowcaseWorkspace` in first-app-data.ts: kick the
      // workspace meta map into the right shape before the workspace
      // is ever opened. The backend seeds the "Getting Started" doc as
      // part of `createWorkspace`, so we don't need to push any docs
      // here — the y-doc sync engine will pick the doc up when the
      // workspace first loads.
      const meta = await workspacesService.create(
        'affine-cloud',
        async docCollection => {
          docCollection.meta.initialize();
          docCollection.doc.getMap('meta').set('name', trimmed);
        }
      );
      jumpToPage(meta.id, 'all', RouteLogic.REPLACE);
    } catch (error) {
      console.error('Failed to create workspace', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Couldn't create your workspace. Please try again."
      );
      setSubmitting(false);
    }
  }, [jumpToPage, name, submitting, workspacesService]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleCreate();
    },
    [handleCreate]
  );

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <header className={styles.greeting}>
          <h1 className={styles.headline}>
            {account?.info?.name
              ? `Welcome, ${account.info.name.split(' ')[0]}.`
              : 'Welcome.'}
          </h1>
          <p className={styles.subCopy}>
            Let&rsquo;s create your first workspace. You can rename it later
            from Workspace settings.
          </p>
        </header>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="welcome-workspace-name">
            Workspace name
            <Input
              id="welcome-workspace-name"
              autoFocus
              autoSelect
              size="large"
              value={name}
              placeholder="My workspace"
              disabled={submitting}
              onChange={value => {
                setName(value);
                if (errorMessage) {
                  setErrorMessage(null);
                }
              }}
              onEnter={() => handleCreate()}
            />
          </label>
          {errorMessage ? (
            <p className={styles.errorText}>{errorMessage}</p>
          ) : null}
          <Button
            variant="primary"
            size="large"
            className={styles.submitButton}
            loading={submitting}
            disabled={submitting || name.trim().length === 0}
            onClick={() => handleCreate()}
          >
            Create workspace
          </Button>
        </form>
      </div>
    </div>
  );
};

export const Component = () => {
  return (
    <AffineOtherPageLayout>
      <WelcomePage />
    </AffineOtherPageLayout>
  );
};
