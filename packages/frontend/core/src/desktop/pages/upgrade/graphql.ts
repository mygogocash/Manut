/**
 * GraphQL operation for the Manut Pro upgrade page (E3.3 / M3).
 *
 * Inlined here rather than threaded through the codegen pipeline
 * because the backend resolver (`createManutProCheckoutSession`) ships
 * as part of the same release and the codegen hasn't re-run yet. We
 * mirror the codegen output shape (`{ id, op, query }`) so this can be
 * passed to `useMutation` from `@affine/core/components/hooks` with a
 * single `as unknown as` cast at the call site.
 *
 * Same pattern the `/welcome` wizard uses for its
 * `updateOnboarding` / `seedWorkspaceFromWizard` mutations
 * (`desktop/pages/welcome/graphql.ts` header for the original
 * rationale). Replace with imports from `@affine/graphql` after the
 * next codegen run.
 */

export const createManutProCheckoutSessionMutation = {
  id: 'createManutProCheckoutSessionMutation' as const,
  op: 'createManutProCheckoutSession',
  query: `mutation createManutProCheckoutSession($workspaceId: ID!) {
  createManutProCheckoutSession(workspaceId: $workspaceId)
}`,
};
