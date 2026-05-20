/**
 * GraphQL operations for the Wave 2 B6 onboarding wizard at `/welcome`.
 *
 * Inlined here rather than added to the codegen pipeline because the
 * backend resolvers (`updateOnboarding`, `seedWorkspaceFromWizard`) ship
 * as part of the same release and the codegen hasn't re-run yet. We
 * mirror the codegen output shape (`{ id, op, query }`) so they can be
 * passed to `useMutation` from `@affine/core/components/hooks` with a
 * single `as unknown as` cast at the call site.
 *
 * This pattern matches the Google integration scaffold (see
 * `packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/integration/google/graphql.ts`)
 * which uses the same approach for the same reason.
 *
 * Replace these with imports from `@affine/graphql` after the next
 * codegen run.
 */

/**
 * Categorical answer for "What are you building?". Matches the
 * `WizardContext` string union on the server side. Free-form values
 * are silently dropped server-side, so this list is the contract.
 */
export type WizardContext =
  | 'saas'
  | 'agency'
  | 'personal'
  | 'research'
  | 'other';

/** Team-size bucket. Matches the server-side `WizardTeam` union. */
export type WizardTeam = 'solo' | '2-5' | '6-20' | '20+';

/** Connectable app. Matches the server-side `WizardApp` union. */
export type WizardApp = 'gmail' | 'calendar' | 'github';

/**
 * Wizard answers persisted by `useOnboardingWizard`. Mirrors the
 * `WizardAnswersInput` GraphQL InputType. All fields are optional so
 * the skip path can submit an empty object cleanly.
 */
export interface WizardAnswers {
  context?: WizardContext;
  team?: WizardTeam;
  apps?: WizardApp[];
  project?: string;
}

export const updateOnboardingMutation = {
  id: 'updateOnboardingMutation' as const,
  op: 'updateOnboarding',
  query: `mutation updateOnboarding($input: UpdateOnboardingInput!) {
  updateOnboarding(input: $input) {
    id
    completedOnboarding
  }
}`,
};

export const seedWorkspaceFromWizardMutation = {
  id: 'seedWorkspaceFromWizardMutation' as const,
  op: 'seedWorkspaceFromWizard',
  query: `mutation seedWorkspaceFromWizard($workspaceId: String!, $answers: WizardAnswersInput!) {
  seedWorkspaceFromWizard(workspaceId: $workspaceId, answers: $answers)
}`,
};
