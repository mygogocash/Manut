/**
 * GraphQL operations for the Linear OAuth scaffold.
 *
 * Co-located with the integration UI. Replace with imports from
 * `@affine/graphql` after the next codegen run.
 */

export interface LinearConnectionDto {
  connected: boolean;
  displayName?: string | null;
  organizationName?: string | null;
}

export const linearConnectionQuery = {
  id: 'linearConnectionQuery' as const,
  op: 'linearConnection',
  query: `query linearConnection($workspaceId: String!) {
  linearConnection(workspaceId: $workspaceId) {
    connected
    displayName
    organizationName
  }
}`,
};

export const connectLinearMutation = {
  id: 'connectLinearMutation' as const,
  op: 'connectLinear',
  query: `mutation connectLinear($workspaceId: String!) {
  connectLinear(workspaceId: $workspaceId) {
    url
  }
}`,
};

export const disconnectLinearMutation = {
  id: 'disconnectLinearMutation' as const,
  op: 'disconnectLinear',
  query: `mutation disconnectLinear($workspaceId: String!) {
  disconnectLinear(workspaceId: $workspaceId)
}`,
};
