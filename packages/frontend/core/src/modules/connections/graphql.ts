/**
 * GraphQL operations for the connections module.
 *
 * These are co-located with the module rather than codegen'd into
 * `@affine/graphql` because the backend resolvers were added in the same
 * release and the codegen pipeline hasn't been re-run yet. They follow the
 * same shape as the codegen output (`{ id, op, query }`) so they can be
 * passed to `useQuery` / `useMutation` from `@affine/core/components/hooks`.
 *
 * When the next codegen run lands, replace these with imports from
 * `@affine/graphql`.
 */

export interface ConnectedAccountDto {
  id: string;
  provider: string;
  displayName: string;
  scopes: string[];
  createdAt: string;
}

export const listConnectionsQuery = {
  id: 'listConnectionsQuery' as const,
  op: 'listConnections',
  query: `query listConnections($workspaceId: String!) {
  listConnections(workspaceId: $workspaceId) {
    id
    provider
    displayName
    scopes
    createdAt
  }
}`,
};

export const disconnectProviderMutation = {
  id: 'disconnectProviderMutation' as const,
  op: 'disconnectProvider',
  query: `mutation disconnectProvider($workspaceId: String!, $provider: String!) {
  disconnectProvider(workspaceId: $workspaceId, provider: $provider)
}`,
};
