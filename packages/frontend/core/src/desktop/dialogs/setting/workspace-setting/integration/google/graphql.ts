/**
 * GraphQL operations for the Google OAuth scaffold (v1.10.1) + Gmail/Drive
 * importers (v1.10.2).
 *
 * Co-located with the integration UI for the same reason the connections
 * module does it: the backend resolvers are part of the same release and
 * the codegen pipeline hasn't re-run yet. Replace these with imports from
 * `@affine/graphql` after the next codegen run.
 *
 * Operation shape mirrors the codegen output (`{ id, op, query }`) so they
 * can be passed to `useQuery` / `useMutation` from `@affine/core/components/hooks`
 * with a single `as unknown as` cast at the call site.
 */

export type GoogleScope = 'gmail' | 'drive';

export interface GoogleConnectionDto {
  scope: GoogleScope;
  connected: boolean;
  email?: string;
}

export interface GmailMessageSummaryDto {
  messageId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

export interface DriveFileDto {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string | null;
  webViewLink?: string | null;
  modifiedTime?: string | null;
  size?: string | null;
}

export const googleConnectionQuery = {
  id: 'googleConnectionQuery' as const,
  op: 'googleConnection',
  query: `query googleConnection($workspaceId: String!, $scope: GoogleScope!) {
  googleConnection(workspaceId: $workspaceId, scope: $scope) {
    scope
    connected
    email
  }
}`,
};

export const connectGoogleMutation = {
  id: 'connectGoogleMutation' as const,
  op: 'connectGoogle',
  query: `mutation connectGoogle($workspaceId: String!, $scope: GoogleScope!) {
  connectGoogle(workspaceId: $workspaceId, scope: $scope) {
    url
  }
}`,
};

export const disconnectGoogleMutation = {
  id: 'disconnectGoogleMutation' as const,
  op: 'disconnectGoogle',
  query: `mutation disconnectGoogle($workspaceId: String!, $scope: GoogleScope!) {
  disconnectGoogle(workspaceId: $workspaceId, scope: $scope)
}`,
};

export const gmailMessagesQuery = {
  id: 'gmailMessagesQuery' as const,
  op: 'gmailMessages',
  query: `query gmailMessages($workspaceId: String!, $query: String, $maxResults: Int) {
  gmailMessages(workspaceId: $workspaceId, query: $query, maxResults: $maxResults) {
    messageId
    from
    subject
    date
    snippet
  }
}`,
};

export const importGmailMessageMutation = {
  id: 'importGmailMessageMutation' as const,
  op: 'importGmailMessage',
  query: `mutation importGmailMessage($workspaceId: String!, $messageId: String!) {
  importGmailMessage(workspaceId: $workspaceId, messageId: $messageId)
}`,
};

export const driveFilesQuery = {
  id: 'driveFilesQuery' as const,
  op: 'driveFiles',
  query: `query driveFiles($workspaceId: String!, $query: String, $pageSize: Int) {
  driveFiles(workspaceId: $workspaceId, query: $query, pageSize: $pageSize) {
    id
    name
    mimeType
    iconLink
    webViewLink
    modifiedTime
    size
  }
}`,
};
