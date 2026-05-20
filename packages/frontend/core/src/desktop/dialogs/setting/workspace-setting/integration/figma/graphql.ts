/**
 * GraphQL operations for the Figma OAuth scaffold.
 *
 * Co-located with the integration UI. Replace with imports from
 * `@affine/graphql` after the next codegen run.
 */

export interface FigmaConnectionDto {
  connected: boolean;
  handle?: string | null;
  email?: string | null;
}

export const figmaConnectionQuery = {
  id: 'figmaConnectionQuery' as const,
  op: 'figmaConnection',
  query: `query figmaConnection($workspaceId: String!) {
  figmaConnection(workspaceId: $workspaceId) {
    connected
    handle
    email
  }
}`,
};

export const connectFigmaMutation = {
  id: 'connectFigmaMutation' as const,
  op: 'connectFigma',
  query: `mutation connectFigma($workspaceId: String!) {
  connectFigma(workspaceId: $workspaceId) {
    url
  }
}`,
};

export const disconnectFigmaMutation = {
  id: 'disconnectFigmaMutation' as const,
  op: 'disconnectFigma',
  query: `mutation disconnectFigma($workspaceId: String!) {
  disconnectFigma(workspaceId: $workspaceId)
}`,
};
