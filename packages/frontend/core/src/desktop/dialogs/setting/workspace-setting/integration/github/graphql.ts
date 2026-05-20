/**
 * GraphQL operations for the GitHub OAuth scaffold (M2 E2.1).
 *
 * Co-located with the integration UI for the same reason
 * `google/graphql.ts` is: the backend resolvers are part of the same
 * release and the codegen pipeline hasn't re-run yet. Replace these
 * with imports from `@affine/graphql` after the next codegen run.
 *
 * Operation shape mirrors the codegen output (`{ id, op, query }`)
 * so they can be passed to `useQuery` / `useMutation` from
 * `@affine/core/components/hooks` with a single `as unknown as` cast
 * at the call site.
 */

export interface GithubConnectionDto {
  connected: boolean;
  login?: string | null;
}

export const githubConnectionQuery = {
  id: 'githubConnectionQuery' as const,
  op: 'githubConnection',
  query: `query githubConnection($workspaceId: String!) {
  githubConnection(workspaceId: $workspaceId) {
    connected
    login
  }
}`,
};

export const connectGithubMutation = {
  id: 'connectGithubMutation' as const,
  op: 'connectGithub',
  query: `mutation connectGithub($workspaceId: String!) {
  connectGithub(workspaceId: $workspaceId) {
    url
  }
}`,
};

export const disconnectGithubMutation = {
  id: 'disconnectGithubMutation' as const,
  op: 'disconnectGithub',
  query: `mutation disconnectGithub($workspaceId: String!) {
  disconnectGithub(workspaceId: $workspaceId)
}`,
};
