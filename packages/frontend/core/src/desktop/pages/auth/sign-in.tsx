import { notify } from '@affine/component';
import { AffineOtherPageLayout } from '@affine/component/affine-other-page-layout';
import { SignInPageContainer } from '@affine/component/auth-components';
import { SignInPanel } from '@affine/core/components/sign-in';
import { SignInBackgroundArts } from '@affine/core/components/sign-in/background-arts';
import type { AuthSessionStatus } from '@affine/core/modules/cloud/entities/session';
import { WorkspacesService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  RouteLogic,
  useNavigateHelper,
} from '../../../components/hooks/use-navigate-helper';

export const SignIn = ({
  redirectUrl: redirectUrlFromProps,
}: {
  redirectUrl?: string;
}) => {
  const t = useI18n();
  const navigate = useNavigate();
  const { jumpToIndex } = useNavigateHelper();
  const workspacesService = useService(WorkspacesService);
  const [searchParams] = useSearchParams();
  const redirectUrl = redirectUrlFromProps ?? searchParams.get('redirect_uri');

  const error = searchParams.get('error');

  useEffect(() => {
    if (error) {
      notify.error({
        title: t['com.affine.auth.toast.title.failed'](),
        message: error,
      });
    }
  }, [error, t]);

  const handleClose = useCallback(() => {
    jumpToIndex(RouteLogic.REPLACE, {
      search: searchParams.toString(),
    });
  }, [jumpToIndex, searchParams]);

  const handleAuthenticated = useCallback(
    (status: AuthSessionStatus) => {
      if (status !== 'authenticated') {
        return;
      }
      if (redirectUrl) {
        if (redirectUrl.toUpperCase() === 'CLOSE_POPUP') {
          window.close();
        }
        navigate(redirectUrl, {
          replace: true,
        });
        return;
      }

      // First-time workspace creation flow (Wave 2 B5). Brand-new users
      // sign up, finish auth, and have zero workspaces — route them to
      // `/welcome` so they can name their first workspace before being
      // dropped into the app shell. Returning users with at least one
      // workspace keep the existing index behavior.
      //
      // We wait for the workspace list to revalidate so we don't
      // misclassify a returning user as "new" just because the in-
      // memory list hasn't loaded yet.
      workspacesService.list
        .waitForRevalidation()
        .then(() => {
          const hasWorkspace =
            workspacesService.list.workspaces$.value.length > 0;
          if (hasWorkspace) {
            handleClose();
          } else {
            navigate('/welcome', { replace: true });
          }
        })
        .catch(err => {
          console.error('Failed to revalidate workspaces after sign-in', err);
          handleClose();
        });
    },
    [handleClose, navigate, redirectUrl, workspacesService]
  );

  return (
    <SignInPageContainer>
      <div style={{ maxWidth: '400px', width: '100%', zIndex: 1 }}>
        <SignInPanel
          onSkip={handleClose}
          onAuthenticated={handleAuthenticated}
          initStep="signIn"
        />
      </div>
    </SignInPageContainer>
  );
};

export const Component = () => {
  return (
    <AffineOtherPageLayout>
      <SignInBackgroundArts />
      <SignIn />
    </AffineOtherPageLayout>
  );
};
