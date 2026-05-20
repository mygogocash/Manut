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
import { useMutation } from '../../../components/hooks/use-mutation';
import {
  RouteLogic,
  useNavigateHelper,
} from '../../../components/hooks/use-navigate-helper';
import { AuthService } from '../../../modules/cloud';
import { WorkspacesService } from '../../../modules/workspace';
import {
  seedWorkspaceFromWizardMutation,
  updateOnboardingMutation,
  type WizardAnswers,
} from './graphql';
import { StepApps } from './steps/step-apps';
import { StepContext } from './steps/step-context';
import { StepProject } from './steps/step-project';
import { StepTeam } from './steps/step-team';
import * as styles from './styles.css';
import { useOnboardingWizard, WIZARD_STEPS } from './use-onboarding-wizard';

/**
 * /welcome page — first-time workspace creation with an AI-led
 * 4-question onboarding wizard.
 *
 * Wave 2 B5 introduced this page as a single-form workspace-name
 * dialog. Wave 2 B6 extends it into a 5-step wizard:
 *
 *   1. Workspace name (unchanged from B5)
 *   2. "What are you building?" — categorical
 *   3. "Who's on your team?" — categorical
 *   4. "What apps do you live in?" — multi-select
 *   5. "What's your first project?" — free text → submit
 *
 * The wizard answers feed the backend's `seedStarterDoc` so the user
 * lands on docs templated to their stated work type. A Skip button is
 * always visible in the top-right; clicking it creates a blank
 * workspace and goes straight to /workspace/{id}/all.
 *
 * State machine + persistence live in `use-onboarding-wizard.ts`.
 * GraphQL contracts (`updateOnboarding`, `seedWorkspaceFromWizard`)
 * live in `./graphql.ts` (mirrors the integration scaffold pattern —
 * inline until codegen reruns).
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

  const wizard = useOnboardingWizard(defaultName);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // GraphQL mutations — cast at the boundary because these aren't in
  // the codegen'd discriminated union yet. Same pattern as the Google
  // integration scaffold (`integration/google/setting-panel.tsx`).
  const { trigger: triggerUpdateOnboarding } = useMutation({
    mutation: updateOnboardingMutation,
  } as unknown as Parameters<typeof useMutation>[0]);
  const { trigger: triggerSeedFromWizard } = useMutation({
    mutation: seedWorkspaceFromWizardMutation,
  } as unknown as Parameters<typeof useMutation>[0]);

  /**
   * Create the workspace (always seeds Getting Started server-side),
   * then, if `wizardAnswers` is non-empty, fan out to:
   *   - `seedWorkspaceFromWizard` for the extra Project plan +
   *     Team notes docs.
   *   - `updateOnboarding` to flip the user's `completedOnboarding`
   *     flag so we don't bounce them back here on next sign-in.
   *
   * Best-effort on the post-creation calls — a failure there doesn't
   * undo the workspace itself, so we log + continue rather than
   * trapping the user in /welcome.
   */
  const createWorkspaceWithAnswers = useCallback(
    async (
      trimmedName: string,
      wizardAnswers: WizardAnswers
    ): Promise<string> => {
      const meta = await workspacesService.create(
        'affine-cloud',
        async docCollection => {
          docCollection.meta.initialize();
          docCollection.doc.getMap('meta').set('name', trimmedName);
        }
      );

      const hasWizardAnswers =
        Boolean(wizardAnswers.context) ||
        Boolean(wizardAnswers.team) ||
        (wizardAnswers.apps !== undefined && wizardAnswers.apps.length > 0) ||
        (wizardAnswers.project !== undefined &&
          wizardAnswers.project.trim().length > 0);

      if (hasWizardAnswers) {
        try {
          await triggerSeedFromWizard({
            workspaceId: meta.id,
            answers: {
              context: wizardAnswers.context ?? null,
              team: wizardAnswers.team ?? null,
              apps: wizardAnswers.apps ?? null,
              project: wizardAnswers.project ?? null,
            },
          } as unknown as Parameters<typeof triggerSeedFromWizard>[0]);
        } catch (err) {
          // Don't fail the workspace creation if the extras seed
          // fails — Getting Started already exists.
          console.warn('seedWorkspaceFromWizard failed', err);
        }
      }

      try {
        await triggerUpdateOnboarding({
          input: { completedOnboarding: true },
        } as unknown as Parameters<typeof triggerUpdateOnboarding>[0]);
      } catch (err) {
        console.warn('updateOnboarding failed', err);
      }

      return meta.id;
    },
    [triggerSeedFromWizard, triggerUpdateOnboarding, workspacesService]
  );

  const handleSubmit = useAsyncCallback(async () => {
    const trimmed = wizard.workspaceName.trim();
    if (trimmed.length === 0) {
      setErrorMessage('Please give your workspace a name.');
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const id = await createWorkspaceWithAnswers(trimmed, wizard.answers);
      wizard.clear();
      jumpToPage(id, 'all', RouteLogic.REPLACE);
    } catch (error) {
      console.error('Failed to create workspace', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Couldn't create your workspace. Please try again."
      );
      setSubmitting(false);
    }
  }, [createWorkspaceWithAnswers, jumpToPage, submitting, wizard]);

  /**
   * Skip path — create a blank workspace with no wizard answers and
   * drop the user straight into /all. We still flip
   * `completedOnboarding` so the next sign-in doesn't bounce them
   * back to /welcome.
   */
  const handleSkip = useAsyncCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const trimmed = wizard.workspaceName.trim();
      const name = trimmed.length > 0 ? trimmed : defaultName;
      const id = await createWorkspaceWithAnswers(name, {});
      wizard.clear();
      jumpToPage(id, 'all', RouteLogic.REPLACE);
    } catch (error) {
      console.error('Failed to skip onboarding', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Couldn't create your workspace. Please try again."
      );
      setSubmitting(false);
    }
  }, [createWorkspaceWithAnswers, defaultName, jumpToPage, submitting, wizard]);

  const renderProgress = () => {
    return (
      <div className={styles.dots} aria-label="Progress">
        {WIZARD_STEPS.map((step, index) => {
          let className = styles.dot;
          if (index === wizard.currentStepIndex) {
            className = `${styles.dot} ${styles.dotActive}`;
          } else if (index < wizard.currentStepIndex) {
            className = `${styles.dot} ${styles.dotCompleted}`;
          }
          return (
            <span
              key={step}
              className={className}
              aria-current={
                index === wizard.currentStepIndex ? 'step' : undefined
              }
            />
          );
        })}
      </div>
    );
  };

  const renderStep = () => {
    switch (wizard.currentStep) {
      case 'workspace':
        return (
          <WorkspaceNameStep
            value={wizard.workspaceName}
            onChange={value => {
              wizard.setWorkspaceName(value);
              if (errorMessage) setErrorMessage(null);
            }}
            onNext={() => {
              if (wizard.workspaceName.trim().length === 0) {
                setErrorMessage('Please give your workspace a name.');
                return;
              }
              setErrorMessage(null);
              wizard.next();
            }}
            errorMessage={errorMessage}
            account={account?.info ?? null}
            disabled={submitting}
          />
        );
      case 'context':
        return (
          <StepContext
            value={wizard.answers.context}
            onChange={wizard.setContext}
            onNext={wizard.next}
            onBack={wizard.prev}
            disabled={submitting}
          />
        );
      case 'team':
        return (
          <StepTeam
            value={wizard.answers.team}
            onChange={wizard.setTeam}
            onNext={wizard.next}
            onBack={wizard.prev}
            disabled={submitting}
          />
        );
      case 'apps':
        return (
          <StepApps
            selectedApps={wizard.answers.apps ?? []}
            onToggle={wizard.toggleApp}
            onNext={wizard.next}
            onBack={wizard.prev}
            disabled={submitting}
          />
        );
      case 'project':
        return (
          <StepProject
            value={wizard.answers.project ?? ''}
            onChange={wizard.setProject}
            onSubmit={handleSubmit}
            onBack={wizard.prev}
            submitting={submitting}
            errorMessage={errorMessage}
            disabled={submitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.topBar}>
          {renderProgress()}
          <button
            type="button"
            className={styles.skipButton}
            onClick={handleSkip}
            disabled={submitting}
          >
            Skip
          </button>
        </div>
        {renderStep()}
      </div>
    </div>
  );
};

interface WorkspaceNameStepProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  errorMessage: string | null;
  account: { name?: string | null } | null;
  disabled?: boolean;
}

