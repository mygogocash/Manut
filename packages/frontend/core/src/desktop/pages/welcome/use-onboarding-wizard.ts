import { GlobalStateService } from '@affine/core/modules/storage';
import { LiveData, useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  WizardAnswers,
  WizardApp,
  WizardContext,
  WizardTeam,
} from './graphql';

/**
 * Ordered list of wizard step ids. Index 0 is the workspace-name step
 * (always shown first); the remaining four are the categorical /
 * free-text onboarding questions. The progress dots in the header
 * render one dot per step in this list.
 */
export const WIZARD_STEPS = [
  'workspace',
  'context',
  'team',
  'apps',
  'project',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

/**
 * Key under which the wizard persists its in-flight answers via
 * `GlobalState`. We persist so the user can refresh the page mid-flow
 * without losing what they typed; the welcome route clears the value
 * on successful submit or skip.
 */
const WIZARD_STATE_KEY = 'manut.onboarding.wizardAnswers.v1';

/**
 * Shape persisted to GlobalState. Same fields as `WizardAnswers`
 * plus the workspace name (the first step), kept here so going
 * back from step 2 to step 1 doesn't lose the name.
 */
interface PersistedWizardState {
  workspaceName?: string;
  context?: WizardContext;
  team?: WizardTeam;
  apps?: WizardApp[];
  project?: string;
}

export interface UseOnboardingWizardResult {
  /** Index into `WIZARD_STEPS`. */
  currentStepIndex: number;
  /** The current step id (`'workspace' | 'context' | ...`). */
  currentStep: WizardStep;
  /** True when on the very first step. */
  isFirstStep: boolean;
  /** True when on the final step. */
  isLastStep: boolean;

  workspaceName: string;
  setWorkspaceName: (value: string) => void;

  /** Categorical / free-text answers gathered through steps 2–5. */
  answers: WizardAnswers;

  setContext: (value: WizardContext | undefined) => void;
  setTeam: (value: WizardTeam | undefined) => void;
  toggleApp: (app: WizardApp) => void;
  setProject: (value: string) => void;

  /** Advance to the next step (no-op on the last step). */
  next: () => void;
  /** Go back to the previous step (no-op on the first step). */
  prev: () => void;
  /**
   * Clear persisted state. Call after successful submit or skip so a
   * later sign-in starts the wizard from scratch.
   */
  clear: () => void;
}

/**
 * State-machine hook for the /welcome onboarding wizard.
 *
 * Persists in-flight answers to GlobalState so a page refresh or a
 * step-back doesn't lose user input. Returns a stable API surface that
 * the welcome page and each step component consume.
 */
export function useOnboardingWizard(
  defaultWorkspaceName: string
): UseOnboardingWizardResult {
  const globalStateService = useService(GlobalStateService);
  const globalState = globalStateService.globalState;

  // Re-read on remount so cross-tab persists work in the rare case
  // we open /welcome on another tab. `useLiveData` keeps this reactive
  // to external writes; we still hold the active step in local state
  // because step navigation is per-session and shouldn't flicker.
  //
  // `globalState.watch<T>()` emits an Observable<T | undefined> —
  // `useLiveData` requires a LiveData, so we wrap with `LiveData.from`
  // and seed an explicit `undefined` initial value. Mirrors the
  // pattern from `useActiveTab` in `components/root-app-sidebar/`.
  const persisted$ = useMemo(
    () =>
      LiveData.from<PersistedWizardState | undefined>(
        globalState.watch<PersistedWizardState>(WIZARD_STATE_KEY),
        undefined
      ),
    [globalState]
  );
  const persisted = useLiveData(persisted$);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Seed local form state from persisted + default. We deliberately
  // do NOT mirror persisted into local state on every change — the
  // persistence layer is the source of truth, but local state owns
  // the input controls so typing stays snappy.
  const [workspaceName, setWorkspaceNameLocal] = useState<string>(
    persisted?.workspaceName ?? defaultWorkspaceName
  );
  const [context, setContextLocal] = useState<WizardContext | undefined>(
    persisted?.context
  );
  const [team, setTeamLocal] = useState<WizardTeam | undefined>(
    persisted?.team
  );
  const [apps, setAppsLocal] = useState<WizardApp[]>(persisted?.apps ?? []);
  const [project, setProjectLocal] = useState<string>(persisted?.project ?? '');

  // When the default workspace name resolves AFTER mount (the auth
  // session can be slightly delayed), backfill the input if the user
  // hasn't typed anything yet.
  useEffect(() => {
    setWorkspaceNameLocal(previous =>
      previous.length > 0 ? previous : defaultWorkspaceName
    );
  }, [defaultWorkspaceName]);

  // Helper that writes the current snapshot back to GlobalState. We
  // call this from every setter so persisted is always in lockstep
  // with the local form state.
  const persist = useCallback(
    (next: PersistedWizardState) => {
      globalState.set<PersistedWizardState>(WIZARD_STATE_KEY, next);
    },
    [globalState]
  );

  const snapshot = useCallback(
    (overrides: PersistedWizardState = {}): PersistedWizardState => ({
      workspaceName,
      context,
      team,
      apps,
      project,
      ...overrides,
    }),
    [apps, context, project, team, workspaceName]
  );

  const setWorkspaceName = useCallback(
    (value: string) => {
      setWorkspaceNameLocal(value);
      persist(snapshot({ workspaceName: value }));
    },
    [persist, snapshot]
  );

  const setContext = useCallback(
    (value: WizardContext | undefined) => {
      setContextLocal(value);
      persist(snapshot({ context: value }));
    },
    [persist, snapshot]
  );

  const setTeam = useCallback(
    (value: WizardTeam | undefined) => {
      setTeamLocal(value);
      persist(snapshot({ team: value }));
    },
    [persist, snapshot]
  );

  const toggleApp = useCallback(
    (app: WizardApp) => {
      setAppsLocal(previous => {
        const next = previous.includes(app)
          ? previous.filter(a => a !== app)
          : [...previous, app];
        persist(snapshot({ apps: next }));
        return next;
      });
    },
    [persist, snapshot]
  );

  const setProject = useCallback(
    (value: string) => {
      setProjectLocal(value);
      persist(snapshot({ project: value }));
    },
    [persist, snapshot]
  );

  const next = useCallback(() => {
    setCurrentStepIndex(previous =>
      Math.min(previous + 1, WIZARD_STEPS.length - 1)
    );
  }, []);

  const prev = useCallback(() => {
    setCurrentStepIndex(previous => Math.max(previous - 1, 0));
  }, []);

  const clear = useCallback(() => {
    globalState.del(WIZARD_STATE_KEY);
  }, [globalState]);

  const answers = useMemo<WizardAnswers>(() => {
    const out: WizardAnswers = {};
    if (context) out.context = context;
    if (team) out.team = team;
    if (apps.length > 0) out.apps = apps;
    const trimmedProject = project.trim();
    if (trimmedProject.length > 0) out.project = trimmedProject;
    return out;
  }, [apps, context, project, team]);

  return {
    currentStepIndex,
    currentStep: WIZARD_STEPS[currentStepIndex] ?? WIZARD_STEPS[0],
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === WIZARD_STEPS.length - 1,
    workspaceName,
    setWorkspaceName,
    answers,
    setContext,
    setTeam,
    toggleApp,
    setProject,
    next,
    prev,
    clear,
  };
}
