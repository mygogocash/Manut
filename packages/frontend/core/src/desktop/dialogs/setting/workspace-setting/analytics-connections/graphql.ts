/**
 * GraphQL operations for the 8 Manut Analytics connectors (Wave 7+).
 *
 * Co-located with the panel UI for the same reason
 * `integration/github/graphql.ts` is: the backend resolvers shipped
 * in the same release, codegen hasn't re-run yet. Replace these with
 * imports from `@affine/graphql` after the next codegen pass.
 *
 * Operation shape mirrors the codegen output (`{ id, op, query }`)
 * so each can be passed to `useQuery` / `useMutation` from
 * `@affine/core/components/hooks` with a single `as unknown as` cast
 * at the call site.
 */

// ============================================================================
// OAuth connectors — Facebook / Instagram / Threads / TikTok / LINE VOOM
// All five expose the same shape: a connection query returning
// `{ connected, <displayLabel> }` + a `connect*` mutation returning
// `{ url }` + a `disconnect*` mutation returning Boolean.
// ============================================================================

export type OAuthConnectionHealthStatus =
  | 'saved'
  | 'verified'
  | 'expired'
  | 'error';

export interface FacebookConnectionDto {
  connected: boolean;
  verified?: boolean | null;
  healthStatus?: OAuthConnectionHealthStatus | null;
  displayName?: string | null;
}

export const facebookConnectionQuery = {
  id: 'facebookConnectionQuery' as const,
  op: 'facebookConnection',
  query: `query facebookConnection($workspaceId: String!) {
  facebookConnection(workspaceId: $workspaceId) {
    connected
    verified
    healthStatus
    displayName
  }
}`,
};

export const connectFacebookMutation = {
  id: 'connectFacebookMutation' as const,
  op: 'connectFacebook',
  query: `mutation connectFacebook($workspaceId: String!) {
  connectFacebook(workspaceId: $workspaceId) {
    url
  }
}`,
};

export const disconnectFacebookMutation = {
  id: 'disconnectFacebookMutation' as const,
  op: 'disconnectFacebook',
  query: `mutation disconnectFacebook($workspaceId: String!) {
  disconnectFacebook(workspaceId: $workspaceId)
}`,
};

export interface InstagramConnectionDto {
  connected: boolean;
  verified?: boolean | null;
  healthStatus?: OAuthConnectionHealthStatus | null;
  username?: string | null;
}

export const instagramConnectionQuery = {
  id: 'instagramConnectionQuery' as const,
  op: 'instagramConnection',
  query: `query instagramConnection($workspaceId: String!) {
  instagramConnection(workspaceId: $workspaceId) {
    connected
    verified
    healthStatus
    username
  }
}`,
};

export const connectInstagramMutation = {
  id: 'connectInstagramMutation' as const,
  op: 'connectInstagram',
  query: `mutation connectInstagram($workspaceId: String!) {
  connectInstagram(workspaceId: $workspaceId) {
    url
  }
}`,
};

export const disconnectInstagramMutation = {
  id: 'disconnectInstagramMutation' as const,
  op: 'disconnectInstagram',
  query: `mutation disconnectInstagram($workspaceId: String!) {
  disconnectInstagram(workspaceId: $workspaceId)
}`,
};

export interface ThreadsConnectionDto {
  connected: boolean;
  verified?: boolean | null;
  healthStatus?: OAuthConnectionHealthStatus | null;
  username?: string | null;
}

export const threadsConnectionQuery = {
  id: 'threadsConnectionQuery' as const,
  op: 'threadsConnection',
  query: `query threadsConnection($workspaceId: String!) {
  threadsConnection(workspaceId: $workspaceId) {
    connected
    verified
    healthStatus
    username
  }
}`,
};

export const connectThreadsMutation = {
  id: 'connectThreadsMutation' as const,
  op: 'connectThreads',
  query: `mutation connectThreads($workspaceId: String!) {
  connectThreads(workspaceId: $workspaceId) {
    url
  }
}`,
};

export const disconnectThreadsMutation = {
  id: 'disconnectThreadsMutation' as const,
  op: 'disconnectThreads',
  query: `mutation disconnectThreads($workspaceId: String!) {
  disconnectThreads(workspaceId: $workspaceId)
}`,
};

export interface TiktokConnectionDto {
  connected: boolean;
  verified?: boolean | null;
  healthStatus?: OAuthConnectionHealthStatus | null;
  displayName?: string | null;
}

export const tiktokConnectionQuery = {
  id: 'tiktokConnectionQuery' as const,
  op: 'tiktokConnection',
  query: `query tiktokConnection($workspaceId: String!) {
  tiktokConnection(workspaceId: $workspaceId) {
    connected
    verified
    healthStatus
    displayName
  }
}`,
};

export const connectTiktokMutation = {
  id: 'connectTiktokMutation' as const,
  op: 'connectTiktok',
  query: `mutation connectTiktok($workspaceId: String!) {
  connectTiktok(workspaceId: $workspaceId) {
    url
  }
}`,
};