/**
 * First step in the wizard — pick a workspace name. Kept inline (not
 * extracted to `steps/`) because it owns its own form submit + error
 * surface that doesn't quite match the categorical/free-text shape
 * of the other steps.
 */
const WorkspaceNameStep = ({
  value,
  onChange,
  onNext,
  errorMessage,
  account,
  disabled,
}: WorkspaceNameStepProps) => {
  const greetName =
    account?.name && typeof account.name === 'string'
      ? account.name.split(' ')[0]
      : null;
  const handleFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onNext();
    },
    [onNext]
  );
  return (
    <>
      <header className={styles.greeting}>
        <h1 className={styles.headline}>
          {greetName ? `Welcome, ${greetName}.` : 'Welcome.'}
        </h1>
        <p className={styles.subCopy}>
          Let&rsquo;s set up your workspace. We&rsquo;ll ask four quick
          questions to personalise the start.
        </p>
      </header>
      <form className={styles.form} onSubmit={handleFormSubmit}>
        <label className={styles.label} htmlFor="welcome-workspace-name">
          Workspace name
          <Input
            id="welcome-workspace-name"
            autoFocus
            autoSelect
            size="large"
            value={value}
            placeholder="My workspace"
            disabled={disabled}
            onChange={onChange}
            onEnter={onNext}
          />
        </label>
        {errorMessage ? (
          <p className={styles.errorText}>{errorMessage}</p>
        ) : null}
        <Button
          variant="primary"
          size="large"
          className={styles.submitButton}
          disabled={disabled || value.trim().length === 0}
          onClick={onNext}
        >
          Continue
        </Button>
      </form>
    </>
  );
};

export const Component = () => {
  return (
    <AffineOtherPageLayout>
      <WelcomePage />
    </AffineOtherPageLayout>
  );
};
