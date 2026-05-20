/**
 * GraphQL operations for the Slack OAuth scaffold.
 *
 * Co-located with the integration UI for the same reason
 * `github/graphql.ts` is: the backend resolvers are part of the same
 * release and the codegen pipeline hasn't re-run yet. Replace with
 * imports from `@affine/graphql` after the next codegen run.
 *
 * Operation shape mirrors the codegen output (`{ id, op, query }`)
 * so they can be passed to `useQuery` / `useMutation` from
 * `@affine/core/components/hooks` with a single `as unknown as` cast
 * at the call site.
 */

export interface SlackConnectionDto {
  connected: boolean;
  teamName?: string | null;
}

export const slackConnectionQuery = {
  id: 'slackConnectionQuery' as const,
  op: 'slackConnection',
  query: `query slackConnection($workspaceId: String!) {
  slackConnection(workspaceId: $workspaceId) {
    connected
    teamName
  }
}`,
};

export const connectSlackMutation = {
  id: 'connectSlackMutation' as const,
  op: 'connectSlack',
  query: `mutation connectSlack($workspaceId: String!) {
  connectSlack(workspaceId: $workspaceId) {
    url
  }
}`,
};

export const disconnectSlackMutation = {
  id: 'disconnectSlackMutation' as const,
  op: 'disconnectSlack',
  query: `mutation disconnectSlack($workspaceId: String!) {
  disconnectSlack(workspaceId: $workspaceId)
}`,
};