export const disconnectTiktokMutation = {
  id: 'disconnectTiktokMutation' as const,
  op: 'disconnectTiktok',
  query: `mutation disconnectTiktok($workspaceId: String!) {
  disconnectTiktok(workspaceId: $workspaceId)
}`,
};

export interface LineVoomConnectionDto {
  connected: boolean;
  verified?: boolean | null;
  healthStatus?: OAuthConnectionHealthStatus | null;
  displayName?: string | null;
}

export const lineVoomConnectionQuery = {
  id: 'lineVoomConnectionQuery' as const,
  op: 'lineVoomConnection',
  query: `query lineVoomConnection($workspaceId: String!) {
  lineVoomConnection(workspaceId: $workspaceId) {
    connected
    verified
    healthStatus
    displayName
  }
}`,
};

export const connectLineVoomMutation = {
  id: 'connectLineVoomMutation' as const,
  op: 'connectLineVoom',
  query: `mutation connectLineVoom($workspaceId: String!) {
  connectLineVoom(workspaceId: $workspaceId) {
    url
  }
}`,
};

export const disconnectLineVoomMutation = {
  id: 'disconnectLineVoomMutation' as const,
  op: 'disconnectLineVoom',
  query: `mutation disconnectLineVoom($workspaceId: String!) {
  disconnectLineVoom(workspaceId: $workspaceId)
}`,
};

// ============================================================================
// Direct-credential connectors — GoGoCash (api-key), MongoDB (uri),
// PostHog (api-key + host)
// ============================================================================

export interface GoGoCashConnectionDto {
  connected: boolean;
  label?: string | null;
}

export const goGoCashConnectionQuery = {
  id: 'goGoCashConnectionQuery' as const,
  op: 'goGoCashConnection',
  query: `query goGoCashConnection($workspaceId: String!) {
  goGoCashConnection(workspaceId: $workspaceId) {
    connected
    label
  }
}`,
};

export const setGoGoCashConnectionMutation = {
  id: 'setGoGoCashConnectionMutation' as const,
  op: 'setGoGoCashConnection',
  query: `mutation setGoGoCashConnection($workspaceId: String!, $input: GoGoCashConnectionInputType!) {
  setGoGoCashConnection(workspaceId: $workspaceId, input: $input) {
    connected
    label
  }
}`,
};

export const disconnectGoGoCashMutation = {
  id: 'disconnectGoGoCashMutation' as const,
  op: 'disconnectGoGoCash',
  query: `mutation disconnectGoGoCash($workspaceId: String!) {
  disconnectGoGoCash(workspaceId: $workspaceId)
}`,
};

export interface MongoDbConnectionDto {
  connected: boolean;
  host?: string | null;
  database?: string | null;
}

export interface MongoDbConnectionTestResultDto {
  ok: boolean;
  error?: string | null;
  host?: string | null;
  database?: string | null;
  pingMs?: number | null;
}

export const mongoDbConnectionQuery = {
  id: 'mongoDbConnectionQuery' as const,
  op: 'mongoDbConnection',
  query: `query mongoDbConnection($workspaceId: String!) {
  mongoDbConnection(workspaceId: $workspaceId) {
    connected
    host
    database
  }
}`,
};

export const setMongoDbConnectionMutation = {
  id: 'setMongoDbConnectionMutation' as const,
  op: 'setMongoDbConnection',
  query: `mutation setMongoDbConnection($workspaceId: String!, $input: MongoDbConnectionInputType!) {
  setMongoDbConnection(workspaceId: $workspaceId, input: $input) {
    connected
    host
    database
  }
}`,
};

export const testMongoDbConnectionMutation = {
  id: 'testMongoDbConnectionMutation' as const,
  op: 'testMongoDbConnection',
  query: `mutation testMongoDbConnection($workspaceId: String!, $input: MongoDbConnectionInputType!) {
  testMongoDbConnection(workspaceId: $workspaceId, input: $input) {
    ok
    error
    host
    database
    pingMs
  }
}`,
};

export const disconnectMongoDbMutation = {
  id: 'disconnectMongoDbMutation' as const,
  op: 'disconnectMongoDb',
  query: `mutation disconnectMongoDb($workspaceId: String!) {
  disconnectMongoDb(workspaceId: $workspaceId)
}`,
};

export interface PostHogConnectionDto {
  connected: boolean;
  host?: string | null;
  projectCount?: number | null;
}

export interface PostHogConnectionTestResultDto {
  ok: boolean;
  error?: string | null;
  host?: string | null;
  projectCount?: number | null;
}

export const postHogConnectionQuery = {
  id: 'postHogConnectionQuery' as const,
  op: 'postHogConnection',
  query: `query postHogConnection($workspaceId: String!) {
  postHogConnection(workspaceId: $workspaceId) {
    connected
    host
    projectCount
  }
}`,
};

