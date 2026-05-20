/**
 * Manut M2 E2.4 — Self-evolution loop.
 *
 * Hand-rolled GraphQL client for the `rateMessage` mutation. Lives
 * here (rather than being purely codegen-driven) so the Lit assistant
 * message component can import it the moment this PR lands, even
 * before `yarn workspace @affine/graphql build` regenerates
 * `graphql/index.ts`.
 *
 * Mirrors the runtime shape produced by `@graphql-codegen/typescript-operations`
 * for the other `copilot-*` mutations in `graphql/index.ts`:
 *   { id, op, query }
 * with the `id` suffixed `Mutation` to match codegen conventions.
 *
 * Companion `.gql` file lives at `copilot-rate-message.gql` so when
 * codegen does run, it will produce an identical export under the same
 * symbol — TypeScript's module resolution will dedupe on the runtime
 * object's `id` so SWR / Apollo cache keys stay stable across the swap.
 *
 * Why not modify `index.ts` directly?
 *   - It carries a `do not manipulate this file manually` pragma.
 *   - Codegen overwrites it on every `yarn workspace @affine/graphql
 *     build`, so a manual edit would vanish.
 *
 * Consumers import from this file via the standard package barrel
 * (`@affine/graphql`) once the package `index.ts` re-exports it; until
 * then, they can import the relative path inside the package.
 */
export const rateMessageMutation = {
  id: 'rateMessageMutation' as const,
  op: 'rateMessage',
  query: `mutation rateMessage($messageId: String!, $rating: String!) {
  rateMessage(messageId: $messageId, rating: $rating)
}`,
};

export interface RateMessageMutationVariables {
  messageId: string;
  rating: 'positive' | 'negative';
}

export interface RateMessageMutation {
  rateMessage: boolean;
}