export const setPostHogConnectionMutation = {
  id: 'setPostHogConnectionMutation' as const,
  op: 'setPostHogConnection',
  query: `mutation setPostHogConnection($workspaceId: String!, $input: PostHogConnectionInputType!) {
  setPostHogConnection(workspaceId: $workspaceId, input: $input) {
    connected
    host
    projectCount
  }
}`,
};

export const testPostHogConnectionMutation = {
  id: 'testPostHogConnectionMutation' as const,
  op: 'testPostHogConnection',
  query: `mutation testPostHogConnection($workspaceId: String!, $input: PostHogConnectionInputType!) {
  testPostHogConnection(workspaceId: $workspaceId, input: $input) {
    ok
    error
    host
    projectCount
  }
}`,
};

export const disconnectPostHogMutation = {
  id: 'disconnectPostHogMutation' as const,
  op: 'disconnectPostHog',
  query: `mutation disconnectPostHog($workspaceId: String!) {
  disconnectPostHog(workspaceId: $workspaceId)
}`,
};

// ============================================================================
// MongoDB ingestion-config — schema discovery + per-collection toggle.
//
// Paired with packages/backend/server/src/plugins/mongodb-connection/
// ingestion-config.resolver.ts. Reusing the analytics-connections
// graphql.ts file follows the same pattern as the connector ops above —
// codegen hasn't re-run; the strings below are the canonical source.
// ============================================================================

export interface MongoCollectionInfoDto {
  name: string;
  estimatedCount?: number | null;
  enabled: boolean;
  cursorField?: string | null;
  lastSyncedAt?: string | null;
  consecutiveFailures?: number | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
}

export interface MongoSampleDocsDto {
  collectionName: string;
  documents: string[];
}

export interface MongoIngestionConfigDto {
  id: string;
  workspaceId: string;
  collectionName: string;
  enabled: boolean;
  cursorField: string;
  lastSyncedAt?: string | null;
  lastCursorValue?: string | null;
  consecutiveFailures: number;
  lastError?: string | null;
  lastErrorAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const listMongoCollectionsQuery = {
  id: 'listMongoCollectionsQuery' as const,
  op: 'listMongoCollections',
  query: `query listMongoCollections($workspaceId: String!) {
  listMongoCollections(workspaceId: $workspaceId) {
    name
    estimatedCount
    enabled
    cursorField
    lastSyncedAt
    consecutiveFailures
    lastError
    lastErrorAt
  }
}`,
};

export const sampleMongoCollectionQuery = {
  id: 'sampleMongoCollectionQuery' as const,
  op: 'sampleMongoCollection',
  query: `query sampleMongoCollection($workspaceId: String!, $collectionName: String!, $limit: Int) {
  sampleMongoCollection(workspaceId: $workspaceId, collectionName: $collectionName, limit: $limit) {
    collectionName
    documents
  }
}`,
};

export const getMongoIngestionConfigsQuery = {
  id: 'getMongoIngestionConfigsQuery' as const,
  op: 'getMongoIngestionConfigs',
  query: `query getMongoIngestionConfigs($workspaceId: String!) {
  getMongoIngestionConfigs(workspaceId: $workspaceId) {
    id
    workspaceId
    collectionName
    enabled
    cursorField
    lastSyncedAt
    lastCursorValue
    consecutiveFailures
    lastError
    lastErrorAt
    createdAt
    updatedAt
  }
}`,
};

export const setMongoIngestionConfigMutation = {
  id: 'setMongoIngestionConfigMutation' as const,
  op: 'setMongoIngestionConfig',
  query: `mutation setMongoIngestionConfig($workspaceId: String!, $input: SetMongoIngestionConfigInput!) {
  setMongoIngestionConfig(workspaceId: $workspaceId, input: $input) {
    id
    workspaceId
    collectionName
    enabled
    cursorField
    lastSyncedAt
    lastCursorValue
    consecutiveFailures
    lastError
    lastErrorAt
    createdAt
    updatedAt
  }
}`,
};

export const deleteMongoIngestionConfigMutation = {
  id: 'deleteMongoIngestionConfigMutation' as const,
  op: 'deleteMongoIngestionConfig',
  query: `mutation deleteMongoIngestionConfig($workspaceId: String!, $collectionName: String!) {
  deleteMongoIngestionConfig(workspaceId: $workspaceId, collectionName: $collectionName)
}`,
};
export interface DailyStatDto {
  day: string;
  metric: string;
  value: number;
}

export const dailyStatsQuery = {
  id: 'dailyStatsQuery' as const,
  op: 'dailyStats',
  query: `query dailyStats($input: DailyStatsInput!) {
  dailyStats(input: $input) {
    day
    metric
    value
  }
}`,
};

export const backfillAnalyticsMutation = {
  id: 'backfillAnalyticsMutation' as const,
  op: 'backfillAnalytics',
  query: `mutation backfillAnalytics($workspaceId: String!, $daysBack: Int!) {
  backfillAnalytics(workspaceId: $workspaceId, daysBack: $daysBack)
}`,
};
