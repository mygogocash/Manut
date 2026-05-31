export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: string; output: string };
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: { input: Record<string, string>; output: Record<string, string> };
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSONObject: { input: any; output: any };
  /** The `SafeInt` scalar type represents non-fractional signed whole numeric values that are considered safe as defined by the ECMAScript specification. */
  SafeInt: { input: number; output: number };
  /** The `Upload` scalar type represents a file upload. */
  Upload: { input: File; output: File };
}

export interface AccessToken {
  __typename?: 'AccessToken';
  createdAt: Scalars['DateTime']['output'];
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
}

export interface AcknowledgeInsightInput {
  insightId: Scalars['String']['input'];
}

export interface AddContextBlobInput {
  blobId: Scalars['String']['input'];
  contextId: Scalars['String']['input'];
}

export interface AddContextCategoryInput {
  categoryId: Scalars['String']['input'];
  contextId: Scalars['String']['input'];
  docs?: InputMaybe<Array<Scalars['String']['input']>>;
  type: ContextCategories;
}

export interface AddContextDocInput {
  contextId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
}

export interface AddContextFileInput {
  contextId: Scalars['String']['input'];
}

export interface AddMnCeoTurnInput {
  bodyMd: Scalars['String']['input'];
  conversationId: Scalars['ID']['input'];
  role: MnCeoTurnRole;
}

export interface AddMnTaskBlockerInput {
  blockedByTaskId: Scalars['ID']['input'];
  taskId: Scalars['ID']['input'];
}

export interface AdminAllSharedLink {
  __typename?: 'AdminAllSharedLink';
  docId: Scalars['String']['output'];
  docUpdatedAt: Maybe<Scalars['DateTime']['output']>;
  guestViews: Maybe<Scalars['SafeInt']['output']>;
  lastAccessedAt: Maybe<Scalars['DateTime']['output']>;
  lastUpdaterId: Maybe<Scalars['String']['output']>;
  publishedAt: Maybe<Scalars['DateTime']['output']>;
  shareUrl: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  uniqueViews: Maybe<Scalars['SafeInt']['output']>;
  views: Maybe<Scalars['SafeInt']['output']>;
  workspaceId: Scalars['String']['output'];
  workspaceOwnerId: Maybe<Scalars['String']['output']>;
}

export interface AdminAllSharedLinkEdge {
  __typename?: 'AdminAllSharedLinkEdge';
  cursor: Scalars['String']['output'];
  node: AdminAllSharedLink;
}

export interface AdminAllSharedLinksFilterInput {
  analyticsWindowDays?: InputMaybe<Scalars['Int']['input']>;
  includeTotal?: InputMaybe<Scalars['Boolean']['input']>;
  keyword?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<AdminSharedLinksOrder>;
  updatedAfter?: InputMaybe<Scalars['DateTime']['input']>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface AdminDashboard {
  __typename?: 'AdminDashboard';
  blobStorageBytes: Scalars['SafeInt']['output'];
  blobStorageHistory: Array<AdminDashboardValueDayPoint>;
  copilotConversations: Scalars['SafeInt']['output'];
  generatedAt: Scalars['DateTime']['output'];
  storageWindow: TimeWindow;
  syncActiveUsers: Scalars['Int']['output'];
  syncActiveUsersTimeline: Array<AdminDashboardMinutePoint>;
  syncWindow: TimeWindow;
  topSharedLinks: Array<AdminSharedLinkTopItem>;
  topSharedLinksWindow: TimeWindow;
  workspaceStorageBytes: Scalars['SafeInt']['output'];
  workspaceStorageHistory: Array<AdminDashboardValueDayPoint>;
}

export interface AdminDashboardInput {
  sharedLinkWindowDays?: InputMaybe<Scalars['Int']['input']>;
  storageHistoryDays?: InputMaybe<Scalars['Int']['input']>;
  syncHistoryHours?: InputMaybe<Scalars['Int']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
}

export interface AdminDashboardMinutePoint {
  __typename?: 'AdminDashboardMinutePoint';
  activeUsers: Scalars['Int']['output'];
  minute: Scalars['DateTime']['output'];
}

export interface AdminDashboardValueDayPoint {
  __typename?: 'AdminDashboardValueDayPoint';
  date: Scalars['DateTime']['output'];
  value: Scalars['SafeInt']['output'];
}

export interface AdminSharedLinkTopItem {
  __typename?: 'AdminSharedLinkTopItem';
  docId: Scalars['String']['output'];
  guestViews: Scalars['SafeInt']['output'];
  lastAccessedAt: Maybe<Scalars['DateTime']['output']>;
  publishedAt: Maybe<Scalars['DateTime']['output']>;
  shareUrl: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  uniqueViews: Scalars['SafeInt']['output'];
  views: Scalars['SafeInt']['output'];
  workspaceId: Scalars['String']['output'];
}

export enum AdminSharedLinksOrder {
  PublishedAtDesc = 'PublishedAtDesc',
  UpdatedAtDesc = 'UpdatedAtDesc',
  ViewsDesc = 'ViewsDesc',
}

export interface AdminUpdateWorkspaceInput {
  avatarKey?: InputMaybe<Scalars['String']['input']>;
  enableAi?: InputMaybe<Scalars['Boolean']['input']>;
  enableDocEmbedding?: InputMaybe<Scalars['Boolean']['input']>;
  enableSharing?: InputMaybe<Scalars['Boolean']['input']>;
  enableUrlPreview?: InputMaybe<Scalars['Boolean']['input']>;
  features?: InputMaybe<Array<FeatureType>>;
  id: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  public?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface AdminVerifiedDoc {
  __typename?: 'AdminVerifiedDoc';
  docId: Scalars['String']['output'];
  verificationExpiresAt: Maybe<Scalars['DateTime']['output']>;
  verifiedAt: Scalars['DateTime']['output'];
  verifiedBy: Maybe<Scalars['String']['output']>;
  workspaceId: Scalars['String']['output'];
}

export interface AdminWorkspace {
  __typename?: 'AdminWorkspace';
  avatarKey: Maybe<Scalars['String']['output']>;
  blobCount: Scalars['Int']['output'];
  blobSize: Scalars['SafeInt']['output'];
  createdAt: Scalars['DateTime']['output'];
  enableAi: Scalars['Boolean']['output'];
  enableDocEmbedding: Scalars['Boolean']['output'];
  enableSharing: Scalars['Boolean']['output'];
  enableUrlPreview: Scalars['Boolean']['output'];
  features: Array<FeatureType>;
  id: Scalars['String']['output'];
  memberCount: Scalars['Int']['output'];
  /** Members of workspace */
  members: Array<AdminWorkspaceMember>;
  name: Maybe<Scalars['String']['output']>;
  owner: Maybe<WorkspaceUserType>;
  public: Scalars['Boolean']['output'];
  publicPageCount: Scalars['Int']['output'];
  sharedLinks: Array<AdminWorkspaceSharedLink>;
  snapshotCount: Scalars['Int']['output'];
  snapshotSize: Scalars['SafeInt']['output'];
}

export interface AdminWorkspaceMembersArgs {
  query?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
}

export interface AdminWorkspaceMember {
  __typename?: 'AdminWorkspaceMember';
  avatarUrl: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  role: Permission;
  status: WorkspaceMemberStatus;
}

export interface AdminWorkspaceSharedLink {
  __typename?: 'AdminWorkspaceSharedLink';
  docId: Scalars['String']['output'];
  publishedAt: Maybe<Scalars['DateTime']['output']>;
  title: Maybe<Scalars['String']['output']>;
}

export enum AdminWorkspaceSort {
  BlobCount = 'BlobCount',
  BlobSize = 'BlobSize',
  CreatedAt = 'CreatedAt',
  MemberCount = 'MemberCount',
  PublicPageCount = 'PublicPageCount',
  SnapshotCount = 'SnapshotCount',
  SnapshotSize = 'SnapshotSize',
}

export interface Agent {
  __typename?: 'Agent';
  avatar: Scalars['JSONObject']['output'];
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  files: Array<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  instructions: Scalars['String']['output'];
  links: Array<AgentLink>;
  name: Scalars['String']['output'];
  ownerId: Scalars['String']['output'];
  parentAgentId: Maybe<Scalars['String']['output']>;
  skills: Array<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface AgentLink {
  __typename?: 'AgentLink';
  label: Maybe<Scalars['String']['output']>;
  url: Scalars['String']['output'];
}

export interface AgentLinkInput {
  label?: InputMaybe<Scalars['String']['input']>;
  url: Scalars['String']['input'];
}

export interface AggregateBucketHitsObjectType {
  __typename?: 'AggregateBucketHitsObjectType';
  nodes: Array<SearchNodeObjectType>;
}

export interface AggregateBucketObjectType {
  __typename?: 'AggregateBucketObjectType';
  count: Scalars['Int']['output'];
  /** The hits object */
  hits: AggregateBucketHitsObjectType;
  key: Scalars['String']['output'];
}

export interface AggregateHitsOptions {
  fields: Array<Scalars['String']['input']>;
  highlights?: InputMaybe<Array<SearchHighlight>>;
  pagination?: InputMaybe<AggregateHitsPagination>;
}

export interface AggregateHitsPagination {
  limit?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
}

export interface AggregateInput {
  field: Scalars['String']['input'];
  options: AggregateOptions;
  query: SearchQuery;
  table: SearchTable;
}

export interface AggregateOptions {
  hits: AggregateHitsOptions;
  pagination?: InputMaybe<SearchPagination>;
}

export interface AggregateResultObjectType {
  __typename?: 'AggregateResultObjectType';
  buckets: Array<AggregateBucketObjectType>;
  pagination: SearchResultPagination;
}

export enum AiJobStatus {
  claimed = 'claimed',
  failed = 'failed',
  finished = 'finished',
  pending = 'pending',
  running = 'running',
}

export interface AlreadyInSpaceDataType {
  __typename?: 'AlreadyInSpaceDataType';
  spaceId: Scalars['String']['output'];
}

export interface AnalyticsKpi {
  __typename?: 'AnalyticsKpi';
  deltaPct: Maybe<Scalars['Float']['output']>;
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  sparkline: Array<Scalars['Float']['output']>;
  value: Scalars['Float']['output'];
}

export interface AnalyticsOverview {
  __typename?: 'AnalyticsOverview';
  capUsdThisMonth: Scalars['Float']['output'];
  generatedAt: Scalars['DateTime']['output'];
  insightsLast7Days: Scalars['Int']['output'];
  kpis: Array<AnalyticsKpi>;
  lastSyncAt: Maybe<Scalars['DateTime']['output']>;
  platforms: Array<AnalyticsPlatformStatus>;
  recentInsights: Array<SocialInsight>;
  spendUsdThisMonth: Scalars['Float']['output'];
  totalConnections: Scalars['Int']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface AnalyticsPlatformStatus {
  __typename?: 'AnalyticsPlatformStatus';
  isConnected: Scalars['Boolean']['output'];
  lastSyncAt: Maybe<Scalars['DateTime']['output']>;
  platform: SocialPlatform;
  status: Scalars['String']['output'];
}

export interface AppConfigValidateResult {
  __typename?: 'AppConfigValidateResult';
  error: Maybe<Scalars['String']['output']>;
  key: Scalars['String']['output'];
  module: Scalars['String']['output'];
  valid: Scalars['Boolean']['output'];
  value: Scalars['JSON']['output'];
}

export interface AudioSliceManifestItemInput {
  byteSize?: InputMaybe<Scalars['Int']['input']>;
  durationSec: Scalars['Float']['input'];
  fileName: Scalars['String']['input'];
  index: Scalars['Int']['input'];
  mimeType: Scalars['String']['input'];
  startSec: Scalars['Float']['input'];
}

export interface AudioSliceManifestItemType {
  __typename?: 'AudioSliceManifestItemType';
  byteSize: Maybe<Scalars['Int']['output']>;
  durationSec: Scalars['Float']['output'];
  fileName: Scalars['String']['output'];
  index: Scalars['Int']['output'];
  mimeType: Scalars['String']['output'];
  startSec: Scalars['Float']['output'];
}

export interface BeginOAuthResult {
  __typename?: 'BeginOAuthResult';
  /** Authorization URL the client must navigate to. */
  url: Scalars['String']['output'];
}

export interface BlobNotFoundDataType {
  __typename?: 'BlobNotFoundDataType';
  blobId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export interface BlobUploadInit {
  __typename?: 'BlobUploadInit';
  alreadyUploaded: Maybe<Scalars['Boolean']['output']>;
  blobKey: Scalars['String']['output'];
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  headers: Maybe<Scalars['JSONObject']['output']>;
  method: BlobUploadMethod;
  partSize: Maybe<Scalars['Int']['output']>;
  uploadId: Maybe<Scalars['String']['output']>;
  uploadUrl: Maybe<Scalars['String']['output']>;
  uploadedParts: Maybe<Array<BlobUploadedPart>>;
}

/** Blob upload method */
export enum BlobUploadMethod {
  GRAPHQL = 'GRAPHQL',
  MULTIPART = 'MULTIPART',
  PRESIGNED = 'PRESIGNED',
}

export interface BlobUploadPart {
  __typename?: 'BlobUploadPart';
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  headers: Maybe<Scalars['JSONObject']['output']>;
  uploadUrl: Scalars['String']['output'];
}

export interface BlobUploadPartInput {
  etag: Scalars['String']['input'];
  partNumber: Scalars['Int']['input'];
}

export interface BlobUploadedPart {
  __typename?: 'BlobUploadedPart';
  etag: Scalars['String']['output'];
  partNumber: Scalars['Int']['output'];
}

export interface BudgetSoftCapNotificationBodyType {
  __typename?: 'BudgetSoftCapNotificationBodyType';
  /** Hard cap in USD for the workspace; soft cap is 80% of this */
  capUsd: Scalars['Float']['output'];
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  /** Calendar month the spend belongs to, formatted as YYYY-MM */
  monthYear: Scalars['String']['output'];
  /** Total AI spend in USD for the calendar month at the time the soft cap was crossed */
  spentUsd: Scalars['Float']['output'];
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
  /** Workspace whose AI budget crossed the soft cap */
  workspaceId: Scalars['String']['output'];
}

export interface CalendarAccountObjectType {
  __typename?: 'CalendarAccountObjectType';
  calendars: Array<CalendarSubscriptionObjectType>;
  calendarsCount: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  displayName: Maybe<Scalars['String']['output']>;
  email: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  lastError: Maybe<Scalars['String']['output']>;
  provider: CalendarProviderType;
  providerAccountId: Scalars['String']['output'];
  refreshIntervalMinutes: Scalars['Int']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
}

export interface CalendarCalDavProviderPresetObjectType {
  __typename?: 'CalendarCalDAVProviderPresetObjectType';
  docsUrl: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  label: Scalars['String']['output'];
  requiresAppPassword: Maybe<Scalars['Boolean']['output']>;
}

export interface CalendarEventObjectType {
  __typename?: 'CalendarEventObjectType';
  allDay: Scalars['Boolean']['output'];
  description: Maybe<Scalars['String']['output']>;
  endAtUtc: Scalars['DateTime']['output'];
  externalEventId: Scalars['String']['output'];
  id: Scalars['String']['output'];
  location: Maybe<Scalars['String']['output']>;
  originalTimezone: Maybe<Scalars['String']['output']>;
  recurrenceId: Maybe<Scalars['String']['output']>;
  startAtUtc: Scalars['DateTime']['output'];
  status: Maybe<Scalars['String']['output']>;
  subscriptionId: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
}

export interface CalendarProviderRequestErrorDataType {
  __typename?: 'CalendarProviderRequestErrorDataType';
  message: Scalars['String']['output'];
  status: Scalars['Int']['output'];
}

export enum CalendarProviderType {
  CalDAV = 'CalDAV',
  Google = 'Google',
}

export interface CalendarSubscriptionObjectType {
  __typename?: 'CalendarSubscriptionObjectType';
  accountId: Scalars['String']['output'];
  color: Maybe<Scalars['String']['output']>;
  displayName: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  externalCalendarId: Scalars['String']['output'];
  id: Scalars['String']['output'];
  lastSyncAt: Maybe<Scalars['DateTime']['output']>;
  provider: CalendarProviderType;
  timezone: Maybe<Scalars['String']['output']>;
}

export interface CancelPlatformConnectInput {
  /** Pending OAuth id to discard. */
  pendingId: Scalars['String']['input'];
}

export enum ChatHistoryOrder {
  asc = 'asc',
  desc = 'desc',
}

export interface ChatMessage {
  __typename?: 'ChatMessage';
  attachments: Maybe<Array<Scalars['String']['output']>>;
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Maybe<Scalars['ID']['output']>;
  params: Maybe<Scalars['JSON']['output']>;
  role: Scalars['String']['output'];
  streamObjects: Maybe<Array<StreamObject>>;
}

/** Comment change action */
export enum CommentChangeAction {
  delete = 'delete',
  update = 'update',
}

export interface CommentChangeObjectType {
  __typename?: 'CommentChangeObjectType';
  /** The action of the comment change */
  action: CommentChangeAction;
  commentId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  /** The item of the comment or reply, different types have different fields, see UnionCommentObjectType */
  item: Scalars['JSONObject']['output'];
}

export interface CommentChangeObjectTypeEdge {
  __typename?: 'CommentChangeObjectTypeEdge';
  cursor: Scalars['String']['output'];
  node: CommentChangeObjectType;
}

export interface CommentCreateInput {
  content: Scalars['JSONObject']['input'];
  docId: Scalars['ID']['input'];
  docMode: DocMode;
  docTitle: Scalars['String']['input'];
  /** The mention user ids, if not provided, the comment will not be mentioned */
  mentions?: InputMaybe<Array<Scalars['String']['input']>>;
  workspaceId: Scalars['ID']['input'];
}

export interface CommentObjectType {
  __typename?: 'CommentObjectType';
  /** The content of the comment */
  content: Scalars['JSONObject']['output'];
  /** The created at time of the comment */
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  /** The replies of the comment */
  replies: Array<ReplyObjectType>;
  /** Whether the comment is resolved */
  resolved: Scalars['Boolean']['output'];
  /** The updated at time of the comment */
  updatedAt: Scalars['DateTime']['output'];
  /** The user who created the comment */
  user: PublicUserType;
}

export interface CommentObjectTypeEdge {
  __typename?: 'CommentObjectTypeEdge';
  cursor: Scalars['String']['output'];
  node: CommentObjectType;
}

export interface CommentResolveInput {
  id: Scalars['ID']['input'];
  /** Whether the comment is resolved */
  resolved: Scalars['Boolean']['input'];
}

export interface CommentUpdateInput {
  content: Scalars['JSONObject']['input'];
  id: Scalars['ID']['input'];
}

export interface ConnectedAccountType {
  __typename?: 'ConnectedAccountType';
  createdAt: Scalars['DateTime']['output'];
  displayName: Scalars['String']['output'];
  id: Scalars['String']['output'];
  provider: Scalars['String']['output'];
  scopes: Array<Scalars['String']['output']>;
}

/** Lifecycle state of a workspace platform connection. */
export enum ConnectionStatus {
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR',
  EXPIRED = 'EXPIRED',
  PAUSED = 'PAUSED',
}

export enum ContextCategories {
  Collection = 'Collection',
  Tag = 'Tag',
}

export enum ContextEmbedStatus {
  failed = 'failed',
  finished = 'finished',
  processing = 'processing',
}

export interface ContextMatchedDocChunk {
  __typename?: 'ContextMatchedDocChunk';
  chunk: Scalars['SafeInt']['output'];
  content: Scalars['String']['output'];
  distance: Maybe<Scalars['Float']['output']>;
  docId: Scalars['String']['output'];
}

export interface ContextMatchedFileChunk {
  __typename?: 'ContextMatchedFileChunk';
  blobId: Scalars['String']['output'];
  chunk: Scalars['SafeInt']['output'];
  content: Scalars['String']['output'];
  distance: Maybe<Scalars['Float']['output']>;
  fileId: Scalars['String']['output'];
  mimeType: Scalars['String']['output'];
  name: Scalars['String']['output'];
}

export interface ContextWorkspaceEmbeddingStatus {
  __typename?: 'ContextWorkspaceEmbeddingStatus';
  embedded: Scalars['SafeInt']['output'];
  total: Scalars['SafeInt']['output'];
}

export interface Copilot {
  __typename?: 'Copilot';
  audioTranscription: Maybe<TranscriptionResultType>;
  chats: PaginatedCopilotHistoriesType;
  /** Get the context list of a session */
  contexts: Array<CopilotContext>;
  /** @deprecated use `chats` instead */
  histories: Array<CopilotHistories>;
  /** List available models for a prompt, with human-readable names */
  models: CopilotModelsType;
  /** Get the quota of the user in the workspace */
  quota: CopilotQuota;
  /** Get the session by id */
  session: CopilotSessionType;
  /**
   * Get the session list in the workspace
   * @deprecated use `chats` instead
   */
  sessions: Array<CopilotSessionType>;
  workspaceId: Maybe<Scalars['ID']['output']>;
}

export interface CopilotAudioTranscriptionArgs {
  blobId?: InputMaybe<Scalars['String']['input']>;
  jobId?: InputMaybe<Scalars['String']['input']>;
}

export interface CopilotChatsArgs {
  docId?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<QueryChatHistoriesInput>;
  pagination: PaginationInput;
}

export interface CopilotContextsArgs {
  contextId?: InputMaybe<Scalars['String']['input']>;
  sessionId?: InputMaybe<Scalars['String']['input']>;
}

export interface CopilotHistoriesArgs {
  docId?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<QueryChatHistoriesInput>;
}

export interface CopilotModelsArgs {
  promptName: Scalars['String']['input'];
}

export interface CopilotSessionArgs {
  sessionId: Scalars['String']['input'];
}

export interface CopilotSessionsArgs {
  docId?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<QueryChatSessionsInput>;
}

export interface CopilotContext {
  __typename?: 'CopilotContext';
  /** list blobs in context */
  blobs: Array<CopilotContextBlob>;
  /** list collections in context */
  collections: Array<CopilotContextCategory>;
  /** list files in context */
  docs: Array<CopilotContextDoc>;
  /** list files in context */
  files: Array<CopilotContextFile>;
  id: Maybe<Scalars['ID']['output']>;
  /** match file in context */
  matchFiles: Array<ContextMatchedFileChunk>;
  /** match workspace docs */
  matchWorkspaceDocs: Array<ContextMatchedDocChunk>;
  /** list tags in context */
  tags: Array<CopilotContextCategory>;
  workspaceId: Scalars['String']['output'];
}

export interface CopilotContextMatchFilesArgs {
  content: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  scopedThreshold?: InputMaybe<Scalars['Float']['input']>;
  threshold?: InputMaybe<Scalars['Float']['input']>;
}

export interface CopilotContextMatchWorkspaceDocsArgs {
  content: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  scopedThreshold?: InputMaybe<Scalars['Float']['input']>;
  threshold?: InputMaybe<Scalars['Float']['input']>;
}

export interface CopilotContextBlob {
  __typename?: 'CopilotContextBlob';
  createdAt: Scalars['SafeInt']['output'];
  id: Scalars['ID']['output'];
  status: Maybe<ContextEmbedStatus>;
}

export interface CopilotContextCategory {
  __typename?: 'CopilotContextCategory';
  createdAt: Scalars['SafeInt']['output'];
  docs: Array<CopilotContextDoc>;
  id: Scalars['ID']['output'];
  type: ContextCategories;
}

export interface CopilotContextDoc {
  __typename?: 'CopilotContextDoc';
  createdAt: Scalars['SafeInt']['output'];
  id: Scalars['ID']['output'];
  status: Maybe<ContextEmbedStatus>;
}

export interface CopilotContextFile {
  __typename?: 'CopilotContextFile';
  blobId: Scalars['String']['output'];
  chunkSize: Scalars['SafeInt']['output'];
  createdAt: Scalars['SafeInt']['output'];
  error: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  mimeType: Scalars['String']['output'];
  name: Scalars['String']['output'];
  status: ContextEmbedStatus;
}

export interface CopilotContextFileNotSupportedDataType {
  __typename?: 'CopilotContextFileNotSupportedDataType';
  fileName: Scalars['String']['output'];
  message: Scalars['String']['output'];
}

export interface CopilotDocNotFoundDataType {
  __typename?: 'CopilotDocNotFoundDataType';
  docId: Scalars['String']['output'];
}

export interface CopilotFailedToAddWorkspaceFileEmbeddingDataType {
  __typename?: 'CopilotFailedToAddWorkspaceFileEmbeddingDataType';
  message: Scalars['String']['output'];
}

export interface CopilotFailedToGenerateEmbeddingDataType {
  __typename?: 'CopilotFailedToGenerateEmbeddingDataType';
  message: Scalars['String']['output'];
  provider: Scalars['String']['output'];
}

export interface CopilotFailedToMatchContextDataType {
  __typename?: 'CopilotFailedToMatchContextDataType';
  content: Scalars['String']['output'];
  contextId: Scalars['String']['output'];
  message: Scalars['String']['output'];
}

export interface CopilotFailedToMatchGlobalContextDataType {
  __typename?: 'CopilotFailedToMatchGlobalContextDataType';
  content: Scalars['String']['output'];
  message: Scalars['String']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotFailedToModifyContextDataType {
  __typename?: 'CopilotFailedToModifyContextDataType';
  contextId: Scalars['String']['output'];
  message: Scalars['String']['output'];
}

export interface CopilotHistories {
  __typename?: 'CopilotHistories';
  /** An mark identifying which view to use to display the session */
  action: Maybe<Scalars['String']['output']>;
  agentId: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  docId: Maybe<Scalars['String']['output']>;
  messages: Array<ChatMessage>;
  model: Scalars['String']['output'];
  optionalModels: Array<Scalars['String']['output']>;
  parentSessionId: Maybe<Scalars['String']['output']>;
  pinned: Scalars['Boolean']['output'];
  pinnedDocId: Maybe<Scalars['String']['output']>;
  promptName: Scalars['String']['output'];
  sessionId: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  /** The number of tokens used in the session */
  tokens: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotHistoriesTypeEdge {
  __typename?: 'CopilotHistoriesTypeEdge';
  cursor: Scalars['String']['output'];
  node: CopilotHistories;
}

export interface CopilotInvalidContextDataType {
  __typename?: 'CopilotInvalidContextDataType';
  contextId: Scalars['String']['output'];
}

export interface CopilotMessageNotFoundDataType {
  __typename?: 'CopilotMessageNotFoundDataType';
  messageId: Scalars['String']['output'];
}

export enum CopilotModelFamily {
  claude = 'claude',
  cloudflare = 'cloudflare',
  deepseek = 'deepseek',
  fal = 'fal',
  gemini = 'gemini',
  gpt = 'gpt',
  llama = 'llama',
  mistral = 'mistral',
  morph = 'morph',
  other = 'other',
  perplexity = 'perplexity',
}

export enum CopilotModelTier {
  balanced = 'balanced',
  fast = 'fast',
  max = 'max',
}

export interface CopilotModelType {
  __typename?: 'CopilotModelType';
  /** Human-readable display name. Falls back to `name` when no friendlier label is available. */
  displayName: Scalars['String']['output'];
  /** Model family (gemini / claude / gpt / llama / mistral / deepseek / ...) for picker badges. */
  family: CopilotModelFamily;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  /** USD per 1k input tokens, list-price approximation. Used by the auto-router and surfaced in the UI for cost-awareness. */
  pricePerKToken: Scalars['Int']['output'];
  /** Coarse tier — fast / balanced / max — for the picker to group by speed-vs-quality. */
  tier: CopilotModelTier;
}

export interface CopilotModelsType {
  __typename?: 'CopilotModelsType';
  defaultModel: Scalars['String']['output'];
  optionalModels: Array<CopilotModelType>;
  proModels: Array<CopilotModelType>;
}

export interface CopilotPromptNotFoundDataType {
  __typename?: 'CopilotPromptNotFoundDataType';
  name: Scalars['String']['output'];
}

export interface CopilotProviderNotSupportedDataType {
  __typename?: 'CopilotProviderNotSupportedDataType';
  kind: Scalars['String']['output'];
  provider: Scalars['String']['output'];
}

export interface CopilotProviderSideErrorDataType {
  __typename?: 'CopilotProviderSideErrorDataType';
  kind: Scalars['String']['output'];
  message: Scalars['String']['output'];
  provider: Scalars['String']['output'];
}

export interface CopilotQuota {
  __typename?: 'CopilotQuota';
  limit: Maybe<Scalars['SafeInt']['output']>;
  used: Scalars['SafeInt']['output'];
}

export interface CopilotSessionType {
  __typename?: 'CopilotSessionType';
  docId: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  model: Scalars['String']['output'];
  optionalModels: Array<Scalars['String']['output']>;
  parentSessionId: Maybe<Scalars['ID']['output']>;
  pinned: Scalars['Boolean']['output'];
  promptName: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
}

export interface CopilotWorkspaceConfig {
  __typename?: 'CopilotWorkspaceConfig';
  allIgnoredDocs: Array<CopilotWorkspaceIgnoredDoc>;
  files: PaginatedCopilotWorkspaceFileType;
  ignoredDocs: PaginatedIgnoredDocsType;
  workspaceId: Scalars['String']['output'];
}

export interface CopilotWorkspaceConfigFilesArgs {
  pagination: PaginationInput;
}

export interface CopilotWorkspaceConfigIgnoredDocsArgs {
  pagination: PaginationInput;
}

export interface CopilotWorkspaceFile {
  __typename?: 'CopilotWorkspaceFile';
  blobId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  fileId: Scalars['String']['output'];
  fileName: Scalars['String']['output'];
  mimeType: Scalars['String']['output'];
  size: Scalars['SafeInt']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotWorkspaceFileTypeEdge {
  __typename?: 'CopilotWorkspaceFileTypeEdge';
  cursor: Scalars['String']['output'];
  node: CopilotWorkspaceFile;
}

export interface CopilotWorkspaceIgnoredDoc {
  __typename?: 'CopilotWorkspaceIgnoredDoc';
  createdAt: Scalars['DateTime']['output'];
  createdBy: Maybe<Scalars['String']['output']>;
  createdByAvatar: Maybe<Scalars['String']['output']>;
  docCreatedAt: Maybe<Scalars['DateTime']['output']>;
  docId: Scalars['String']['output'];
  docUpdatedAt: Maybe<Scalars['DateTime']['output']>;
  title: Maybe<Scalars['String']['output']>;
  updatedBy: Maybe<Scalars['String']['output']>;
}

export interface CopilotWorkspaceIgnoredDocTypeEdge {
  __typename?: 'CopilotWorkspaceIgnoredDocTypeEdge';
  cursor: Scalars['String']['output'];
  node: CopilotWorkspaceIgnoredDoc;
}

export interface CreateAgentInput {
  avatar?: InputMaybe<Scalars['JSONObject']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  instructions?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  parentAgentId?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CreateChatMessageInput {
  /** @deprecated use blobs */
  attachments?: InputMaybe<Array<Scalars['String']['input']>>;
  blob?: InputMaybe<Scalars['Upload']['input']>;
  blobs?: InputMaybe<Array<Scalars['Upload']['input']>>;
  content?: InputMaybe<Scalars['String']['input']>;
  params?: InputMaybe<Scalars['JSON']['input']>;
  sessionId: Scalars['String']['input'];
}

export interface CreateChatSessionInput {
  docId?: InputMaybe<Scalars['String']['input']>;
  pinned?: InputMaybe<Scalars['Boolean']['input']>;
  /** Lock the floating-chat tab context to this doc id (Wave 6 E2.5). */
  pinnedDocId?: InputMaybe<Scalars['String']['input']>;
  /** The prompt name to use for the session */
  promptName: Scalars['String']['input'];
  /** true by default, compliant for old version */
  reuseLatestChat?: InputMaybe<Scalars['Boolean']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CreateCheckoutSessionInput {
  args?: InputMaybe<Scalars['JSONObject']['input']>;
  coupon?: InputMaybe<Scalars['String']['input']>;
  /** @deprecated not required anymore */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  plan?: InputMaybe<SubscriptionPlan>;
  recurring?: InputMaybe<SubscriptionRecurring>;
  successCallbackLink: Scalars['String']['input'];
  variant?: InputMaybe<SubscriptionVariant>;
}

export interface CreateMnAgentInput {
  adapterConfig?: InputMaybe<Scalars['JSONObject']['input']>;
  adapterType?: InputMaybe<MnAgentAdapterType>;
  capabilities?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  projectId: Scalars['ID']['input'];
  reportsToAgentId?: InputMaybe<Scalars['ID']['input']>;
  roleId?: InputMaybe<Scalars['ID']['input']>;
  runtimeConfig?: InputMaybe<Scalars['JSONObject']['input']>;
}

export interface CreateMnApprovalCommentInput {
  /** Optional agent id if the comment author is an agent. Null when authored by a human user. */
  authorAgentId?: InputMaybe<Scalars['ID']['input']>;
  body: Scalars['String']['input'];
}

export interface CreateMnApprovalInput {
  /** Type-specific payload. For TOOL_CALL_REVIEW: { toolName, args, sessionId, agentId }. Free JSON otherwise. */
  payload?: InputMaybe<Scalars['JSONObject']['input']>;
  projectId: Scalars['ID']['input'];
  /** Optional agent id that requested the approval. Null when a human requested it directly. */
  requestedByAgentId?: InputMaybe<Scalars['ID']['input']>;
  type: MnApprovalType;
}

export interface CreateMnBudgetInput {
  /** Spending cap in USD cents (integer). Negative not allowed. */
  capCents: Scalars['Int']['input'];
  /** When true (default), reaching capCents blocks new spend on this scope. */
  hardStopEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  /** Calendar month in YYYY-MM (e.g. "2026-05"). */
  monthYear: Scalars['String']['input'];
  /** Optional project context. Required for PROJECT scope; may be unset for WORKSPACE scope. */
  projectId?: InputMaybe<Scalars['ID']['input']>;
  /** Identifier for the entity at `scopeType`. NULL for workspace-level budgets. */
  scopeId?: InputMaybe<Scalars['ID']['input']>;
  scopeType: MnBudgetScope;
  /** Warning threshold as integer percent of cap (0–100). Defaults to 80. */
  warnThresholdPct?: InputMaybe<Scalars['Int']['input']>;
}

export interface CreateMnCeoConversationInput {
  title?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['ID']['input'];
}

export interface CreateMnCrmAccountInput {
  industry?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  ownerUserId?: InputMaybe<Scalars['ID']['input']>;
  website?: InputMaybe<Scalars['String']['input']>;
}

export interface CreateMnCrmActivityInput {
  accountId?: InputMaybe<Scalars['ID']['input']>;
  body?: InputMaybe<Scalars['String']['input']>;
  contactId?: InputMaybe<Scalars['ID']['input']>;
  dealId?: InputMaybe<Scalars['ID']['input']>;
  dueAt?: InputMaybe<Scalars['DateTime']['input']>;
  subject?: InputMaybe<Scalars['String']['input']>;
  type: MnCrmActivityType;
}

export interface CreateMnCrmContactInput {
  accountId?: InputMaybe<Scalars['ID']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  firstName: Scalars['String']['input'];
  lastName?: InputMaybe<Scalars['String']['input']>;
  ownerUserId?: InputMaybe<Scalars['ID']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
}

export interface CreateMnCrmDealInput {
  accountId?: InputMaybe<Scalars['ID']['input']>;
  contactId?: InputMaybe<Scalars['ID']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  expectedCloseAt?: InputMaybe<Scalars['DateTime']['input']>;
  name: Scalars['String']['input'];
  ownerUserId?: InputMaybe<Scalars['ID']['input']>;
  probability?: InputMaybe<Scalars['Int']['input']>;
  stageId: Scalars['ID']['input'];
  value?: InputMaybe<Scalars['Float']['input']>;
}

export interface CreateMnCrmDealStageInput {
  name: Scalars['String']['input'];
  pipelineKey?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
}

export interface CreateMnGoalInput {
  description?: InputMaybe<Scalars['String']['input']>;
  level: MnGoalLevel;
  ownerAgentId?: InputMaybe<Scalars['ID']['input']>;
  parentGoalId?: InputMaybe<Scalars['ID']['input']>;
  projectId: Scalars['ID']['input'];
  status?: InputMaybe<MnGoalStatus>;
  title: Scalars['String']['input'];
}

export interface CreateMnProjectInput {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
}

export interface CreateMnReminderInput {
  body?: InputMaybe<Scalars['String']['input']>;
  channel?: InputMaybe<MnNotificationChannel>;
  fireAt: Scalars['DateTime']['input'];
  title: Scalars['String']['input'];
}

export interface CreateMnReminderRuleInput {
  config?: InputMaybe<Scalars['JSONObject']['input']>;
  cronExpression?: InputMaybe<Scalars['String']['input']>;
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  timezone?: InputMaybe<Scalars['String']['input']>;
  trigger: MnReminderRuleTrigger;
}

export interface CreateMnSkillInput {
  contentMd: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  slug: Scalars['String']['input'];
  source?: InputMaybe<MnSkillSource>;
  version: Scalars['String']['input'];
}

export interface CreateMnTaskInput {
  assigneeUserId?: InputMaybe<Scalars['ID']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dueAt?: InputMaybe<Scalars['DateTime']['input']>;
  listSortOrder?: InputMaybe<Scalars['Int']['input']>;
  priority?: InputMaybe<MnTaskPriority>;
  status?: InputMaybe<MnTaskStatus>;
  title: Scalars['String']['input'];
}

export interface CreateMnTaskPlanInput {
  bodyMd: Scalars['String']['input'];
  taskId: Scalars['ID']['input'];
}

export interface CreateMnWorkProductInput {
  byteSize?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  kind: MnWorkProductKind;
  metadata?: InputMaybe<Scalars['JSONObject']['input']>;
  producedByAgentId?: InputMaybe<Scalars['ID']['input']>;
  ref: Scalars['String']['input'];
  taskId: Scalars['ID']['input'];
  title?: InputMaybe<Scalars['String']['input']>;
}

export interface CreateMnWorkQueueInput {
  defaultAssigneeAgentId?: InputMaybe<Scalars['ID']['input']>;
  defaultPriority?: InputMaybe<MnTaskPriority>;
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  projectId: Scalars['ID']['input'];
  routingRulesJson?: InputMaybe<Scalars['String']['input']>;
}

export interface CreateUserInput {
  email: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  password?: InputMaybe<Scalars['String']['input']>;
}

export interface CredentialsRequirementType {
  __typename?: 'CredentialsRequirementType';
  password: PasswordLimitsType;
}

export interface DailyStat {
  __typename?: 'DailyStat';
  day: Scalars['String']['output'];
  metric: Scalars['String']['output'];
  value: Scalars['Float']['output'];
}

export interface DailyStatsInput {
  from: Scalars['String']['input'];
  metrics?: InputMaybe<Array<Scalars['String']['input']>>;
  to: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface DecideMnApprovalInput {
  /** Free-text note explaining the decision. Surfaced to the requesting agent so it can react. */
  decisionNote?: InputMaybe<Scalars['String']['input']>;
  /** Decision: APPROVED, REJECTED, CANCELLED, or REVISION_REQUESTED. PENDING is not a legal write target. */
  status: MnApprovalStatus;
}

export interface DecideMnOrgChangeInput {
  /** Free-text note explaining the decision. Surfaced to the proposing agent so it can react. */
  decisionNote?: InputMaybe<Scalars['String']['input']>;
  /** Decision: APPROVED or REJECTED. PROPOSED is not a legal write target; APPLIED / REVERTED are reachable only via apply() / revert(). */
  status: MnOrgChangeStatus;
}

export interface DecideMnTaskPlanInput {
  comment?: InputMaybe<Scalars['String']['input']>;
  decision: MnTaskPlanDecision;
  planId: Scalars['ID']['input'];
}

export interface DeleteAccount {
  __typename?: 'DeleteAccount';
  success: Scalars['Boolean']['output'];
}

export interface DeleteSessionInput {
  docId?: InputMaybe<Scalars['String']['input']>;
  sessionIds: Array<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface DocActionDeniedDataType {
  __typename?: 'DocActionDeniedDataType';
  action: Scalars['String']['output'];
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export interface DocHistoryNotFoundDataType {
  __typename?: 'DocHistoryNotFoundDataType';
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
  timestamp: Scalars['Int']['output'];
}

export interface DocHistoryType {
  __typename?: 'DocHistoryType';
  editor: Maybe<EditorType>;
  id: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface DocMemberLastAccess {
  __typename?: 'DocMemberLastAccess';
  lastAccessedAt: Scalars['DateTime']['output'];
  lastDocId: Maybe<Scalars['String']['output']>;
  user: PublicUserType;
}

export interface DocMemberLastAccessEdge {
  __typename?: 'DocMemberLastAccessEdge';
  cursor: Scalars['String']['output'];
  node: DocMemberLastAccess;
}

/** Doc mode */
export enum DocMode {
  edgeless = 'edgeless',
  page = 'page',
}

export interface DocNotFoundDataType {
  __typename?: 'DocNotFoundDataType';
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export interface DocPageAnalytics {
  __typename?: 'DocPageAnalytics';
  generatedAt: Scalars['DateTime']['output'];
  series: Array<DocPageAnalyticsPoint>;
  summary: DocPageAnalyticsSummary;
  window: TimeWindow;
}

export interface DocPageAnalyticsInput {
  timezone?: InputMaybe<Scalars['String']['input']>;
  windowDays?: InputMaybe<Scalars['Int']['input']>;
}

export interface DocPageAnalyticsPoint {
  __typename?: 'DocPageAnalyticsPoint';
  date: Scalars['DateTime']['output'];
  guestViews: Scalars['SafeInt']['output'];
  totalViews: Scalars['SafeInt']['output'];
  uniqueViews: Scalars['SafeInt']['output'];
}

export interface DocPageAnalyticsSummary {
  __typename?: 'DocPageAnalyticsSummary';
  guestViews: Scalars['SafeInt']['output'];
  lastAccessedAt: Maybe<Scalars['DateTime']['output']>;
  totalViews: Scalars['SafeInt']['output'];
  uniqueViews: Scalars['SafeInt']['output'];
}

export interface DocPermissions {
  __typename?: 'DocPermissions';
  Doc_Comments_Create: Scalars['Boolean']['output'];
  Doc_Comments_Delete: Scalars['Boolean']['output'];
  Doc_Comments_Read: Scalars['Boolean']['output'];
  Doc_Comments_Resolve: Scalars['Boolean']['output'];
  Doc_Copy: Scalars['Boolean']['output'];
  Doc_Delete: Scalars['Boolean']['output'];
  Doc_Duplicate: Scalars['Boolean']['output'];
  Doc_Properties_Read: Scalars['Boolean']['output'];
  Doc_Properties_Update: Scalars['Boolean']['output'];
  Doc_Publish: Scalars['Boolean']['output'];
  Doc_Read: Scalars['Boolean']['output'];
  Doc_Restore: Scalars['Boolean']['output'];
  Doc_TransferOwner: Scalars['Boolean']['output'];
  Doc_Trash: Scalars['Boolean']['output'];
  Doc_Update: Scalars['Boolean']['output'];
  Doc_Users_Manage: Scalars['Boolean']['output'];
  Doc_Users_Read: Scalars['Boolean']['output'];
}

/** User permission in doc */
export enum DocRole {
  Commenter = 'Commenter',
  Editor = 'Editor',
  External = 'External',
  Manager = 'Manager',
  None = 'None',
  Owner = 'Owner',
  Reader = 'Reader',
}

export interface DocType {
  __typename?: 'DocType';
  /** Doc page analytics in a time window */
  analytics: DocPageAnalytics;
  createdAt: Maybe<Scalars['DateTime']['output']>;
  /** Doc create user */
  createdBy: Maybe<PublicUserType>;
  creatorId: Maybe<Scalars['String']['output']>;
  defaultRole: DocRole;
  /** paginated doc granted users list */
  grantedUsersList: PaginatedGrantedDocUserType;
  id: Scalars['String']['output'];
  isVerified: Scalars['Boolean']['output'];
  /** Paginated last accessed members of the current doc */
  lastAccessedMembers: PaginatedDocMemberLastAccess;
  /** Doc last updated user */
  lastUpdatedBy: Maybe<PublicUserType>;
  lastUpdaterId: Maybe<Scalars['String']['output']>;
  /** Doc metadata */
  meta: WorkspaceDocMeta;
  mode: PublicDocMode;
  permissions: DocPermissions;
  public: Scalars['Boolean']['output'];
  summary: Maybe<Scalars['String']['output']>;
  title: Maybe<Scalars['String']['output']>;
  updatedAt: Maybe<Scalars['DateTime']['output']>;
  verificationExpiresAt: Maybe<Scalars['DateTime']['output']>;
  verifiedAt: Maybe<Scalars['DateTime']['output']>;
  verifiedBy: Maybe<Scalars['String']['output']>;
  workspaceId: Scalars['String']['output'];
}

export interface DocTypeAnalyticsArgs {
  input?: InputMaybe<DocPageAnalyticsInput>;
}

export interface DocTypeGrantedUsersListArgs {
  pagination: PaginationInput;
}

export interface DocTypeLastAccessedMembersArgs {
  includeTotal?: InputMaybe<Scalars['Boolean']['input']>;
  pagination: PaginationInput;
  query?: InputMaybe<Scalars['String']['input']>;
}

export interface DocTypeEdge {
  __typename?: 'DocTypeEdge';
  cursor: Scalars['String']['output'];
  node: DocType;
}

export interface DocUpdateBlockedDataType {
  __typename?: 'DocUpdateBlockedDataType';
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export interface DriveFileType {
  __typename?: 'DriveFileType';
  iconLink: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  mimeType: Scalars['String']['output'];
  modifiedTime: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  size: Maybe<Scalars['String']['output']>;
  webViewLink: Maybe<Scalars['String']['output']>;
}

export interface EditorType {
  __typename?: 'EditorType';
  avatarUrl: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
}

export type ErrorDataUnion =
  | AlreadyInSpaceDataType
  | BlobNotFoundDataType
  | CalendarProviderRequestErrorDataType
  | CopilotContextFileNotSupportedDataType
  | CopilotDocNotFoundDataType
  | CopilotFailedToAddWorkspaceFileEmbeddingDataType
  | CopilotFailedToGenerateEmbeddingDataType
  | CopilotFailedToMatchContextDataType
  | CopilotFailedToMatchGlobalContextDataType
  | CopilotFailedToModifyContextDataType
  | CopilotInvalidContextDataType
  | CopilotMessageNotFoundDataType
  | CopilotPromptNotFoundDataType
  | CopilotProviderNotSupportedDataType
  | CopilotProviderSideErrorDataType
  | DocActionDeniedDataType
  | DocHistoryNotFoundDataType
  | DocNotFoundDataType
  | DocUpdateBlockedDataType
  | ExpectToGrantDocUserRolesDataType
  | ExpectToRevokeDocUserRolesDataType
  | ExpectToUpdateDocUserRoleDataType
  | GraphqlBadRequestDataType
  | HttpRequestErrorDataType
  | ImageFormatNotSupportedDataType
  | InvalidAppConfigDataType
  | InvalidAppConfigInputDataType
  | InvalidEmailDataType
  | InvalidHistoryTimestampDataType
  | InvalidIndexerInputDataType
  | InvalidLicenseToActivateDataType
  | InvalidLicenseUpdateParamsDataType
  | InvalidOauthCallbackCodeDataType
  | InvalidOauthResponseDataType
  | InvalidPasswordLengthDataType
  | InvalidRuntimeConfigTypeDataType
  | InvalidSearchProviderRequestDataType
  | MemberNotFoundInSpaceDataType
  | MentionUserDocAccessDeniedDataType
  | MissingOauthQueryParameterDataType
  | NoCopilotProviderAvailableDataType
  | NoMoreSeatDataType
  | NotInSpaceDataType
  | QueryTooLongDataType
  | ResponseTooLargeErrorDataType
  | RuntimeConfigNotFoundDataType
  | SameSubscriptionRecurringDataType
  | SpaceAccessDeniedDataType
  | SpaceNotFoundDataType
  | SpaceOwnerNotFoundDataType
  | SpaceShouldHaveOnlyOneOwnerDataType
  | SsrfBlockedErrorDataType
  | SubscriptionAlreadyExistsDataType
  | SubscriptionNotExistsDataType
  | SubscriptionPlanNotFoundDataType
  | UnknownOauthProviderDataType
  | UnsupportedClientVersionDataType
  | UnsupportedSubscriptionPlanDataType
  | ValidationErrorDataType
  | VersionRejectedDataType
  | WorkspacePermissionNotFoundDataType
  | WrongSignInCredentialsDataType;

export enum ErrorNames {
  ACCESS_DENIED = 'ACCESS_DENIED',
  ACTION_FORBIDDEN = 'ACTION_FORBIDDEN',
  ACTION_FORBIDDEN_ON_NON_TEAM_WORKSPACE = 'ACTION_FORBIDDEN_ON_NON_TEAM_WORKSPACE',
  ALREADY_IN_SPACE = 'ALREADY_IN_SPACE',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  BAD_REQUEST = 'BAD_REQUEST',
  BLOB_INVALID = 'BLOB_INVALID',
  BLOB_NOT_FOUND = 'BLOB_NOT_FOUND',
  BLOB_QUOTA_EXCEEDED = 'BLOB_QUOTA_EXCEEDED',
  CALENDAR_PROVIDER_REQUEST_ERROR = 'CALENDAR_PROVIDER_REQUEST_ERROR',
  CANNOT_DELETE_ACCOUNT_WITH_OWNED_TEAM_WORKSPACE = 'CANNOT_DELETE_ACCOUNT_WITH_OWNED_TEAM_WORKSPACE',
  CANNOT_DELETE_ALL_ADMIN_ACCOUNT = 'CANNOT_DELETE_ALL_ADMIN_ACCOUNT',
  CANNOT_DELETE_OWN_ACCOUNT = 'CANNOT_DELETE_OWN_ACCOUNT',
  CANT_UPDATE_ONETIME_PAYMENT_SUBSCRIPTION = 'CANT_UPDATE_ONETIME_PAYMENT_SUBSCRIPTION',
  CAN_NOT_BATCH_GRANT_DOC_OWNER_PERMISSIONS = 'CAN_NOT_BATCH_GRANT_DOC_OWNER_PERMISSIONS',
  CAN_NOT_REVOKE_YOURSELF = 'CAN_NOT_REVOKE_YOURSELF',
  CAPTCHA_VERIFICATION_FAILED = 'CAPTCHA_VERIFICATION_FAILED',
  COMMENT_ATTACHMENT_NOT_FOUND = 'COMMENT_ATTACHMENT_NOT_FOUND',
  COMMENT_ATTACHMENT_QUOTA_EXCEEDED = 'COMMENT_ATTACHMENT_QUOTA_EXCEEDED',
  COMMENT_NOT_FOUND = 'COMMENT_NOT_FOUND',
  COPILOT_ACTION_TAKEN = 'COPILOT_ACTION_TAKEN',
  COPILOT_CONTEXT_FILE_NOT_SUPPORTED = 'COPILOT_CONTEXT_FILE_NOT_SUPPORTED',
  COPILOT_DOCS_NOT_FOUND = 'COPILOT_DOCS_NOT_FOUND',
  COPILOT_DOC_NOT_FOUND = 'COPILOT_DOC_NOT_FOUND',
  COPILOT_EMBEDDING_DISABLED = 'COPILOT_EMBEDDING_DISABLED',
  COPILOT_EMBEDDING_UNAVAILABLE = 'COPILOT_EMBEDDING_UNAVAILABLE',
  COPILOT_FAILED_TO_ADD_WORKSPACE_FILE_EMBEDDING = 'COPILOT_FAILED_TO_ADD_WORKSPACE_FILE_EMBEDDING',
  COPILOT_FAILED_TO_CREATE_MESSAGE = 'COPILOT_FAILED_TO_CREATE_MESSAGE',
  COPILOT_FAILED_TO_GENERATE_EMBEDDING = 'COPILOT_FAILED_TO_GENERATE_EMBEDDING',
  COPILOT_FAILED_TO_GENERATE_TEXT = 'COPILOT_FAILED_TO_GENERATE_TEXT',
  COPILOT_FAILED_TO_MATCH_CONTEXT = 'COPILOT_FAILED_TO_MATCH_CONTEXT',
  COPILOT_FAILED_TO_MATCH_GLOBAL_CONTEXT = 'COPILOT_FAILED_TO_MATCH_GLOBAL_CONTEXT',
  COPILOT_FAILED_TO_MODIFY_CONTEXT = 'COPILOT_FAILED_TO_MODIFY_CONTEXT',
  COPILOT_INVALID_CONTEXT = 'COPILOT_INVALID_CONTEXT',
  COPILOT_MESSAGE_NOT_FOUND = 'COPILOT_MESSAGE_NOT_FOUND',
  COPILOT_PROMPT_INVALID = 'COPILOT_PROMPT_INVALID',
  COPILOT_PROMPT_NOT_FOUND = 'COPILOT_PROMPT_NOT_FOUND',
  COPILOT_PROVIDER_NOT_SUPPORTED = 'COPILOT_PROVIDER_NOT_SUPPORTED',
  COPILOT_PROVIDER_SIDE_ERROR = 'COPILOT_PROVIDER_SIDE_ERROR',
  COPILOT_QUOTA_EXCEEDED = 'COPILOT_QUOTA_EXCEEDED',
  COPILOT_SESSION_DELETED = 'COPILOT_SESSION_DELETED',
  COPILOT_SESSION_INVALID_INPUT = 'COPILOT_SESSION_INVALID_INPUT',
  COPILOT_SESSION_NOT_FOUND = 'COPILOT_SESSION_NOT_FOUND',
  COPILOT_TRANSCRIPTION_AUDIO_NOT_PROVIDED = 'COPILOT_TRANSCRIPTION_AUDIO_NOT_PROVIDED',
  COPILOT_TRANSCRIPTION_JOB_EXISTS = 'COPILOT_TRANSCRIPTION_JOB_EXISTS',
  COPILOT_TRANSCRIPTION_JOB_NOT_FOUND = 'COPILOT_TRANSCRIPTION_JOB_NOT_FOUND',
  CUSTOMER_PORTAL_CREATE_FAILED = 'CUSTOMER_PORTAL_CREATE_FAILED',
  DOC_ACTION_DENIED = 'DOC_ACTION_DENIED',
  DOC_DEFAULT_ROLE_CAN_NOT_BE_OWNER = 'DOC_DEFAULT_ROLE_CAN_NOT_BE_OWNER',
  DOC_HISTORY_NOT_FOUND = 'DOC_HISTORY_NOT_FOUND',
  DOC_IS_NOT_PUBLIC = 'DOC_IS_NOT_PUBLIC',
  DOC_NOT_FOUND = 'DOC_NOT_FOUND',
  DOC_UPDATE_BLOCKED = 'DOC_UPDATE_BLOCKED',
  EMAIL_ALREADY_USED = 'EMAIL_ALREADY_USED',
  EMAIL_SERVICE_NOT_CONFIGURED = 'EMAIL_SERVICE_NOT_CONFIGURED',
  EMAIL_TOKEN_NOT_FOUND = 'EMAIL_TOKEN_NOT_FOUND',
  EMAIL_VERIFICATION_REQUIRED = 'EMAIL_VERIFICATION_REQUIRED',
  EXPECT_TO_GRANT_DOC_USER_ROLES = 'EXPECT_TO_GRANT_DOC_USER_ROLES',
  EXPECT_TO_PUBLISH_DOC = 'EXPECT_TO_PUBLISH_DOC',
  EXPECT_TO_REVOKE_DOC_USER_ROLES = 'EXPECT_TO_REVOKE_DOC_USER_ROLES',
  EXPECT_TO_REVOKE_PUBLIC_DOC = 'EXPECT_TO_REVOKE_PUBLIC_DOC',
  EXPECT_TO_UPDATE_DOC_USER_ROLE = 'EXPECT_TO_UPDATE_DOC_USER_ROLE',
  FAILED_TO_CHECKOUT = 'FAILED_TO_CHECKOUT',
  FAILED_TO_SAVE_UPDATES = 'FAILED_TO_SAVE_UPDATES',
  FAILED_TO_UPSERT_SNAPSHOT = 'FAILED_TO_UPSERT_SNAPSHOT',
  GRAPHQL_BAD_REQUEST = 'GRAPHQL_BAD_REQUEST',
  HTTP_REQUEST_ERROR = 'HTTP_REQUEST_ERROR',
  IMAGE_FORMAT_NOT_SUPPORTED = 'IMAGE_FORMAT_NOT_SUPPORTED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  INVALID_APP_CONFIG = 'INVALID_APP_CONFIG',
  INVALID_APP_CONFIG_INPUT = 'INVALID_APP_CONFIG_INPUT',
  INVALID_AUTH_STATE = 'INVALID_AUTH_STATE',
  INVALID_CHECKOUT_PARAMETERS = 'INVALID_CHECKOUT_PARAMETERS',
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_EMAIL_TOKEN = 'INVALID_EMAIL_TOKEN',
  INVALID_HISTORY_TIMESTAMP = 'INVALID_HISTORY_TIMESTAMP',
  INVALID_INDEXER_INPUT = 'INVALID_INDEXER_INPUT',
  INVALID_INVITATION = 'INVALID_INVITATION',
  INVALID_LICENSE_SESSION_ID = 'INVALID_LICENSE_SESSION_ID',
  INVALID_LICENSE_TO_ACTIVATE = 'INVALID_LICENSE_TO_ACTIVATE',
  INVALID_LICENSE_UPDATE_PARAMS = 'INVALID_LICENSE_UPDATE_PARAMS',
  INVALID_OAUTH_CALLBACK_CODE = 'INVALID_OAUTH_CALLBACK_CODE',
  INVALID_OAUTH_CALLBACK_STATE = 'INVALID_OAUTH_CALLBACK_STATE',
  INVALID_OAUTH_RESPONSE = 'INVALID_OAUTH_RESPONSE',
  INVALID_PASSWORD_LENGTH = 'INVALID_PASSWORD_LENGTH',
  INVALID_RUNTIME_CONFIG_TYPE = 'INVALID_RUNTIME_CONFIG_TYPE',
  INVALID_SEARCH_PROVIDER_REQUEST = 'INVALID_SEARCH_PROVIDER_REQUEST',
  INVALID_SUBSCRIPTION_PARAMETERS = 'INVALID_SUBSCRIPTION_PARAMETERS',
  LICENSE_EXPIRED = 'LICENSE_EXPIRED',
  LICENSE_NOT_FOUND = 'LICENSE_NOT_FOUND',
  LICENSE_REVEALED = 'LICENSE_REVEALED',
  LINK_EXPIRED = 'LINK_EXPIRED',
  MAILER_SERVICE_IS_NOT_CONFIGURED = 'MAILER_SERVICE_IS_NOT_CONFIGURED',
  MANAGED_BY_APP_STORE_OR_PLAY = 'MANAGED_BY_APP_STORE_OR_PLAY',
  MEMBER_NOT_FOUND_IN_SPACE = 'MEMBER_NOT_FOUND_IN_SPACE',
  MEMBER_QUOTA_EXCEEDED = 'MEMBER_QUOTA_EXCEEDED',
  MENTION_USER_DOC_ACCESS_DENIED = 'MENTION_USER_DOC_ACCESS_DENIED',
  MENTION_USER_ONESELF_DENIED = 'MENTION_USER_ONESELF_DENIED',
  MISSING_OAUTH_QUERY_PARAMETER = 'MISSING_OAUTH_QUERY_PARAMETER',
  NETWORK_ERROR = 'NETWORK_ERROR',
  NEW_OWNER_IS_NOT_ACTIVE_MEMBER = 'NEW_OWNER_IS_NOT_ACTIVE_MEMBER',
  NOTIFICATION_NOT_FOUND = 'NOTIFICATION_NOT_FOUND',
  NOT_FOUND = 'NOT_FOUND',
  NOT_IN_SPACE = 'NOT_IN_SPACE',
  NO_COPILOT_PROVIDER_AVAILABLE = 'NO_COPILOT_PROVIDER_AVAILABLE',
  NO_MORE_SEAT = 'NO_MORE_SEAT',
  OAUTH_ACCOUNT_ALREADY_CONNECTED = 'OAUTH_ACCOUNT_ALREADY_CONNECTED',
  OAUTH_STATE_EXPIRED = 'OAUTH_STATE_EXPIRED',
  OWNER_CAN_NOT_LEAVE_WORKSPACE = 'OWNER_CAN_NOT_LEAVE_WORKSPACE',
  PASSWORD_REQUIRED = 'PASSWORD_REQUIRED',
  QUERY_TOO_LONG = 'QUERY_TOO_LONG',
  REPLY_NOT_FOUND = 'REPLY_NOT_FOUND',
  RESPONSE_TOO_LARGE_ERROR = 'RESPONSE_TOO_LARGE_ERROR',
  RUNTIME_CONFIG_NOT_FOUND = 'RUNTIME_CONFIG_NOT_FOUND',
  SAME_EMAIL_PROVIDED = 'SAME_EMAIL_PROVIDED',
  SAME_SUBSCRIPTION_RECURRING = 'SAME_SUBSCRIPTION_RECURRING',
  SEARCH_PROVIDER_NOT_FOUND = 'SEARCH_PROVIDER_NOT_FOUND',
  SIGN_UP_FORBIDDEN = 'SIGN_UP_FORBIDDEN',
  SPACE_ACCESS_DENIED = 'SPACE_ACCESS_DENIED',
  SPACE_NOT_FOUND = 'SPACE_NOT_FOUND',
  SPACE_OWNER_NOT_FOUND = 'SPACE_OWNER_NOT_FOUND',
  SPACE_SHOULD_HAVE_ONLY_ONE_OWNER = 'SPACE_SHOULD_HAVE_ONLY_ONE_OWNER',
  SSRF_BLOCKED_ERROR = 'SSRF_BLOCKED_ERROR',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  SUBSCRIPTION_ALREADY_EXISTS = 'SUBSCRIPTION_ALREADY_EXISTS',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_HAS_BEEN_CANCELED = 'SUBSCRIPTION_HAS_BEEN_CANCELED',
  SUBSCRIPTION_HAS_NOT_BEEN_CANCELED = 'SUBSCRIPTION_HAS_NOT_BEEN_CANCELED',
  SUBSCRIPTION_NOT_EXISTS = 'SUBSCRIPTION_NOT_EXISTS',
  SUBSCRIPTION_PLAN_NOT_FOUND = 'SUBSCRIPTION_PLAN_NOT_FOUND',
  TOO_MANY_REQUEST = 'TOO_MANY_REQUEST',
  UNKNOWN_OAUTH_PROVIDER = 'UNKNOWN_OAUTH_PROVIDER',
  UNSPLASH_IS_NOT_CONFIGURED = 'UNSPLASH_IS_NOT_CONFIGURED',
  UNSUPPORTED_CLIENT_VERSION = 'UNSUPPORTED_CLIENT_VERSION',
  UNSUPPORTED_SUBSCRIPTION_PLAN = 'UNSUPPORTED_SUBSCRIPTION_PLAN',
  USER_AVATAR_NOT_FOUND = 'USER_AVATAR_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  VERSION_REJECTED = 'VERSION_REJECTED',
  WORKSPACE_ID_REQUIRED_FOR_TEAM_SUBSCRIPTION = 'WORKSPACE_ID_REQUIRED_FOR_TEAM_SUBSCRIPTION',
  WORKSPACE_ID_REQUIRED_TO_UPDATE_TEAM_SUBSCRIPTION = 'WORKSPACE_ID_REQUIRED_TO_UPDATE_TEAM_SUBSCRIPTION',
  WORKSPACE_LICENSE_ALREADY_EXISTS = 'WORKSPACE_LICENSE_ALREADY_EXISTS',
  WORKSPACE_PERMISSION_NOT_FOUND = 'WORKSPACE_PERMISSION_NOT_FOUND',
  WRONG_SIGN_IN_CREDENTIALS = 'WRONG_SIGN_IN_CREDENTIALS',
  WRONG_SIGN_IN_METHOD = 'WRONG_SIGN_IN_METHOD',
}

export interface ExpectToGrantDocUserRolesDataType {
  __typename?: 'ExpectToGrantDocUserRolesDataType';
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export interface ExpectToRevokeDocUserRolesDataType {
  __typename?: 'ExpectToRevokeDocUserRolesDataType';
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export interface ExpectToUpdateDocUserRoleDataType {
  __typename?: 'ExpectToUpdateDocUserRoleDataType';
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export interface FacebookConnectAuthUrl {
  __typename?: 'FacebookConnectAuthUrl';
  url: Scalars['String']['output'];
}

export interface FacebookConnectionType {
  __typename?: 'FacebookConnectionType';
  connected: Scalars['Boolean']['output'];
  displayName: Maybe<Scalars['String']['output']>;
}

export enum FeatureType {
  AIEarlyAccess = 'AIEarlyAccess',
  Admin = 'Admin',
  EarlyAccess = 'EarlyAccess',
  FreePlan = 'FreePlan',
  LifetimeProPlan = 'LifetimeProPlan',
  ProPlan = 'ProPlan',
  QuotaExceededReadonlyWorkspace = 'QuotaExceededReadonlyWorkspace',
  TeamPlan = 'TeamPlan',
  UnlimitedCopilot = 'UnlimitedCopilot',
  UnlimitedWorkspace = 'UnlimitedWorkspace',
}

export interface FigmaConnectAuthUrl {
  __typename?: 'FigmaConnectAuthUrl';
  url: Scalars['String']['output'];
}

export interface FigmaConnectionType {
  __typename?: 'FigmaConnectionType';
  connected: Scalars['Boolean']['output'];
  email: Maybe<Scalars['String']['output']>;
  handle: Maybe<Scalars['String']['output']>;
}

export interface FinalizePlatformConnectInput {
  /** Provider account id the user picked from the picker modal. */
  externalAccountId: Scalars['String']['input'];
  /** Pending OAuth id returned from the choose-account postMessage. */
  pendingId: Scalars['String']['input'];
}

export interface ForkChatSessionInput {
  docId: Scalars['String']['input'];
  /** Identify a message in the array and keep it with all previous messages into a forked session. */
  latestMessageId?: InputMaybe<Scalars['String']['input']>;
  sessionId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface GenerateAccessTokenInput {
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  name: Scalars['String']['input'];
}

export interface GithubConnectAuthUrl {
  __typename?: 'GithubConnectAuthUrl';
  url: Scalars['String']['output'];
}

export interface GithubConnectionType {
  __typename?: 'GithubConnectionType';
  connected: Scalars['Boolean']['output'];
  login: Maybe<Scalars['String']['output']>;
}

export interface GmailMessageSummaryType {
  __typename?: 'GmailMessageSummaryType';
  date: Scalars['String']['output'];
  from: Scalars['String']['output'];
  messageId: Scalars['String']['output'];
  snippet: Scalars['String']['output'];
  subject: Scalars['String']['output'];
}

export interface GoGoCashConnectionInputType {
  apiKey: Scalars['String']['input'];
  label?: InputMaybe<Scalars['String']['input']>;
}

export interface GoGoCashConnectionType {
  __typename?: 'GoGoCashConnectionType';
  connected: Scalars['Boolean']['output'];
  label: Maybe<Scalars['String']['output']>;
}

export interface GoogleConnectAuthUrl {
  __typename?: 'GoogleConnectAuthUrl';
  url: Scalars['String']['output'];
}

export interface GoogleConnectionType {
  __typename?: 'GoogleConnectionType';
  connected: Scalars['Boolean']['output'];
  email: Maybe<Scalars['String']['output']>;
  scope: GoogleScope;
}

/** Which Google service the OAuth flow should request access to. v1.10.1: gmail and drive only. */
export enum GoogleScope {
  drive = 'drive',
  gmail = 'gmail',
}

export interface GrantDocUserRolesInput {
  docId: Scalars['String']['input'];
  role: DocRole;
  userIds: Array<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface GrantedDocUserType {
  __typename?: 'GrantedDocUserType';
  role: DocRole;
  user: WorkspaceUserType;
}

export interface GrantedDocUserTypeEdge {
  __typename?: 'GrantedDocUserTypeEdge';
  cursor: Scalars['String']['output'];
  node: GrantedDocUserType;
}

export interface GraphqlBadRequestDataType {
  __typename?: 'GraphqlBadRequestDataType';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
}

export interface HttpRequestErrorDataType {
  __typename?: 'HttpRequestErrorDataType';
  message: Scalars['String']['output'];
}

export interface ImageFormatNotSupportedDataType {
  __typename?: 'ImageFormatNotSupportedDataType';
  format: Scalars['String']['output'];
}

export interface ImportMnHandoverInput {
  handoverJson: Scalars['String']['input'];
  targetDocId?: InputMaybe<Scalars['ID']['input']>;
}

export interface ImportMnHandoverResult {
  __typename?: 'ImportMnHandoverResult';
  docId: Scalars['ID']['output'];
  title: Scalars['String']['output'];
  updated: Scalars['Boolean']['output'];
}

export interface ImportUsersInput {
  users: Array<CreateUserInput>;
}

/** How loud the insight should be in the UI. */
export enum InsightSeverity {
  ACTION_REQUIRED = 'ACTION_REQUIRED',
  INFO = 'INFO',
  NOTABLE = 'NOTABLE',
}

/** Category of an AI-generated SocialInsight. */
export enum InsightType {
  ANOMALY = 'ANOMALY',
  RECOMMENDATION = 'RECOMMENDATION',
  TREND = 'TREND',
  WEEKLY_STRATEGY = 'WEEKLY_STRATEGY',
}

export interface InstagramConnectAuthUrl {
  __typename?: 'InstagramConnectAuthUrl';
  url: Scalars['String']['output'];
}

export interface InstagramConnectionType {
  __typename?: 'InstagramConnectionType';
  connected: Scalars['Boolean']['output'];
  username: Maybe<Scalars['String']['output']>;
}

export interface InstallMnPluginInput {
  name: Scalars['String']['input'];
  version: Scalars['String']['input'];
}

export interface InvalidAppConfigDataType {
  __typename?: 'InvalidAppConfigDataType';
  hint: Scalars['String']['output'];
  key: Scalars['String']['output'];
  module: Scalars['String']['output'];
}

export interface InvalidAppConfigInputDataType {
  __typename?: 'InvalidAppConfigInputDataType';
  message: Scalars['String']['output'];
}

export interface InvalidEmailDataType {
  __typename?: 'InvalidEmailDataType';
  email: Scalars['String']['output'];
}

export interface InvalidHistoryTimestampDataType {
  __typename?: 'InvalidHistoryTimestampDataType';
  timestamp: Scalars['String']['output'];
}

export interface InvalidIndexerInputDataType {
  __typename?: 'InvalidIndexerInputDataType';
  reason: Scalars['String']['output'];
}

export interface InvalidLicenseToActivateDataType {
  __typename?: 'InvalidLicenseToActivateDataType';
  reason: Scalars['String']['output'];
}

export interface InvalidLicenseUpdateParamsDataType {
  __typename?: 'InvalidLicenseUpdateParamsDataType';
  reason: Scalars['String']['output'];
}

export interface InvalidOauthCallbackCodeDataType {
  __typename?: 'InvalidOauthCallbackCodeDataType';
  body: Scalars['String']['output'];
  status: Scalars['Int']['output'];
}

export interface InvalidOauthResponseDataType {
  __typename?: 'InvalidOauthResponseDataType';
  reason: Scalars['String']['output'];
}

export interface InvalidPasswordLengthDataType {
  __typename?: 'InvalidPasswordLengthDataType';
  max: Scalars['Int']['output'];
  min: Scalars['Int']['output'];
}

export interface InvalidRuntimeConfigTypeDataType {
  __typename?: 'InvalidRuntimeConfigTypeDataType';
  get: Scalars['String']['output'];
  key: Scalars['String']['output'];
  want: Scalars['String']['output'];
}

export interface InvalidSearchProviderRequestDataType {
  __typename?: 'InvalidSearchProviderRequestDataType';
  reason: Scalars['String']['output'];
  type: Scalars['String']['output'];
}

export interface InvitationAcceptedNotificationBodyType {
  __typename?: 'InvitationAcceptedNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  inviteId: Scalars['ID']['output'];
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface InvitationBlockedNotificationBodyType {
  __typename?: 'InvitationBlockedNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  inviteId: Scalars['ID']['output'];
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface InvitationNotificationBodyType {
  __typename?: 'InvitationNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  inviteId: Scalars['ID']['output'];
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface InvitationReviewApprovedNotificationBodyType {
  __typename?: 'InvitationReviewApprovedNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  inviteId: Scalars['ID']['output'];
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface InvitationReviewDeclinedNotificationBodyType {
  __typename?: 'InvitationReviewDeclinedNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface InvitationReviewRequestNotificationBodyType {
  __typename?: 'InvitationReviewRequestNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  inviteId: Scalars['ID']['output'];
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface InvitationType {
  __typename?: 'InvitationType';
  /** Invitee information */
  invitee: WorkspaceUserType;
  /** Invitation status in workspace */
  status: Maybe<WorkspaceMemberStatus>;
  /** User information */
  user: WorkspaceUserType;
  /** Workspace information */
  workspace: InvitationWorkspaceType;
}

export interface InvitationWorkspaceType {
  __typename?: 'InvitationWorkspaceType';
  /** Base64 encoded avatar */
  avatar: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Workspace name */
  name: Scalars['String']['output'];
}

export interface InviteLink {
  __typename?: 'InviteLink';
  /** Invite link expire time */
  expireTime: Scalars['DateTime']['output'];
  /** Invite link */
  link: Scalars['String']['output'];
}

export interface InviteResult {
  __typename?: 'InviteResult';
  email: Scalars['String']['output'];
  /** Invite error */
  error: Maybe<Scalars['JSONObject']['output']>;
  /** Invite id, null if invite record create failed */
  inviteId: Maybe<Scalars['String']['output']>;
  /**
   * Invite email sent success
   * @deprecated Notification will be sent asynchronously
   */
  sentSuccess: Scalars['Boolean']['output'];
}

export interface InviteUserType {
  __typename?: 'InviteUserType';
  /** User avatar url */
  avatarUrl: Maybe<Scalars['String']['output']>;
  /** Whether the user has finished (or skipped) the /welcome onboarding wizard. Used by the frontend index router to decide whether to drop a brand-new account into /welcome or into their landing workspace. */
  completedOnboarding: Maybe<Scalars['Boolean']['output']>;
  /**
   * User email verified
   * @deprecated useless
   */
  createdAt: Maybe<Scalars['DateTime']['output']>;
  /** User is disabled */
  disabled: Maybe<Scalars['Boolean']['output']>;
  /** User email */
  email: Maybe<Scalars['String']['output']>;
  /** User email verified */
  emailVerified: Maybe<Scalars['Boolean']['output']>;
  /** User password has been set */
  hasPassword: Maybe<Scalars['Boolean']['output']>;
  id: Scalars['ID']['output'];
  /** Invite id */
  inviteId: Scalars['String']['output'];
  /** User name */
  name: Maybe<Scalars['String']['output']>;
  /**
   * User permission in workspace
   * @deprecated Use role instead
   */
  permission: Permission;
  /** User role in workspace */
  role: Permission;
  /** Member invite status in workspace */
  status: WorkspaceMemberStatus;
}

export enum InvoiceStatus {
  Draft = 'Draft',
  Open = 'Open',
  Paid = 'Paid',
  Uncollectible = 'Uncollectible',
  Void = 'Void',
}

export interface InvoiceType {
  __typename?: 'InvoiceType';
  amount: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  currency: Scalars['String']['output'];
  /** @deprecated removed */
  id: Maybe<Scalars['String']['output']>;
  lastPaymentError: Maybe<Scalars['String']['output']>;
  link: Maybe<Scalars['String']['output']>;
  /** @deprecated removed */
  plan: Maybe<SubscriptionPlan>;
  reason: Scalars['String']['output'];
  /** @deprecated removed */
  recurring: Maybe<SubscriptionRecurring>;
  status: InvoiceStatus;
  updatedAt: Scalars['DateTime']['output'];
}

export interface License {
  __typename?: 'License';
  expiredAt: Maybe<Scalars['DateTime']['output']>;
  installedAt: Scalars['DateTime']['output'];
  quantity: Scalars['Int']['output'];
  recurring: SubscriptionRecurring;
  validatedAt: Scalars['DateTime']['output'];
  variant: Maybe<SubscriptionVariant>;
}

export interface LimitedUserType {
  __typename?: 'LimitedUserType';
  /** User email */
  email: Scalars['String']['output'];
  /** User password has been set */
  hasPassword: Maybe<Scalars['Boolean']['output']>;
}

export interface LineVoomConnectAuthUrl {
  __typename?: 'LineVoomConnectAuthUrl';
  url: Scalars['String']['output'];
}

export interface LineVoomConnectionType {
  __typename?: 'LineVoomConnectionType';
  connected: Scalars['Boolean']['output'];
  displayName: Maybe<Scalars['String']['output']>;
}

export interface LinearConnectAuthUrl {
  __typename?: 'LinearConnectAuthUrl';
  url: Scalars['String']['output'];
}

export interface LinearConnectionType {
  __typename?: 'LinearConnectionType';
  connected: Scalars['Boolean']['output'];
  displayName: Maybe<Scalars['String']['output']>;
  organizationName: Maybe<Scalars['String']['output']>;
}

export interface LinkCalDavAccountInput {
  displayName?: InputMaybe<Scalars['String']['input']>;
  password: Scalars['String']['input'];
  providerPresetId: Scalars['String']['input'];
  username: Scalars['String']['input'];
}

export interface LinkCalendarAccountInput {
  provider: CalendarProviderType;
  redirectUri?: InputMaybe<Scalars['String']['input']>;
}

export interface ListInsightsInput {
  insightType?: InputMaybe<InsightType>;
  limit?: Scalars['Int']['input'];
  types?: InputMaybe<Array<InsightType>>;
  workspaceId: Scalars['String']['input'];
}

export interface ListMetricsInput {
  bucket: MetricBucket;
  from: Scalars['DateTime']['input'];
  platform?: InputMaybe<SocialPlatform>;
  to: Scalars['DateTime']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface ListMnApprovalsInput {
  /** Maximum rows to return. Defaults to 100; clamped to 500. */
  limit?: InputMaybe<Scalars['Int']['input']>;
  projectId?: InputMaybe<Scalars['ID']['input']>;
  requestedByAgentId?: InputMaybe<Scalars['ID']['input']>;
  statuses?: InputMaybe<Array<MnApprovalStatus>>;
  types?: InputMaybe<Array<MnApprovalType>>;
}

export interface ListMnOrgChangesInput {
  /** Maximum rows to return. Defaults to 100; clamped to 500. */
  limit?: InputMaybe<Scalars['Int']['input']>;
  projectId?: InputMaybe<Scalars['ID']['input']>;
  proposedByAgentId?: InputMaybe<Scalars['ID']['input']>;
  statuses?: InputMaybe<Array<MnOrgChangeStatus>>;
  types?: InputMaybe<Array<MnOrgChangeType>>;
}

export interface ListUserInput {
  features?: InputMaybe<Array<FeatureType>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  keyword?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
}

export interface ListWorkspaceInput {
  enableAi?: InputMaybe<Scalars['Boolean']['input']>;
  enableDocEmbedding?: InputMaybe<Scalars['Boolean']['input']>;
  enableSharing?: InputMaybe<Scalars['Boolean']['input']>;
  enableUrlPreview?: InputMaybe<Scalars['Boolean']['input']>;
  features?: InputMaybe<Array<FeatureType>>;
  first?: Scalars['Int']['input'];
  keyword?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<AdminWorkspaceSort>;
  public?: InputMaybe<Scalars['Boolean']['input']>;
  skip?: Scalars['Int']['input'];
}

export interface ListedBlob {
  __typename?: 'ListedBlob';
  createdAt: Scalars['String']['output'];
  key: Scalars['String']['output'];
  mime: Scalars['String']['output'];
  size: Scalars['Int']['output'];
}

export interface ManageUserInput {
  /** User email */
  email?: InputMaybe<Scalars['String']['input']>;
  /** User name */
  name?: InputMaybe<Scalars['String']['input']>;
}

export interface MeetingActionItemType {
  __typename?: 'MeetingActionItemType';
  deadline: Maybe<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  owner: Maybe<Scalars['String']['output']>;
}

export interface MeetingSummaryV2Type {
  __typename?: 'MeetingSummaryV2Type';
  actionItems: Array<MeetingActionItemType>;
  attendees: Array<Scalars['String']['output']>;
  blockers: Array<Scalars['String']['output']>;
  decisions: Array<Scalars['String']['output']>;
  durationMinutes: Scalars['Float']['output'];
  keyPoints: Array<Scalars['String']['output']>;
  openQuestions: Array<Scalars['String']['output']>;
  title: Scalars['String']['output'];
}

export interface MemberNotFoundInSpaceDataType {
  __typename?: 'MemberNotFoundInSpaceDataType';
  spaceId: Scalars['String']['output'];
}

export interface Memory {
  __typename?: 'Memory';
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  kind: MemoryKindEnum;
  pinned: Scalars['Boolean']['output'];
  scope: MemoryScopeEnum;
  workspaceId: Scalars['String']['output'];
}

export enum MemoryKindEnum {
  DECISION = 'DECISION',
  FACT = 'FACT',
  OBSERVATION = 'OBSERVATION',
  PLAYBOOK = 'PLAYBOOK',
}

export enum MemoryScopeEnum {
  user = 'user',
  workspace = 'workspace',
}

export interface MentionDocInput {
  /** The block id in the doc */
  blockId?: InputMaybe<Scalars['String']['input']>;
  /** The element id in the doc */
  elementId?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['String']['input'];
  mode: DocMode;
  title: Scalars['String']['input'];
}

export interface MentionDocType {
  __typename?: 'MentionDocType';
  blockId: Maybe<Scalars['String']['output']>;
  elementId: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  mode: DocMode;
  title: Scalars['String']['output'];
}

export interface MentionInput {
  doc: MentionDocInput;
  userId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MentionNotificationBodyType {
  __typename?: 'MentionNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  doc: MentionDocType;
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface MentionUserDocAccessDeniedDataType {
  __typename?: 'MentionUserDocAccessDeniedDataType';
  docId: Scalars['String']['output'];
}

/** Pre-aggregated rollup window for a SocialMetric row. */
export enum MetricBucket {
  DAY = 'DAY',
  HOUR = 'HOUR',
  WEEK = 'WEEK',
}

export interface MintMnAgentApiKeyInput {
  /** Human-readable label for this key, shown in the key list. */
  name: Scalars['String']['input'];
}

export interface MintedMnAgentApiKey {
  __typename?: 'MintedMnAgentApiKey';
  key: MnAgentApiKey;
  /** Plaintext API key. Shown ONCE — never recoverable from the server again. */
  plaintext: Scalars['String']['output'];
}

export interface MissingOauthQueryParameterDataType {
  __typename?: 'MissingOauthQueryParameterDataType';
  name: Scalars['String']['output'];
}

export interface MnAgent {
  __typename?: 'MnAgent';
  adapterConfig: Scalars['JSONObject']['output'];
  adapterType: MnAgentAdapterType;
  capabilities: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdByUserId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  lastHeartbeatAt: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  projectId: Scalars['ID']['output'];
  reportsToAgentId: Maybe<Scalars['ID']['output']>;
  roleId: Maybe<Scalars['ID']['output']>;
  runtimeConfig: Scalars['JSONObject']['output'];
  status: MnAgentStatus;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
}

/** Which downstream runtime an agent talks to. M1 only ships Copilot chat sessions. */
export enum MnAgentAdapterType {
  COPILOT_CHAT_SESSION = 'COPILOT_CHAT_SESSION',
  CURSOR_CLOUD = 'CURSOR_CLOUD',
  E2B_SANDBOX = 'E2B_SANDBOX',
  HTTP_WEBHOOK = 'HTTP_WEBHOOK',
  PROCESS_COMMAND = 'PROCESS_COMMAND',
}

export interface MnAgentApiKey {
  __typename?: 'MnAgentApiKey';
  agentId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  lastUsedAt: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  projectId: Scalars['ID']['output'];
  revokedAt: Maybe<Scalars['DateTime']['output']>;
  workspaceId: Scalars['ID']['output'];
}

export interface MnAgentMaximizerToggleResult {
  __typename?: 'MnAgentMaximizerToggleResult';
  agentId: Scalars['ID']['output'];
  maximizerMode: Scalars['Boolean']['output'];
}

export interface MnAgentMemory {
  __typename?: 'MnAgentMemory';
  agentId: Scalars['ID']['output'];
  contentMd: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  importance: Scalars['Int']['output'];
  kind: MnMemoryKind;
  lastRetrievedAt: Maybe<Scalars['DateTime']['output']>;
  projectId: Scalars['ID']['output'];
  retrievedCount: Scalars['Int']['output'];
  taskId: Maybe<Scalars['ID']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
}

export interface MnAgentRole {
  __typename?: 'MnAgentRole';
  adapter: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  displayName: Scalars['String']['output'];
  escalation: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  lastSeenAt: Maybe<Scalars['DateTime']['output']>;
  lastSuccessfulRunId: Maybe<Scalars['String']['output']>;
  responsibility: Scalars['String']['output'];
  /** Stable identifier (e.g. "release-captain"). Immutable — used by automation. */
  slug: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
}

/** Lifecycle state of a Manut agent. */
export enum MnAgentStatus {
  ERROR = 'ERROR',
  IDLE = 'IDLE',
  PAUSED = 'PAUSED',
  RUNNING = 'RUNNING',
  TERMINATED = 'TERMINATED',
}

export interface MnApproval {
  __typename?: 'MnApproval';
  createdAt: Scalars['DateTime']['output'];
  decidedAt: Maybe<Scalars['DateTime']['output']>;
  decidedByUserId: Maybe<Scalars['ID']['output']>;
  decisionNote: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  payload: Scalars['JSONObject']['output'];
  projectId: Scalars['ID']['output'];
  requestedByAgentId: Maybe<Scalars['ID']['output']>;
  requestedByUserId: Maybe<Scalars['ID']['output']>;
  status: MnApprovalStatus;
  type: MnApprovalType;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
}

export interface MnApprovalComment {
  __typename?: 'MnApprovalComment';
  approvalId: Scalars['ID']['output'];
  authorAgentId: Maybe<Scalars['ID']['output']>;
  authorUserId: Maybe<Scalars['ID']['output']>;
  body: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  projectId: Scalars['ID']['output'];
}

/** Lifecycle state of an approval. PENDING/REVISION_REQUESTED are mutable; APPROVED/REJECTED/CANCELLED are terminal. */
export enum MnApprovalStatus {
  APPROVED = 'APPROVED',
  CANCELLED = 'CANCELLED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
}

/** Kind of approval request — hire-an-agent, mark-task-complete, override-budget, board-approval, tool-call-review, or org-change. */
export enum MnApprovalType {
  AGENT_ORG_CHANGE = 'AGENT_ORG_CHANGE',
  APPROVE_TASK_COMPLETION = 'APPROVE_TASK_COMPLETION',
  BUDGET_OVERRIDE = 'BUDGET_OVERRIDE',
  HIRE_AGENT = 'HIRE_AGENT',
  REQUEST_BOARD_APPROVAL = 'REQUEST_BOARD_APPROVAL',
  TOOL_CALL_REVIEW = 'TOOL_CALL_REVIEW',
}

export interface MnBudget {
  __typename?: 'MnBudget';
  alertSent: Scalars['Boolean']['output'];
  capCents: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  hardStopEnabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  monthYear: Scalars['String']['output'];
  projectId: Maybe<Scalars['ID']['output']>;
  scopeId: Maybe<Scalars['ID']['output']>;
  scopeType: MnBudgetScope;
  spentCents: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
  warnThresholdPct: Scalars['Int']['output'];
  workspaceId: Scalars['ID']['output'];
}

export interface MnBudgetRollup {
  __typename?: 'MnBudgetRollup';
  capCents: Scalars['Int']['output'];
  monthYear: Scalars['String']['output'];
  projectId: Maybe<Scalars['ID']['output']>;
  scopeId: Maybe<Scalars['ID']['output']>;
  scopeType: MnBudgetScope;
  spentCents: Scalars['Int']['output'];
  /** Convenience: `Math.min(100, Math.floor(spent / cap * 100))`. 0 when capCents is 0. */
  utilizationPct: Scalars['Int']['output'];
}

/** Scope on which a budget cap is enforced. The enforcer walks task → goal → agent → project → workspace; first hard-stop hit wins. */
export enum MnBudgetScope {
  AGENT = 'AGENT',
  GOAL = 'GOAL',
  PROJECT = 'PROJECT',
  TASK = 'TASK',
  WORKSPACE = 'WORKSPACE',
}

export interface MnCeoConversation {
  __typename?: 'MnCeoConversation';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  lastResolutionKind: Maybe<MnCeoResolutionKind>;
  ownerUserId: Scalars['ID']['output'];
  title: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
}

/** M17 — typed resolution emitted by the CEO agent for a user turn. */
export enum MnCeoResolutionKind {
  APPROVAL_REQUESTED = 'APPROVAL_REQUESTED',
  BUDGET_QUERY = 'BUDGET_QUERY',
  DECISION_RECORDED = 'DECISION_RECORDED',
  NONE = 'NONE',
  PLAN_DRAFTED = 'PLAN_DRAFTED',
  STATUS_QUERY = 'STATUS_QUERY',
  TASK_CREATED = 'TASK_CREATED',
}

export interface MnCeoTurn {
  __typename?: 'MnCeoTurn';
  bodyMd: Scalars['String']['output'];
  conversationId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  resolutionKind: MnCeoResolutionKind;
  resolutionRefId: Maybe<Scalars['String']['output']>;
  role: MnCeoTurnRole;
}

/** M17 — speaker role on a CEO Chat turn. */
export enum MnCeoTurnRole {
  CEO_AGENT = 'CEO_AGENT',
  SYSTEM = 'SYSTEM',
  USER = 'USER',
}

export interface MnCostEvent {
  __typename?: 'MnCostEvent';
  agentId: Maybe<Scalars['ID']['output']>;
  billingCode: Maybe<Scalars['String']['output']>;
  costCents: Scalars['Int']['output'];
  goalId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  inputTokens: Scalars['Int']['output'];
  model: Scalars['String']['output'];
  occurredAt: Scalars['DateTime']['output'];
  outputTokens: Scalars['Int']['output'];
  projectId: Maybe<Scalars['ID']['output']>;
  provider: Scalars['String']['output'];
  taskId: Maybe<Scalars['ID']['output']>;
  workspaceId: Scalars['ID']['output'];
}

export interface MnCrmAccount {
  __typename?: 'MnCrmAccount';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  industry: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  notes: Maybe<Scalars['String']['output']>;
  ownerUserId: Maybe<Scalars['ID']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  website: Maybe<Scalars['String']['output']>;
  workspaceId: Scalars['ID']['output'];
}

export interface MnCrmActivity {
  __typename?: 'MnCrmActivity';
  accountId: Maybe<Scalars['ID']['output']>;
  body: Maybe<Scalars['String']['output']>;
  completedAt: Maybe<Scalars['DateTime']['output']>;
  contactId: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdByUserId: Scalars['ID']['output'];
  dealId: Maybe<Scalars['ID']['output']>;
  dueAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  subject: Maybe<Scalars['String']['output']>;
  type: MnCrmActivityType;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
}

/** CRM activity category. */
export enum MnCrmActivityType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  NOTE = 'NOTE',
  OTHER = 'OTHER',
}

export interface MnCrmContact {
  __typename?: 'MnCrmContact';
  accountId: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['DateTime']['output'];
  email: Maybe<Scalars['String']['output']>;
  firstName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastName: Maybe<Scalars['String']['output']>;
  ownerUserId: Maybe<Scalars['ID']['output']>;
  phone: Maybe<Scalars['String']['output']>;
  title: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
}

export interface MnCrmDeal {
  __typename?: 'MnCrmDeal';
  accountId: Maybe<Scalars['ID']['output']>;
  contactId: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['DateTime']['output'];
  currency: Maybe<Scalars['String']['output']>;
  expectedCloseAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  ownerUserId: Maybe<Scalars['ID']['output']>;
  probability: Maybe<Scalars['Int']['output']>;
  stageId: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
  value: Maybe<Scalars['Float']['output']>;
  workspaceId: Scalars['ID']['output'];
}

export interface MnCrmDealStage {
  __typename?: 'MnCrmDealStage';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  pipelineKey: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
  workspaceId: Scalars['ID']['output'];
}

/** M11 — Predicate kind for Definition of Done. Each kind has its own verifier path in MnOutcomeVerifierService. */
export enum MnDoDPredicateKind {
  CUSTOM = 'CUSTOM',
  DOC_EXISTS = 'DOC_EXISTS',
  EMBEDDING_SIMILARITY = 'EMBEDDING_SIMILARITY',
  URL_REACHABLE = 'URL_REACHABLE',
  WORK_PRODUCT_EXISTS = 'WORK_PRODUCT_EXISTS',
}

export interface MnDoDPredicateResult {
  __typename?: 'MnDoDPredicateResult';
  evidence: Maybe<Scalars['JSON']['output']>;
  kind: MnDoDPredicateKind;
  predicate: Scalars['JSON']['output'];
  reason: Maybe<Scalars['String']['output']>;
  satisfied: Scalars['Boolean']['output'];
}

export interface MnDoDVerificationResult {
  __typename?: 'MnDoDVerificationResult';
  hasDefinition: Scalars['Boolean']['output'];
  results: Array<MnDoDPredicateResult>;
  satisfied: Scalars['Boolean']['output'];
  taskId: Scalars['ID']['output'];
}

export interface MnExecutionRun {
  __typename?: 'MnExecutionRun';
  agentId: Maybe<Scalars['ID']['output']>;
  error: Maybe<Scalars['String']['output']>;
  finishedAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  startedAt: Scalars['DateTime']['output'];
  status: MnExecutionRunStatus;
  taskId: Scalars['ID']['output'];
}

/** M7 — Manut execution run lifecycle status. QUEUED → RUNNING → SUCCEEDED | FAILED | CANCELLED | TIMED_OUT. */
export enum MnExecutionRunStatus {
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  TIMED_OUT = 'TIMED_OUT',
}

export interface MnGoal {
  __typename?: 'MnGoal';
  createdAt: Scalars['DateTime']['output'];
  createdByUserId: Maybe<Scalars['ID']['output']>;
  description: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  level: MnGoalLevel;
  ownerAgentId: Maybe<Scalars['ID']['output']>;
  parentGoalId: Maybe<Scalars['ID']['output']>;
  projectId: Scalars['ID']['output'];
  status: MnGoalStatus;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
}

export interface MnGoalAncestryStep {
  __typename?: 'MnGoalAncestryStep';
  depth: Scalars['Int']['output'];
  goalId: Scalars['ID']['output'];
  level: MnGoalLevel;
  status: MnGoalStatus;
  title: Scalars['String']['output'];
}

/** Where in the strategy chain a goal sits. PROJECT > TEAM > AGENT > TASK. */
export enum MnGoalLevel {
  AGENT = 'AGENT',
  PROJECT = 'PROJECT',
  TASK = 'TASK',
  TEAM = 'TEAM',
}

/** Lifecycle state of a Manut goal. */
export enum MnGoalStatus {
  ACHIEVED = 'ACHIEVED',
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  PLANNED = 'PLANNED',
}

/** Manut work queue intake lifecycle status. */
export enum MnIntakeStatus {
  RECEIVED = 'RECEIVED',
  REJECTED = 'REJECTED',
  ROUTED = 'ROUTED',
}

export interface MnLearningCandidate {
  __typename?: 'MnLearningCandidate';
  /** The proposed playbook body in Markdown. Includes the mn-learning-candidate marker block as a trailing HTML comment so a round-trip back into the candidate list stays deterministic. */
  body: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  /** Short summary of the playbook body. Mirrors MnSkill.description so an approving operator can scan the list without opening every row. */
  description: Maybe<Scalars['String']['output']>;
  /** The underlying MnSkill.id of the candidate row. Approving / rejecting a candidate operates on this id. */
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  slug: Scalars['String']['output'];
  source: MnSkillSource;
  /** Task id that triggered this extraction. SetNull on task delete so a candidate survives the task being purged. Surfaces as null when the source task is no longer resolvable. */
  sourceTaskId: Maybe<Scalars['String']['output']>;
  status: MnLearningCandidateStatus;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
}

/** Lifecycle state for an auto-extracted playbook. PENDING means awaiting operator review; APPROVED means promoted to a real skill (the row remains source=IMPORTED to preserve provenance); REJECTED means archived without promotion. */
export enum MnLearningCandidateStatus {
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
}

/** Kind of memory row. FACT is a statement of truth; DECISION is a recorded choice future runs should respect; OBSERVATION is a free-form note; PLAYBOOK is a reusable runbook fragment. */
export enum MnMemoryKind {
  DECISION = 'DECISION',
  FACT = 'FACT',
  OBSERVATION = 'OBSERVATION',
  PLAYBOOK = 'PLAYBOOK',
}

/** Outbound notification channel for a reminder. */
export enum MnNotificationChannel {
  EMAIL = 'EMAIL',
}

export interface MnOrgChange {
  __typename?: 'MnOrgChange';
  appliedAt: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  decidedAt: Maybe<Scalars['DateTime']['output']>;
  decidedByUserId: Maybe<Scalars['ID']['output']>;
  decisionNote: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  payload: Scalars['JSONObject']['output'];
  projectId: Scalars['ID']['output'];
  proposedByAgentId: Maybe<Scalars['ID']['output']>;
  rationale: Scalars['String']['output'];
  status: MnOrgChangeStatus;
  type: MnOrgChangeType;
  workspaceId: Scalars['ID']['output'];
}

/** Lifecycle state of an org-change proposal: PROPOSED -> APPROVED|REJECTED -> APPLIED -> REVERTED. */
export enum MnOrgChangeStatus {
  APPLIED = 'APPLIED',
  APPROVED = 'APPROVED',
  PROPOSED = 'PROPOSED',
  REJECTED = 'REJECTED',
  REVERTED = 'REVERTED',
}

/** Kind of structural change proposed by an agent: role adjustment, delegation change, new routine, hire proposal, reporting change, or capability grant. */
export enum MnOrgChangeType {
  AGENT_HIRE_PROPOSAL = 'AGENT_HIRE_PROPOSAL',
  CAPABILITY_GRANT = 'CAPABILITY_GRANT',
  DELEGATION_CHANGE = 'DELEGATION_CHANGE',
  NEW_ROUTINE = 'NEW_ROUTINE',
  REPORTING_CHANGE = 'REPORTING_CHANGE',
  ROLE_ADJUSTMENT = 'ROLE_ADJUSTMENT',
}

export interface MnPlugin {
  __typename?: 'MnPlugin';
  createdAt: Scalars['DateTime']['output'];
  enabledAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  installedAt: Scalars['DateTime']['output'];
  manifestJson: Scalars['JSON']['output'];
  name: Scalars['String']['output'];
  packagePath: Maybe<Scalars['String']['output']>;
  processStatus: MnPluginStatus;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['String']['output'];
}

export interface MnPluginConfig {
  __typename?: 'MnPluginConfig';
  configJson: Scalars['JSON']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  pluginId: Scalars['ID']['output'];
  projectId: Maybe<Scalars['ID']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

/** Lifecycle status of an installed plugin: INSTALLED (manifest in DB, not yet enabled), LOADING (spawning), RUNNING (worker alive), CRASHED (supervisor parked it after N restart failures), DISABLED (operator paused it). */
export enum MnPluginStatus {
  CRASHED = 'CRASHED',
  DISABLED = 'DISABLED',
  INSTALLED = 'INSTALLED',
  LOADING = 'LOADING',
  RUNNING = 'RUNNING',
}

export interface MnProject {
  __typename?: 'MnProject';
  createdAt: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
  status: MnProjectStatus;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
}

/** Lifecycle state of a Manut project. */
export enum MnProjectStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export interface MnReleaseRun {
  __typename?: 'MnReleaseRun';
  actor: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deployUrl: Maybe<Scalars['String']['output']>;
  generatedAt: Maybe<Scalars['DateTime']['output']>;
  /** GitHub Actions run identifier (workflow.runId from the handover). */
  ghRunId: Scalars['String']['output'];
  ghRunUrl: Maybe<Scalars['String']['output']>;
  headSha: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  imageDigest: Maybe<Scalars['String']['output']>;
  imageTag: Maybe<Scalars['String']['output']>;
  mode: Scalars['String']['output'];
  registry: Maybe<Scalars['String']['output']>;
  shortSha: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  tasks: Array<MnReleaseTask>;
  updatedAt: Scalars['DateTime']['output'];
  version: Maybe<Scalars['String']['output']>;
  workspaceId: Scalars['ID']['output'];
}

export interface MnReleaseTask {
  __typename?: 'MnReleaseTask';
  id: Scalars['ID']['output'];
  /** Human-readable label copied verbatim from the handover taskTree. */
  label: Scalars['String']['output'];
  runId: Scalars['ID']['output'];
  /** Stable slug for the task (build, verify, deploy, observe, document). */
  slug: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
}

export interface MnReminder {
  __typename?: 'MnReminder';
  body: Maybe<Scalars['String']['output']>;
  channel: MnNotificationChannel;
  completedAt: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  fireAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  relatedEntityId: Maybe<Scalars['String']['output']>;
  relatedEntityType: Maybe<Scalars['String']['output']>;
  ruleId: Maybe<Scalars['ID']['output']>;
  status: MnReminderStatus;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
  workspaceId: Scalars['ID']['output'];
}

export interface MnReminderRule {
  __typename?: 'MnReminderRule';
  config: Scalars['JSONObject']['output'];
  createdAt: Scalars['DateTime']['output'];
  createdByUserId: Scalars['ID']['output'];
  cronExpression: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  lastEvaluatedAt: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  nextRunAt: Maybe<Scalars['DateTime']['output']>;
  timezone: Maybe<Scalars['String']['output']>;
  trigger: MnReminderRuleTrigger;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
}

/** When a reminder rule fires: cron-driven (DATETIME) or event-driven (OVERDUE_TASK, INACTIVITY, UPCOMING_DEADLINE). v0 surfaces only DATETIME in the UI. */
export enum MnReminderRuleTrigger {
  DATETIME = 'DATETIME',
  INACTIVITY = 'INACTIVITY',
  OVERDUE_TASK = 'OVERDUE_TASK',
  UPCOMING_DEADLINE = 'UPCOMING_DEADLINE',
}

/** Manut reminder lifecycle. */
export enum MnReminderStatus {
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PROCESSING = 'PROCESSING',
  SCHEDULED = 'SCHEDULED',
}

export interface MnSkill {
  __typename?: 'MnSkill';
  archivedAt: Maybe<Scalars['DateTime']['output']>;
  contentMd: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  slug: Scalars['String']['output'];
  source: MnSkillSource;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['String']['output'];
  workspaceId: Scalars['ID']['output'];
}

/** Provenance of an MnSkill row. BUILTIN is reserved for seed skills, WORKSPACE is created by an end user, and IMPORTED was created by the AGENTS.md import flow (Branch B / M5.2). */
export enum MnSkillSource {
  BUILTIN = 'BUILTIN',
  IMPORTED = 'IMPORTED',
  WORKSPACE = 'WORKSPACE',
}

export interface MnTask {
  __typename?: 'MnTask';
  assigneeUserId: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdByUserId: Maybe<Scalars['ID']['output']>;
  description: Maybe<Scalars['String']['output']>;
  dueAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  listSortOrder: Scalars['Int']['output'];
  priority: MnTaskPriority;
  projectId: Scalars['ID']['output'];
  status: MnTaskStatus;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
}

export interface MnTaskAncestry {
  __typename?: 'MnTaskAncestry';
  goalChain: Array<MnGoalAncestryStep>;
  taskAncestors: Array<MnTaskAncestryStep>;
  taskId: Scalars['ID']['output'];
  taskTitle: Scalars['String']['output'];
}

export interface MnTaskAncestryStep {
  __typename?: 'MnTaskAncestryStep';
  depth: Scalars['Int']['output'];
  taskId: Scalars['ID']['output'];
  title: Scalars['String']['output'];
}

export interface MnTaskBlocker {
  __typename?: 'MnTaskBlocker';
  blockedByTaskId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  projectId: Scalars['ID']['output'];
  taskId: Scalars['ID']['output'];
}

export interface MnTaskCheckoutResult {
  __typename?: 'MnTaskCheckoutResult';
  acquired: Scalars['Boolean']['output'];
  executionLockedAt: Maybe<Scalars['DateTime']['output']>;
  executionRunId: Maybe<Scalars['ID']['output']>;
  taskId: Maybe<Scalars['ID']['output']>;
}

export interface MnTaskPlan {
  __typename?: 'MnTaskPlan';
  authorAgentId: Maybe<Scalars['ID']['output']>;
  authorUserId: Maybe<Scalars['ID']['output']>;
  bodyMd: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  reviewerComments: Scalars['JSON']['output'];
  revisionNumber: Scalars['Int']['output'];
  status: MnTaskPlanStatus;
  taskId: Scalars['ID']['output'];
}

/** M13 — Reviewer decision discriminator. APPROVE moves UNDER_REVIEW → APPROVED and supersedes prior APPROVED revisions; REJECT moves UNDER_REVIEW → REJECTED. */
export enum MnTaskPlanDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

/** M13 — Plan lifecycle state. DRAFT and UNDER_REVIEW are the only mutable states; APPROVED, REJECTED, and SUPERSEDED are terminal. */
export enum MnTaskPlanStatus {
  APPROVED = 'APPROVED',
  DRAFT = 'DRAFT',
  REJECTED = 'REJECTED',
  SUPERSEDED = 'SUPERSEDED',
  UNDER_REVIEW = 'UNDER_REVIEW',
}

/** Manut task priority. */
export enum MnTaskPriority {
  HIGH = 'HIGH',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  NONE = 'NONE',
  URGENT = 'URGENT',
}

/** Manut task workflow state. */
export enum MnTaskStatus {
  BACKLOG = 'BACKLOG',
  CANCELLED = 'CANCELLED',
  DONE = 'DONE',
  IN_PROGRESS = 'IN_PROGRESS',
  TODO = 'TODO',
}

export interface MnWorkProduct {
  __typename?: 'MnWorkProduct';
  byteSize: Maybe<Scalars['Int']['output']>;
  createdAt: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  kind: MnWorkProductKind;
  metadata: Scalars['JSONObject']['output'];
  producedByAgentId: Maybe<Scalars['ID']['output']>;
  projectId: Scalars['ID']['output'];
  ref: Scalars['String']['output'];
  taskId: Scalars['ID']['output'];
  title: Maybe<Scalars['String']['output']>;
  workspaceId: Scalars['ID']['output'];
}

/** Kind of work product. DOC is an internal BlockSuite doc, FILE is a blob in object storage, URL is an external link, PR is a pull request, DEPLOYMENT is an environment rollout, CSV is a data export, SCREENSHOT is an image attachment. Free-form `metadata` JSON carries per-kind detail. */
export enum MnWorkProductKind {
  CSV = 'CSV',
  DEPLOYMENT = 'DEPLOYMENT',
  DOC = 'DOC',
  FILE = 'FILE',
  PR = 'PR',
  SCREENSHOT = 'SCREENSHOT',
  URL = 'URL',
}

export interface MnWorkQueue {
  __typename?: 'MnWorkQueue';
  createdAt: Scalars['DateTime']['output'];
  defaultAssigneeAgentId: Maybe<Scalars['ID']['output']>;
  defaultPriority: MnTaskPriority;
  description: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  intakeWebhookToken: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  projectId: Scalars['ID']['output'];
  routingRulesJson: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
}

export interface MnWorkQueueIntake {
  __typename?: 'MnWorkQueueIntake';
  externalRef: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  payloadJson: Scalars['String']['output'];
  queueId: Scalars['ID']['output'];
  receivedAt: Scalars['DateTime']['output'];
  routedToTaskId: Maybe<Scalars['ID']['output']>;
  status: MnIntakeStatus;
}

export interface MongoCollectionInfo {
  __typename?: 'MongoCollectionInfo';
  consecutiveFailures: Maybe<Scalars['Int']['output']>;
  cursorField: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  estimatedCount: Maybe<Scalars['Int']['output']>;
  lastError: Maybe<Scalars['String']['output']>;
  lastErrorAt: Maybe<Scalars['DateTime']['output']>;
  lastSyncedAt: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
}

export interface MongoDbConnectionInputType {
  uri: Scalars['String']['input'];
}

export interface MongoDbConnectionTestResultType {
  __typename?: 'MongoDbConnectionTestResultType';
  database: Maybe<Scalars['String']['output']>;
  error: Maybe<Scalars['String']['output']>;
  host: Maybe<Scalars['String']['output']>;
  ok: Scalars['Boolean']['output'];
  pingMs: Maybe<Scalars['Int']['output']>;
}

export interface MongoDbConnectionType {
  __typename?: 'MongoDbConnectionType';
  connected: Scalars['Boolean']['output'];
  database: Maybe<Scalars['String']['output']>;
  host: Maybe<Scalars['String']['output']>;
}

export interface MongoIngestionConfig {
  __typename?: 'MongoIngestionConfig';
  collectionName: Scalars['String']['output'];
  consecutiveFailures: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  cursorField: Scalars['String']['output'];
  enabled: Scalars['Boolean']['output'];
  id: Scalars['String']['output'];
  lastCursorValue: Maybe<Scalars['String']['output']>;
  lastError: Maybe<Scalars['String']['output']>;
  lastErrorAt: Maybe<Scalars['DateTime']['output']>;
  lastSyncedAt: Maybe<Scalars['DateTime']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface MongoSampleDocs {
  __typename?: 'MongoSampleDocs';
  collectionName: Scalars['String']['output'];
  documents: Array<Scalars['String']['output']>;
}

export interface Mutation {
  __typename?: 'Mutation';
  abortBlobUpload: Scalars['Boolean']['output'];
  acceptInviteById: Scalars['Boolean']['output'];
  /** Mark an AI insight as acknowledged by the current user. */
  acknowledgeInsight: SocialInsight;
  activateLicense: License;
  addAgentFile: Agent;
  addAgentLink: Agent;
  addAgentSkill: Agent;
  /** add a blob to context */
  addContextBlob: CopilotContextBlob;
  /** add a category to context */
  addContextCategory: CopilotContextCategory;
  /** add a doc to context */
  addContextDoc: CopilotContextDoc;
  /** add a file to context */
  addContextFile: CopilotContextFile;
  addMnCeoTurn: MnCeoTurn;
  /** Mark one task as blocked by another. Rejects self-block. */
  addMnTaskBlocker: MnTaskBlocker;
  /** Update workspace embedding files */
  addWorkspaceEmbeddingFiles: CopilotWorkspaceFile;
  addWorkspaceFeature: Scalars['Boolean']['output'];
  /** Update workspace flags and features for admin */
  adminUpdateWorkspace: Maybe<AdminWorkspace>;
  /** Apply updates to a doc using LLM and return the merged markdown. */
  applyDocUpdates: Scalars['String']['output'];
  /** Execute an APPROVED change. Mutates the underlying tables (e.g. updates MnAgent.reportsToAgentId for DELEGATION_CHANGE, creates an MnRoutine row for NEW_ROUTINE) and transitions to APPLIED. Captures priorState onto the payload so revert() can undo if needed. */
  applyMnOrgChange: MnOrgChange;
  approveMember: Scalars['Boolean']['output'];
  /** Approve a candidate playbook. The underlying MnSkill row remains source=IMPORTED so provenance (auto-extracted vs hand-authored) is preserved forever. Returns the updated candidate. */
  approveMnLearningCandidate: MnLearningCandidate;
  archiveMnProject: MnProject;
  /** Archive a skill (soft delete). Archived skills are hidden from the default list but preserved so existing references keep resolving. */
  archiveMnSkill: MnSkill;
  archiveMnWorkQueue: MnWorkQueue;
  /** Assign or re-assign a task. XOR — at most one of { userId, agentId } may be non-null. Both null clears assignees. */
  assignMnTask: Scalars['Boolean']['output'];
  backfillAnalytics: Scalars['Int']['output'];
  /** Ban an user */
  banUser: UserType;
  /** Begin OAuth handshake for a platform. Returns the authorization URL the client must navigate to. */
  beginPlatformConnect: BeginOAuthResult;
  /** Bind the given chat session to a task so its messages get GOAL CONTEXT injected on the next turn. Pass null to unbind. */
  bindAiSessionToTask: Scalars['Boolean']['output'];
  cancelMnReminder: MnReminder;
  /** Discard a pending Meta OAuth picker session without binding any account. */
  cancelPlatformConnect: Scalars['Boolean']['output'];
  cancelSubscription: SubscriptionType;
  changeEmail: UserType;
  changePassword: Scalars['Boolean']['output'];
  claimAudioTranscription: Maybe<TranscriptionResultType>;
  /** Cleanup sessions */
  cleanupCopilotSession: Array<Scalars['String']['output']>;
  completeBlobUpload: Scalars['String']['output'];
  connectFacebook: FacebookConnectAuthUrl;
  connectFigma: FigmaConnectAuthUrl;
  connectGithub: GithubConnectAuthUrl;
  connectGoogle: GoogleConnectAuthUrl;
  connectInstagram: InstagramConnectAuthUrl;
  connectLineVoom: LineVoomConnectAuthUrl;
  connectLinear: LinearConnectAuthUrl;
  connectSlack: SlackConnectAuthUrl;
  connectThreads: ThreadsConnectAuthUrl;
  connectTiktok: TiktokConnectAuthUrl;
  createAgent: Agent;
  createBlobUpload: BlobUploadInit;
  /** Create change password url */
  createChangePasswordUrl: Scalars['String']['output'];
  /** Create a subscription checkout link of stripe */
  createCheckoutSession: Scalars['String']['output'];
  createComment: CommentObjectType;
  /** Create a context session */
  createCopilotContext: Scalars['String']['output'];
  /** Create a chat message */
  createCopilotMessage: Scalars['String']['output'];
  /**
   * Create a chat session
   * @deprecated use `createCopilotSessionWithHistory` instead
   */
  createCopilotSession: Scalars['String']['output'];
  /** Create a chat session and return full session payload */
  createCopilotSessionWithHistory: CopilotHistories;
  /** Create a stripe customer portal to manage payment methods */
  createCustomerPortal: Scalars['String']['output'];
  createInviteLink: InviteLink;
  /** Open a Stripe Checkout Session that upgrades the workspace to Manut Pro. Returns the absolute checkout URL — the frontend redirects via `window.location.assign(checkoutUrl)`. Requires Workspace.Settings.Update. */
  createManutProCheckoutSession: Scalars['String']['output'];
  /** Create a new agent. Requires Workspace.Settings.Update. */
  createMnAgent: MnAgent;
  /** Create a new PENDING approval. Requires Workspace.Settings.Update. */
  createMnApproval: MnApproval;
  /** Add a comment to an approval thread. */
  createMnApprovalComment: MnApprovalComment;
  /** Create a new budget. Requires Workspace.Settings.Update. */
  createMnBudget: MnBudget;
  createMnCeoConversation: MnCeoConversation;
  createMnCrmAccount: MnCrmAccount;
  createMnCrmActivity: MnCrmActivity;
  createMnCrmContact: MnCrmContact;
  createMnCrmDeal: MnCrmDeal;
  createMnCrmDealStage: MnCrmDealStage;
  /** Create a goal. Requires Workspace.Settings.Update. */
  createMnGoal: MnGoal;
  createMnProject: MnProject;
  createMnReminder: MnReminder;
  /** Create a reminder rule. Requires Workspace.Settings.Update. */
  createMnReminderRule: MnReminderRule;
  /** Create a new skill. Requires Workspace.Settings.Update. Slug must be unique within the workspace. */
  createMnSkill: MnSkill;
  createMnTask: MnTask;
  /** M13 — create a new DRAFT revision for a task. The service auto-increments revisionNumber inside a transaction so concurrent creates produce distinct revisions. */
  createMnTaskPlan: MnTaskPlan;
  /** Create a new work product attached to a task. Requires Workspace.Settings.Update. The task and (optional) producer agent must live in the same workspace as the caller — cross-workspace attachment is rejected with Forbidden. */
  createMnWorkProduct: MnWorkProduct;
  createMnWorkQueue: MnWorkQueue;
  createReply: ReplyObjectType;
  createSelfhostWorkspaceCustomerPortal: Scalars['String']['output'];
  /** Create a new user */
  createUser: UserType;
  /** Create a new workspace */
  createWorkspace: WorkspaceType;
  deactivateLicense: Scalars['Boolean']['output'];
  /** Decide an approval (APPROVED / REJECTED / CANCELLED / REVISION_REQUESTED). Terminal-state approvals are immutable. */
  decideMnApproval: MnApproval;
  /** Decide a PROPOSED change (APPROVED or REJECTED). Mirrors the decision onto the sibling MnApproval row. */
  decideMnOrgChange: MnOrgChange;
  /** M13 — APPROVE or REJECT an UNDER_REVIEW plan. APPROVE supersedes any prior APPROVED revision on the same task in the same transaction so the "current plan" invariant holds. Both decisions append an audit entry to reviewerComments. */
  decideMnTaskPlan: MnTaskPlan;
  deleteAccount: DeleteAccount;
  deleteAgent: Scalars['Boolean']['output'];
  deleteBlob: Scalars['Boolean']['output'];
  /** Delete a comment */
  deleteComment: Scalars['Boolean']['output'];
  /** Delete an agent. Cascades to API keys and heartbeat runs. */
  deleteMnAgent: Scalars['Boolean']['output'];
  /** Delete a memory row. Requires Workspace.Settings.Update. Returns true on success; throws NotFound when the row is missing or belongs to another workspace. */
  deleteMnAgentMemory: Scalars['Boolean']['output'];
  /** Delete a budget. Cost events are preserved. */
  deleteMnBudget: Scalars['Boolean']['output'];
  /** Delete a goal. Linked tasks survive (goalId set to null). */
  deleteMnGoal: Scalars['Boolean']['output'];
  /** Delete a reminder rule. Pending reminders generated by the rule are kept (the FK is nullable on MnReminder.ruleId). Requires Workspace.Settings.Update. */
  deleteMnReminderRule: Scalars['Boolean']['output'];
  deleteMnTask: Scalars['Boolean']['output'];
  /** Delete a work product registry row. Does NOT delete the underlying artifact (doc / PR / file) — those are owned by their source-of- truth system. Requires Workspace.Settings.Update. */
  deleteMnWorkProduct: Scalars['Boolean']['output'];
  deleteMongoIngestionConfig: Scalars['Boolean']['output'];
  /** Delete a reply */
  deleteReply: Scalars['Boolean']['output'];
  /** Delete a user account */
  deleteUser: DeleteAccount;
  deleteWorkspace: Scalars['Boolean']['output'];
  /** M12 — disable MAXIMIZER MODE on an agent and revert the dispatch path to upstream behavior. Requires Workspace.Settings.Update. */
  disableMnAgentMaximizer: MnAgentMaximizerToggleResult;
  /** Disable a plugin: terminate the worker process and mark DISABLED. Pending RPC calls reject with rpc_disposed. */
  disableMnPlugin: MnPlugin;
  disconnectFacebook: Scalars['Boolean']['output'];
  disconnectFigma: Scalars['Boolean']['output'];
  disconnectGithub: Scalars['Boolean']['output'];
  disconnectGoGoCash: Scalars['Boolean']['output'];
  disconnectGoogle: Scalars['Boolean']['output'];
  disconnectInstagram: Scalars['Boolean']['output'];
  disconnectLineVoom: Scalars['Boolean']['output'];
  disconnectLinear: Scalars['Boolean']['output'];
  disconnectMongoDb: Scalars['Boolean']['output'];
  /** Disconnect a platform from the workspace (soft-delete). */
  disconnectPlatform: Scalars['Boolean']['output'];
  disconnectPostHog: Scalars['Boolean']['output'];
  disconnectProvider: Scalars['Boolean']['output'];
  disconnectSlack: Scalars['Boolean']['output'];
  disconnectThreads: Scalars['Boolean']['output'];
  disconnectTiktok: Scalars['Boolean']['output'];
  /** M12 — enable MAXIMIZER MODE on an agent. While on, the dispatch orchestrator auto-delegates capability-matched calls to subordinates, batches the rest into 10-call heartbeat groups, forces approval for any call costing >50% of remaining monthly budget, and runs full M11 outcome verification on every DONE transition. Requires Workspace.Settings.Update. */
  enableMnAgentMaximizer: MnAgentMaximizerToggleResult;
  /** Enable a plugin: flip its status to LOADING and spawn the worker process. Idempotent for an already-running plugin. */
  enableMnPlugin: MnPlugin;
  /** Reenable an banned user */
  enableUser: UserType;
  /** Complete a multi-account Meta OAuth flow by binding the chosen page / IG biz / Threads profile. */
  finalizePlatformConnect: SocialConnection;
  /** Hard-delete a memory the AI has stored about the user. */
  forgetMemory: Scalars['Boolean']['output'];
  /** Create a chat session */
  forkCopilotSession: Scalars['String']['output'];
  generateLicenseKey: Scalars['String']['output'];
  generateUserAccessToken: RevealedAccessToken;
  grantDocUserRoles: Scalars['Boolean']['output'];
  grantMember: Scalars['Boolean']['output'];
  /** Imports a Gmail message as a new doc. Returns the new doc ID. */
  importGmailMessage: Scalars['String']['output'];
  /** Import a Manut release handover JSON payload into a workspace doc. */
  importMnHandover: ImportMnHandoverResult;
  /** import users */
  importUsers: Array<UserImportResultType>;
  installLicense: License;
  /** Install a plugin from npm by package name + version. Runs `npm install` under the instance plugin directory, validates the declared manifest, and persists an MnPlugin row in INSTALLED status. */
  installMnPlugin: MnPlugin;
  inviteMembers: Array<InviteResult>;
  leaveWorkspace: Scalars['Boolean']['output'];
  linkCalDAVAccount: CalendarAccountObjectType;
  linkCalendarAccount: Scalars['String']['output'];
  /** M7 — mark an MnExecutionRun row as complete. `status` must be terminal (SUCCEEDED / FAILED / CANCELLED / TIMED_OUT). */
  markMnExecutionRunComplete: MnExecutionRun;
  /** mention user in a doc */
  mentionUser: Scalars['ID']['output'];
  /** Mint a new API key. The plaintext is shown ONCE in the response and is never recoverable from the server again. */
  mintMnAgentApiKey: MintedMnAgentApiKey;
  /** Toggle the pinned flag on a memory. Pinned memories surface ahead of unpinned ones during AI recall. */
  pinMemory: Memory;
  /** Promote a personal (user-scope) memory to workspace-scope so any member can recall it. */
  promoteMemoryToWorkspace: Memory;
  /** Propose a structural change. Creates a PROPOSED MnOrgChange row AND a sibling PENDING MnApproval (type=AGENT_ORG_CHANGE) linked via payload.orgChangeId so the existing inbox / SSE surface gates the human decision. */
  proposeMnOrgChange: MnOrgChange;
  publishDoc: DocType;
  /** queue workspace doc embedding */
  queueWorkspaceEmbedding: Scalars['Boolean']['output'];
  /** Record a user 👍/👎 rating on an assistant chat message. Stored as an OBSERVATION memory tagged feedback:positive|negative. */
  rateMessage: Scalars['Boolean']['output'];
  /** mark all notifications as read */
  readAllNotifications: Scalars['Boolean']['output'];
  /** mark notification as read */
  readNotification: Scalars['Boolean']['output'];
  recoverDoc: Scalars['DateTime']['output'];
  /** Refresh current user subscriptions and return latest. */
  refreshUserSubscriptions: Array<SubscriptionType>;
  /** Reject a candidate playbook. Archives the row AND rewrites the embedded marker to status=rejected so the audit trail survives. */
  rejectMnLearningCandidate: MnLearningCandidate;
  releaseDeletedBlobs: Scalars['Boolean']['output'];
  /** M7 — release a task checkout. No-op if `runId` does not match the current holder (security: stale processes cannot clobber fresh executions). */
  releaseMnTaskCheckout: Scalars['Boolean']['output'];
  removeAgentFile: Agent;
  removeAgentLink: Agent;
  removeAgentSkill: Agent;
  /** Remove user avatar */
  removeAvatar: RemoveAvatar;
  /** remove a blob from context */
  removeContextBlob: Scalars['Boolean']['output'];
  /** remove a category from context */
  removeContextCategory: Scalars['Boolean']['output'];
  /** remove a doc from context */
  removeContextDoc: Scalars['Boolean']['output'];
  /** remove a file from context */
  removeContextFile: Scalars['Boolean']['output'];
  /** Remove a task blocker edge. No-op when the edge is gone. */
  removeMnTaskBlocker: Scalars['Boolean']['output'];
  /** Remove workspace embedding files */
  removeWorkspaceEmbeddingFiles: Scalars['Boolean']['output'];
  removeWorkspaceFeature: Scalars['Boolean']['output'];
  /** Request to apply the subscription in advance */
  requestApplySubscription: Array<SubscriptionType>;
  /** Resolve a comment or not */
  resolveComment: Scalars['Boolean']['output'];
  resolveMnCeoTurn: MnCeoTurn;
  /** Restore an archived skill so it shows in default lists again. */
  restoreMnSkill: MnSkill;
  resumeSubscription: SubscriptionType;
  retryAudioTranscription: Maybe<TranscriptionResultType>;
  /** Reverse an APPLIED change when reversibility is possible. Restores underlying tables from payload.priorState; transitions to REVERTED. */
  revertMnOrgChange: MnOrgChange;
  resendInvite: Scalars['Boolean']['output'];
  revokeDocUserRoles: Scalars['Boolean']['output'];
  revokeInviteLink: Scalars['Boolean']['output'];
  revokeMember: Scalars['Boolean']['output'];
  /** Soft-revoke an API key. Idempotent — re-revoking a revoked key returns the existing row unchanged. */
  revokeMnAgentApiKey: MnAgentApiKey;
  revokePublicDoc: DocType;
  revokeUserAccessToken: Scalars['Boolean']['output'];
  rotateMnWorkQueueToken: MnWorkQueue;
  /** Run the on-demand Content Recommendation prompt — gemini-2.5-flash, ~3K in / 0.5K out. */
  runContentRecommendation: SocialInsight;
  /** Seed additional starter docs derived from the /welcome onboarding wizard answers. */
  seedWorkspaceFromWizard: Scalars['Boolean']['output'];
  sendChangeEmail: Scalars['Boolean']['output'];
  sendChangePasswordEmail: Scalars['Boolean']['output'];
  sendSetPasswordEmail: Scalars['Boolean']['output'];
  sendTestEmail: Scalars['Boolean']['output'];
  sendVerifyChangeEmail: Scalars['Boolean']['output'];
  sendVerifyEmail: Scalars['Boolean']['output'];
  setBlob: Scalars['String']['output'];
  setGoGoCashConnection: GoGoCashConnectionType;
  /** M11 — set or clear the Definition of Done predicate list for a task. Pass `predicates: null` (or an empty array) to remove the transition guard. Returns the freshly verified outcome so the UI can render predicate-by-predicate status immediately after save. */
  setMnTaskDefinitionOfDone: MnDoDVerificationResult;
  /** Set or clear a task parent. Rejects self-parent, cycles, and chains deeper than the configured cap. */
  setMnTaskParent: Scalars['Boolean']['output'];
  setMongoDbConnection: MongoDbConnectionType;
  setMongoIngestionConfig: MongoIngestionConfig;
  setPostHogConnection: PostHogConnectionType;
  /** Store a new memory row. Requires Workspace.Settings.Update. */
  storeMnAgentMemory: MnAgentMemory;
  submitAudioTranscription: Maybe<TranscriptionResultType>;
  /** Resubmit a REVISION_REQUESTED approval. Optionally overwrites the payload with the revised version. Status returns to PENDING. */
  submitMnApprovalRevision: MnApproval;
  /** M13 — move a DRAFT plan to UNDER_REVIEW. Idempotent on already-UNDER_REVIEW plans is NOT supported — the service rejects any source state other than DRAFT to keep the state machine honest. */
  submitMnTaskPlanForReview: MnTaskPlan;
  testMongoDbConnection: MongoDbConnectionTestResultType;
  testPostHogConnection: PostHogConnectionTestResultType;
  /** Trigger cleanup of trashed doc embeddings */
  triggerCleanupTrashedDocEmbeddings: Scalars['Boolean']['output'];
  /** Trigger generate missing titles cron job */
  triggerGenerateTitleCron: Scalars['Boolean']['output'];
  /** On-demand trigger: extract a candidate playbook from the given task. In M16.1 this is the only way to start an extraction — the auto-on-DONE wiring is deferred to a follow-up so MnTask service stays untouched. */
  triggerLearningExtractionForTask: MnLearningCandidate;
  /** M7 — atomically claim the execution lock on a task. Returns `acquired=true` plus updated lock metadata on success; `acquired=false` when another caller holds a non-stale lock. */
  tryCheckoutMnTask: MnTaskCheckoutResult;
  /** Uninstall a plugin: disables it if running, deletes the MnPlugin row, and leaves the on-disk package directory in place so an operator can audit it. Returns true on success. */
  uninstallMnPlugin: Scalars['Boolean']['output'];
  unlinkCalendarAccount: Scalars['Boolean']['output'];
  unverifyDoc: Scalars['Boolean']['output'];
  updateAgent: Agent;
  /** Update an agent role. The slug is immutable; only displayName, adapter, responsibility, and escalation can be edited. */
  updateAgentRole: MnAgentRole;
  /** update app configuration */
  updateAppConfig: Scalars['JSONObject']['output'];
  updateCalendarAccount: Maybe<CalendarAccountObjectType>;
  /** Update a comment content */
  updateComment: Scalars['Boolean']['output'];
  /** Update a chat session */
  updateCopilotSession: Scalars['String']['output'];
  updateDocDefaultRole: Scalars['Boolean']['output'];
  updateDocUserRole: Scalars['Boolean']['output'];
  /** Patch editable fields on an agent. TERMINATED agents cannot be resumed; updating them is rejected. */
  updateMnAgent: MnAgent;
  /** Update editable fields on a budget. Resets alertSent if cap is raised. */
  updateMnBudget: MnBudget;
  updateMnCrmAccount: MnCrmAccount;
  updateMnCrmActivity: MnCrmActivity;
  updateMnCrmContact: MnCrmContact;
  updateMnCrmDeal: MnCrmDeal;
  updateMnCrmDealStage: MnCrmDealStage;
  /** Patch an existing goal. Terminal statuses (ACHIEVED, CANCELLED) cannot be flipped back. Requires Workspace.Settings.Update. */
  updateMnGoal: MnGoal;
  updateMnProject: MnProject;
  /** Update a reminder rule. The trigger field is immutable after create. Requires Workspace.Settings.Update on the rule's workspace. */
  updateMnReminderRule: MnReminderRule;
  /** Patch editable fields on a skill. The version-bump rule applies: editing contentMd without changing version is rejected. */
  updateMnSkill: MnSkill;
  updateMnTask: MnTask;
  updateMnTaskStatus: MnTask;
  updateMnWorkQueue: MnWorkQueue;
  /** Persist the user’s onboarding flag after the /welcome wizard finishes or is skipped. */
  updateOnboarding: UserType;
  updateProfile: UserType;
  /** Update a reply content */
  updateReply: Scalars['Boolean']['output'];
  /** Update user settings */
  updateSettings: Scalars['Boolean']['output'];
  updateSubscriptionRecurring: SubscriptionType;
  /** Update an user */
  updateUser: UserType;
  /** update user enabled feature */
  updateUserFeatures: Array<FeatureType>;
  /** Update workspace */
  updateWorkspace: WorkspaceType;
  updateWorkspaceCalendars: WorkspaceCalendarObjectType;
  /** Update ignored docs */
  updateWorkspaceEmbeddingIgnoredDocs: Scalars['Int']['output'];
  /** Upload user avatar */
  uploadAvatar: UserType;
  /** Upload a comment attachment and return the access url */
  uploadCommentAttachment: Scalars['String']['output'];
  /** Create or update the workspace-scoped (or project-scoped) plugin config row. The well-known `configJson.enabled` boolean is what the workspace UI toggle flips; other fields are passed through to plugin workers via the host RPC bridge. 16 KB hard cap on payload size. */
  upsertMnPluginConfig: MnPluginConfig;
  verifyDoc: Scalars['Boolean']['output'];
  verifyEmail: Scalars['Boolean']['output'];
}

export interface MutationAbortBlobUploadArgs {
  key: Scalars['String']['input'];
  uploadId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationAcceptInviteByIdArgs {
  inviteId: Scalars['String']['input'];
  sendAcceptMail?: InputMaybe<Scalars['Boolean']['input']>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationAcknowledgeInsightArgs {
  input: AcknowledgeInsightInput;
}

export interface MutationActivateLicenseArgs {
  license: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationAddAgentFileArgs {
  fileId: Scalars['String']['input'];
  id: Scalars['String']['input'];
}

export interface MutationAddAgentLinkArgs {
  id: Scalars['String']['input'];
  label?: InputMaybe<Scalars['String']['input']>;
  url: Scalars['String']['input'];
}

export interface MutationAddAgentSkillArgs {
  id: Scalars['String']['input'];
  skill: Scalars['String']['input'];
}

export interface MutationAddContextBlobArgs {
  options: AddContextBlobInput;
}

export interface MutationAddContextCategoryArgs {
  options: AddContextCategoryInput;
}

export interface MutationAddContextDocArgs {
  options: AddContextDocInput;
}

export interface MutationAddContextFileArgs {
  content: Scalars['Upload']['input'];
  options: AddContextFileInput;
}

export interface MutationAddMnCeoTurnArgs {
  input: AddMnCeoTurnInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationAddMnTaskBlockerArgs {
  input: AddMnTaskBlockerInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationAddWorkspaceEmbeddingFilesArgs {
  blob: Scalars['Upload']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationAddWorkspaceFeatureArgs {
  feature: FeatureType;
  workspaceId: Scalars['String']['input'];
}

export interface MutationAdminUpdateWorkspaceArgs {
  input: AdminUpdateWorkspaceInput;
}

export interface MutationApplyDocUpdatesArgs {
  docId: Scalars['String']['input'];
  op: Scalars['String']['input'];
  updates: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationApplyMnOrgChangeArgs {
  orgChangeId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationApproveMemberArgs {
  userId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationApproveMnLearningCandidateArgs {
  candidateId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationArchiveMnProjectArgs {
  projectId: Scalars['ID']['input'];
}

export interface MutationArchiveMnSkillArgs {
  skillId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationArchiveMnWorkQueueArgs {
  queueId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationAssignMnTaskArgs {
  assigneeAgentId?: InputMaybe<Scalars['ID']['input']>;
  assigneeUserId?: InputMaybe<Scalars['ID']['input']>;
  taskId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationBackfillAnalyticsArgs {
  daysBack: Scalars['Int']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationBanUserArgs {
  id: Scalars['String']['input'];
}

export interface MutationBeginPlatformConnectArgs {
  platform: SocialPlatform;
  workspaceId: Scalars['String']['input'];
}

export interface MutationBindAiSessionToTaskArgs {
  depth?: InputMaybe<Scalars['Int']['input']>;
  sessionId: Scalars['ID']['input'];
  taskId?: InputMaybe<Scalars['ID']['input']>;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationCancelMnReminderArgs {
  reminderId: Scalars['ID']['input'];
}

export interface MutationCancelPlatformConnectArgs {
  input: CancelPlatformConnectInput;
}

export interface MutationCancelSubscriptionArgs {
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  plan?: InputMaybe<SubscriptionPlan>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationChangeEmailArgs {
  email: Scalars['String']['input'];
  token: Scalars['String']['input'];
}

export interface MutationChangePasswordArgs {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationClaimAudioTranscriptionArgs {
  jobId: Scalars['String']['input'];
}

export interface MutationCleanupCopilotSessionArgs {
  options: DeleteSessionInput;
}

export interface MutationCompleteBlobUploadArgs {
  key: Scalars['String']['input'];
  parts?: InputMaybe<Array<BlobUploadPartInput>>;
  uploadId?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationConnectFacebookArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationConnectFigmaArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationConnectGithubArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationConnectGoogleArgs {
  scope: GoogleScope;
  workspaceId: Scalars['String']['input'];
}

export interface MutationConnectInstagramArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationConnectLineVoomArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationConnectLinearArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationConnectSlackArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationConnectThreadsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationConnectTiktokArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateAgentArgs {
  input: CreateAgentInput;
}

export interface MutationCreateBlobUploadArgs {
  key: Scalars['String']['input'];
  mime: Scalars['String']['input'];
  size: Scalars['Int']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateChangePasswordUrlArgs {
  callbackUrl: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}

export interface MutationCreateCheckoutSessionArgs {
  input: CreateCheckoutSessionInput;
}

export interface MutationCreateCommentArgs {
  input: CommentCreateInput;
}

export interface MutationCreateCopilotContextArgs {
  sessionId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateCopilotMessageArgs {
  options: CreateChatMessageInput;
}

export interface MutationCreateCopilotSessionArgs {
  options: CreateChatSessionInput;
}

export interface MutationCreateCopilotSessionWithHistoryArgs {
  options: CreateChatSessionInput;
}

export interface MutationCreateInviteLinkArgs {
  expireTime: WorkspaceInviteLinkExpireTime;
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateManutProCheckoutSessionArgs {
  workspaceId: Scalars['ID']['input'];
}

export interface MutationCreateMnAgentArgs {
  input: CreateMnAgentInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationCreateMnApprovalArgs {
  input: CreateMnApprovalInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationCreateMnApprovalCommentArgs {
  approvalId: Scalars['ID']['input'];
  input: CreateMnApprovalCommentInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationCreateMnBudgetArgs {
  input: CreateMnBudgetInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationCreateMnCeoConversationArgs {
  input: CreateMnCeoConversationInput;
}

export interface MutationCreateMnCrmAccountArgs {
  input: CreateMnCrmAccountInput;
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateMnCrmActivityArgs {
  input: CreateMnCrmActivityInput;
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateMnCrmContactArgs {
  input: CreateMnCrmContactInput;
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateMnCrmDealArgs {
  input: CreateMnCrmDealInput;
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateMnCrmDealStageArgs {
  input: CreateMnCrmDealStageInput;
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateMnGoalArgs {
  input: CreateMnGoalInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationCreateMnProjectArgs {
  input: CreateMnProjectInput;
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateMnReminderArgs {
  input: CreateMnReminderInput;
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateMnReminderRuleArgs {
  input: CreateMnReminderRuleInput;
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateMnSkillArgs {
  input: CreateMnSkillInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationCreateMnTaskArgs {
  input: CreateMnTaskInput;
  projectId: Scalars['ID']['input'];
}

export interface MutationCreateMnTaskPlanArgs {
  input: CreateMnTaskPlanInput;
}

export interface MutationCreateMnWorkProductArgs {
  input: CreateMnWorkProductInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationCreateMnWorkQueueArgs {
  input: CreateMnWorkQueueInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationCreateReplyArgs {
  input: ReplyCreateInput;
}

export interface MutationCreateSelfhostWorkspaceCustomerPortalArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateUserArgs {
  input: CreateUserInput;
}

export interface MutationCreateWorkspaceArgs {
  init?: InputMaybe<Scalars['Upload']['input']>;
}

export interface MutationDeactivateLicenseArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDecideMnApprovalArgs {
  approvalId: Scalars['ID']['input'];
  input: DecideMnApprovalInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationDecideMnOrgChangeArgs {
  input: DecideMnOrgChangeInput;
  orgChangeId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationDecideMnTaskPlanArgs {
  input: DecideMnTaskPlanInput;
}

export interface MutationDeleteAgentArgs {
  id: Scalars['String']['input'];
}

export interface MutationDeleteBlobArgs {
  hash?: InputMaybe<Scalars['String']['input']>;
  key?: InputMaybe<Scalars['String']['input']>;
  permanently?: Scalars['Boolean']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationDeleteCommentArgs {
  id: Scalars['String']['input'];
}

export interface MutationDeleteMnAgentArgs {
  agentId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationDeleteMnAgentMemoryArgs {
  memoryId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationDeleteMnBudgetArgs {
  budgetId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationDeleteMnGoalArgs {
  goalId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationDeleteMnReminderRuleArgs {
  ruleId: Scalars['ID']['input'];
}

export interface MutationDeleteMnTaskArgs {
  taskId: Scalars['ID']['input'];
}

export interface MutationDeleteMnWorkProductArgs {
  workProductId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationDeleteMongoIngestionConfigArgs {
  collectionName: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationDeleteReplyArgs {
  id: Scalars['String']['input'];
}

export interface MutationDeleteUserArgs {
  id: Scalars['String']['input'];
}

export interface MutationDeleteWorkspaceArgs {
  id: Scalars['String']['input'];
}

export interface MutationDisableMnAgentMaximizerArgs {
  agentId: Scalars['ID']['input'];
}

export interface MutationDisableMnPluginArgs {
  id: Scalars['ID']['input'];
}

export interface MutationDisconnectFacebookArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectFigmaArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectGithubArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectGoGoCashArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectGoogleArgs {
  scope: GoogleScope;
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectInstagramArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectLineVoomArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectLinearArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectMongoDbArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectPlatformArgs {
  connectionId: Scalars['String']['input'];
}

export interface MutationDisconnectPostHogArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectProviderArgs {
  provider: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectSlackArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectThreadsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectTiktokArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationEnableMnAgentMaximizerArgs {
  agentId: Scalars['ID']['input'];
}

export interface MutationEnableMnPluginArgs {
  id: Scalars['ID']['input'];
}

export interface MutationEnableUserArgs {
  id: Scalars['String']['input'];
}

export interface MutationFinalizePlatformConnectArgs {
  input: FinalizePlatformConnectInput;
}

export interface MutationForgetMemoryArgs {
  id: Scalars['ID']['input'];
}

export interface MutationForkCopilotSessionArgs {
  options: ForkChatSessionInput;
}

export interface MutationGenerateLicenseKeyArgs {
  sessionId: Scalars['String']['input'];
}

export interface MutationGenerateUserAccessTokenArgs {
  input: GenerateAccessTokenInput;
}

export interface MutationGrantDocUserRolesArgs {
  input: GrantDocUserRolesInput;
}

export interface MutationGrantMemberArgs {
  permission: Permission;
  userId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationImportGmailMessageArgs {
  messageId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationImportMnHandoverArgs {
  input: ImportMnHandoverInput;
  workspaceId: Scalars['String']['input'];
}

export interface MutationImportUsersArgs {
  input: ImportUsersInput;
}

export interface MutationInstallLicenseArgs {
  license: Scalars['Upload']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationInstallMnPluginArgs {
  input: InstallMnPluginInput;
}

export interface MutationInviteMembersArgs {
  emails: Array<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationLeaveWorkspaceArgs {
  sendLeaveMail?: InputMaybe<Scalars['Boolean']['input']>;
  workspaceId: Scalars['String']['input'];
  workspaceName?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationResendInviteArgs {
  inviteId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationLinkCalDavAccountArgs {
  input: LinkCalDavAccountInput;
}

export interface MutationLinkCalendarAccountArgs {
  input: LinkCalendarAccountInput;
}

export interface MutationMarkMnExecutionRunCompleteArgs {
  error?: InputMaybe<Scalars['String']['input']>;
  runId: Scalars['ID']['input'];
  status: MnExecutionRunStatus;
}

export interface MutationMentionUserArgs {
  input: MentionInput;
}

export interface MutationMintMnAgentApiKeyArgs {
  agentId: Scalars['ID']['input'];
  input: MintMnAgentApiKeyInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationPinMemoryArgs {
  id: Scalars['ID']['input'];
}

export interface MutationPromoteMemoryToWorkspaceArgs {
  id: Scalars['ID']['input'];
}

export interface MutationProposeMnOrgChangeArgs {
  input: ProposeMnOrgChangeInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationPublishDocArgs {
  docId: Scalars['String']['input'];
  mode?: InputMaybe<PublicDocMode>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationQueueWorkspaceEmbeddingArgs {
  docId: Array<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationRateMessageArgs {
  messageId: Scalars['String']['input'];
  rating: Scalars['String']['input'];
}

export interface MutationReadNotificationArgs {
  id: Scalars['String']['input'];
}

export interface MutationRecoverDocArgs {
  guid: Scalars['String']['input'];
  timestamp: Scalars['DateTime']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationRejectMnLearningCandidateArgs {
  candidateId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationReleaseDeletedBlobsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationReleaseMnTaskCheckoutArgs {
  runId: Scalars['ID']['input'];
  taskId: Scalars['ID']['input'];
}

export interface MutationRemoveAgentFileArgs {
  fileId: Scalars['String']['input'];
  id: Scalars['String']['input'];
}

export interface MutationRemoveAgentLinkArgs {
  id: Scalars['String']['input'];
  url: Scalars['String']['input'];
}

export interface MutationRemoveAgentSkillArgs {
  id: Scalars['String']['input'];
  skill: Scalars['String']['input'];
}

export interface MutationRemoveContextBlobArgs {
  options: RemoveContextBlobInput;
}

export interface MutationRemoveContextCategoryArgs {
  options: RemoveContextCategoryInput;
}

export interface MutationRemoveContextDocArgs {
  options: RemoveContextDocInput;
}

export interface MutationRemoveContextFileArgs {
  options: RemoveContextFileInput;
}

export interface MutationRemoveMnTaskBlockerArgs {
  blockerId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationRemoveWorkspaceEmbeddingFilesArgs {
  fileId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationRemoveWorkspaceFeatureArgs {
  feature: FeatureType;
  workspaceId: Scalars['String']['input'];
}

export interface MutationRequestApplySubscriptionArgs {
  transactionId: Scalars['String']['input'];
}

export interface MutationResolveCommentArgs {
  input: CommentResolveInput;
}

export interface MutationResolveMnCeoTurnArgs {
  turnId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationRestoreMnSkillArgs {
  skillId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationResumeSubscriptionArgs {
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  plan?: InputMaybe<SubscriptionPlan>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationRetryAudioTranscriptionArgs {
  jobId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationRevertMnOrgChangeArgs {
  orgChangeId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationRevokeDocUserRolesArgs {
  input: RevokeDocUserRoleInput;
}

export interface MutationRevokeInviteLinkArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationRevokeMemberArgs {
  userId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationRevokeMnAgentApiKeyArgs {
  agentId: Scalars['ID']['input'];
  keyId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationRevokePublicDocArgs {
  docId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationRevokeUserAccessTokenArgs {
  id: Scalars['String']['input'];
}

export interface MutationRotateMnWorkQueueTokenArgs {
  queueId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationRunContentRecommendationArgs {
  input: RunContentRecommendationInput;
}

export interface MutationSeedWorkspaceFromWizardArgs {
  answers: WizardAnswersInput;
  workspaceId: Scalars['String']['input'];
}

export interface MutationSendChangeEmailArgs {
  callbackUrl: Scalars['String']['input'];
  email?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationSendChangePasswordEmailArgs {
  callbackUrl: Scalars['String']['input'];
  email?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationSendSetPasswordEmailArgs {
  callbackUrl: Scalars['String']['input'];
  email?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationSendTestEmailArgs {
  config: Scalars['JSONObject']['input'];
}

export interface MutationSendVerifyChangeEmailArgs {
  callbackUrl: Scalars['String']['input'];
  email: Scalars['String']['input'];
  token: Scalars['String']['input'];
}

export interface MutationSendVerifyEmailArgs {
  callbackUrl: Scalars['String']['input'];
}

export interface MutationSetBlobArgs {
  blob: Scalars['Upload']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationSetGoGoCashConnectionArgs {
  input: GoGoCashConnectionInputType;
  workspaceId: Scalars['String']['input'];
}

export interface MutationSetMnTaskDefinitionOfDoneArgs {
  input: SetMnTaskDefinitionOfDoneInput;
}

export interface MutationSetMnTaskParentArgs {
  parentTaskId?: InputMaybe<Scalars['ID']['input']>;
  taskId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationSetMongoDbConnectionArgs {
  input: MongoDbConnectionInputType;
  workspaceId: Scalars['String']['input'];
}

export interface MutationSetMongoIngestionConfigArgs {
  input: SetMongoIngestionConfigInput;
  workspaceId: Scalars['String']['input'];
}

export interface MutationSetPostHogConnectionArgs {
  input: PostHogConnectionInputType;
  workspaceId: Scalars['String']['input'];
}

export interface MutationStoreMnAgentMemoryArgs {
  input: StoreMnAgentMemoryInput;
}

export interface MutationSubmitAudioTranscriptionArgs {
  blob?: InputMaybe<Scalars['Upload']['input']>;
  blobId: Scalars['String']['input'];
  blobs?: InputMaybe<Array<Scalars['Upload']['input']>>;
  input?: InputMaybe<SubmitAudioTranscriptionInput>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationSubmitMnApprovalRevisionArgs {
  approvalId: Scalars['ID']['input'];
  payload?: InputMaybe<Scalars['JSONObject']['input']>;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationSubmitMnTaskPlanForReviewArgs {
  planId: Scalars['ID']['input'];
}

export interface MutationTestMongoDbConnectionArgs {
  input: MongoDbConnectionInputType;
}

export interface MutationTestPostHogConnectionArgs {
  input: PostHogConnectionInputType;
}

export interface MutationTriggerLearningExtractionForTaskArgs {
  taskId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationTryCheckoutMnTaskArgs {
  executingAgentId?: InputMaybe<Scalars['ID']['input']>;
  runId: Scalars['ID']['input'];
  taskId: Scalars['ID']['input'];
}

export interface MutationUninstallMnPluginArgs {
  id: Scalars['ID']['input'];
}

export interface MutationUnlinkCalendarAccountArgs {
  accountId: Scalars['String']['input'];
}

export interface MutationUnverifyDocArgs {
  docId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationUpdateAgentArgs {
  id: Scalars['String']['input'];
  input: UpdateAgentInput;
}

export interface MutationUpdateAgentRoleArgs {
  input: UpdateMnAgentRoleInput;
  slug: Scalars['String']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationUpdateAppConfigArgs {
  updates: Array<UpdateAppConfigInput>;
}

export interface MutationUpdateCalendarAccountArgs {
  accountId: Scalars['String']['input'];
  refreshIntervalMinutes: Scalars['Int']['input'];
}

export interface MutationUpdateCommentArgs {
  input: CommentUpdateInput;
}

export interface MutationUpdateCopilotSessionArgs {
  options: UpdateChatSessionInput;
}

export interface MutationUpdateDocDefaultRoleArgs {
  input: UpdateDocDefaultRoleInput;
}

export interface MutationUpdateDocUserRoleArgs {
  input: UpdateDocUserRoleInput;
}

export interface MutationUpdateMnAgentArgs {
  agentId: Scalars['ID']['input'];
  input: UpdateMnAgentInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationUpdateMnBudgetArgs {
  budgetId: Scalars['ID']['input'];
  input: UpdateMnBudgetInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationUpdateMnCrmAccountArgs {
  accountId: Scalars['ID']['input'];
  input: UpdateMnCrmAccountInput;
}

export interface MutationUpdateMnCrmActivityArgs {
  activityId: Scalars['ID']['input'];
  input: UpdateMnCrmActivityInput;
}

export interface MutationUpdateMnCrmContactArgs {
  contactId: Scalars['ID']['input'];
  input: UpdateMnCrmContactInput;
}

export interface MutationUpdateMnCrmDealArgs {
  dealId: Scalars['ID']['input'];
  input: UpdateMnCrmDealInput;
}

export interface MutationUpdateMnCrmDealStageArgs {
  input: UpdateMnCrmDealStageInput;
  stageId: Scalars['ID']['input'];
}

export interface MutationUpdateMnGoalArgs {
  goalId: Scalars['ID']['input'];
  input: UpdateMnGoalInput;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationUpdateMnProjectArgs {
  input: UpdateMnProjectInput;
  projectId: Scalars['ID']['input'];
}

export interface MutationUpdateMnReminderRuleArgs {
  input: UpdateMnReminderRuleInput;
  ruleId: Scalars['ID']['input'];
}

export interface MutationUpdateMnSkillArgs {
  input: UpdateMnSkillInput;
  skillId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationUpdateMnTaskArgs {
  input: UpdateMnTaskInput;
  taskId: Scalars['ID']['input'];
}

export interface MutationUpdateMnTaskStatusArgs {
  status: MnTaskStatus;
  taskId: Scalars['ID']['input'];
}

export interface MutationUpdateMnWorkQueueArgs {
  input: UpdateMnWorkQueueInput;
  queueId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationUpdateOnboardingArgs {
  input: UpdateOnboardingInput;
}

export interface MutationUpdateProfileArgs {
  input: UpdateUserInput;
}

export interface MutationUpdateReplyArgs {
  input: ReplyUpdateInput;
}

export interface MutationUpdateSettingsArgs {
  input: UpdateUserSettingsInput;
}

export interface MutationUpdateSubscriptionRecurringArgs {
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  plan?: InputMaybe<SubscriptionPlan>;
  recurring: SubscriptionRecurring;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationUpdateUserArgs {
  id: Scalars['String']['input'];
  input: ManageUserInput;
}

export interface MutationUpdateUserFeaturesArgs {
  features: Array<FeatureType>;
  id: Scalars['String']['input'];
}

export interface MutationUpdateWorkspaceArgs {
  input: UpdateWorkspaceInput;
}

export interface MutationUpdateWorkspaceCalendarsArgs {
  input: UpdateWorkspaceCalendarsInput;
}

export interface MutationUpdateWorkspaceEmbeddingIgnoredDocsArgs {
  add?: InputMaybe<Array<Scalars['String']['input']>>;
  remove?: InputMaybe<Array<Scalars['String']['input']>>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationUploadAvatarArgs {
  avatar: Scalars['Upload']['input'];
}

export interface MutationUploadCommentAttachmentArgs {
  attachment: Scalars['Upload']['input'];
  docId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationUpsertMnPluginConfigArgs {
  input: UpsertMnPluginConfigInput;
}

export interface MutationVerifyDocArgs {
  docId: Scalars['String']['input'];
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationVerifyEmailArgs {
  token: Scalars['String']['input'];
}

export interface NoCopilotProviderAvailableDataType {
  __typename?: 'NoCopilotProviderAvailableDataType';
  modelId: Scalars['String']['output'];
}

export interface NoMoreSeatDataType {
  __typename?: 'NoMoreSeatDataType';
  spaceId: Scalars['String']['output'];
}

export interface NormalizedTranscriptSegmentType {
  __typename?: 'NormalizedTranscriptSegmentType';
  end: Scalars['String']['output'];
  endSec: Scalars['Float']['output'];
  speaker: Scalars['String']['output'];
  start: Scalars['String']['output'];
  startSec: Scalars['Float']['output'];
  text: Scalars['String']['output'];
}

export interface NotInSpaceDataType {
  __typename?: 'NotInSpaceDataType';
  spaceId: Scalars['String']['output'];
}

/** Notification level */
export enum NotificationLevel {
  Default = 'Default',
  High = 'High',
  Low = 'Low',
  Min = 'Min',
  None = 'None',
}

export interface NotificationObjectType {
  __typename?: 'NotificationObjectType';
  /** Just a placeholder to export UnionNotificationBodyType, don't use it */
  _placeholderForUnionNotificationBodyType: UnionNotificationBodyType;
  /** The body of the notification, different types have different fields, see UnionNotificationBodyType */
  body: Scalars['JSONObject']['output'];
  /** The created at time of the notification */
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  /** The level of the notification */
  level: NotificationLevel;
  /** Whether the notification has been read */
  read: Scalars['Boolean']['output'];
  /** The type of the notification */
  type: NotificationType;
  /** The updated at time of the notification */
  updatedAt: Scalars['DateTime']['output'];
}

export interface NotificationObjectTypeEdge {
  __typename?: 'NotificationObjectTypeEdge';
  cursor: Scalars['String']['output'];
  node: NotificationObjectType;
}

/** Notification type */
export enum NotificationType {
  BudgetSoftCap = 'BudgetSoftCap',
  Comment = 'Comment',
  CommentMention = 'CommentMention',
  Invitation = 'Invitation',
  InvitationAccepted = 'InvitationAccepted',
  InvitationBlocked = 'InvitationBlocked',
  InvitationRejected = 'InvitationRejected',
  InvitationReviewApproved = 'InvitationReviewApproved',
  InvitationReviewDeclined = 'InvitationReviewDeclined',
  InvitationReviewRequest = 'InvitationReviewRequest',
  Mention = 'Mention',
}

export interface NotificationWorkspaceType {
  __typename?: 'NotificationWorkspaceType';
  /** Workspace avatar url */
  avatarUrl: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** Workspace name */
  name: Scalars['String']['output'];
}

export enum OAuthProviderType {
  Apple = 'Apple',
  GitHub = 'GitHub',
  Google = 'Google',
  OIDC = 'OIDC',
}

export interface PageInfo {
  __typename?: 'PageInfo';
  endCursor: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor: Maybe<Scalars['String']['output']>;
}

export interface PaginatedAdminAllSharedLink {
  __typename?: 'PaginatedAdminAllSharedLink';
  analyticsWindow: TimeWindow;
  edges: Array<AdminAllSharedLinkEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
}

export interface PaginatedCommentChangeObjectType {
  __typename?: 'PaginatedCommentChangeObjectType';
  edges: Array<CommentChangeObjectTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedCommentObjectType {
  __typename?: 'PaginatedCommentObjectType';
  edges: Array<CommentObjectTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedCopilotHistoriesType {
  __typename?: 'PaginatedCopilotHistoriesType';
  edges: Array<CopilotHistoriesTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedCopilotWorkspaceFileType {
  __typename?: 'PaginatedCopilotWorkspaceFileType';
  edges: Array<CopilotWorkspaceFileTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedDocMemberLastAccess {
  __typename?: 'PaginatedDocMemberLastAccess';
  edges: Array<DocMemberLastAccessEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
}

export interface PaginatedDocType {
  __typename?: 'PaginatedDocType';
  edges: Array<DocTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedGrantedDocUserType {
  __typename?: 'PaginatedGrantedDocUserType';
  edges: Array<GrantedDocUserTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedIgnoredDocsType {
  __typename?: 'PaginatedIgnoredDocsType';
  edges: Array<CopilotWorkspaceIgnoredDocTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedNotificationObjectType {
  __typename?: 'PaginatedNotificationObjectType';
  edges: Array<NotificationObjectTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginationInput {
  /** returns the elements in the list that come after the specified cursor. */
  after?: InputMaybe<Scalars['String']['input']>;
  /** returns the first n elements from the list. */
  first?: InputMaybe<Scalars['Int']['input']>;
  /** ignore the first n elements from the list. */
  offset?: InputMaybe<Scalars['Int']['input']>;
}

export interface PasswordLimitsType {
  __typename?: 'PasswordLimitsType';
  maxLength: Scalars['Int']['output'];
  minLength: Scalars['Int']['output'];
}

/** User permission in workspace */
export enum Permission {
  Admin = 'Admin',
  Collaborator = 'Collaborator',
  External = 'External',
  Owner = 'Owner',
}

export interface PostHogConnectionInputType {
  apiKey: Scalars['String']['input'];
  host?: InputMaybe<Scalars['String']['input']>;
}

export interface PostHogConnectionTestResultType {
  __typename?: 'PostHogConnectionTestResultType';
  error: Maybe<Scalars['String']['output']>;
  host: Maybe<Scalars['String']['output']>;
  ok: Scalars['Boolean']['output'];
  projectCount: Maybe<Scalars['Int']['output']>;
}

export interface PostHogConnectionType {
  __typename?: 'PostHogConnectionType';
  connected: Scalars['Boolean']['output'];
  host: Maybe<Scalars['String']['output']>;
  projectCount: Maybe<Scalars['Int']['output']>;
}

export interface ProposeMnOrgChangeInput {
  /** Type-specific payload. For DELEGATION_CHANGE: { agentId, newReportsToAgentId }. For NEW_ROUTINE: { name, prompt, cronSchedule?, timezone? }. See enum docs in schema.prisma. */
  payload: Scalars['JSONObject']['input'];
  projectId: Scalars['ID']['input'];
  /** Optional agent id that proposed the change. Null when a human authored it directly via the org-changes inbox. */
  proposedByAgentId?: InputMaybe<Scalars['ID']['input']>;
  /** Free-form rationale explaining why this change is being proposed. Surfaced verbatim to the deciding operator. */
  rationale: Scalars['String']['input'];
  type: MnOrgChangeType;
}

/** The mode which the public doc default in */
export enum PublicDocMode {
  Edgeless = 'Edgeless',
  Page = 'Page',
}

export interface PublicUserType {
  __typename?: 'PublicUserType';
  avatarUrl: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
}

export interface Query {
  __typename?: 'Query';
  /** List all shared links across workspaces for admin panel */
  adminAllSharedLinks: PaginatedAdminAllSharedLink;
  /** Get aggregated dashboard metrics for admin panel */
  adminDashboard: AdminDashboard;
  /** List all currently-verified docs across workspaces */
  adminVerifiedDocs: Array<AdminVerifiedDoc>;
  /** Get workspace detail for admin */
  adminWorkspace: Maybe<AdminWorkspace>;
  /** List workspaces for admin */
  adminWorkspaces: Array<AdminWorkspace>;
  /** Workspaces count for admin */
  adminWorkspacesCount: Scalars['Int']['output'];
  agent: Maybe<Agent>;
  /** Return the 5 canonical operating roles registered for a workspace. */
  agentRoles: Array<MnAgentRole>;
  agents: Array<Agent>;
  /** get the whole app configuration */
  appConfig: Scalars['JSONObject']['output'];
  /**
   * Apply updates to a doc using LLM and return the merged markdown.
   * @deprecated use Mutation.applyDocUpdates
   */
  applyDocUpdates: Scalars['String']['output'];
  /** List analytics platform connections for a workspace. */
  connections: Array<SocialConnection>;
  /** Get current user */
  currentUser: Maybe<UserType>;
  dailyStats: Array<DailyStat>;
  driveFiles: Array<DriveFileType>;
  error: ErrorDataUnion;
  facebookConnection: FacebookConnectionType;
  figmaConnection: FigmaConnectionType;
  /** get workspace invitation info */
  getInviteInfo: InvitationType;
  getMongoIngestionConfigs: Array<MongoIngestionConfig>;
  /** Overview tile for the Analytics landing page: totals, recent insights, current AI spend. */
  getOverview: AnalyticsOverview;
  githubConnection: GithubConnectionType;
  gmailMessages: Array<GmailMessageSummaryType>;
  goGoCashConnection: GoGoCashConnectionType;
  googleConnection: GoogleConnectionType;
  instagramConnection: InstagramConnectionType;
  lineVoomConnection: LineVoomConnectionType;
  linearConnection: LinearConnectionType;
  listConnections: Array<ConnectedAccountType>;
  /** AI insights timeline filtered by type. */
  listInsights: Array<SocialInsight>;
  /** Aggregated metrics for the dashboard charts. */
  listMetrics: Array<SocialMetric>;
  listMongoCollections: Array<MongoCollectionInfo>;
  /** Fetch a single agent by id. Returns null when the agent does not exist or belongs to another workspace. */
  mnAgent: Maybe<MnAgent>;
  /** List API keys for an agent. Includes revoked keys so the audit trail stays visible. */
  mnAgentApiKeys: Array<MnAgentApiKey>;
  /** List memories for an agent. Pass taskId to narrow to memories pinned to a specific task; otherwise returns all agent memories ranked by importance then recency. */
  mnAgentMemories: Array<MnAgentMemory>;
  /** List agents in a workspace, optionally filtered by project. */
  mnAgents: Array<MnAgent>;
  /** Fetch a single approval by id. Returns null when the approval does not exist or belongs to another workspace (no info leak). */
  mnApproval: Maybe<MnApproval>;
  /** List comments on an approval, oldest first. Cross-workspace lookups throw NotFoundException (matches the approval surface). */
  mnApprovalComments: Array<MnApprovalComment>;
  /** List approvals for a workspace inbox. Filterable by project, status, type, or requesting agent. Workspace-scoped. */
  mnApprovals: Array<MnApproval>;
  /** Fetch a single budget by id. */
  mnBudget: Maybe<MnBudget>;
  /** Per-project spend rollup for the dashboard. Joins budgets with live cost-event aggregates for projects without a configured cap. */
  mnBudgetProjectRollups: Array<MnBudgetRollup>;
  /** List budgets in a workspace, optionally narrowed by month or scope. */
  mnBudgets: Array<MnBudget>;
  mnCeoConversation: MnCeoConversation;
  mnCeoConversations: Array<MnCeoConversation>;
  mnCeoTurns: Array<MnCeoTurn>;
  /** Recent cost events for a workspace; capped at 500 by default. */
  mnCostEvents: Array<MnCostEvent>;
  mnCrmAccounts: Array<MnCrmAccount>;
  mnCrmActivities: Array<MnCrmActivity>;
  mnCrmContacts: Array<MnCrmContact>;
  mnCrmDealStages: Array<MnCrmDealStage>;
  mnCrmDeals: Array<MnCrmDeal>;
  /** M7 — list execution runs for a task, newest first. Requires Workspace.Read on the owning workspace. */
  mnExecutionRunsForTask: Array<MnExecutionRun>;
  /** Fetch a single goal. Returns null when not in workspace. */
  mnGoal: Maybe<MnGoal>;
  /** Walk parent chain of a goal, ordered root → leaf. */
  mnGoalAncestry: Array<MnGoalAncestryStep>;
  /** List goals in a workspace, optionally filtered by project. Workspace.Read. */
  mnGoals: Array<MnGoal>;
  /** List auto-learning playbook candidates for a workspace. By default returns only candidates awaiting review (status=PENDING). Pass an explicit status to see approved or rejected history. */
  mnLearningCandidates: Array<MnLearningCandidate>;
  /** List structural-change proposals for an org-changes inbox. Workspace-scoped; filterable by project, status, type, and proposing agent. */
  mnOrgChanges: Array<MnOrgChange>;
  /** Fetch a single plugin by id. Returns null when missing. */
  mnPlugin: Maybe<MnPlugin>;
  /** List the per-workspace plugin configs visible to this workspace. Returns every installed plugin once — synthesises an empty config row for plugins the workspace has not yet configured so the UI can render an "enable" toggle for them. */
  mnPluginConfigs: Array<MnPluginConfig>;
  /** List every installed plugin (instance-wide). Admin-only because plugin lifecycle is an operator concern, not a workspace concern. */
  mnPlugins: Array<MnPlugin>;
  mnProjects: Array<MnProject>;
  /** List reminder rules in a workspace. Requires Workspace.Read. */
  mnReminderRules: Array<MnReminderRule>;
  /** List reminders in a workspace: own reminders for all members; admins see all when they have Workspace.Settings.Update. */
  mnReminders: Array<MnReminder>;
  /** Fetch a single skill by id. Returns null when the skill does not exist or belongs to another workspace. */
  mnSkill: Maybe<MnSkill>;
  /** Look up a skill by its workspace-scoped slug. */
  mnSkillBySlug: Maybe<MnSkill>;
  /** List skills in a workspace. Excludes archived rows by default; pass includeArchived=true to see the full history. */
  mnSkills: Array<MnSkill>;
  /** Combined task + goal ancestry for the task detail breadcrumb. */
  mnTaskAncestry: Maybe<MnTaskAncestry>;
  /** M13 — list every revision of a task plan, newest first. The UI renders this as a vertical timeline with status badges. */
  mnTaskPlans: Array<MnTaskPlan>;
  mnTasks: Array<MnTask>;
  /** Fetch a single work product by id. Returns null when the row does not exist or belongs to another workspace. */
  mnWorkProduct: Maybe<MnWorkProduct>;
  /** List work products attributed to a task, newest first. Workspace-fenced — passing a task from another workspace returns []. */
  mnWorkProducts: Array<MnWorkProduct>;
  mnWorkQueueIntakes: Array<MnWorkQueueIntake>;
  mnWorkQueues: Array<MnWorkQueue>;
  mongoDbConnection: MongoDbConnectionType;
  /** List memories the current user can recall in this workspace (personal + workspace-scope). Pinned rows first, newest first. */
  myMemories: Array<Memory>;
  postHogConnection: PostHogConnectionType;
  prices: Array<SubscriptionPrice>;
  /** Get public user by id */
  publicUserById: Maybe<PublicUserType>;
  /** query workspace embedding status */
  queryWorkspaceEmbeddingStatus: ContextWorkspaceEmbeddingStatus;
  /** Recall top memories for an agent ranked by importance and recency. Touches retrievedCount + lastRetrievedAt as a side effect so the next recall sees the recency boost. Limit is clamped to [1, 100]. */
  recallMnAgentMemories: Array<MnAgentMemory>;
  /** Fetch a single Manut release run scoped to the workspace. */
  releaseRun: MnReleaseRun;
  /** List Manut release runs for the given workspace, newest first. */
  releaseRuns: Array<MnReleaseRun>;
  /** @deprecated use currentUser.revealedAccessTokens */
  revealedAccessTokens: Array<RevealedAccessToken>;
  sampleMongoCollection: MongoSampleDocs;
  /** server config */
  serverConfig: ServerConfigType;
  slackConnection: SlackConnectionType;
  threadsConnection: ThreadsConnectionType;
  tiktokConnection: TiktokConnectionType;
  /** Get user by email */
  user: Maybe<UserOrLimitedUser>;
  /** Get user by email for admin */
  userByEmail: Maybe<UserType>;
  /** Get user by id */
  userById: UserType;
  /** List registered users */
  users: Array<UserType>;
  /** Get users count */
  usersCount: Scalars['Int']['output'];
  /** validate app configuration */
  validateAppConfig: Array<AppConfigValidateResult>;
  /** M11 — verify a task against its declared Definition of Done. Runs every predicate and returns a per-predicate breakdown. `satisfied=true` is the AND of every predicate. A task with no predicates returns `hasDefinition=false, satisfied=true` (transition guard is a no-op for un-enforced tasks). */
  verifyMnTaskDone: MnDoDVerificationResult;
  /** Get workspace by id */
  workspace: WorkspaceType;
  /**
   * Get workspace role permissions
   * @deprecated use WorkspaceType[permissions] instead
   */
  workspaceRolePermissions: WorkspaceRolePermissions;
  /** Get all accessible workspaces for current user */
  workspaces: Array<WorkspaceType>;
}

export interface QueryAdminAllSharedLinksArgs {
  filter?: InputMaybe<AdminAllSharedLinksFilterInput>;
  pagination: PaginationInput;
}

export interface QueryAdminDashboardArgs {
  input?: InputMaybe<AdminDashboardInput>;
}

export interface QueryAdminVerifiedDocsArgs {
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface QueryAdminWorkspaceArgs {
  id: Scalars['String']['input'];
}

export interface QueryAdminWorkspacesArgs {
  filter: ListWorkspaceInput;
}

export interface QueryAdminWorkspacesCountArgs {
  filter: ListWorkspaceInput;
}

export interface QueryAgentArgs {
  id: Scalars['String']['input'];
}

export interface QueryAgentRolesArgs {
  workspaceId: Scalars['ID']['input'];
}

export interface QueryAgentsArgs {
  parentAgentId?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface QueryApplyDocUpdatesArgs {
  docId: Scalars['String']['input'];
  op: Scalars['String']['input'];
  updates: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface QueryConnectionsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryDailyStatsArgs {
  input: DailyStatsInput;
}

export interface QueryDriveFilesArgs {
  pageSize?: Scalars['Int']['input'];
  query?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface QueryErrorArgs {
  name: ErrorNames;
}

export interface QueryFacebookConnectionArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryFigmaConnectionArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryGetInviteInfoArgs {
  inviteId: Scalars['String']['input'];
}

export interface QueryGetMongoIngestionConfigsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryGetOverviewArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryGithubConnectionArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryGmailMessagesArgs {
  maxResults?: Scalars['Int']['input'];
  query?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface QueryGoGoCashConnectionArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryGoogleConnectionArgs {
  scope: GoogleScope;
  workspaceId: Scalars['String']['input'];
}

export interface QueryInstagramConnectionArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryLineVoomConnectionArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryLinearConnectionArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryListConnectionsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryListInsightsArgs {
  input: ListInsightsInput;
}

export interface QueryListMetricsArgs {
  input: ListMetricsInput;
}

export interface QueryListMongoCollectionsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryMnAgentArgs {
  agentId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnAgentApiKeysArgs {
  agentId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnAgentMemoriesArgs {
  agentId: Scalars['ID']['input'];
  taskId?: InputMaybe<Scalars['ID']['input']>;
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnAgentsArgs {
  projectId?: InputMaybe<Scalars['ID']['input']>;
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnApprovalArgs {
  approvalId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnApprovalCommentsArgs {
  approvalId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnApprovalsArgs {
  filter?: InputMaybe<ListMnApprovalsInput>;
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnBudgetArgs {
  budgetId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnBudgetProjectRollupsArgs {
  monthYear: Scalars['String']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnBudgetsArgs {
  monthYear?: InputMaybe<Scalars['String']['input']>;
  scopeType?: InputMaybe<MnBudgetScope>;
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnCeoConversationArgs {
  id: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnCeoConversationsArgs {
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnCeoTurnsArgs {
  conversationId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnCostEventsArgs {
  agentId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  monthYear?: InputMaybe<Scalars['String']['input']>;
  projectId?: InputMaybe<Scalars['ID']['input']>;
  taskId?: InputMaybe<Scalars['ID']['input']>;
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnCrmAccountsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryMnCrmActivitiesArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryMnCrmContactsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryMnCrmDealStagesArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryMnCrmDealsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryMnExecutionRunsForTaskArgs {
  limit?: InputMaybe<Scalars['Int']['input']>;
  taskId: Scalars['ID']['input'];
}

export interface QueryMnGoalArgs {
  goalId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnGoalAncestryArgs {
  goalId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnGoalsArgs {
  projectId?: InputMaybe<Scalars['ID']['input']>;
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnLearningCandidatesArgs {
  status?: InputMaybe<MnLearningCandidateStatus>;
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnOrgChangesArgs {
  filter?: InputMaybe<ListMnOrgChangesInput>;
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnPluginArgs {
  id: Scalars['ID']['input'];
}

export interface QueryMnPluginConfigsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryMnProjectsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryMnReminderRulesArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryMnRemindersArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryMnSkillArgs {
  skillId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnSkillBySlugArgs {
  slug: Scalars['String']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnSkillsArgs {
  includeArchived?: InputMaybe<Scalars['Boolean']['input']>;
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnTaskAncestryArgs {
  taskId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnTaskPlansArgs {
  taskId: Scalars['ID']['input'];
}

export interface QueryMnTasksArgs {
  projectId: Scalars['ID']['input'];
}

export interface QueryMnWorkProductArgs {
  workProductId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnWorkProductsArgs {
  taskId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnWorkQueueIntakesArgs {
  queueId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMnWorkQueuesArgs {
  workspaceId: Scalars['ID']['input'];
}

export interface QueryMongoDbConnectionArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryMyMemoriesArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryPostHogConnectionArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryPublicUserByIdArgs {
  id: Scalars['String']['input'];
}

export interface QueryQueryWorkspaceEmbeddingStatusArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryRecallMnAgentMemoriesArgs {
  agentId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  taskId?: InputMaybe<Scalars['ID']['input']>;
  workspaceId: Scalars['ID']['input'];
}

export interface QueryReleaseRunArgs {
  runId: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface QueryReleaseRunsArgs {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface QuerySampleMongoCollectionArgs {
  collectionName: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface QuerySlackConnectionArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryThreadsConnectionArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryTiktokConnectionArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryUserArgs {
  email: Scalars['String']['input'];
}

export interface QueryUserByEmailArgs {
  email: Scalars['String']['input'];
}

export interface QueryUserByIdArgs {
  id: Scalars['String']['input'];
}

export interface QueryUsersArgs {
  filter: ListUserInput;
}

export interface QueryUsersCountArgs {
  filter?: InputMaybe<ListUserInput>;
}

export interface QueryValidateAppConfigArgs {
  updates: Array<UpdateAppConfigInput>;
}

export interface QueryVerifyMnTaskDoneArgs {
  taskId: Scalars['ID']['input'];
}

export interface QueryWorkspaceArgs {
  id: Scalars['String']['input'];
}

export interface QueryWorkspaceRolePermissionsArgs {
  id: Scalars['String']['input'];
}

export interface QueryChatHistoriesInput {
  action?: InputMaybe<Scalars['Boolean']['input']>;
  fork?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  messageOrder?: InputMaybe<ChatHistoryOrder>;
  pinned?: InputMaybe<Scalars['Boolean']['input']>;
  sessionId?: InputMaybe<Scalars['String']['input']>;
  sessionOrder?: InputMaybe<ChatHistoryOrder>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  withMessages?: InputMaybe<Scalars['Boolean']['input']>;
  withPrompt?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface QueryChatSessionsInput {
  action?: InputMaybe<Scalars['Boolean']['input']>;
  fork?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  pinned?: InputMaybe<Scalars['Boolean']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
}

export interface QueryTooLongDataType {
  __typename?: 'QueryTooLongDataType';
  max: Scalars['Int']['output'];
}

export interface ReleaseVersionType {
  __typename?: 'ReleaseVersionType';
  changelog: Scalars['String']['output'];
  publishedAt: Scalars['DateTime']['output'];
  url: Scalars['String']['output'];
  version: Scalars['String']['output'];
}

export interface RemoveAvatar {
  __typename?: 'RemoveAvatar';
  success: Scalars['Boolean']['output'];
}

export interface RemoveContextBlobInput {
  blobId: Scalars['String']['input'];
  contextId: Scalars['String']['input'];
}

export interface RemoveContextCategoryInput {
  categoryId: Scalars['String']['input'];
  contextId: Scalars['String']['input'];
  type: ContextCategories;
}

export interface RemoveContextDocInput {
  contextId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
}

export interface RemoveContextFileInput {
  contextId: Scalars['String']['input'];
  fileId: Scalars['String']['input'];
}

export interface ReplyCreateInput {
  commentId: Scalars['ID']['input'];
  content: Scalars['JSONObject']['input'];
  docMode: DocMode;
  docTitle: Scalars['String']['input'];
  /** The mention user ids, if not provided, the comment reply will not be mentioned */
  mentions?: InputMaybe<Array<Scalars['String']['input']>>;
}

export interface ReplyObjectType {
  __typename?: 'ReplyObjectType';
  commentId: Scalars['ID']['output'];
  /** The content of the reply */
  content: Scalars['JSONObject']['output'];
  /** The created at time of the reply */
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  /** The updated at time of the reply */
  updatedAt: Scalars['DateTime']['output'];
  /** The user who created the reply */
  user: PublicUserType;
}

export interface ReplyUpdateInput {
  content: Scalars['JSONObject']['input'];
  id: Scalars['ID']['input'];
}

export interface ResponseTooLargeErrorDataType {
  __typename?: 'ResponseTooLargeErrorDataType';
  limitBytes: Scalars['Int']['output'];
  receivedBytes: Scalars['Int']['output'];
}

export interface RevealedAccessToken {
  __typename?: 'RevealedAccessToken';
  createdAt: Scalars['DateTime']['output'];
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  token: Scalars['String']['output'];
}

export interface RevokeDocUserRoleInput {
  docId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface RunContentRecommendationInput {
  platform: SocialPlatform;
  tone?: InputMaybe<Scalars['String']['input']>;
  topic?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface RuntimeConfigNotFoundDataType {
  __typename?: 'RuntimeConfigNotFoundDataType';
  key: Scalars['String']['output'];
}

export interface SameSubscriptionRecurringDataType {
  __typename?: 'SameSubscriptionRecurringDataType';
  recurring: Scalars['String']['output'];
}

export interface SearchDocObjectType {
  __typename?: 'SearchDocObjectType';
  blockId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  createdByUser: Maybe<PublicUserType>;
  docId: Scalars['String']['output'];
  highlight: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  updatedByUser: Maybe<PublicUserType>;
}

export interface SearchDocsInput {
  keyword: Scalars['String']['input'];
  /** Limit the number of docs to return, default is 20 */
  limit?: InputMaybe<Scalars['Int']['input']>;
}

export interface SearchHighlight {
  before: Scalars['String']['input'];
  end: Scalars['String']['input'];
  field: Scalars['String']['input'];
}

export interface SearchInput {
  options: SearchOptions;
  query: SearchQuery;
  table: SearchTable;
}

export interface SearchNodeObjectType {
  __typename?: 'SearchNodeObjectType';
  /** The search result fields, see UnionSearchItemObjectType */
  fields: Scalars['JSONObject']['output'];
  /** The search result fields, see UnionSearchItemObjectType */
  highlights: Maybe<Scalars['JSONObject']['output']>;
}

export interface SearchOptions {
  fields: Array<Scalars['String']['input']>;
  highlights?: InputMaybe<Array<SearchHighlight>>;
  pagination?: InputMaybe<SearchPagination>;
}

export interface SearchPagination {
  cursor?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
}

export interface SearchQuery {
  boost?: InputMaybe<Scalars['Float']['input']>;
  field?: InputMaybe<Scalars['String']['input']>;
  match?: InputMaybe<Scalars['String']['input']>;
  occur?: InputMaybe<SearchQueryOccur>;
  queries?: InputMaybe<Array<SearchQuery>>;
  query?: InputMaybe<SearchQuery>;
  type: SearchQueryType;
}

/** Search query occur */
export enum SearchQueryOccur {
  must = 'must',
  must_not = 'must_not',
  should = 'should',
}

/** Search query type */
export enum SearchQueryType {
  all = 'all',
  boolean = 'boolean',
  boost = 'boost',
  exists = 'exists',
  match = 'match',
}

export interface SearchResultObjectType {
  __typename?: 'SearchResultObjectType';
  nodes: Array<SearchNodeObjectType>;
  pagination: SearchResultPagination;
}

export interface SearchResultPagination {
  __typename?: 'SearchResultPagination';
  count: Scalars['Int']['output'];
  hasMore: Scalars['Boolean']['output'];
  nextCursor: Maybe<Scalars['String']['output']>;
}

/** Search table */
export enum SearchTable {
  block = 'block',
  doc = 'doc',
}

export interface ServerConfigType {
  __typename?: 'ServerConfigType';
  /** fetch latest available upgradable release of server */
  availableUpgrade: Maybe<ReleaseVersionType>;
  /** Features for user that can be configured */
  availableUserFeatures: Array<FeatureType>;
  /** Workspace features available for admin configuration */
  availableWorkspaceFeatures: Array<FeatureType>;
  /** server base url */
  baseUrl: Scalars['String']['output'];
  calendarCalDAVProviders: Array<CalendarCalDavProviderPresetObjectType>;
  calendarProviders: Array<CalendarProviderType>;
  /** credentials requirement */
  credentialsRequirement: CredentialsRequirementType;
  /** enabled server features */
  features: Array<ServerFeature>;
  /** whether server has been initialized */
  initialized: Scalars['Boolean']['output'];
  /** server identical name could be shown as badge on user interface */
  name: Scalars['String']['output'];
  oauthProviders: Array<OAuthProviderType>;
  /** server type */
  type: ServerDeploymentType;
  /** server version */
  version: Scalars['String']['output'];
}

export enum ServerDeploymentType {
  Affine = 'Affine',
  Selfhosted = 'Selfhosted',
}

export enum ServerFeature {
  Captcha = 'Captcha',
  Comment = 'Comment',
  Copilot = 'Copilot',
  CopilotEmbedding = 'CopilotEmbedding',
  Indexer = 'Indexer',
  LocalWorkspace = 'LocalWorkspace',
  Manut = 'Manut',
  OAuth = 'OAuth',
  Payment = 'Payment',
}

export interface SetMnTaskDefinitionOfDoneInput {
  predicates?: InputMaybe<Scalars['JSON']['input']>;
  taskId: Scalars['ID']['input'];
}

export interface SetMongoIngestionConfigInput {
  collectionName: Scalars['String']['input'];
  cursorField: Scalars['String']['input'];
  enabled: Scalars['Boolean']['input'];
}

export interface SlackConnectAuthUrl {
  __typename?: 'SlackConnectAuthUrl';
  url: Scalars['String']['output'];
}

export interface SlackConnectionType {
  __typename?: 'SlackConnectionType';
  connected: Scalars['Boolean']['output'];
  teamName: Maybe<Scalars['String']['output']>;
}

export interface SocialConnection {
  __typename?: 'SocialConnection';
  connectedByUserId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  externalAccountId: Scalars['String']['output'];
  externalAccountName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastError: Maybe<Scalars['String']['output']>;
  lastErrorAt: Maybe<Scalars['DateTime']['output']>;
  lastSyncAt: Maybe<Scalars['DateTime']['output']>;
  platform: SocialPlatform;
  scopes: Array<Scalars['String']['output']>;
  status: ConnectionStatus;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface SocialInsight {
  __typename?: 'SocialInsight';
  acknowledgedAt: Maybe<Scalars['DateTime']['output']>;
  body: Scalars['String']['output'];
  costUsd: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  insightType: InsightType;
  modelUsed: Scalars['String']['output'];
  platforms: Array<SocialPlatform>;
  severity: InsightSeverity;
  title: Scalars['String']['output'];
}

export interface SocialMetric {
  __typename?: 'SocialMetric';
  bucket: MetricBucket;
  bucketStart: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  metricKey: Scalars['String']['output'];
  platform: SocialPlatform;
  value: Scalars['Float']['output'];
}

/** Connected analytics platform. */
export enum SocialPlatform {
  FACEBOOK = 'FACEBOOK',
  GOGOCASH = 'GOGOCASH',
  INSTAGRAM = 'INSTAGRAM',
  LINE_VOOM = 'LINE_VOOM',
  THREADS = 'THREADS',
  TIKTOK = 'TIKTOK',
}

export interface SpaceAccessDeniedDataType {
  __typename?: 'SpaceAccessDeniedDataType';
  spaceId: Scalars['String']['output'];
}

export interface SpaceNotFoundDataType {
  __typename?: 'SpaceNotFoundDataType';
  spaceId: Scalars['String']['output'];
}

export interface SpaceOwnerNotFoundDataType {
  __typename?: 'SpaceOwnerNotFoundDataType';
  spaceId: Scalars['String']['output'];
}

export interface SpaceShouldHaveOnlyOneOwnerDataType {
  __typename?: 'SpaceShouldHaveOnlyOneOwnerDataType';
  spaceId: Scalars['String']['output'];
}

export interface SsrfBlockedErrorDataType {
  __typename?: 'SsrfBlockedErrorDataType';
  reason: Scalars['String']['output'];
}

export interface StoreMnAgentMemoryInput {
  agentId: Scalars['ID']['input'];
  contentMd: Scalars['String']['input'];
  importance?: InputMaybe<Scalars['Int']['input']>;
  kind: MnMemoryKind;
  projectId: Scalars['ID']['input'];
  taskId?: InputMaybe<Scalars['ID']['input']>;
  workspaceId: Scalars['ID']['input'];
}

export interface StreamObject {
  __typename?: 'StreamObject';
  args: Maybe<Scalars['JSON']['output']>;
  result: Maybe<Scalars['JSON']['output']>;
  textDelta: Maybe<Scalars['String']['output']>;
  toolCallId: Maybe<Scalars['String']['output']>;
  toolName: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
}

export interface SubmitAudioTranscriptionInput {
  quality?: InputMaybe<TranscriptionQualityInput>;
  sliceManifest?: InputMaybe<Array<AudioSliceManifestItemInput>>;
  sourceAudio?: InputMaybe<TranscriptionSourceAudioInput>;
}

export interface SubscriptionAlreadyExistsDataType {
  __typename?: 'SubscriptionAlreadyExistsDataType';
  plan: Scalars['String']['output'];
}

export interface SubscriptionNotExistsDataType {
  __typename?: 'SubscriptionNotExistsDataType';
  plan: Scalars['String']['output'];
}

export enum SubscriptionPlan {
  AI = 'AI',
  Enterprise = 'Enterprise',
  Free = 'Free',
  Pro = 'Pro',
  SelfHosted = 'SelfHosted',
  SelfHostedTeam = 'SelfHostedTeam',
  Team = 'Team',
}

export interface SubscriptionPlanNotFoundDataType {
  __typename?: 'SubscriptionPlanNotFoundDataType';
  plan: Scalars['String']['output'];
  recurring: Scalars['String']['output'];
}

export interface SubscriptionPrice {
  __typename?: 'SubscriptionPrice';
  amount: Maybe<Scalars['Int']['output']>;
  currency: Scalars['String']['output'];
  lifetimeAmount: Maybe<Scalars['Int']['output']>;
  plan: SubscriptionPlan;
  type: Scalars['String']['output'];
  yearlyAmount: Maybe<Scalars['Int']['output']>;
}

export enum SubscriptionRecurring {
  Lifetime = 'Lifetime',
  Monthly = 'Monthly',
  Yearly = 'Yearly',
}

export enum SubscriptionStatus {
  Active = 'Active',
  Canceled = 'Canceled',
  Incomplete = 'Incomplete',
  IncompleteExpired = 'IncompleteExpired',
  PastDue = 'PastDue',
  Paused = 'Paused',
  Trialing = 'Trialing',
  Unpaid = 'Unpaid',
}

export interface SubscriptionType {
  __typename?: 'SubscriptionType';
  canceledAt: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  end: Maybe<Scalars['DateTime']['output']>;
  /** If provider is revenuecat, indicates underlying store. Read-only. One of: app_store | play_store */
  iapStore: Maybe<Scalars['String']['output']>;
  /** @deprecated removed */
  id: Maybe<Scalars['String']['output']>;
  nextBillAt: Maybe<Scalars['DateTime']['output']>;
  /**
   * The 'Free' plan just exists to be a placeholder and for the type convenience of frontend.
   * There won't actually be a subscription with plan 'Free'
   */
  plan: SubscriptionPlan;
  /** Payment provider of this subscription. Read-only. One of: stripe | revenuecat */
  provider: Maybe<Scalars['String']['output']>;
  recurring: SubscriptionRecurring;
  start: Scalars['DateTime']['output'];
  status: SubscriptionStatus;
  trialEnd: Maybe<Scalars['DateTime']['output']>;
  trialStart: Maybe<Scalars['DateTime']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  variant: Maybe<SubscriptionVariant>;
}

export enum SubscriptionVariant {
  EA = 'EA',
  Onetime = 'Onetime',
}

export interface ThreadsConnectAuthUrl {
  __typename?: 'ThreadsConnectAuthUrl';
  url: Scalars['String']['output'];
}

export interface ThreadsConnectionType {
  __typename?: 'ThreadsConnectionType';
  connected: Scalars['Boolean']['output'];
  username: Maybe<Scalars['String']['output']>;
}

export interface TiktokConnectAuthUrl {
  __typename?: 'TiktokConnectAuthUrl';
  url: Scalars['String']['output'];
}

export interface TiktokConnectionType {
  __typename?: 'TiktokConnectionType';
  connected: Scalars['Boolean']['output'];
  displayName: Maybe<Scalars['String']['output']>;
}

export enum TimeBucket {
  Day = 'Day',
  Minute = 'Minute',
}

export interface TimeWindow {
  __typename?: 'TimeWindow';
  bucket: TimeBucket;
  effectiveSize: Scalars['Int']['output'];
  from: Scalars['DateTime']['output'];
  requestedSize: Scalars['Int']['output'];
  timezone: Scalars['String']['output'];
  to: Scalars['DateTime']['output'];
}

export interface TranscriptionItemType {
  __typename?: 'TranscriptionItemType';
  end: Scalars['String']['output'];
  speaker: Scalars['String']['output'];
  start: Scalars['String']['output'];
  transcription: Scalars['String']['output'];
}

export interface TranscriptionQualityInput {
  degraded?: InputMaybe<Scalars['Boolean']['input']>;
  overflowCount?: InputMaybe<Scalars['Int']['input']>;
}

export interface TranscriptionQualityType {
  __typename?: 'TranscriptionQualityType';
  degraded: Maybe<Scalars['Boolean']['output']>;
  overflowCount: Maybe<Scalars['Int']['output']>;
}

export interface TranscriptionResultType {
  __typename?: 'TranscriptionResultType';
  actions: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  normalizedSegments: Maybe<Array<NormalizedTranscriptSegmentType>>;
  normalizedTranscript: Maybe<Scalars['String']['output']>;
  quality: Maybe<TranscriptionQualityType>;
  sliceManifest: Maybe<Array<AudioSliceManifestItemType>>;
  sourceAudio: Maybe<TranscriptionSourceAudioType>;
  status: AiJobStatus;
  summary: Maybe<Scalars['String']['output']>;
  summaryJson: Maybe<MeetingSummaryV2Type>;
  title: Maybe<Scalars['String']['output']>;
  transcription: Maybe<Array<TranscriptionItemType>>;
}

export interface TranscriptionSourceAudioInput {
  channels?: InputMaybe<Scalars['Int']['input']>;
  durationMs?: InputMaybe<Scalars['Int']['input']>;
  mimeType?: InputMaybe<Scalars['String']['input']>;
  sampleRate?: InputMaybe<Scalars['Int']['input']>;
}

export interface TranscriptionSourceAudioType {
  __typename?: 'TranscriptionSourceAudioType';
  blobId: Maybe<Scalars['String']['output']>;
  channels: Maybe<Scalars['Int']['output']>;
  durationMs: Maybe<Scalars['Int']['output']>;
  mimeType: Maybe<Scalars['String']['output']>;
  sampleRate: Maybe<Scalars['Int']['output']>;
}

export type UnionNotificationBodyType =
  | BudgetSoftCapNotificationBodyType
  | InvitationAcceptedNotificationBodyType
  | InvitationBlockedNotificationBodyType
  | InvitationNotificationBodyType
  | InvitationReviewApprovedNotificationBodyType
  | InvitationReviewDeclinedNotificationBodyType
  | InvitationReviewRequestNotificationBodyType
  | MentionNotificationBodyType;

export interface UnknownOauthProviderDataType {
  __typename?: 'UnknownOauthProviderDataType';
  name: Scalars['String']['output'];
}

export interface UnsupportedClientVersionDataType {
  __typename?: 'UnsupportedClientVersionDataType';
  clientVersion: Scalars['String']['output'];
  requiredVersion: Scalars['String']['output'];
}

export interface UnsupportedSubscriptionPlanDataType {
  __typename?: 'UnsupportedSubscriptionPlanDataType';
  plan: Scalars['String']['output'];
}

export interface UpdateAgentInput {
  avatar?: InputMaybe<Scalars['JSONObject']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  files?: InputMaybe<Array<Scalars['String']['input']>>;
  instructions?: InputMaybe<Scalars['String']['input']>;
  links?: InputMaybe<Array<AgentLinkInput>>;
  name?: InputMaybe<Scalars['String']['input']>;
  skills?: InputMaybe<Array<Scalars['String']['input']>>;
}

export interface UpdateAppConfigInput {
  key: Scalars['String']['input'];
  module: Scalars['String']['input'];
  value: Scalars['JSON']['input'];
}

export interface UpdateChatSessionInput {
  /** The workspace id of the session */
  docId?: InputMaybe<Scalars['String']['input']>;
  /** Whether to pin the session */
  pinned?: InputMaybe<Scalars['Boolean']['input']>;
  /** Pin (or clear, pass null) the floating-chat tab to a doc id. (E2.5) */
  pinnedDocId?: InputMaybe<Scalars['String']['input']>;
  /** The prompt name to use for the session */
  promptName?: InputMaybe<Scalars['String']['input']>;
  sessionId: Scalars['String']['input'];
}

export interface UpdateDocDefaultRoleInput {
  docId: Scalars['String']['input'];
  role: DocRole;
  workspaceId: Scalars['String']['input'];
}

export interface UpdateDocUserRoleInput {
  docId: Scalars['String']['input'];
  role: DocRole;
  userId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface UpdateMnAgentInput {
  adapterConfig?: InputMaybe<Scalars['JSONObject']['input']>;
  adapterType?: InputMaybe<MnAgentAdapterType>;
  capabilities?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  reportsToAgentId?: InputMaybe<Scalars['ID']['input']>;
  roleId?: InputMaybe<Scalars['ID']['input']>;
  runtimeConfig?: InputMaybe<Scalars['JSONObject']['input']>;
  status?: InputMaybe<MnAgentStatus>;
}

export interface UpdateMnAgentRoleInput {
  adapter?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  escalation?: InputMaybe<Scalars['String']['input']>;
  responsibility?: InputMaybe<Scalars['String']['input']>;
}

export interface UpdateMnBudgetInput {
  capCents?: InputMaybe<Scalars['Int']['input']>;
  hardStopEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  warnThresholdPct?: InputMaybe<Scalars['Int']['input']>;
}

export interface UpdateMnCrmAccountInput {
  industry?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  ownerUserId?: InputMaybe<Scalars['ID']['input']>;
  website?: InputMaybe<Scalars['String']['input']>;
}

export interface UpdateMnCrmActivityInput {
  body?: InputMaybe<Scalars['String']['input']>;
  completedAt?: InputMaybe<Scalars['DateTime']['input']>;
  dueAt?: InputMaybe<Scalars['DateTime']['input']>;
  subject?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<MnCrmActivityType>;
}

export interface UpdateMnCrmContactInput {
  accountId?: InputMaybe<Scalars['ID']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  ownerUserId?: InputMaybe<Scalars['ID']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
}

export interface UpdateMnCrmDealInput {
  accountId?: InputMaybe<Scalars['ID']['input']>;
  contactId?: InputMaybe<Scalars['ID']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  expectedCloseAt?: InputMaybe<Scalars['DateTime']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  ownerUserId?: InputMaybe<Scalars['ID']['input']>;
  probability?: InputMaybe<Scalars['Int']['input']>;
  stageId?: InputMaybe<Scalars['ID']['input']>;
  value?: InputMaybe<Scalars['Float']['input']>;
}

export interface UpdateMnCrmDealStageInput {
  name?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
}

export interface UpdateMnGoalInput {
  description?: InputMaybe<Scalars['String']['input']>;
  level?: InputMaybe<MnGoalLevel>;
  ownerAgentId?: InputMaybe<Scalars['ID']['input']>;
  parentGoalId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<MnGoalStatus>;
  title?: InputMaybe<Scalars['String']['input']>;
}

export interface UpdateMnProjectInput {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<MnProjectStatus>;
}

export interface UpdateMnReminderRuleInput {
  config?: InputMaybe<Scalars['JSONObject']['input']>;
  cronExpression?: InputMaybe<Scalars['String']['input']>;
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
}

export interface UpdateMnSkillInput {
  contentMd?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  version?: InputMaybe<Scalars['String']['input']>;
}

export interface UpdateMnTaskInput {
  assigneeUserId?: InputMaybe<Scalars['ID']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dueAt?: InputMaybe<Scalars['DateTime']['input']>;
  listSortOrder?: InputMaybe<Scalars['Int']['input']>;
  priority?: InputMaybe<MnTaskPriority>;
  status?: InputMaybe<MnTaskStatus>;
  title?: InputMaybe<Scalars['String']['input']>;
}

export interface UpdateMnWorkQueueInput {
  defaultAssigneeAgentId?: InputMaybe<Scalars['ID']['input']>;
  defaultPriority?: InputMaybe<MnTaskPriority>;
  description?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  routingRulesJson?: InputMaybe<Scalars['String']['input']>;
}

export interface UpdateOnboardingInput {
  /** Whether the user has completed (or skipped) the /welcome onboarding wizard. */
  completedOnboarding?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface UpdateUserInput {
  /** User name */
  name?: InputMaybe<Scalars['String']['input']>;
}

export interface UpdateUserSettingsInput {
  /** Receive comment email */
  receiveCommentEmail?: InputMaybe<Scalars['Boolean']['input']>;
  /** Receive invitation email */
  receiveInvitationEmail?: InputMaybe<Scalars['Boolean']['input']>;
  /** Receive mention email */
  receiveMentionEmail?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface UpdateWorkspaceCalendarsInput {
  items: Array<WorkspaceCalendarItemInput>;
  workspaceId: Scalars['String']['input'];
}

export interface UpdateWorkspaceInput {
  /** Enable AI */
  enableAi?: InputMaybe<Scalars['Boolean']['input']>;
  /** Enable doc embedding */
  enableDocEmbedding?: InputMaybe<Scalars['Boolean']['input']>;
  /** Enable workspace sharing */
  enableSharing?: InputMaybe<Scalars['Boolean']['input']>;
  /** Enable url previous when sharing */
  enableUrlPreview?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
  /** is Public workspace */
  public?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface UpsertMnPluginConfigInput {
  configJson: Scalars['JSON']['input'];
  pluginId: Scalars['ID']['input'];
  projectId?: InputMaybe<Scalars['ID']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface UserImportFailedType {
  __typename?: 'UserImportFailedType';
  email: Scalars['String']['output'];
  error: Scalars['String']['output'];
}

export type UserImportResultType = UserImportFailedType | UserType;

export type UserOrLimitedUser = LimitedUserType | UserType;

export interface UserQuotaHumanReadableType {
  __typename?: 'UserQuotaHumanReadableType';
  blobLimit: Scalars['String']['output'];
  copilotActionLimit: Scalars['String']['output'];
  historyPeriod: Scalars['String']['output'];
  memberLimit: Scalars['String']['output'];
  name: Scalars['String']['output'];
  storageQuota: Scalars['String']['output'];
  usedStorageQuota: Scalars['String']['output'];
}

export interface UserQuotaType {
  __typename?: 'UserQuotaType';
  blobLimit: Scalars['SafeInt']['output'];
  copilotActionLimit: Maybe<Scalars['Int']['output']>;
  historyPeriod: Scalars['SafeInt']['output'];
  humanReadable: UserQuotaHumanReadableType;
  memberLimit: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  storageQuota: Scalars['SafeInt']['output'];
  usedStorageQuota: Scalars['SafeInt']['output'];
}

export interface UserQuotaUsageType {
  __typename?: 'UserQuotaUsageType';
  /** @deprecated use `UserQuotaType['usedStorageQuota']` instead */
  storageQuota: Scalars['SafeInt']['output'];
}

export interface UserSettingsType {
  __typename?: 'UserSettingsType';
  /** Personalize text appended to AI prompts */
  personalize: Scalars['String']['output'];
  /** Receive comment email */
  receiveCommentEmail: Scalars['Boolean']['output'];
  /** Receive invitation email */
  receiveInvitationEmail: Scalars['Boolean']['output'];
  /** Receive mention email */
  receiveMentionEmail: Scalars['Boolean']['output'];
}

export interface UserType {
  __typename?: 'UserType';
  accessTokens: Array<AccessToken>;
  /** User avatar url */
  avatarUrl: Maybe<Scalars['String']['output']>;
  calendarAccounts: Array<CalendarAccountObjectType>;
  /** Whether the user has finished (or skipped) the /welcome onboarding wizard. Used by the frontend index router to decide whether to drop a brand-new account into /welcome or into their landing workspace. */
  completedOnboarding: Scalars['Boolean']['output'];
  copilot: Copilot;
  /**
   * User email verified
   * @deprecated useless
   */
  createdAt: Maybe<Scalars['DateTime']['output']>;
  /** User is disabled */
  disabled: Scalars['Boolean']['output'];
  /** User email */
  email: Scalars['String']['output'];
  /** User email verified */
  emailVerified: Scalars['Boolean']['output'];
  /** Enabled features of a user */
  features: Array<FeatureType>;
  /** User password has been set */
  hasPassword: Maybe<Scalars['Boolean']['output']>;
  id: Scalars['ID']['output'];
  /** Get user invoice count */
  invoiceCount: Scalars['Int']['output'];
  invoices: Array<InvoiceType>;
  /** User name */
  name: Scalars['String']['output'];
  /** Get user notification count */
  notificationCount: Scalars['Int']['output'];
  /** Get current user notifications */
  notifications: PaginatedNotificationObjectType;
  quota: UserQuotaType;
  quotaUsage: UserQuotaUsageType;
  revealedAccessTokens: Array<RevealedAccessToken>;
  /** Get user settings */
  settings: UserSettingsType;
  subscriptions: Array<SubscriptionType>;
  /** @deprecated use [/api/auth/sign-in?native=true] instead */
  token: TokenType;
}

export interface UserTypeCopilotArgs {
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface UserTypeInvoicesArgs {
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
}

export interface UserTypeNotificationsArgs {
  pagination: PaginationInput;
}

export interface ValidationErrorDataType {
  __typename?: 'ValidationErrorDataType';
  errors: Scalars['String']['output'];
}

export interface VersionRejectedDataType {
  __typename?: 'VersionRejectedDataType';
  serverVersion: Scalars['String']['output'];
  version: Scalars['String']['output'];
}

export interface WizardAnswersInput {
  /** The apps the user wants to connect ("gmail" | "calendar" | "github"). Not used by the backend yet — the frontend uses this list to render Connect buttons. */
  apps?: InputMaybe<Array<Scalars['String']['input']>>;
  /** One of "saas" | "agency" | "personal" | "research" | "other". Drives the Project plan template. */
  context?: InputMaybe<Scalars['String']['input']>;
  /** Free-text project name from the final wizard step. */
  project?: InputMaybe<Scalars['String']['input']>;
  /** One of "solo" | "2-5" | "6-20" | "20+". When non-solo we add a Team notes starter doc. */
  team?: InputMaybe<Scalars['String']['input']>;
}

export interface WorkspaceCalendarItemInput {
  colorOverride?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  subscriptionId: Scalars['String']['input'];
}

export interface WorkspaceCalendarItemObjectType {
  __typename?: 'WorkspaceCalendarItemObjectType';
  colorOverride: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['String']['output'];
  sortOrder: Maybe<Scalars['Int']['output']>;
  subscriptionId: Scalars['String']['output'];
}

export interface WorkspaceCalendarObjectType {
  __typename?: 'WorkspaceCalendarObjectType';
  colorOverride: Maybe<Scalars['String']['output']>;
  createdByUserId: Scalars['String']['output'];
  displayNameOverride: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  events: Array<CalendarEventObjectType>;
  id: Scalars['String']['output'];
  items: Array<WorkspaceCalendarItemObjectType>;
  workspaceId: Scalars['String']['output'];
}

export interface WorkspaceCalendarObjectTypeEventsArgs {
  from: Scalars['DateTime']['input'];
  to: Scalars['DateTime']['input'];
}

export interface WorkspaceDocMeta {
  __typename?: 'WorkspaceDocMeta';
  createdAt: Scalars['DateTime']['output'];
  createdBy: Maybe<EditorType>;
  updatedAt: Scalars['DateTime']['output'];
  updatedBy: Maybe<EditorType>;
}

/** Workspace invite link expire time */
export enum WorkspaceInviteLinkExpireTime {
  OneDay = 'OneDay',
  OneMonth = 'OneMonth',
  OneWeek = 'OneWeek',
  ThreeDays = 'ThreeDays',
}

/** Member invite status in workspace */
export enum WorkspaceMemberStatus {
  Accepted = 'Accepted',
  AllocatingSeat = 'AllocatingSeat',
  NeedMoreSeat = 'NeedMoreSeat',
  NeedMoreSeatAndReview = 'NeedMoreSeatAndReview',
  Pending = 'Pending',
  UnderReview = 'UnderReview',
}

export interface WorkspacePermissionNotFoundDataType {
  __typename?: 'WorkspacePermissionNotFoundDataType';
  spaceId: Scalars['String']['output'];
}

export interface WorkspacePermissions {
  __typename?: 'WorkspacePermissions';
  Workspace_Administrators_Manage: Scalars['Boolean']['output'];
  Workspace_Blobs_List: Scalars['Boolean']['output'];
  Workspace_Blobs_Read: Scalars['Boolean']['output'];
  Workspace_Blobs_Write: Scalars['Boolean']['output'];
  Workspace_Copilot: Scalars['Boolean']['output'];
  Workspace_CreateDoc: Scalars['Boolean']['output'];
  Workspace_Delete: Scalars['Boolean']['output'];
  Workspace_Organize_Read: Scalars['Boolean']['output'];
  Workspace_Payment_Manage: Scalars['Boolean']['output'];
  Workspace_Properties_Create: Scalars['Boolean']['output'];
  Workspace_Properties_Delete: Scalars['Boolean']['output'];
  Workspace_Properties_Read: Scalars['Boolean']['output'];
  Workspace_Properties_Update: Scalars['Boolean']['output'];
  Workspace_Read: Scalars['Boolean']['output'];
  Workspace_Settings_Read: Scalars['Boolean']['output'];
  Workspace_Settings_Update: Scalars['Boolean']['output'];
  Workspace_Sync: Scalars['Boolean']['output'];
  Workspace_TransferOwner: Scalars['Boolean']['output'];
  Workspace_Users_Manage: Scalars['Boolean']['output'];
  Workspace_Users_Read: Scalars['Boolean']['output'];
}

export interface WorkspaceQuotaHumanReadableType {
  __typename?: 'WorkspaceQuotaHumanReadableType';
  blobLimit: Scalars['String']['output'];
  historyPeriod: Scalars['String']['output'];
  memberCount: Scalars['String']['output'];
  memberLimit: Scalars['String']['output'];
  name: Scalars['String']['output'];
  overcapacityMemberCount: Scalars['String']['output'];
  storageQuota: Scalars['String']['output'];
  storageQuotaUsed: Scalars['String']['output'];
}

export interface WorkspaceQuotaType {
  __typename?: 'WorkspaceQuotaType';
  blobLimit: Scalars['SafeInt']['output'];
  historyPeriod: Scalars['SafeInt']['output'];
  humanReadable: WorkspaceQuotaHumanReadableType;
  memberCount: Scalars['Int']['output'];
  memberLimit: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  overcapacityMemberCount: Scalars['Int']['output'];
  storageQuota: Scalars['SafeInt']['output'];
  /** @deprecated use `usedStorageQuota` instead */
  usedSize: Scalars['SafeInt']['output'];
  usedStorageQuota: Scalars['SafeInt']['output'];
}

export interface WorkspaceRolePermissions {
  __typename?: 'WorkspaceRolePermissions';
  permissions: WorkspacePermissions;
  role: Permission;
}

export interface WorkspaceType {
  __typename?: 'WorkspaceType';
  /** Search a specific table with aggregate */
  aggregate: AggregateResultObjectType;
  /** Get blob upload part url */
  blobUploadPartUrl: BlobUploadPart;
  /** List blobs of workspace */
  blobs: Array<ListedBlob>;
  /** Blobs size of workspace */
  blobsSize: Scalars['Int']['output'];
  calendars: Array<WorkspaceCalendarObjectType>;
  /** Get comment changes of a doc */
  commentChanges: PaginatedCommentChangeObjectType;
  /** Get comments of a doc */
  comments: PaginatedCommentObjectType;
  /** Workspace created date */
  createdAt: Scalars['DateTime']['output'];
  /** Get get with given id */
  doc: DocType;
  docs: PaginatedDocType;
  embedding: CopilotWorkspaceConfig;
  /** Enable AI */
  enableAi: Scalars['Boolean']['output'];
  /** Enable doc embedding */
  enableDocEmbedding: Scalars['Boolean']['output'];
  /** Enable workspace sharing */
  enableSharing: Scalars['Boolean']['output'];
  /** Enable url previous when sharing */
  enableUrlPreview: Scalars['Boolean']['output'];
  histories: Array<DocHistoryType>;
  id: Scalars['ID']['output'];
  /** is current workspace initialized */
  initialized: Scalars['Boolean']['output'];
  /** invite link for workspace */
  inviteLink: Maybe<InviteLink>;
  /** Get user invoice count */
  invoiceCount: Scalars['Int']['output'];
  invoices: Array<InvoiceType>;
  /** The selfhost license of the workspace */
  license: Maybe<License>;
  /** member count of workspace */
  memberCount: Scalars['Int']['output'];
  /** Members of workspace */
  members: Array<InviteUserType>;
  /** Owner of workspace */
  owner: UserType;
  /**
   * Cloud page metadata of workspace
   * @deprecated use [WorkspaceType.doc] instead
   */
  pageMeta: WorkspaceDocMeta;
  /** map of action permissions */
  permissions: WorkspacePermissions;
  /** is Public workspace */
  public: Scalars['Boolean']['output'];
  /** Get public docs of a workspace */
  publicDocs: Array<DocType>;
  /** quota of workspace */
  quota: WorkspaceQuotaType;
  /** Get recently updated docs of a workspace */
  recentlyUpdatedDocs: PaginatedDocType;
  /** Role of current signed in user in workspace */
  role: Permission;
  /** Search a specific table */
  search: SearchResultObjectType;
  /** Search docs by keyword */
  searchDocs: Array<SearchDocObjectType>;
  /** URL-safe workspace path segment */
  slug: Scalars['String']['output'];
  /** The team subscription of the workspace, if exists. */
  subscription: Maybe<SubscriptionType>;
  /** if workspace is team workspace */
  team: Scalars['Boolean']['output'];
}

export interface WorkspaceTypeAggregateArgs {
  input: AggregateInput;
}

export interface WorkspaceTypeBlobUploadPartUrlArgs {
  key: Scalars['String']['input'];
  partNumber: Scalars['Int']['input'];
  uploadId: Scalars['String']['input'];
}

export interface WorkspaceTypeCommentChangesArgs {
  docId: Scalars['String']['input'];
  pagination: PaginationInput;
}

export interface WorkspaceTypeCommentsArgs {
  docId: Scalars['String']['input'];
  pagination?: InputMaybe<PaginationInput>;
}

export interface WorkspaceTypeDocArgs {
  docId: Scalars['String']['input'];
}

export interface WorkspaceTypeDocsArgs {
  pagination: PaginationInput;
}

export interface WorkspaceTypeHistoriesArgs {
  before?: InputMaybe<Scalars['DateTime']['input']>;
  guid: Scalars['String']['input'];
  take?: InputMaybe<Scalars['Int']['input']>;
}

export interface WorkspaceTypeInvoicesArgs {
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
}

export interface WorkspaceTypeMembersArgs {
  query?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
}

export interface WorkspaceTypePageMetaArgs {
  pageId: Scalars['String']['input'];
}

export interface WorkspaceTypeRecentlyUpdatedDocsArgs {
  pagination: PaginationInput;
}

export interface WorkspaceTypeSearchArgs {
  input: SearchInput;
}

export interface WorkspaceTypeSearchDocsArgs {
  input: SearchDocsInput;
}

export interface WorkspaceUserType {
  __typename?: 'WorkspaceUserType';
  avatarUrl: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
}

export interface WrongSignInCredentialsDataType {
  __typename?: 'WrongSignInCredentialsDataType';
  email: Scalars['String']['output'];
}

export interface TokenType {
  __typename?: 'tokenType';
  refresh: Scalars['String']['output'];
  sessionToken: Maybe<Scalars['String']['output']>;
  token: Scalars['String']['output'];
}

export type GenerateUserAccessTokenMutationVariables = Exact<{
  input: GenerateAccessTokenInput;
}>;

export type GenerateUserAccessTokenMutation = {
  __typename?: 'Mutation';
  generateUserAccessToken: {
    __typename?: 'RevealedAccessToken';
    id: string;
    name: string;
    token: string;
    createdAt: string;
    expiresAt: string | null;
  };
};

export type ListUserAccessTokensQueryVariables = Exact<{
  [key: string]: never;
}>;

export type ListUserAccessTokensQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    revealedAccessTokens: Array<{
      __typename?: 'RevealedAccessToken';
      id: string;
      name: string;
      createdAt: string;
      expiresAt: string | null;
      token: string;
    }>;
  } | null;
};

export type RevokeUserAccessTokenMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type RevokeUserAccessTokenMutation = {
  __typename?: 'Mutation';
  revokeUserAccessToken: boolean;
};

export type AdminVerifiedDocsQueryVariables = Exact<{
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}>;

export type AdminVerifiedDocsQuery = {
  __typename?: 'Query';
  adminVerifiedDocs: Array<{
    __typename?: 'AdminVerifiedDoc';
    workspaceId: string;
    docId: string;
    verifiedAt: string;
    verifiedBy: string | null;
    verificationExpiresAt: string | null;
  }>;
};

export type AdminAllSharedLinksQueryVariables = Exact<{
  pagination: PaginationInput;
  filter?: InputMaybe<AdminAllSharedLinksFilterInput>;
}>;

export type AdminAllSharedLinksQuery = {
  __typename?: 'Query';
  adminAllSharedLinks: {
    __typename?: 'PaginatedAdminAllSharedLink';
    totalCount: number | null;
    analyticsWindow: {
      __typename?: 'TimeWindow';
      from: string;
      to: string;
      timezone: string;
      bucket: TimeBucket;
      requestedSize: number;
      effectiveSize: number;
    };
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
    edges: Array<{
      __typename?: 'AdminAllSharedLinkEdge';
      cursor: string;
      node: {
        __typename?: 'AdminAllSharedLink';
        workspaceId: string;
        docId: string;
        title: string | null;
        publishedAt: string | null;
        docUpdatedAt: string | null;
        workspaceOwnerId: string | null;
        lastUpdaterId: string | null;
        shareUrl: string;
        views: number | null;
        uniqueViews: number | null;
        guestViews: number | null;
        lastAccessedAt: string | null;
      };
    }>;
  };
};

export type AdminDashboardQueryVariables = Exact<{
  input?: InputMaybe<AdminDashboardInput>;
}>;

export type AdminDashboardQuery = {
  __typename?: 'Query';
  adminDashboard: {
    __typename?: 'AdminDashboard';
    syncActiveUsers: number;
    copilotConversations: number;
    workspaceStorageBytes: number;
    blobStorageBytes: number;
    generatedAt: string;
    syncActiveUsersTimeline: Array<{
      __typename?: 'AdminDashboardMinutePoint';
      minute: string;
      activeUsers: number;
    }>;
    syncWindow: {
      __typename?: 'TimeWindow';
      from: string;
      to: string;
      timezone: string;
      bucket: TimeBucket;
      requestedSize: number;
      effectiveSize: number;
    };
    workspaceStorageHistory: Array<{
      __typename?: 'AdminDashboardValueDayPoint';
      date: string;
      value: number;
    }>;
    blobStorageHistory: Array<{
      __typename?: 'AdminDashboardValueDayPoint';
      date: string;
      value: number;
    }>;
    storageWindow: {
      __typename?: 'TimeWindow';
      from: string;
      to: string;
      timezone: string;
      bucket: TimeBucket;
      requestedSize: number;
      effectiveSize: number;
    };
    topSharedLinks: Array<{
      __typename?: 'AdminSharedLinkTopItem';
      workspaceId: string;
      docId: string;
      title: string | null;
      shareUrl: string;
      publishedAt: string | null;
      views: number;
      uniqueViews: number;
      guestViews: number;
      lastAccessedAt: string | null;
    }>;
    topSharedLinksWindow: {
      __typename?: 'TimeWindow';
      from: string;
      to: string;
      timezone: string;
      bucket: TimeBucket;
      requestedSize: number;
      effectiveSize: number;
    };
  };
};

export type AdminServerConfigQueryVariables = Exact<{ [key: string]: never }>;

export type AdminServerConfigQuery = {
  __typename?: 'Query';
  serverConfig: {
    __typename?: 'ServerConfigType';
    version: string;
    baseUrl: string;
    name: string;
    features: Array<ServerFeature>;
    type: ServerDeploymentType;
    initialized: boolean;
    availableUserFeatures: Array<FeatureType>;
    availableWorkspaceFeatures: Array<FeatureType>;
    credentialsRequirement: {
      __typename?: 'CredentialsRequirementType';
      password: {
        __typename?: 'PasswordLimitsType';
        minLength: number;
        maxLength: number;
      };
    };
    availableUpgrade: {
      __typename?: 'ReleaseVersionType';
      changelog: string;
      version: string;
      publishedAt: string;
      url: string;
    } | null;
  };
};

export type AdminUpdateWorkspaceMutationVariables = Exact<{
  input: AdminUpdateWorkspaceInput;
}>;

export type AdminUpdateWorkspaceMutation = {
  __typename?: 'Mutation';
  adminUpdateWorkspace: {
    __typename?: 'AdminWorkspace';
    id: string;
    public: boolean;
    createdAt: string;
    name: string | null;
    avatarKey: string | null;
    enableAi: boolean;
    enableSharing: boolean;
    enableUrlPreview: boolean;
    enableDocEmbedding: boolean;
    features: Array<FeatureType>;
    memberCount: number;
    publicPageCount: number;
    snapshotCount: number;
    snapshotSize: number;
    blobCount: number;
    blobSize: number;
    owner: {
      __typename?: 'WorkspaceUserType';
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    } | null;
  } | null;
};

export type AdminWorkspaceQueryVariables = Exact<{
  id: Scalars['String']['input'];
  memberSkip?: InputMaybe<Scalars['Int']['input']>;
  memberTake?: InputMaybe<Scalars['Int']['input']>;
  memberQuery?: InputMaybe<Scalars['String']['input']>;
}>;

export type AdminWorkspaceQuery = {
  __typename?: 'Query';
  adminWorkspace: {
    __typename?: 'AdminWorkspace';
    id: string;
    public: boolean;
    createdAt: string;
    name: string | null;
    avatarKey: string | null;
    enableAi: boolean;
    enableSharing: boolean;
    enableUrlPreview: boolean;
    enableDocEmbedding: boolean;
    features: Array<FeatureType>;
    memberCount: number;
    publicPageCount: number;
    snapshotCount: number;
    snapshotSize: number;
    blobCount: number;
    blobSize: number;
    owner: {
      __typename?: 'WorkspaceUserType';
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    } | null;
    sharedLinks: Array<{
      __typename?: 'AdminWorkspaceSharedLink';
      docId: string;
      title: string | null;
      publishedAt: string | null;
    }>;
    members: Array<{
      __typename?: 'AdminWorkspaceMember';
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      role: Permission;
      status: WorkspaceMemberStatus;
    }>;
  } | null;
};

export type AdminWorkspacesQueryVariables = Exact<{
  filter: ListWorkspaceInput;
}>;

export type AdminWorkspacesQuery = {
  __typename?: 'Query';
  adminWorkspaces: Array<{
    __typename?: 'AdminWorkspace';
    id: string;
    public: boolean;
    createdAt: string;
    name: string | null;
    avatarKey: string | null;
    enableAi: boolean;
    enableSharing: boolean;
    enableUrlPreview: boolean;
    enableDocEmbedding: boolean;
    features: Array<FeatureType>;
    memberCount: number;
    publicPageCount: number;
    snapshotCount: number;
    snapshotSize: number;
    blobCount: number;
    blobSize: number;
    owner: {
      __typename?: 'WorkspaceUserType';
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    } | null;
  }>;
};

export type AdminWorkspacesCountQueryVariables = Exact<{
  filter: ListWorkspaceInput;
}>;

export type AdminWorkspacesCountQuery = {
  __typename?: 'Query';
  adminWorkspacesCount: number;
};

export type CreateChangePasswordUrlMutationVariables = Exact<{
  callbackUrl: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}>;

export type CreateChangePasswordUrlMutation = {
  __typename?: 'Mutation';
  createChangePasswordUrl: string;
};

export type AppConfigQueryVariables = Exact<{ [key: string]: never }>;

export type AppConfigQuery = { __typename?: 'Query'; appConfig: any };

export type CreateUserMutationVariables = Exact<{
  input: CreateUserInput;
}>;

export type CreateUserMutation = {
  __typename?: 'Mutation';
  createUser: { __typename?: 'UserType'; id: string };
};

export type DeleteUserMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DeleteUserMutation = {
  __typename?: 'Mutation';
  deleteUser: { __typename?: 'DeleteAccount'; success: boolean };
};

export type DisableUserMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DisableUserMutation = {
  __typename?: 'Mutation';
  banUser: { __typename?: 'UserType'; email: string; disabled: boolean };
};

export type EnableUserMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type EnableUserMutation = {
  __typename?: 'Mutation';
  enableUser: { __typename?: 'UserType'; email: string; disabled: boolean };
};

export type GetUserByEmailQueryVariables = Exact<{
  email: Scalars['String']['input'];
}>;

export type GetUserByEmailQuery = {
  __typename?: 'Query';
  userByEmail: {
    __typename?: 'UserType';
    id: string;
    name: string;
    email: string;
    features: Array<FeatureType>;
    hasPassword: boolean | null;
    emailVerified: boolean;
    avatarUrl: string | null;
    disabled: boolean;
  } | null;
};

export type ImportUsersMutationVariables = Exact<{
  input: ImportUsersInput;
}>;

export type ImportUsersMutation = {
  __typename?: 'Mutation';
  importUsers: Array<
    | { __typename: 'UserImportFailedType'; email: string; error: string }
    | { __typename: 'UserType'; id: string; name: string; email: string }
  >;
};

export type ListUsersQueryVariables = Exact<{
  filter: ListUserInput;
}>;

export type ListUsersQuery = {
  __typename?: 'Query';
  usersCount: number;
  users: Array<{
    __typename?: 'UserType';
    id: string;
    name: string;
    email: string;
    disabled: boolean;
    features: Array<FeatureType>;
    hasPassword: boolean | null;
    emailVerified: boolean;
    avatarUrl: string | null;
  }>;
};

export type SendTestEmailMutationVariables = Exact<{
  host: Scalars['String']['input'];
  port: Scalars['Int']['input'];
  sender: Scalars['String']['input'];
  username: Scalars['String']['input'];
  password: Scalars['String']['input'];
  ignoreTLS: Scalars['Boolean']['input'];
}>;

export type SendTestEmailMutation = {
  __typename?: 'Mutation';
  sendTestEmail: boolean;
};

export type UpdateAccountFeaturesMutationVariables = Exact<{
  userId: Scalars['String']['input'];
  features: Array<FeatureType> | FeatureType;
}>;

export type UpdateAccountFeaturesMutation = {
  __typename?: 'Mutation';
  updateUserFeatures: Array<FeatureType>;
};

export type UpdateAccountMutationVariables = Exact<{
  id: Scalars['String']['input'];
  input: ManageUserInput;
}>;

export type UpdateAccountMutation = {
  __typename?: 'Mutation';
  updateUser: {
    __typename?: 'UserType';
    id: string;
    name: string;
    email: string;
  };
};

export type UpdateAppConfigMutationVariables = Exact<{
  updates: Array<UpdateAppConfigInput> | UpdateAppConfigInput;
}>;

export type UpdateAppConfigMutation = {
  __typename?: 'Mutation';
  updateAppConfig: any;
};

export type ValidateConfigQueryVariables = Exact<{
  updates: Array<UpdateAppConfigInput> | UpdateAppConfigInput;
}>;

export type ValidateConfigQuery = {
  __typename?: 'Query';
  validateAppConfig: Array<{
    __typename?: 'AppConfigValidateResult';
    module: string;
    key: string;
    value: Record<string, string>;
    valid: boolean;
    error: string | null;
  }>;
};

export type DailyStatsQueryVariables = Exact<{
  input: DailyStatsInput;
}>;

export type DailyStatsQuery = {
  __typename?: 'Query';
  dailyStats: Array<{
    __typename?: 'DailyStat';
    day: string;
    metric: string;
    value: number;
  }>;
};

export type BackfillAnalyticsMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  daysBack: Scalars['Int']['input'];
}>;

export type BackfillAnalyticsMutation = {
  __typename?: 'Mutation';
  backfillAnalytics: number;
};

export type AcknowledgeInsightMutationVariables = Exact<{
  input: AcknowledgeInsightInput;
}>;

export type AcknowledgeInsightMutation = {
  __typename?: 'Mutation';
  acknowledgeInsight: {
    __typename?: 'SocialInsight';
    id: string;
    insightType: InsightType;
    platforms: Array<SocialPlatform>;
    title: string;
    body: string;
    severity: InsightSeverity;
    modelUsed: string;
    createdAt: string;
    acknowledgedAt: string | null;
  };
};

export type BeginPlatformConnectMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  platform: SocialPlatform;
}>;

export type BeginPlatformConnectMutation = {
  __typename?: 'Mutation';
  beginPlatformConnect: { __typename?: 'BeginOAuthResult'; url: string };
};

export type CancelPlatformConnectMutationVariables = Exact<{
  input: CancelPlatformConnectInput;
}>;

export type CancelPlatformConnectMutation = {
  __typename?: 'Mutation';
  cancelPlatformConnect: boolean;
};

export type DisconnectPlatformMutationVariables = Exact<{
  connectionId: Scalars['String']['input'];
}>;

export type DisconnectPlatformMutation = {
  __typename?: 'Mutation';
  disconnectPlatform: boolean;
};

export type FinalizePlatformConnectMutationVariables = Exact<{
  input: FinalizePlatformConnectInput;
}>;

export type FinalizePlatformConnectMutation = {
  __typename?: 'Mutation';
  finalizePlatformConnect: {
    __typename?: 'SocialConnection';
    id: string;
    workspaceId: string;
    platform: SocialPlatform;
    status: ConnectionStatus;
    externalAccountName: string;
    lastSyncAt: string | null;
    lastError: string | null;
  };
};

export type GetAnalyticsOverviewQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetAnalyticsOverviewQuery = {
  __typename?: 'Query';
  getOverview: {
    __typename?: 'AnalyticsOverview';
    workspaceId: string;
    generatedAt: string;
    lastSyncAt: string | null;
    platforms: Array<{
      __typename?: 'AnalyticsPlatformStatus';
      platform: SocialPlatform;
      status: string;
      lastSyncAt: string | null;
      isConnected: boolean;
    }>;
    kpis: Array<{
      __typename?: 'AnalyticsKpi';
      key: string;
      label: string;
      value: number;
      deltaPct: number | null;
      sparkline: Array<number>;
    }>;
  };
};

export type ListConnectionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type ListConnectionsQuery = {
  __typename?: 'Query';
  connections: Array<{
    __typename?: 'SocialConnection';
    id: string;
    workspaceId: string;
    platform: SocialPlatform;
    status: ConnectionStatus;
    externalAccountName: string;
    lastSyncAt: string | null;
    lastError: string | null;
  }>;
};

export type ListInsightsQueryVariables = Exact<{
  input: ListInsightsInput;
}>;

export type ListInsightsQuery = {
  __typename?: 'Query';
  listInsights: Array<{
    __typename?: 'SocialInsight';
    id: string;
    insightType: InsightType;
    platforms: Array<SocialPlatform>;
    title: string;
    body: string;
    severity: InsightSeverity;
    modelUsed: string;
    createdAt: string;
    acknowledgedAt: string | null;
  }>;
};

export type RunContentRecommendationMutationVariables = Exact<{
  input: RunContentRecommendationInput;
}>;

export type RunContentRecommendationMutation = {
  __typename?: 'Mutation';
  runContentRecommendation: {
    __typename?: 'SocialInsight';
    id: string;
    insightType: InsightType;
    platforms: Array<SocialPlatform>;
    title: string;
    body: string;
    severity: InsightSeverity;
    modelUsed: string;
    createdAt: string;
    acknowledgedAt: string | null;
  };
};

export type DeleteBlobMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  key: Scalars['String']['input'];
  permanently?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type DeleteBlobMutation = {
  __typename?: 'Mutation';
  deleteBlob: boolean;
};

export type ListBlobsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type ListBlobsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    blobs: Array<{
      __typename?: 'ListedBlob';
      key: string;
      size: number;
      mime: string;
      createdAt: string;
    }>;
  };
};

export type ReleaseDeletedBlobsMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type ReleaseDeletedBlobsMutation = {
  __typename?: 'Mutation';
  releaseDeletedBlobs: boolean;
};

export type SetBlobMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  blob: Scalars['Upload']['input'];
}>;

export type SetBlobMutation = { __typename?: 'Mutation'; setBlob: string };

export type AbortBlobUploadMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  key: Scalars['String']['input'];
  uploadId: Scalars['String']['input'];
}>;

export type AbortBlobUploadMutation = {
  __typename?: 'Mutation';
  abortBlobUpload: boolean;
};

export type CompleteBlobUploadMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  key: Scalars['String']['input'];
  uploadId?: InputMaybe<Scalars['String']['input']>;
  parts?: InputMaybe<Array<BlobUploadPartInput> | BlobUploadPartInput>;
}>;

export type CompleteBlobUploadMutation = {
  __typename?: 'Mutation';
  completeBlobUpload: string;
};

export type CreateBlobUploadMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  key: Scalars['String']['input'];
  size: Scalars['Int']['input'];
  mime: Scalars['String']['input'];
}>;

export type CreateBlobUploadMutation = {
  __typename?: 'Mutation';
  createBlobUpload: {
    __typename?: 'BlobUploadInit';
    method: BlobUploadMethod;
    blobKey: string;
    alreadyUploaded: boolean | null;
    uploadUrl: string | null;
    headers: any | null;
    expiresAt: string | null;
    uploadId: string | null;
    partSize: number | null;
    uploadedParts: Array<{
      __typename?: 'BlobUploadedPart';
      partNumber: number;
      etag: string;
    }> | null;
  };
};

export type GetBlobUploadPartUrlQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  key: Scalars['String']['input'];
  uploadId: Scalars['String']['input'];
  partNumber: Scalars['Int']['input'];
}>;

export type GetBlobUploadPartUrlQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    blobUploadPartUrl: {
      __typename?: 'BlobUploadPart';
      uploadUrl: string;
      headers: any | null;
      expiresAt: string | null;
    };
  };
};

export type CalendarAccountsQueryVariables = Exact<{ [key: string]: never }>;

export type CalendarAccountsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    calendarAccounts: Array<{
      __typename?: 'CalendarAccountObjectType';
      id: string;
      provider: CalendarProviderType;
      providerAccountId: string;
      displayName: string | null;
      email: string | null;
      status: string;
      lastError: string | null;
      refreshIntervalMinutes: number;
      calendarsCount: number;
      createdAt: string;
      updatedAt: string;
      calendars: Array<{
        __typename?: 'CalendarSubscriptionObjectType';
        id: string;
        accountId: string;
        provider: CalendarProviderType;
        externalCalendarId: string;
        displayName: string | null;
        timezone: string | null;
        color: string | null;
        enabled: boolean;
        lastSyncAt: string | null;
      }>;
    }>;
  } | null;
};

export type CalendarEventsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  from: Scalars['DateTime']['input'];
  to: Scalars['DateTime']['input'];
}>;

export type CalendarEventsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    calendars: Array<{
      __typename?: 'WorkspaceCalendarObjectType';
      id: string;
      events: Array<{
        __typename?: 'CalendarEventObjectType';
        id: string;
        subscriptionId: string;
        externalEventId: string;
        recurrenceId: string | null;
        status: string | null;
        title: string | null;
        description: string | null;
        location: string | null;
        startAtUtc: string;
        endAtUtc: string;
        originalTimezone: string | null;
        allDay: boolean;
      }>;
    }>;
  };
};

export type CalendarProvidersQueryVariables = Exact<{ [key: string]: never }>;

export type CalendarProvidersQuery = {
  __typename?: 'Query';
  serverConfig: {
    __typename?: 'ServerConfigType';
    calendarProviders: Array<CalendarProviderType>;
    calendarCalDAVProviders: Array<{
      __typename?: 'CalendarCalDAVProviderPresetObjectType';
      id: string;
      label: string;
      requiresAppPassword: boolean | null;
      docsUrl: string | null;
    }>;
  };
};

export type LinkCalDavAccountMutationVariables = Exact<{
  input: LinkCalDavAccountInput;
}>;

export type LinkCalDavAccountMutation = {
  __typename?: 'Mutation';
  linkCalDAVAccount: {
    __typename?: 'CalendarAccountObjectType';
    id: string;
    provider: CalendarProviderType;
    providerAccountId: string;
    displayName: string | null;
    email: string | null;
    status: string;
    lastError: string | null;
    refreshIntervalMinutes: number;
    calendarsCount: number;
    createdAt: string;
    updatedAt: string;
  };
};

export type LinkCalendarAccountMutationVariables = Exact<{
  input: LinkCalendarAccountInput;
}>;

export type LinkCalendarAccountMutation = {
  __typename?: 'Mutation';
  linkCalendarAccount: string;
};

export type UnlinkCalendarAccountMutationVariables = Exact<{
  accountId: Scalars['String']['input'];
}>;

export type UnlinkCalendarAccountMutation = {
  __typename?: 'Mutation';
  unlinkCalendarAccount: boolean;
};

export type UpdateCalendarAccountMutationVariables = Exact<{
  accountId: Scalars['String']['input'];
  refreshIntervalMinutes: Scalars['Int']['input'];
}>;

export type UpdateCalendarAccountMutation = {
  __typename?: 'Mutation';
  updateCalendarAccount: {
    __typename?: 'CalendarAccountObjectType';
    id: string;
    provider: CalendarProviderType;
    providerAccountId: string;
    displayName: string | null;
    email: string | null;
    status: string;
    lastError: string | null;
    refreshIntervalMinutes: number;
    calendarsCount: number;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type UpdateWorkspaceCalendarsMutationVariables = Exact<{
  input: UpdateWorkspaceCalendarsInput;
}>;

export type UpdateWorkspaceCalendarsMutation = {
  __typename?: 'Mutation';
  updateWorkspaceCalendars: {
    __typename?: 'WorkspaceCalendarObjectType';
    id: string;
    workspaceId: string;
    createdByUserId: string;
    displayNameOverride: string | null;
    colorOverride: string | null;
    enabled: boolean;
    items: Array<{
      __typename?: 'WorkspaceCalendarItemObjectType';
      id: string;
      subscriptionId: string;
      sortOrder: number | null;
      colorOverride: string | null;
      enabled: boolean;
    }>;
  };
};

export type WorkspaceCalendarsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type WorkspaceCalendarsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    calendars: Array<{
      __typename?: 'WorkspaceCalendarObjectType';
      id: string;
      workspaceId: string;
      createdByUserId: string;
      displayNameOverride: string | null;
      colorOverride: string | null;
      enabled: boolean;
      items: Array<{
        __typename?: 'WorkspaceCalendarItemObjectType';
        id: string;
        subscriptionId: string;
        sortOrder: number | null;
        colorOverride: string | null;
        enabled: boolean;
      }>;
    }>;
  };
};

export type CancelSubscriptionMutationVariables = Exact<{
  plan?: InputMaybe<SubscriptionPlan>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}>;

export type CancelSubscriptionMutation = {
  __typename?: 'Mutation';
  cancelSubscription: {
    __typename?: 'SubscriptionType';
    id: string | null;
    status: SubscriptionStatus;
    nextBillAt: string | null;
    canceledAt: string | null;
  };
};

export type ChangeEmailMutationVariables = Exact<{
  token: Scalars['String']['input'];
  email: Scalars['String']['input'];
}>;

export type ChangeEmailMutation = {
  __typename?: 'Mutation';
  changeEmail: { __typename?: 'UserType'; id: string; email: string };
};

export type ChangePasswordMutationVariables = Exact<{
  token: Scalars['String']['input'];
  userId: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
}>;

export type ChangePasswordMutation = {
  __typename?: 'Mutation';
  changePassword: boolean;
};

export type ListCommentChangesQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  pagination: PaginationInput;
}>;

export type ListCommentChangesQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    commentChanges: {
      __typename?: 'PaginatedCommentChangeObjectType';
      totalCount: number;
      edges: Array<{
        __typename?: 'CommentChangeObjectTypeEdge';
        cursor: string;
        node: {
          __typename?: 'CommentChangeObjectType';
          action: CommentChangeAction;
          id: string;
          commentId: string | null;
          item: any;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        startCursor: string | null;
        endCursor: string | null;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    };
  };
};

export type CreateCommentMutationVariables = Exact<{
  input: CommentCreateInput;
}>;

export type CreateCommentMutation = {
  __typename?: 'Mutation';
  createComment: {
    __typename?: 'CommentObjectType';
    id: string;
    content: any;
    resolved: boolean;
    createdAt: string;
    updatedAt: string;
    user: {
      __typename?: 'PublicUserType';
      id: string;
      name: string;
      avatarUrl: string | null;
    };
    replies: Array<{
      __typename?: 'ReplyObjectType';
      commentId: string;
      id: string;
      content: any;
      createdAt: string;
      updatedAt: string;
      user: {
        __typename?: 'PublicUserType';
        id: string;
        name: string;
        avatarUrl: string | null;
      };
    }>;
  };
};

export type DeleteCommentMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DeleteCommentMutation = {
  __typename?: 'Mutation';
  deleteComment: boolean;
};

export type ListCommentsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  pagination?: InputMaybe<PaginationInput>;
}>;

export type ListCommentsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    comments: {
      __typename?: 'PaginatedCommentObjectType';
      totalCount: number;
      edges: Array<{
        __typename?: 'CommentObjectTypeEdge';
        cursor: string;
        node: {
          __typename?: 'CommentObjectType';
          id: string;
          content: any;
          resolved: boolean;
          createdAt: string;
          updatedAt: string;
          user: {
            __typename?: 'PublicUserType';
            id: string;
            name: string;
            avatarUrl: string | null;
          };
          replies: Array<{
            __typename?: 'ReplyObjectType';
            commentId: string;
            id: string;
            content: any;
            createdAt: string;
            updatedAt: string;
            user: {
              __typename?: 'PublicUserType';
              id: string;
              name: string;
              avatarUrl: string | null;
            };
          }>;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        startCursor: string | null;
        endCursor: string | null;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    };
  };
};

export type CreateReplyMutationVariables = Exact<{
  input: ReplyCreateInput;
}>;

export type CreateReplyMutation = {
  __typename?: 'Mutation';
  createReply: {
    __typename?: 'ReplyObjectType';
    commentId: string;
    id: string;
    content: any;
    createdAt: string;
    updatedAt: string;
    user: {
      __typename?: 'PublicUserType';
      id: string;
      name: string;
      avatarUrl: string | null;
    };
  };
};

export type DeleteReplyMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DeleteReplyMutation = {
  __typename?: 'Mutation';
  deleteReply: boolean;
};

export type UpdateReplyMutationVariables = Exact<{
  input: ReplyUpdateInput;
}>;

export type UpdateReplyMutation = {
  __typename?: 'Mutation';
  updateReply: boolean;
};

export type ResolveCommentMutationVariables = Exact<{
  input: CommentResolveInput;
}>;

export type ResolveCommentMutation = {
  __typename?: 'Mutation';
  resolveComment: boolean;
};

export type UpdateCommentMutationVariables = Exact<{
  input: CommentUpdateInput;
}>;

export type UpdateCommentMutation = {
  __typename?: 'Mutation';
  updateComment: boolean;
};

export type UploadCommentAttachmentMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  attachment: Scalars['Upload']['input'];
}>;

export type UploadCommentAttachmentMutation = {
  __typename?: 'Mutation';
  uploadCommentAttachment: string;
};

export type ApplyDocUpdatesMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  op: Scalars['String']['input'];
  updates: Scalars['String']['input'];
}>;

export type ApplyDocUpdatesMutation = {
  __typename?: 'Mutation';
  applyDocUpdates: string;
};

export type AddContextBlobMutationVariables = Exact<{
  options: AddContextBlobInput;
}>;

export type AddContextBlobMutation = {
  __typename?: 'Mutation';
  addContextBlob: {
    __typename?: 'CopilotContextBlob';
    id: string;
    createdAt: number;
    status: ContextEmbedStatus | null;
  };
};

export type RemoveContextBlobMutationVariables = Exact<{
  options: RemoveContextBlobInput;
}>;

export type RemoveContextBlobMutation = {
  __typename?: 'Mutation';
  removeContextBlob: boolean;
};

export type AddContextCategoryMutationVariables = Exact<{
  options: AddContextCategoryInput;
}>;

export type AddContextCategoryMutation = {
  __typename?: 'Mutation';
  addContextCategory: {
    __typename?: 'CopilotContextCategory';
    id: string;
    createdAt: number;
    type: ContextCategories;
    docs: Array<{
      __typename?: 'CopilotContextDoc';
      id: string;
      createdAt: number;
      status: ContextEmbedStatus | null;
    }>;
  };
};

export type RemoveContextCategoryMutationVariables = Exact<{
  options: RemoveContextCategoryInput;
}>;

export type RemoveContextCategoryMutation = {
  __typename?: 'Mutation';
  removeContextCategory: boolean;
};

export type CreateCopilotContextMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  sessionId: Scalars['String']['input'];
}>;

export type CreateCopilotContextMutation = {
  __typename?: 'Mutation';
  createCopilotContext: string;
};

export type AddContextDocMutationVariables = Exact<{
  options: AddContextDocInput;
}>;

export type AddContextDocMutation = {
  __typename?: 'Mutation';
  addContextDoc: {
    __typename?: 'CopilotContextDoc';
    id: string;
    createdAt: number;
    status: ContextEmbedStatus | null;
  };
};

export type RemoveContextDocMutationVariables = Exact<{
  options: RemoveContextDocInput;
}>;

export type RemoveContextDocMutation = {
  __typename?: 'Mutation';
  removeContextDoc: boolean;
};

export type AddContextFileMutationVariables = Exact<{
  content: Scalars['Upload']['input'];
  options: AddContextFileInput;
}>;

export type AddContextFileMutation = {
  __typename?: 'Mutation';
  addContextFile: {
    __typename?: 'CopilotContextFile';
    id: string;
    createdAt: number;
    name: string;
    mimeType: string;
    chunkSize: number;
    error: string | null;
    status: ContextEmbedStatus;
    blobId: string;
  };
};

export type RemoveContextFileMutationVariables = Exact<{
  options: RemoveContextFileInput;
}>;

export type RemoveContextFileMutation = {
  __typename?: 'Mutation';
  removeContextFile: boolean;
};

export type ListContextObjectQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  sessionId: Scalars['String']['input'];
  contextId: Scalars['String']['input'];
}>;

export type ListContextObjectQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contexts: Array<{
        __typename?: 'CopilotContext';
        blobs: Array<{
          __typename?: 'CopilotContextBlob';
          id: string;
          status: ContextEmbedStatus | null;
          createdAt: number;
        }>;
        docs: Array<{
          __typename?: 'CopilotContextDoc';
          id: string;
          status: ContextEmbedStatus | null;
          createdAt: number;
        }>;
        files: Array<{
          __typename?: 'CopilotContextFile';
          id: string;
          name: string;
          mimeType: string;
          blobId: string;
          chunkSize: number;
          error: string | null;
          status: ContextEmbedStatus;
          createdAt: number;
        }>;
        tags: Array<{
          __typename?: 'CopilotContextCategory';
          type: ContextCategories;
          id: string;
          createdAt: number;
          docs: Array<{
            __typename?: 'CopilotContextDoc';
            id: string;
            status: ContextEmbedStatus | null;
            createdAt: number;
          }>;
        }>;
        collections: Array<{
          __typename?: 'CopilotContextCategory';
          type: ContextCategories;
          id: string;
          createdAt: number;
          docs: Array<{
            __typename?: 'CopilotContextDoc';
            id: string;
            status: ContextEmbedStatus | null;
            createdAt: number;
          }>;
        }>;
      }>;
    };
  } | null;
};

export type ListContextQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  sessionId: Scalars['String']['input'];
}>;

export type ListContextQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contexts: Array<{
        __typename?: 'CopilotContext';
        id: string | null;
        workspaceId: string;
      }>;
    };
  } | null;
};

export type MatchContextQueryVariables = Exact<{
  contextId?: InputMaybe<Scalars['String']['input']>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
  content: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  scopedThreshold?: InputMaybe<Scalars['Float']['input']>;
  threshold?: InputMaybe<Scalars['Float']['input']>;
}>;

export type MatchContextQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contexts: Array<{
        __typename?: 'CopilotContext';
        matchFiles: Array<{
          __typename?: 'ContextMatchedFileChunk';
          fileId: string;
          blobId: string;
          name: string;
          mimeType: string;
          chunk: number;
          content: string;
          distance: number | null;
        }>;
        matchWorkspaceDocs: Array<{
          __typename?: 'ContextMatchedDocChunk';
          docId: string;
          chunk: number;
          content: string;
          distance: number | null;
        }>;
      }>;
    };
  } | null;
};

export type MatchWorkspaceDocsQueryVariables = Exact<{
  contextId?: InputMaybe<Scalars['String']['input']>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
  content: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  scopedThreshold?: InputMaybe<Scalars['Float']['input']>;
  threshold?: InputMaybe<Scalars['Float']['input']>;
}>;

export type MatchWorkspaceDocsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contexts: Array<{
        __typename?: 'CopilotContext';
        matchWorkspaceDocs: Array<{
          __typename?: 'ContextMatchedDocChunk';
          docId: string;
          chunk: number;
          content: string;
          distance: number | null;
        }>;
      }>;
    };
  } | null;
};

export type MatchFilesQueryVariables = Exact<{
  contextId?: InputMaybe<Scalars['String']['input']>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
  content: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  scopedThreshold?: InputMaybe<Scalars['Float']['input']>;
  threshold?: InputMaybe<Scalars['Float']['input']>;
}>;

export type MatchFilesQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contexts: Array<{
        __typename?: 'CopilotContext';
        matchFiles: Array<{
          __typename?: 'ContextMatchedFileChunk';
          fileId: string;
          blobId: string;
          chunk: number;
          content: string;
          distance: number | null;
        }>;
      }>;
    };
  } | null;
};

export type GetWorkspaceEmbeddingStatusQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetWorkspaceEmbeddingStatusQuery = {
  __typename?: 'Query';
  queryWorkspaceEmbeddingStatus: {
    __typename?: 'ContextWorkspaceEmbeddingStatus';
    total: number;
    embedded: number;
  };
};

export type QueueWorkspaceEmbeddingMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;

export type QueueWorkspaceEmbeddingMutation = {
  __typename?: 'Mutation';
  queueWorkspaceEmbedding: boolean;
};

export type GetCopilotHistoryIdsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
  docId?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<QueryChatHistoriesInput>;
}>;

export type GetCopilotHistoryIdsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            pinned: boolean;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              createdAt: string;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type GetCopilotDocSessionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  pagination: PaginationInput;
  options?: InputMaybe<QueryChatHistoriesInput>;
}>;

export type GetCopilotDocSessionsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: Record<string, string> | null;
                result: Record<string, string> | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type GetCopilotPinnedSessionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId?: InputMaybe<Scalars['String']['input']>;
  messageOrder?: InputMaybe<ChatHistoryOrder>;
  withPrompt?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type GetCopilotPinnedSessionsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: Record<string, string> | null;
                result: Record<string, string> | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type GetCopilotWorkspaceSessionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
  options?: InputMaybe<QueryChatHistoriesInput>;
}>;

export type GetCopilotWorkspaceSessionsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: Record<string, string> | null;
                result: Record<string, string> | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type GetCopilotHistoriesQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
  docId?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<QueryChatHistoriesInput>;
}>;

export type GetCopilotHistoriesQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: Record<string, string> | null;
                result: Record<string, string> | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type SubmitAudioTranscriptionMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  blobId: Scalars['String']['input'];
  blob?: InputMaybe<Scalars['Upload']['input']>;
  blobs?: InputMaybe<
    Array<Scalars['Upload']['input']> | Scalars['Upload']['input']
  >;
  input?: InputMaybe<SubmitAudioTranscriptionInput>;
}>;

export type SubmitAudioTranscriptionMutation = {
  __typename?: 'Mutation';
  submitAudioTranscription: {
    __typename?: 'TranscriptionResultType';
    id: string;
    status: AiJobStatus;
  } | null;
};

export type ClaimAudioTranscriptionMutationVariables = Exact<{
  jobId: Scalars['String']['input'];
}>;

export type ClaimAudioTranscriptionMutation = {
  __typename?: 'Mutation';
  claimAudioTranscription: {
    __typename?: 'TranscriptionResultType';
    id: string;
    status: AiJobStatus;
    title: string | null;
    summary: string | null;
    actions: string | null;
    normalizedTranscript: string | null;
    sourceAudio: {
      __typename?: 'TranscriptionSourceAudioType';
      blobId: string | null;
      mimeType: string | null;
      durationMs: number | null;
      sampleRate: number | null;
      channels: number | null;
    } | null;
    quality: {
      __typename?: 'TranscriptionQualityType';
      degraded: boolean | null;
      overflowCount: number | null;
    } | null;
    sliceManifest: Array<{
      __typename?: 'AudioSliceManifestItemType';
      index: number;
      fileName: string;
      mimeType: string;
      startSec: number;
      durationSec: number;
      byteSize: number | null;
    }> | null;
    normalizedSegments: Array<{
      __typename?: 'NormalizedTranscriptSegmentType';
      speaker: string;
      startSec: number;
      endSec: number;
      start: string;
      end: string;
      text: string;
    }> | null;
    summaryJson: {
      __typename?: 'MeetingSummaryV2Type';
      title: string;
      durationMinutes: number;
      attendees: Array<string>;
      keyPoints: Array<string>;
      decisions: Array<string>;
      openQuestions: Array<string>;
      blockers: Array<string>;
      actionItems: Array<{
        __typename?: 'MeetingActionItemType';
        description: string;
        owner: string | null;
        deadline: string | null;
      }>;
    } | null;
    transcription: Array<{
      __typename?: 'TranscriptionItemType';
      speaker: string;
      start: string;
      end: string;
      transcription: string;
    }> | null;
  } | null;
};

export type GetAudioTranscriptionQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  jobId?: InputMaybe<Scalars['String']['input']>;
  blobId?: InputMaybe<Scalars['String']['input']>;
}>;

export type GetAudioTranscriptionQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      audioTranscription: {
        __typename?: 'TranscriptionResultType';
        id: string;
        status: AiJobStatus;
        title: string | null;
        summary: string | null;
        normalizedTranscript: string | null;
        sourceAudio: {
          __typename?: 'TranscriptionSourceAudioType';
          blobId: string | null;
          mimeType: string | null;
          durationMs: number | null;
          sampleRate: number | null;
          channels: number | null;
        } | null;
        quality: {
          __typename?: 'TranscriptionQualityType';
          degraded: boolean | null;
          overflowCount: number | null;
        } | null;
        sliceManifest: Array<{
          __typename?: 'AudioSliceManifestItemType';
          index: number;
          fileName: string;
          mimeType: string;
          startSec: number;
          durationSec: number;
          byteSize: number | null;
        }> | null;
        normalizedSegments: Array<{
          __typename?: 'NormalizedTranscriptSegmentType';
          speaker: string;
          startSec: number;
          endSec: number;
          start: string;
          end: string;
          text: string;
        }> | null;
        summaryJson: {
          __typename?: 'MeetingSummaryV2Type';
          title: string;
          durationMinutes: number;
          attendees: Array<string>;
          keyPoints: Array<string>;
          decisions: Array<string>;
          openQuestions: Array<string>;
          blockers: Array<string>;
          actionItems: Array<{
            __typename?: 'MeetingActionItemType';
            description: string;
            owner: string | null;
            deadline: string | null;
          }>;
        } | null;
        transcription: Array<{
          __typename?: 'TranscriptionItemType';
          speaker: string;
          start: string;
          end: string;
          transcription: string;
        }> | null;
      } | null;
    };
  } | null;
};

export type RetryAudioTranscriptionMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  jobId: Scalars['String']['input'];
}>;

export type RetryAudioTranscriptionMutation = {
  __typename?: 'Mutation';
  retryAudioTranscription: {
    __typename?: 'TranscriptionResultType';
    id: string;
    status: AiJobStatus;
  } | null;
};

export type CreateCopilotMessageMutationVariables = Exact<{
  options: CreateChatMessageInput;
}>;

export type CreateCopilotMessageMutation = {
  __typename?: 'Mutation';
  createCopilotMessage: string;
};

export type GetPromptModelsQueryVariables = Exact<{
  promptName: Scalars['String']['input'];
}>;

export type GetPromptModelsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      models: {
        __typename?: 'CopilotModelsType';
        defaultModel: string;
        optionalModels: Array<{
          __typename?: 'CopilotModelType';
          id: string;
          name: string;
        }>;
        proModels: Array<{
          __typename?: 'CopilotModelType';
          id: string;
          name: string;
        }>;
      };
    };
  } | null;
};

export type CopilotQuotaQueryVariables = Exact<{ [key: string]: never }>;

export type CopilotQuotaQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      quota: {
        __typename?: 'CopilotQuota';
        limit: number | null;
        used: number;
      };
    };
  } | null;
};

export type RateMessageMutationVariables = Exact<{
  messageId: Scalars['String']['input'];
  rating: Scalars['String']['input'];
}>;

export type RateMessageMutation = {
  __typename?: 'Mutation';
  rateMessage: boolean;
};

export type CleanupCopilotSessionMutationVariables = Exact<{
  input: DeleteSessionInput;
}>;

export type CleanupCopilotSessionMutation = {
  __typename?: 'Mutation';
  cleanupCopilotSession: Array<string>;
};

export type CreateCopilotSessionWithHistoryMutationVariables = Exact<{
  options: CreateChatSessionInput;
}>;

export type CreateCopilotSessionWithHistoryMutation = {
  __typename?: 'Mutation';
  createCopilotSessionWithHistory: {
    __typename?: 'CopilotHistories';
    sessionId: string;
    workspaceId: string;
    docId: string | null;
    parentSessionId: string | null;
    promptName: string;
    model: string;
    optionalModels: Array<string>;
    action: string | null;
    pinned: boolean;
    title: string | null;
    tokens: number;
    createdAt: string;
    updatedAt: string;
    messages: Array<{
      __typename?: 'ChatMessage';
      id: string | null;
      role: string;
      content: string;
      attachments: Array<string> | null;
      createdAt: string;
      streamObjects: Array<{
        __typename?: 'StreamObject';
        type: string;
        textDelta: string | null;
        toolCallId: string | null;
        toolName: string | null;
        args: Record<string, string> | null;
        result: Record<string, string> | null;
      }> | null;
    }>;
  };
};

export type CreateCopilotSessionMutationVariables = Exact<{
  options: CreateChatSessionInput;
}>;

export type CreateCopilotSessionMutation = {
  __typename?: 'Mutation';
  createCopilotSession: string;
};

export type ForkCopilotSessionMutationVariables = Exact<{
  options: ForkChatSessionInput;
}>;

export type ForkCopilotSessionMutation = {
  __typename?: 'Mutation';
  forkCopilotSession: string;
};

export type GetCopilotLatestDocSessionQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
}>;

export type GetCopilotLatestDocSessionQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: Record<string, string> | null;
                result: Record<string, string> | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type GetCopilotSessionQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  sessionId: Scalars['String']['input'];
}>;

export type GetCopilotSessionQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: Record<string, string> | null;
                result: Record<string, string> | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type GetCopilotRecentSessionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;

export type GetCopilotRecentSessionsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: Record<string, string> | null;
                result: Record<string, string> | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type UpdateCopilotSessionMutationVariables = Exact<{
  options: UpdateChatSessionInput;
}>;

export type UpdateCopilotSessionMutation = {
  __typename?: 'Mutation';
  updateCopilotSession: string;
};

export type GetCopilotSessionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
  docId?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<QueryChatHistoriesInput>;
}>;

export type GetCopilotSessionsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: Record<string, string> | null;
                result: Record<string, string> | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type AddWorkspaceEmbeddingFilesMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  blob: Scalars['Upload']['input'];
}>;

export type AddWorkspaceEmbeddingFilesMutation = {
  __typename?: 'Mutation';
  addWorkspaceEmbeddingFiles: {
    __typename?: 'CopilotWorkspaceFile';
    fileId: string;
    fileName: string;
    blobId: string;
    mimeType: string;
    size: number;
    createdAt: string;
  };
};

export type GetWorkspaceEmbeddingFilesQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
}>;

export type GetWorkspaceEmbeddingFilesQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    embedding: {
      __typename?: 'CopilotWorkspaceConfig';
      files: {
        __typename?: 'PaginatedCopilotWorkspaceFileType';
        totalCount: number;
        pageInfo: {
          __typename?: 'PageInfo';
          endCursor: string | null;
          hasNextPage: boolean;
        };
        edges: Array<{
          __typename?: 'CopilotWorkspaceFileTypeEdge';
          node: {
            __typename?: 'CopilotWorkspaceFile';
            fileId: string;
            fileName: string;
            blobId: string;
            mimeType: string;
            size: number;
            createdAt: string;
          };
        }>;
      };
    };
  };
};

export type RemoveWorkspaceEmbeddingFilesMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  fileId: Scalars['String']['input'];
}>;

export type RemoveWorkspaceEmbeddingFilesMutation = {
  __typename?: 'Mutation';
  removeWorkspaceEmbeddingFiles: boolean;
};

export type AddWorkspaceEmbeddingIgnoredDocsMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  add: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;

export type AddWorkspaceEmbeddingIgnoredDocsMutation = {
  __typename?: 'Mutation';
  updateWorkspaceEmbeddingIgnoredDocs: number;
};

export type GetAllWorkspaceEmbeddingIgnoredDocsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetAllWorkspaceEmbeddingIgnoredDocsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    embedding: {
      __typename?: 'CopilotWorkspaceConfig';
      allIgnoredDocs: Array<{
        __typename?: 'CopilotWorkspaceIgnoredDoc';
        docId: string;
        createdAt: string;
      }>;
    };
  };
};

export type GetWorkspaceEmbeddingIgnoredDocsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
}>;

export type GetWorkspaceEmbeddingIgnoredDocsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    embedding: {
      __typename?: 'CopilotWorkspaceConfig';
      ignoredDocs: {
        __typename?: 'PaginatedIgnoredDocsType';
        totalCount: number;
        pageInfo: {
          __typename?: 'PageInfo';
          endCursor: string | null;
          hasNextPage: boolean;
        };
        edges: Array<{
          __typename?: 'CopilotWorkspaceIgnoredDocTypeEdge';
          node: {
            __typename?: 'CopilotWorkspaceIgnoredDoc';
            docId: string;
            createdAt: string;
            docCreatedAt: string | null;
            docUpdatedAt: string | null;
            title: string | null;
            createdBy: string | null;
            createdByAvatar: string | null;
            updatedBy: string | null;
          };
        }>;
      };
    };
  };
};

export type RemoveWorkspaceEmbeddingIgnoredDocsMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  remove: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;

export type RemoveWorkspaceEmbeddingIgnoredDocsMutation = {
  __typename?: 'Mutation';
  updateWorkspaceEmbeddingIgnoredDocs: number;
};

export type CreateCheckoutSessionMutationVariables = Exact<{
  input: CreateCheckoutSessionInput;
}>;

export type CreateCheckoutSessionMutation = {
  __typename?: 'Mutation';
  createCheckoutSession: string;
};

export type CreateCustomerPortalMutationVariables = Exact<{
  [key: string]: never;
}>;

export type CreateCustomerPortalMutation = {
  __typename?: 'Mutation';
  createCustomerPortal: string;
};

export type CreateSelfhostCustomerPortalMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type CreateSelfhostCustomerPortalMutation = {
  __typename?: 'Mutation';
  createSelfhostWorkspaceCustomerPortal: string;
};

export type CreateWorkspaceMutationVariables = Exact<{ [key: string]: never }>;

export type CreateWorkspaceMutation = {
  __typename?: 'Mutation';
  createWorkspace: {
    __typename?: 'WorkspaceType';
    id: string;
    slug: string;
    public: boolean;
    createdAt: string;
  };
};

export type DeleteAccountMutationVariables = Exact<{ [key: string]: never }>;

export type DeleteAccountMutation = {
  __typename?: 'Mutation';
  deleteAccount: { __typename?: 'DeleteAccount'; success: boolean };
};

export type DeleteWorkspaceMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DeleteWorkspaceMutation = {
  __typename?: 'Mutation';
  deleteWorkspace: boolean;
};

export type GetDocRolePermissionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
}>;

export type GetDocRolePermissionsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    doc: {
      __typename?: 'DocType';
      permissions: {
        __typename?: 'DocPermissions';
        Doc_Copy: boolean;
        Doc_Delete: boolean;
        Doc_Duplicate: boolean;
        Doc_Properties_Read: boolean;
        Doc_Properties_Update: boolean;
        Doc_Publish: boolean;
        Doc_Read: boolean;
        Doc_Restore: boolean;
        Doc_TransferOwner: boolean;
        Doc_Trash: boolean;
        Doc_Update: boolean;
        Doc_Users_Manage: boolean;
        Doc_Users_Read: boolean;
        Doc_Comments_Create: boolean;
        Doc_Comments_Delete: boolean;
        Doc_Comments_Read: boolean;
        Doc_Comments_Resolve: boolean;
      };
    };
  };
};

export type CopilotChatHistoryFragment = {
  __typename?: 'CopilotHistories';
  sessionId: string;
  workspaceId: string;
  docId: string | null;
  parentSessionId: string | null;
  promptName: string;
  model: string;
  optionalModels: Array<string>;
  action: string | null;
  pinned: boolean;
  title: string | null;
  tokens: number;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    __typename?: 'ChatMessage';
    id: string | null;
    role: string;
    content: string;
    attachments: Array<string> | null;
    createdAt: string;
    streamObjects: Array<{
      __typename?: 'StreamObject';
      type: string;
      textDelta: string | null;
      toolCallId: string | null;
      toolName: string | null;
      args: Record<string, string> | null;
      result: Record<string, string> | null;
    }> | null;
  }>;
};

export type CredentialsRequirementsFragment = {
  __typename?: 'CredentialsRequirementType';
  password: {
    __typename?: 'PasswordLimitsType';
    minLength: number;
    maxLength: number;
  };
};

export type CurrentUserProfileFragment = {
  __typename?: 'UserType';
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  features: Array<FeatureType>;
  settings: {
    __typename?: 'UserSettingsType';
    receiveInvitationEmail: boolean;
    receiveMentionEmail: boolean;
    receiveCommentEmail: boolean;
  };
  quota: {
    __typename?: 'UserQuotaType';
    name: string;
    blobLimit: number;
    storageQuota: number;
    historyPeriod: number;
    memberLimit: number;
    humanReadable: {
      __typename?: 'UserQuotaHumanReadableType';
      name: string;
      blobLimit: string;
      storageQuota: string;
      historyPeriod: string;
      memberLimit: string;
    };
  };
  quotaUsage: { __typename?: 'UserQuotaUsageType'; storageQuota: number };
  copilot: {
    __typename?: 'Copilot';
    quota: { __typename?: 'CopilotQuota'; limit: number | null; used: number };
  };
};

export type PaginatedCopilotChatsFragment = {
  __typename?: 'PaginatedCopilotHistoriesType';
  pageInfo: {
    __typename?: 'PageInfo';
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  edges: Array<{
    __typename?: 'CopilotHistoriesTypeEdge';
    cursor: string;
    node: {
      __typename?: 'CopilotHistories';
      sessionId: string;
      workspaceId: string;
      docId: string | null;
      parentSessionId: string | null;
      promptName: string;
      model: string;
      optionalModels: Array<string>;
      action: string | null;
      pinned: boolean;
      title: string | null;
      tokens: number;
      createdAt: string;
      updatedAt: string;
      messages: Array<{
        __typename?: 'ChatMessage';
        id: string | null;
        role: string;
        content: string;
        attachments: Array<string> | null;
        createdAt: string;
        streamObjects: Array<{
          __typename?: 'StreamObject';
          type: string;
          textDelta: string | null;
          toolCallId: string | null;
          toolName: string | null;
          args: Record<string, string> | null;
          result: Record<string, string> | null;
        }> | null;
      }>;
    };
  }>;
};

export type PasswordLimitsFragment = {
  __typename?: 'PasswordLimitsType';
  minLength: number;
  maxLength: number;
};

export type GenerateLicenseKeyMutationVariables = Exact<{
  sessionId: Scalars['String']['input'];
}>;

export type GenerateLicenseKeyMutation = {
  __typename?: 'Mutation';
  generateLicenseKey: string;
};

export type GetCurrentUserFeaturesQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetCurrentUserFeaturesQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    avatarUrl: string | null;
    features: Array<FeatureType>;
  } | null;
};

export type GetCurrentUserProfileQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetCurrentUserProfileQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    emailVerified: boolean;
    features: Array<FeatureType>;
    settings: {
      __typename?: 'UserSettingsType';
      receiveInvitationEmail: boolean;
      receiveMentionEmail: boolean;
      receiveCommentEmail: boolean;
    };
    quota: {
      __typename?: 'UserQuotaType';
      name: string;
      blobLimit: number;
      storageQuota: number;
      historyPeriod: number;
      memberLimit: number;
      humanReadable: {
        __typename?: 'UserQuotaHumanReadableType';
        name: string;
        blobLimit: string;
        storageQuota: string;
        historyPeriod: string;
        memberLimit: string;
      };
    };
    quotaUsage: { __typename?: 'UserQuotaUsageType'; storageQuota: number };
    copilot: {
      __typename?: 'Copilot';
      quota: {
        __typename?: 'CopilotQuota';
        limit: number | null;
        used: number;
      };
    };
  } | null;
};

export type GetCurrentUserQueryVariables = Exact<{ [key: string]: never }>;

export type GetCurrentUserQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    avatarUrl: string | null;
    token: { __typename?: 'tokenType'; sessionToken: string | null };
  } | null;
};

export type GetDocCreatedByUpdatedByListQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
}>;

export type GetDocCreatedByUpdatedByListQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    docs: {
      __typename?: 'PaginatedDocType';
      totalCount: number;
      pageInfo: {
        __typename?: 'PageInfo';
        endCursor: string | null;
        hasNextPage: boolean;
      };
      edges: Array<{
        __typename?: 'DocTypeEdge';
        node: {
          __typename?: 'DocType';
          id: string;
          creatorId: string | null;
          lastUpdaterId: string | null;
        };
      }>;
    };
  };
};

export type GetDocDefaultRoleQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
}>;

export type GetDocDefaultRoleQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    doc: { __typename?: 'DocType'; defaultRole: DocRole };
  };
};

export type GetDocLastAccessedMembersQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  pagination: PaginationInput;
  query?: InputMaybe<Scalars['String']['input']>;
  includeTotal?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type GetDocLastAccessedMembersQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    doc: {
      __typename?: 'DocType';
      lastAccessedMembers: {
        __typename?: 'PaginatedDocMemberLastAccess';
        totalCount: number | null;
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'DocMemberLastAccessEdge';
          cursor: string;
          node: {
            __typename?: 'DocMemberLastAccess';
            lastAccessedAt: string;
            lastDocId: string | null;
            user: {
              __typename?: 'PublicUserType';
              id: string;
              name: string;
              avatarUrl: string | null;
            };
          };
        }>;
      };
    };
  };
};

export type GetDocPageAnalyticsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  input?: InputMaybe<DocPageAnalyticsInput>;
}>;

export type GetDocPageAnalyticsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    doc: {
      __typename?: 'DocType';
      analytics: {
        __typename?: 'DocPageAnalytics';
        generatedAt: string;
        window: {
          __typename?: 'TimeWindow';
          from: string;
          to: string;
          timezone: string;
          bucket: TimeBucket;
          requestedSize: number;
          effectiveSize: number;
        };
        series: Array<{
          __typename?: 'DocPageAnalyticsPoint';
          date: string;
          totalViews: number;
          uniqueViews: number;
          guestViews: number;
        }>;
        summary: {
          __typename?: 'DocPageAnalyticsSummary';
          totalViews: number;
          uniqueViews: number;
          guestViews: number;
          lastAccessedAt: string | null;
        };
      };
    };
  };
};

export type GetDocSummaryQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
}>;

export type GetDocSummaryQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    doc: { __typename?: 'DocType'; summary: string | null };
  };
};

export type GetInviteInfoQueryVariables = Exact<{
  inviteId: Scalars['String']['input'];
}>;

export type GetInviteInfoQuery = {
  __typename?: 'Query';
  getInviteInfo: {
    __typename?: 'InvitationType';
    status: WorkspaceMemberStatus | null;
    workspace: {
      __typename?: 'InvitationWorkspaceType';
      id: string;
      name: string;
      avatar: string;
    };
    user: {
      __typename?: 'WorkspaceUserType';
      id: string;
      name: string;
      avatarUrl: string | null;
    };
    invitee: {
      __typename?: 'WorkspaceUserType';
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  };
};

export type GetMemberCountByWorkspaceIdQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetMemberCountByWorkspaceIdQuery = {
  __typename?: 'Query';
  workspace: { __typename?: 'WorkspaceType'; memberCount: number };
};

export type GetMembersByWorkspaceIdQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
}>;

export type GetMembersByWorkspaceIdQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    memberCount: number;
    members: Array<{
      __typename?: 'InviteUserType';
      id: string;
      name: string | null;
      email: string | null;
      avatarUrl: string | null;
      permission: Permission;
      inviteId: string;
      emailVerified: boolean | null;
      status: WorkspaceMemberStatus;
    }>;
  };
};

export type OauthProvidersQueryVariables = Exact<{ [key: string]: never }>;

export type OauthProvidersQuery = {
  __typename?: 'Query';
  serverConfig: {
    __typename?: 'ServerConfigType';
    oauthProviders: Array<OAuthProviderType>;
  };
};

export type GetPageGrantedUsersListQueryVariables = Exact<{
  pagination: PaginationInput;
  docId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}>;

export type GetPageGrantedUsersListQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    doc: {
      __typename?: 'DocType';
      grantedUsersList: {
        __typename?: 'PaginatedGrantedDocUserType';
        totalCount: number;
        pageInfo: {
          __typename?: 'PageInfo';
          endCursor: string | null;
          hasNextPage: boolean;
        };
        edges: Array<{
          __typename?: 'GrantedDocUserTypeEdge';
          node: {
            __typename?: 'GrantedDocUserType';
            role: DocRole;
            user: {
              __typename?: 'WorkspaceUserType';
              id: string;
              name: string;
              email: string;
              avatarUrl: string | null;
            };
          };
        }>;
      };
    };
  };
};

export type GetPublicUserByIdQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type GetPublicUserByIdQuery = {
  __typename?: 'Query';
  publicUserById: {
    __typename?: 'PublicUserType';
    id: string;
    avatarUrl: string | null;
    name: string;
  } | null;
};

export type GetRecentlyUpdatedDocsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
}>;

export type GetRecentlyUpdatedDocsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    recentlyUpdatedDocs: {
      __typename?: 'PaginatedDocType';
      totalCount: number;
      pageInfo: {
        __typename?: 'PageInfo';
        endCursor: string | null;
        hasNextPage: boolean;
      };
      edges: Array<{
        __typename?: 'DocTypeEdge';
        node: {
          __typename?: 'DocType';
          id: string;
          title: string | null;
          createdAt: string | null;
          updatedAt: string | null;
          creatorId: string | null;
          lastUpdaterId: string | null;
        };
      }>;
    };
  };
};

export type GetUserFeaturesQueryVariables = Exact<{ [key: string]: never }>;

export type GetUserFeaturesQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    id: string;
    features: Array<FeatureType>;
  } | null;
};

export type GetUserSettingsQueryVariables = Exact<{ [key: string]: never }>;

export type GetUserSettingsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    settings: {
      __typename?: 'UserSettingsType';
      receiveInvitationEmail: boolean;
      receiveMentionEmail: boolean;
      receiveCommentEmail: boolean;
    };
  } | null;
};

export type GetUserQueryVariables = Exact<{
  email: Scalars['String']['input'];
}>;

export type GetUserQuery = {
  __typename?: 'Query';
  user:
    | {
        __typename: 'LimitedUserType';
        email: string;
        hasPassword: boolean | null;
      }
    | {
        __typename: 'UserType';
        id: string;
        name: string;
        avatarUrl: string | null;
        email: string;
        hasPassword: boolean | null;
      }
    | null;
};

export type GetWorkspaceInfoQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetWorkspaceInfoQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    role: Permission;
    team: boolean;
    permissions: {
      __typename?: 'WorkspacePermissions';
      Workspace_Administrators_Manage: boolean;
      Workspace_Blobs_List: boolean;
      Workspace_Blobs_Read: boolean;
      Workspace_Blobs_Write: boolean;
      Workspace_Copilot: boolean;
      Workspace_CreateDoc: boolean;
      Workspace_Delete: boolean;
      Workspace_Organize_Read: boolean;
      Workspace_Payment_Manage: boolean;
      Workspace_Properties_Create: boolean;
      Workspace_Properties_Delete: boolean;
      Workspace_Properties_Read: boolean;
      Workspace_Properties_Update: boolean;
      Workspace_Read: boolean;
      Workspace_Settings_Read: boolean;
      Workspace_Settings_Update: boolean;
      Workspace_Sync: boolean;
      Workspace_TransferOwner: boolean;
      Workspace_Users_Manage: boolean;
      Workspace_Users_Read: boolean;
    };
  };
};

export type GetWorkspacePageByIdQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pageId: Scalars['String']['input'];
}>;

export type GetWorkspacePageByIdQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    doc: {
      __typename?: 'DocType';
      id: string;
      mode: PublicDocMode;
      defaultRole: DocRole;
      public: boolean;
      title: string | null;
      summary: string | null;
    };
  };
};

export type GetWorkspacePageMetaByIdQueryVariables = Exact<{
  id: Scalars['String']['input'];
  pageId: Scalars['String']['input'];
}>;

export type GetWorkspacePageMetaByIdQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    pageMeta: {
      __typename?: 'WorkspaceDocMeta';
      createdAt: string;
      updatedAt: string;
      createdBy: {
        __typename?: 'EditorType';
        name: string;
        avatarUrl: string | null;
      } | null;
      updatedBy: {
        __typename?: 'EditorType';
        name: string;
        avatarUrl: string | null;
      } | null;
    };
  };
};

export type GetWorkspacePublicByIdQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type GetWorkspacePublicByIdQuery = {
  __typename?: 'Query';
  workspace: { __typename?: 'WorkspaceType'; public: boolean };
};

export type GetWorkspacePublicPagesQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetWorkspacePublicPagesQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    publicDocs: Array<{
      __typename?: 'DocType';
      id: string;
      mode: PublicDocMode;
    }>;
  };
};

export type GetWorkspaceSubscriptionQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetWorkspaceSubscriptionQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    subscription: {
      __typename?: 'SubscriptionType';
      id: string | null;
      status: SubscriptionStatus;
      plan: SubscriptionPlan;
      recurring: SubscriptionRecurring;
      start: string;
      end: string | null;
      nextBillAt: string | null;
      canceledAt: string | null;
      variant: SubscriptionVariant | null;
    } | null;
  };
};

export type GetWorkspaceQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type GetWorkspaceQuery = {
  __typename?: 'Query';
  workspace: { __typename?: 'WorkspaceType'; id: string };
};

export type GetWorkspacesQueryVariables = Exact<{ [key: string]: never }>;

export type GetWorkspacesQuery = {
  __typename?: 'Query';
  workspaces: Array<{
    __typename?: 'WorkspaceType';
    id: string;
    slug: string;
    initialized: boolean;
    team: boolean;
    owner: { __typename?: 'UserType'; id: string };
  }>;
};

export type GrantDocUserRolesMutationVariables = Exact<{
  input: GrantDocUserRolesInput;
}>;

export type GrantDocUserRolesMutation = {
  __typename?: 'Mutation';
  grantDocUserRoles: boolean;
};

export type ListHistoryQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pageDocId: Scalars['String']['input'];
  take?: InputMaybe<Scalars['Int']['input']>;
  before?: InputMaybe<Scalars['DateTime']['input']>;
}>;

export type ListHistoryQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    histories: Array<{
      __typename?: 'DocHistoryType';
      id: string;
      timestamp: string;
      editor: {
        __typename?: 'EditorType';
        name: string;
        avatarUrl: string | null;
      } | null;
    }>;
  };
};

export type IndexerAggregateQueryVariables = Exact<{
  id: Scalars['String']['input'];
  input: AggregateInput;
}>;

export type IndexerAggregateQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    aggregate: {
      __typename?: 'AggregateResultObjectType';
      buckets: Array<{
        __typename?: 'AggregateBucketObjectType';
        key: string;
        count: number;
        hits: {
          __typename?: 'AggregateBucketHitsObjectType';
          nodes: Array<{
            __typename?: 'SearchNodeObjectType';
            fields: any;
            highlights: any | null;
          }>;
        };
      }>;
      pagination: {
        __typename?: 'SearchResultPagination';
        count: number;
        hasMore: boolean;
        nextCursor: string | null;
      };
    };
  };
};

export type IndexerSearchDocsQueryVariables = Exact<{
  id: Scalars['String']['input'];
  input: SearchDocsInput;
}>;

export type IndexerSearchDocsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    searchDocs: Array<{
      __typename?: 'SearchDocObjectType';
      docId: string;
      title: string;
      blockId: string;
      highlight: string;
      createdAt: string;
      updatedAt: string;
      createdByUser: {
        __typename?: 'PublicUserType';
        id: string;
        name: string;
        avatarUrl: string | null;
      } | null;
      updatedByUser: {
        __typename?: 'PublicUserType';
        id: string;
        name: string;
        avatarUrl: string | null;
      } | null;
    }>;
  };
};

export type IndexerSearchQueryVariables = Exact<{
  id: Scalars['String']['input'];
  input: SearchInput;
}>;

export type IndexerSearchQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    search: {
      __typename?: 'SearchResultObjectType';
      nodes: Array<{
        __typename?: 'SearchNodeObjectType';
        fields: any;
        highlights: any | null;
      }>;
      pagination: {
        __typename?: 'SearchResultPagination';
        count: number;
        hasMore: boolean;
        nextCursor: string | null;
      };
    };
  };
};

export type GetInvoicesCountQueryVariables = Exact<{ [key: string]: never }>;

export type GetInvoicesCountQuery = {
  __typename?: 'Query';
  currentUser: { __typename?: 'UserType'; invoiceCount: number } | null;
};

export type InvoicesQueryVariables = Exact<{
  take: Scalars['Int']['input'];
  skip: Scalars['Int']['input'];
}>;

export type InvoicesQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    invoiceCount: number;
    invoices: Array<{
      __typename?: 'InvoiceType';
      id: string | null;
      status: InvoiceStatus;
      currency: string;
      amount: number;
      reason: string;
      lastPaymentError: string | null;
      link: string | null;
      createdAt: string;
    }>;
  } | null;
};

export type LeaveWorkspaceMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  sendLeaveMail?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type LeaveWorkspaceMutation = {
  __typename?: 'Mutation';
  leaveWorkspace: boolean;
};

export type ActivateLicenseMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  license: Scalars['String']['input'];
}>;

export type ActivateLicenseMutation = {
  __typename?: 'Mutation';
  activateLicense: {
    __typename?: 'License';
    expiredAt: string | null;
    installedAt: string;
    quantity: number;
    recurring: SubscriptionRecurring;
    validatedAt: string;
    variant: SubscriptionVariant | null;
  };
};

export type DeactivateLicenseMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type DeactivateLicenseMutation = {
  __typename?: 'Mutation';
  deactivateLicense: boolean;
};

export type GetLicenseQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetLicenseQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    license: {
      __typename?: 'License';
      expiredAt: string | null;
      installedAt: string;
      quantity: number;
      recurring: SubscriptionRecurring;
      validatedAt: string;
      variant: SubscriptionVariant | null;
    } | null;
  };
};

export type InstallLicenseMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  license: Scalars['Upload']['input'];
}>;

export type InstallLicenseMutation = {
  __typename?: 'Mutation';
  installLicense: {
    __typename?: 'License';
    expiredAt: string | null;
    installedAt: string;
    quantity: number;
    recurring: SubscriptionRecurring;
    validatedAt: string;
    variant: SubscriptionVariant | null;
  };
};

export type LicenseBodyFragment = {
  __typename?: 'License';
  expiredAt: string | null;
  installedAt: string;
  quantity: number;
  recurring: SubscriptionRecurring;
  validatedAt: string;
  variant: SubscriptionVariant | null;
};

export type ListNotificationsQueryVariables = Exact<{
  pagination: PaginationInput;
}>;

export type ListNotificationsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    notifications: {
      __typename?: 'PaginatedNotificationObjectType';
      totalCount: number;
      edges: Array<{
        __typename?: 'NotificationObjectTypeEdge';
        cursor: string;
        node: {
          __typename?: 'NotificationObjectType';
          id: string;
          type: NotificationType;
          level: NotificationLevel;
          read: boolean;
          createdAt: string;
          updatedAt: string;
          body: any;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        startCursor: string | null;
        endCursor: string | null;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    };
  } | null;
};

export type ForgetMemoryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type ForgetMemoryMutation = {
  __typename?: 'Mutation';
  forgetMemory: boolean;
};

export type MyMemoriesQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type MyMemoriesQuery = {
  __typename?: 'Query';
  myMemories: Array<{
    __typename?: 'Memory';
    id: string;
    content: string;
    kind: MemoryKindEnum;
    scope: MemoryScopeEnum;
    pinned: boolean;
    createdAt: string;
    workspaceId: string;
  }>;
};

export type PinMemoryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type PinMemoryMutation = {
  __typename?: 'Mutation';
  pinMemory: {
    __typename?: 'Memory';
    id: string;
    content: string;
    kind: MemoryKindEnum;
    scope: MemoryScopeEnum;
    pinned: boolean;
    createdAt: string;
    workspaceId: string;
  };
};

export type PromoteMemoryToWorkspaceMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type PromoteMemoryToWorkspaceMutation = {
  __typename?: 'Mutation';
  promoteMemoryToWorkspace: {
    __typename?: 'Memory';
    id: string;
    content: string;
    kind: MemoryKindEnum;
    scope: MemoryScopeEnum;
    pinned: boolean;
    createdAt: string;
    workspaceId: string;
  };
};

export type MentionUserMutationVariables = Exact<{
  input: MentionInput;
}>;

export type MentionUserMutation = {
  __typename?: 'Mutation';
  mentionUser: string;
};

export type ListMongoCollectionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type ListMongoCollectionsQuery = {
  __typename?: 'Query';
  listMongoCollections: Array<{
    __typename?: 'MongoCollectionInfo';
    name: string;
    estimatedCount: number | null;
    enabled: boolean;
    cursorField: string | null;
    lastSyncedAt: string | null;
    consecutiveFailures: number | null;
    lastError: string | null;
    lastErrorAt: string | null;
  }>;
};

export type SampleMongoCollectionQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  collectionName: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;

export type SampleMongoCollectionQuery = {
  __typename?: 'Query';
  sampleMongoCollection: {
    __typename?: 'MongoSampleDocs';
    collectionName: string;
    documents: Array<string>;
  };
};

export type GetMongoIngestionConfigsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetMongoIngestionConfigsQuery = {
  __typename?: 'Query';
  getMongoIngestionConfigs: Array<{
    __typename?: 'MongoIngestionConfig';
    id: string;
    workspaceId: string;
    collectionName: string;
    enabled: boolean;
    cursorField: string;
    lastSyncedAt: string | null;
    lastCursorValue: string | null;
    consecutiveFailures: number;
    lastError: string | null;
    lastErrorAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type SetMongoIngestionConfigMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  input: SetMongoIngestionConfigInput;
}>;

export type SetMongoIngestionConfigMutation = {
  __typename?: 'Mutation';
  setMongoIngestionConfig: {
    __typename?: 'MongoIngestionConfig';
    id: string;
    workspaceId: string;
    collectionName: string;
    enabled: boolean;
    cursorField: string;
    lastSyncedAt: string | null;
    lastCursorValue: string | null;
    consecutiveFailures: number;
    lastError: string | null;
    lastErrorAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type DeleteMongoIngestionConfigMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  collectionName: Scalars['String']['input'];
}>;

export type DeleteMongoIngestionConfigMutation = {
  __typename?: 'Mutation';
  deleteMongoIngestionConfig: boolean;
};

export type NotificationCountQueryVariables = Exact<{ [key: string]: never }>;

export type NotificationCountQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    notifications: {
      __typename?: 'PaginatedNotificationObjectType';
      totalCount: number;
    };
  } | null;
};

export type PricesQueryVariables = Exact<{ [key: string]: never }>;

export type PricesQuery = {
  __typename?: 'Query';
  prices: Array<{
    __typename?: 'SubscriptionPrice';
    type: string;
    plan: SubscriptionPlan;
    currency: string;
    amount: number | null;
    yearlyAmount: number | null;
    lifetimeAmount: number | null;
  }>;
};

export type PublishPageMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pageId: Scalars['String']['input'];
  mode?: InputMaybe<PublicDocMode>;
}>;

export type PublishPageMutation = {
  __typename?: 'Mutation';
  publishDoc: { __typename?: 'DocType'; id: string; mode: PublicDocMode };
};

export type QuotaQueryVariables = Exact<{ [key: string]: never }>;

export type QuotaQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    id: string;
    quota: {
      __typename?: 'UserQuotaType';
      name: string;
      blobLimit: number;
      storageQuota: number;
      historyPeriod: number;
      memberLimit: number;
      humanReadable: {
        __typename?: 'UserQuotaHumanReadableType';
        name: string;
        blobLimit: string;
        storageQuota: string;
        historyPeriod: string;
        memberLimit: string;
      };
    };
    quotaUsage: { __typename?: 'UserQuotaUsageType'; storageQuota: number };
  } | null;
};

export type ReadAllNotificationsMutationVariables = Exact<{
  [key: string]: never;
}>;

export type ReadAllNotificationsMutation = {
  __typename?: 'Mutation';
  readAllNotifications: boolean;
};

export type ReadNotificationMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type ReadNotificationMutation = {
  __typename?: 'Mutation';
  readNotification: boolean;
};

export type RecoverDocMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  timestamp: Scalars['DateTime']['input'];
}>;

export type RecoverDocMutation = {
  __typename?: 'Mutation';
  recoverDoc: string;
};

export type RemoveAvatarMutationVariables = Exact<{ [key: string]: never }>;

export type RemoveAvatarMutation = {
  __typename?: 'Mutation';
  removeAvatar: { __typename?: 'RemoveAvatar'; success: boolean };
};

export type ResumeSubscriptionMutationVariables = Exact<{
  plan?: InputMaybe<SubscriptionPlan>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}>;

export type ResumeSubscriptionMutation = {
  __typename?: 'Mutation';
  resumeSubscription: {
    __typename?: 'SubscriptionType';
    id: string | null;
    status: SubscriptionStatus;
    nextBillAt: string | null;
    start: string;
    end: string | null;
  };
};

export type RevokeDocUserRolesMutationVariables = Exact<{
  input: RevokeDocUserRoleInput;
}>;

export type RevokeDocUserRolesMutation = {
  __typename?: 'Mutation';
  revokeDocUserRoles: boolean;
};

export type RevokeMemberPermissionMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}>;

export type RevokeMemberPermissionMutation = {
  __typename?: 'Mutation';
  revokeMember: boolean;
};

export type ResendInviteMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  inviteId: Scalars['String']['input'];
}>;

export type ResendInviteMutation = {
  __typename?: 'Mutation';
  resendInvite: boolean;
};

export type RevokePublicPageMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pageId: Scalars['String']['input'];
}>;

export type RevokePublicPageMutation = {
  __typename?: 'Mutation';
  revokePublicDoc: {
    __typename?: 'DocType';
    id: string;
    mode: PublicDocMode;
    public: boolean;
  };
};

export type SendChangeEmailMutationVariables = Exact<{
  callbackUrl: Scalars['String']['input'];
}>;

export type SendChangeEmailMutation = {
  __typename?: 'Mutation';
  sendChangeEmail: boolean;
};

export type SendChangePasswordEmailMutationVariables = Exact<{
  callbackUrl: Scalars['String']['input'];
}>;

export type SendChangePasswordEmailMutation = {
  __typename?: 'Mutation';
  sendChangePasswordEmail: boolean;
};

export type SendSetPasswordEmailMutationVariables = Exact<{
  callbackUrl: Scalars['String']['input'];
}>;

export type SendSetPasswordEmailMutation = {
  __typename?: 'Mutation';
  sendSetPasswordEmail: boolean;
};

export type SendVerifyChangeEmailMutationVariables = Exact<{
  token: Scalars['String']['input'];
  email: Scalars['String']['input'];
  callbackUrl: Scalars['String']['input'];
}>;

export type SendVerifyChangeEmailMutation = {
  __typename?: 'Mutation';
  sendVerifyChangeEmail: boolean;
};

export type SendVerifyEmailMutationVariables = Exact<{
  callbackUrl: Scalars['String']['input'];
}>;

export type SendVerifyEmailMutation = {
  __typename?: 'Mutation';
  sendVerifyEmail: boolean;
};

export type ServerConfigQueryVariables = Exact<{ [key: string]: never }>;

export type ServerConfigQuery = {
  __typename?: 'Query';
  serverConfig: {
    __typename?: 'ServerConfigType';
    version: string;
    baseUrl: string;
    name: string;
    features: Array<ServerFeature>;
    type: ServerDeploymentType;
    initialized: boolean;
    calendarProviders: Array<CalendarProviderType>;
    credentialsRequirement: {
      __typename?: 'CredentialsRequirementType';
      password: {
        __typename?: 'PasswordLimitsType';
        minLength: number;
        maxLength: number;
      };
    };
  };
};

export type SetWorkspacePublicByIdMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  public: Scalars['Boolean']['input'];
}>;

export type SetWorkspacePublicByIdMutation = {
  __typename?: 'Mutation';
  updateWorkspace: { __typename?: 'WorkspaceType'; id: string };
};

export type RefreshSubscriptionMutationVariables = Exact<{
  [key: string]: never;
}>;

export type RefreshSubscriptionMutation = {
  __typename?: 'Mutation';
  refreshUserSubscriptions: Array<{
    __typename?: 'SubscriptionType';
    id: string | null;
    status: SubscriptionStatus;
    plan: SubscriptionPlan;
    recurring: SubscriptionRecurring;
    start: string;
    end: string | null;
    nextBillAt: string | null;
    canceledAt: string | null;
    variant: SubscriptionVariant | null;
  }>;
};

export type RequestApplySubscriptionMutationVariables = Exact<{
  transactionId: Scalars['String']['input'];
}>;

export type RequestApplySubscriptionMutation = {
  __typename?: 'Mutation';
  requestApplySubscription: Array<{
    __typename?: 'SubscriptionType';
    id: string | null;
    status: SubscriptionStatus;
    plan: SubscriptionPlan;
    recurring: SubscriptionRecurring;
    start: string;
    end: string | null;
    nextBillAt: string | null;
    canceledAt: string | null;
    variant: SubscriptionVariant | null;
  }>;
};

export type SubscriptionQueryVariables = Exact<{ [key: string]: never }>;

export type SubscriptionQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    id: string;
    subscriptions: Array<{
      __typename?: 'SubscriptionType';
      id: string | null;
      status: SubscriptionStatus;
      plan: SubscriptionPlan;
      recurring: SubscriptionRecurring;
      start: string;
      end: string | null;
      nextBillAt: string | null;
      canceledAt: string | null;
      variant: SubscriptionVariant | null;
    }>;
  } | null;
};

export type UnverifyDocMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
}>;

export type UnverifyDocMutation = {
  __typename?: 'Mutation';
  unverifyDoc: boolean;
};

export type UpdateDocDefaultRoleMutationVariables = Exact<{
  input: UpdateDocDefaultRoleInput;
}>;

export type UpdateDocDefaultRoleMutation = {
  __typename?: 'Mutation';
  updateDocDefaultRole: boolean;
};

export type UpdateDocUserRoleMutationVariables = Exact<{
  input: UpdateDocUserRoleInput;
}>;

export type UpdateDocUserRoleMutation = {
  __typename?: 'Mutation';
  updateDocUserRole: boolean;
};

export type UpdateSubscriptionMutationVariables = Exact<{
  plan?: InputMaybe<SubscriptionPlan>;
  recurring: SubscriptionRecurring;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}>;

export type UpdateSubscriptionMutation = {
  __typename?: 'Mutation';
  updateSubscriptionRecurring: {
    __typename?: 'SubscriptionType';
    id: string | null;
    plan: SubscriptionPlan;
    recurring: SubscriptionRecurring;
    nextBillAt: string | null;
  };
};

export type UpdateUserProfileMutationVariables = Exact<{
  input: UpdateUserInput;
}>;

export type UpdateUserProfileMutation = {
  __typename?: 'Mutation';
  updateProfile: { __typename?: 'UserType'; id: string; name: string };
};

export type UpdateUserSettingsMutationVariables = Exact<{
  input: UpdateUserSettingsInput;
}>;

export type UpdateUserSettingsMutation = {
  __typename?: 'Mutation';
  updateSettings: boolean;
};

export type UploadAvatarMutationVariables = Exact<{
  avatar: Scalars['Upload']['input'];
}>;

export type UploadAvatarMutation = {
  __typename?: 'Mutation';
  uploadAvatar: {
    __typename?: 'UserType';
    id: string;
    name: string;
    avatarUrl: string | null;
    email: string;
  };
};

export type VerifyDocMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
}>;

export type VerifyDocMutation = { __typename?: 'Mutation'; verifyDoc: boolean };

export type VerifyEmailMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;

export type VerifyEmailMutation = {
  __typename?: 'Mutation';
  verifyEmail: boolean;
};

export type WorkspaceBlobQuotaQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type WorkspaceBlobQuotaQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    quota: {
      __typename?: 'WorkspaceQuotaType';
      blobLimit: number;
      humanReadable: {
        __typename?: 'WorkspaceQuotaHumanReadableType';
        blobLimit: string;
      };
    };
  };
};

export type GetWorkspaceConfigQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type GetWorkspaceConfigQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    enableAi: boolean;
    enableSharing: boolean;
    enableUrlPreview: boolean;
    enableDocEmbedding: boolean;
    inviteLink: {
      __typename?: 'InviteLink';
      link: string;
      expireTime: string;
    } | null;
  };
};

export type SetEnableAiMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  enableAi: Scalars['Boolean']['input'];
}>;

export type SetEnableAiMutation = {
  __typename?: 'Mutation';
  updateWorkspace: { __typename?: 'WorkspaceType'; id: string };
};

export type SetEnableDocEmbeddingMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  enableDocEmbedding: Scalars['Boolean']['input'];
}>;

export type SetEnableDocEmbeddingMutation = {
  __typename?: 'Mutation';
  updateWorkspace: { __typename?: 'WorkspaceType'; id: string };
};

export type SetEnableSharingMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  enableSharing: Scalars['Boolean']['input'];
}>;

export type SetEnableSharingMutation = {
  __typename?: 'Mutation';
  updateWorkspace: { __typename?: 'WorkspaceType'; id: string };
};

export type SetEnableUrlPreviewMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  enableUrlPreview: Scalars['Boolean']['input'];
}>;

export type SetEnableUrlPreviewMutation = {
  __typename?: 'Mutation';
  updateWorkspace: { __typename?: 'WorkspaceType'; id: string };
};

export type InviteByEmailsMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  emails: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;

export type InviteByEmailsMutation = {
  __typename?: 'Mutation';
  inviteMembers: Array<{
    __typename?: 'InviteResult';
    email: string;
    inviteId: string | null;
    sentSuccess: boolean;
  }>;
};

export type AcceptInviteByInviteIdMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  inviteId: Scalars['String']['input'];
}>;

export type AcceptInviteByInviteIdMutation = {
  __typename?: 'Mutation';
  acceptInviteById: boolean;
};

export type CreateInviteLinkMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  expireTime: WorkspaceInviteLinkExpireTime;
}>;

export type CreateInviteLinkMutation = {
  __typename?: 'Mutation';
  createInviteLink: {
    __typename?: 'InviteLink';
    link: string;
    expireTime: string;
  };
};

export type RevokeInviteLinkMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type RevokeInviteLinkMutation = {
  __typename?: 'Mutation';
  revokeInviteLink: boolean;
};

export type WorkspaceInvoicesQueryVariables = Exact<{
  take: Scalars['Int']['input'];
  skip: Scalars['Int']['input'];
  workspaceId: Scalars['String']['input'];
}>;

export type WorkspaceInvoicesQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    invoiceCount: number;
    invoices: Array<{
      __typename?: 'InvoiceType';
      id: string | null;
      status: InvoiceStatus;
      currency: string;
      amount: number;
      reason: string;
      lastPaymentError: string | null;
      link: string | null;
      createdAt: string;
    }>;
  };
};

export type WorkspaceQuotaQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type WorkspaceQuotaQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    quota: {
      __typename?: 'WorkspaceQuotaType';
      name: string;
      blobLimit: number;
      storageQuota: number;
      usedStorageQuota: number;
      historyPeriod: number;
      memberLimit: number;
      memberCount: number;
      overcapacityMemberCount: number;
      humanReadable: {
        __typename?: 'WorkspaceQuotaHumanReadableType';
        name: string;
        blobLimit: string;
        storageQuota: string;
        historyPeriod: string;
        memberLimit: string;
        memberCount: string;
        overcapacityMemberCount: string;
      };
    };
  };
};

export type GetWorkspaceRolePermissionsQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type GetWorkspaceRolePermissionsQuery = {
  __typename?: 'Query';
  workspaceRolePermissions: {
    __typename?: 'WorkspaceRolePermissions';
    permissions: {
      __typename?: 'WorkspacePermissions';
      Workspace_Administrators_Manage: boolean;
      Workspace_Blobs_List: boolean;
      Workspace_Blobs_Read: boolean;
      Workspace_Blobs_Write: boolean;
      Workspace_Copilot: boolean;
      Workspace_CreateDoc: boolean;
      Workspace_Delete: boolean;
      Workspace_Organize_Read: boolean;
      Workspace_Payment_Manage: boolean;
      Workspace_Properties_Create: boolean;
      Workspace_Properties_Delete: boolean;
      Workspace_Properties_Read: boolean;
      Workspace_Properties_Update: boolean;
      Workspace_Read: boolean;
      Workspace_Settings_Read: boolean;
      Workspace_Settings_Update: boolean;
      Workspace_Sync: boolean;
      Workspace_TransferOwner: boolean;
      Workspace_Users_Manage: boolean;
      Workspace_Users_Read: boolean;
    };
  };
};

export type ApproveWorkspaceTeamMemberMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}>;

export type ApproveWorkspaceTeamMemberMutation = {
  __typename?: 'Mutation';
  approveMember: boolean;
};

export type GrantWorkspaceTeamMemberMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
  permission: Permission;
}>;

export type GrantWorkspaceTeamMemberMutation = {
  __typename?: 'Mutation';
  grantMember: boolean;
};

export type Queries =
  | {
      name: 'listUserAccessTokensQuery';
      variables: ListUserAccessTokensQueryVariables;
      response: ListUserAccessTokensQuery;
    }
  | {
      name: 'adminVerifiedDocsQuery';
      variables: AdminVerifiedDocsQueryVariables;
      response: AdminVerifiedDocsQuery;
    }
  | {
      name: 'adminAllSharedLinksQuery';
      variables: AdminAllSharedLinksQueryVariables;
      response: AdminAllSharedLinksQuery;
    }
  | {
      name: 'adminDashboardQuery';
      variables: AdminDashboardQueryVariables;
      response: AdminDashboardQuery;
    }
  | {
      name: 'adminServerConfigQuery';
      variables: AdminServerConfigQueryVariables;
      response: AdminServerConfigQuery;
    }
  | {
      name: 'adminWorkspaceQuery';
      variables: AdminWorkspaceQueryVariables;
      response: AdminWorkspaceQuery;
    }
  | {
      name: 'adminWorkspacesQuery';
      variables: AdminWorkspacesQueryVariables;
      response: AdminWorkspacesQuery;
    }
  | {
      name: 'adminWorkspacesCountQuery';
      variables: AdminWorkspacesCountQueryVariables;
      response: AdminWorkspacesCountQuery;
    }
  | {
      name: 'appConfigQuery';
      variables: AppConfigQueryVariables;
      response: AppConfigQuery;
    }
  | {
      name: 'getUserByEmailQuery';
      variables: GetUserByEmailQueryVariables;
      response: GetUserByEmailQuery;
    }
  | {
      name: 'listUsersQuery';
      variables: ListUsersQueryVariables;
      response: ListUsersQuery;
    }
  | {
      name: 'validateConfigQuery';
      variables: ValidateConfigQueryVariables;
      response: ValidateConfigQuery;
    }
  | {
      name: 'dailyStatsQuery';
      variables: DailyStatsQueryVariables;
      response: DailyStatsQuery;
    }
  | {
      name: 'getAnalyticsOverviewQuery';
      variables: GetAnalyticsOverviewQueryVariables;
      response: GetAnalyticsOverviewQuery;
    }
  | {
      name: 'listConnectionsQuery';
      variables: ListConnectionsQueryVariables;
      response: ListConnectionsQuery;
    }
  | {
      name: 'listInsightsQuery';
      variables: ListInsightsQueryVariables;
      response: ListInsightsQuery;
    }
  | {
      name: 'listBlobsQuery';
      variables: ListBlobsQueryVariables;
      response: ListBlobsQuery;
    }
  | {
      name: 'getBlobUploadPartUrlQuery';
      variables: GetBlobUploadPartUrlQueryVariables;
      response: GetBlobUploadPartUrlQuery;
    }
  | {
      name: 'calendarAccountsQuery';
      variables: CalendarAccountsQueryVariables;
      response: CalendarAccountsQuery;
    }
  | {
      name: 'calendarEventsQuery';
      variables: CalendarEventsQueryVariables;
      response: CalendarEventsQuery;
    }
  | {
      name: 'calendarProvidersQuery';
      variables: CalendarProvidersQueryVariables;
      response: CalendarProvidersQuery;
    }
  | {
      name: 'workspaceCalendarsQuery';
      variables: WorkspaceCalendarsQueryVariables;
      response: WorkspaceCalendarsQuery;
    }
  | {
      name: 'listCommentChangesQuery';
      variables: ListCommentChangesQueryVariables;
      response: ListCommentChangesQuery;
    }
  | {
      name: 'listCommentsQuery';
      variables: ListCommentsQueryVariables;
      response: ListCommentsQuery;
    }
  | {
      name: 'listContextObjectQuery';
      variables: ListContextObjectQueryVariables;
      response: ListContextObjectQuery;
    }
  | {
      name: 'listContextQuery';
      variables: ListContextQueryVariables;
      response: ListContextQuery;
    }
  | {
      name: 'matchContextQuery';
      variables: MatchContextQueryVariables;
      response: MatchContextQuery;
    }
  | {
      name: 'matchWorkspaceDocsQuery';
      variables: MatchWorkspaceDocsQueryVariables;
      response: MatchWorkspaceDocsQuery;
    }
  | {
      name: 'matchFilesQuery';
      variables: MatchFilesQueryVariables;
      response: MatchFilesQuery;
    }
  | {
      name: 'getWorkspaceEmbeddingStatusQuery';
      variables: GetWorkspaceEmbeddingStatusQueryVariables;
      response: GetWorkspaceEmbeddingStatusQuery;
    }
  | {
      name: 'getCopilotHistoryIdsQuery';
      variables: GetCopilotHistoryIdsQueryVariables;
      response: GetCopilotHistoryIdsQuery;
    }
  | {
      name: 'getCopilotDocSessionsQuery';
      variables: GetCopilotDocSessionsQueryVariables;
      response: GetCopilotDocSessionsQuery;
    }
  | {
      name: 'getCopilotPinnedSessionsQuery';
      variables: GetCopilotPinnedSessionsQueryVariables;
      response: GetCopilotPinnedSessionsQuery;
    }
  | {
      name: 'getCopilotWorkspaceSessionsQuery';
      variables: GetCopilotWorkspaceSessionsQueryVariables;
      response: GetCopilotWorkspaceSessionsQuery;
    }
  | {
      name: 'getCopilotHistoriesQuery';
      variables: GetCopilotHistoriesQueryVariables;
      response: GetCopilotHistoriesQuery;
    }
  | {
      name: 'getAudioTranscriptionQuery';
      variables: GetAudioTranscriptionQueryVariables;
      response: GetAudioTranscriptionQuery;
    }
  | {
      name: 'getPromptModelsQuery';
      variables: GetPromptModelsQueryVariables;
      response: GetPromptModelsQuery;
    }
  | {
      name: 'copilotQuotaQuery';
      variables: CopilotQuotaQueryVariables;
      response: CopilotQuotaQuery;
    }
  | {
      name: 'getCopilotLatestDocSessionQuery';
      variables: GetCopilotLatestDocSessionQueryVariables;
      response: GetCopilotLatestDocSessionQuery;
    }
  | {
      name: 'getCopilotSessionQuery';
      variables: GetCopilotSessionQueryVariables;
      response: GetCopilotSessionQuery;
    }
  | {
      name: 'getCopilotRecentSessionsQuery';
      variables: GetCopilotRecentSessionsQueryVariables;
      response: GetCopilotRecentSessionsQuery;
    }
  | {
      name: 'getCopilotSessionsQuery';
      variables: GetCopilotSessionsQueryVariables;
      response: GetCopilotSessionsQuery;
    }
  | {
      name: 'getWorkspaceEmbeddingFilesQuery';
      variables: GetWorkspaceEmbeddingFilesQueryVariables;
      response: GetWorkspaceEmbeddingFilesQuery;
    }
  | {
      name: 'getAllWorkspaceEmbeddingIgnoredDocsQuery';
      variables: GetAllWorkspaceEmbeddingIgnoredDocsQueryVariables;
      response: GetAllWorkspaceEmbeddingIgnoredDocsQuery;
    }
  | {
      name: 'getWorkspaceEmbeddingIgnoredDocsQuery';
      variables: GetWorkspaceEmbeddingIgnoredDocsQueryVariables;
      response: GetWorkspaceEmbeddingIgnoredDocsQuery;
    }
  | {
      name: 'getDocRolePermissionsQuery';
      variables: GetDocRolePermissionsQueryVariables;
      response: GetDocRolePermissionsQuery;
    }
  | {
      name: 'getCurrentUserFeaturesQuery';
      variables: GetCurrentUserFeaturesQueryVariables;
      response: GetCurrentUserFeaturesQuery;
    }
  | {
      name: 'getCurrentUserProfileQuery';
      variables: GetCurrentUserProfileQueryVariables;
      response: GetCurrentUserProfileQuery;
    }
  | {
      name: 'getCurrentUserQuery';
      variables: GetCurrentUserQueryVariables;
      response: GetCurrentUserQuery;
    }
  | {
      name: 'getDocCreatedByUpdatedByListQuery';
      variables: GetDocCreatedByUpdatedByListQueryVariables;
      response: GetDocCreatedByUpdatedByListQuery;
    }
  | {
      name: 'getDocDefaultRoleQuery';
      variables: GetDocDefaultRoleQueryVariables;
      response: GetDocDefaultRoleQuery;
    }
  | {
      name: 'getDocLastAccessedMembersQuery';
      variables: GetDocLastAccessedMembersQueryVariables;
      response: GetDocLastAccessedMembersQuery;
    }
  | {
      name: 'getDocPageAnalyticsQuery';
      variables: GetDocPageAnalyticsQueryVariables;
      response: GetDocPageAnalyticsQuery;
    }
  | {
      name: 'getDocSummaryQuery';
      variables: GetDocSummaryQueryVariables;
      response: GetDocSummaryQuery;
    }
  | {
      name: 'getInviteInfoQuery';
      variables: GetInviteInfoQueryVariables;
      response: GetInviteInfoQuery;
    }
  | {
      name: 'getMemberCountByWorkspaceIdQuery';
      variables: GetMemberCountByWorkspaceIdQueryVariables;
      response: GetMemberCountByWorkspaceIdQuery;
    }
  | {
      name: 'getMembersByWorkspaceIdQuery';
      variables: GetMembersByWorkspaceIdQueryVariables;
      response: GetMembersByWorkspaceIdQuery;
    }
  | {
      name: 'oauthProvidersQuery';
      variables: OauthProvidersQueryVariables;
      response: OauthProvidersQuery;
    }
  | {
      name: 'getPageGrantedUsersListQuery';
      variables: GetPageGrantedUsersListQueryVariables;
      response: GetPageGrantedUsersListQuery;
    }
  | {
      name: 'getPublicUserByIdQuery';
      variables: GetPublicUserByIdQueryVariables;
      response: GetPublicUserByIdQuery;
    }
  | {
      name: 'getRecentlyUpdatedDocsQuery';
      variables: GetRecentlyUpdatedDocsQueryVariables;
      response: GetRecentlyUpdatedDocsQuery;
    }
  | {
      name: 'getUserFeaturesQuery';
      variables: GetUserFeaturesQueryVariables;
      response: GetUserFeaturesQuery;
    }
  | {
      name: 'getUserSettingsQuery';
      variables: GetUserSettingsQueryVariables;
      response: GetUserSettingsQuery;
    }
  | {
      name: 'getUserQuery';
      variables: GetUserQueryVariables;
      response: GetUserQuery;
    }
  | {
      name: 'getWorkspaceInfoQuery';
      variables: GetWorkspaceInfoQueryVariables;
      response: GetWorkspaceInfoQuery;
    }
  | {
      name: 'getWorkspacePageByIdQuery';
      variables: GetWorkspacePageByIdQueryVariables;
      response: GetWorkspacePageByIdQuery;
    }
  | {
      name: 'getWorkspacePageMetaByIdQuery';
      variables: GetWorkspacePageMetaByIdQueryVariables;
      response: GetWorkspacePageMetaByIdQuery;
    }
  | {
      name: 'getWorkspacePublicByIdQuery';
      variables: GetWorkspacePublicByIdQueryVariables;
      response: GetWorkspacePublicByIdQuery;
    }
  | {
      name: 'getWorkspacePublicPagesQuery';
      variables: GetWorkspacePublicPagesQueryVariables;
      response: GetWorkspacePublicPagesQuery;
    }
  | {
      name: 'getWorkspaceSubscriptionQuery';
      variables: GetWorkspaceSubscriptionQueryVariables;
      response: GetWorkspaceSubscriptionQuery;
    }
  | {
      name: 'getWorkspaceQuery';
      variables: GetWorkspaceQueryVariables;
      response: GetWorkspaceQuery;
    }
  | {
      name: 'getWorkspacesQuery';
      variables: GetWorkspacesQueryVariables;
      response: GetWorkspacesQuery;
    }
  | {
      name: 'listHistoryQuery';
      variables: ListHistoryQueryVariables;
      response: ListHistoryQuery;
    }
  | {
      name: 'indexerAggregateQuery';
      variables: IndexerAggregateQueryVariables;
      response: IndexerAggregateQuery;
    }
  | {
      name: 'indexerSearchDocsQuery';
      variables: IndexerSearchDocsQueryVariables;
      response: IndexerSearchDocsQuery;
    }
  | {
      name: 'indexerSearchQuery';
      variables: IndexerSearchQueryVariables;
      response: IndexerSearchQuery;
    }
  | {
      name: 'getInvoicesCountQuery';
      variables: GetInvoicesCountQueryVariables;
      response: GetInvoicesCountQuery;
    }
  | {
      name: 'invoicesQuery';
      variables: InvoicesQueryVariables;
      response: InvoicesQuery;
    }
  | {
      name: 'getLicenseQuery';
      variables: GetLicenseQueryVariables;
      response: GetLicenseQuery;
    }
  | {
      name: 'listNotificationsQuery';
      variables: ListNotificationsQueryVariables;
      response: ListNotificationsQuery;
    }
  | {
      name: 'myMemoriesQuery';
      variables: MyMemoriesQueryVariables;
      response: MyMemoriesQuery;
    }
  | {
      name: 'listMongoCollectionsQuery';
      variables: ListMongoCollectionsQueryVariables;
      response: ListMongoCollectionsQuery;
    }
  | {
      name: 'sampleMongoCollectionQuery';
      variables: SampleMongoCollectionQueryVariables;
      response: SampleMongoCollectionQuery;
    }
  | {
      name: 'getMongoIngestionConfigsQuery';
      variables: GetMongoIngestionConfigsQueryVariables;
      response: GetMongoIngestionConfigsQuery;
    }
  | {
      name: 'notificationCountQuery';
      variables: NotificationCountQueryVariables;
      response: NotificationCountQuery;
    }
  | {
      name: 'pricesQuery';
      variables: PricesQueryVariables;
      response: PricesQuery;
    }
  | {
      name: 'quotaQuery';
      variables: QuotaQueryVariables;
      response: QuotaQuery;
    }
  | {
      name: 'serverConfigQuery';
      variables: ServerConfigQueryVariables;
      response: ServerConfigQuery;
    }
  | {
      name: 'subscriptionQuery';
      variables: SubscriptionQueryVariables;
      response: SubscriptionQuery;
    }
  | {
      name: 'workspaceBlobQuotaQuery';
      variables: WorkspaceBlobQuotaQueryVariables;
      response: WorkspaceBlobQuotaQuery;
    }
  | {
      name: 'getWorkspaceConfigQuery';
      variables: GetWorkspaceConfigQueryVariables;
      response: GetWorkspaceConfigQuery;
    }
  | {
      name: 'workspaceInvoicesQuery';
      variables: WorkspaceInvoicesQueryVariables;
      response: WorkspaceInvoicesQuery;
    }
  | {
      name: 'workspaceQuotaQuery';
      variables: WorkspaceQuotaQueryVariables;
      response: WorkspaceQuotaQuery;
    }
  | {
      name: 'getWorkspaceRolePermissionsQuery';
      variables: GetWorkspaceRolePermissionsQueryVariables;
      response: GetWorkspaceRolePermissionsQuery;
    };

export type Mutations =
  | {
      name: 'generateUserAccessTokenMutation';
      variables: GenerateUserAccessTokenMutationVariables;
      response: GenerateUserAccessTokenMutation;
    }
  | {
      name: 'revokeUserAccessTokenMutation';
      variables: RevokeUserAccessTokenMutationVariables;
      response: RevokeUserAccessTokenMutation;
    }
  | {
      name: 'adminUpdateWorkspaceMutation';
      variables: AdminUpdateWorkspaceMutationVariables;
      response: AdminUpdateWorkspaceMutation;
    }
  | {
      name: 'createChangePasswordUrlMutation';
      variables: CreateChangePasswordUrlMutationVariables;
      response: CreateChangePasswordUrlMutation;
    }
  | {
      name: 'createUserMutation';
      variables: CreateUserMutationVariables;
      response: CreateUserMutation;
    }
  | {
      name: 'deleteUserMutation';
      variables: DeleteUserMutationVariables;
      response: DeleteUserMutation;
    }
  | {
      name: 'disableUserMutation';
      variables: DisableUserMutationVariables;
      response: DisableUserMutation;
    }
  | {
      name: 'enableUserMutation';
      variables: EnableUserMutationVariables;
      response: EnableUserMutation;
    }
  | {
      name: 'importUsersMutation';
      variables: ImportUsersMutationVariables;
      response: ImportUsersMutation;
    }
  | {
      name: 'sendTestEmailMutation';
      variables: SendTestEmailMutationVariables;
      response: SendTestEmailMutation;
    }
  | {
      name: 'updateAccountFeaturesMutation';
      variables: UpdateAccountFeaturesMutationVariables;
      response: UpdateAccountFeaturesMutation;
    }
  | {
      name: 'updateAccountMutation';
      variables: UpdateAccountMutationVariables;
      response: UpdateAccountMutation;
    }
  | {
      name: 'updateAppConfigMutation';
      variables: UpdateAppConfigMutationVariables;
      response: UpdateAppConfigMutation;
    }
  | {
      name: 'backfillAnalyticsMutation';
      variables: BackfillAnalyticsMutationVariables;
      response: BackfillAnalyticsMutation;
    }
  | {
      name: 'acknowledgeInsightMutation';
      variables: AcknowledgeInsightMutationVariables;
      response: AcknowledgeInsightMutation;
    }
  | {
      name: 'beginPlatformConnectMutation';
      variables: BeginPlatformConnectMutationVariables;
      response: BeginPlatformConnectMutation;
    }
  | {
      name: 'cancelPlatformConnectMutation';
      variables: CancelPlatformConnectMutationVariables;
      response: CancelPlatformConnectMutation;
    }
  | {
      name: 'disconnectPlatformMutation';
      variables: DisconnectPlatformMutationVariables;
      response: DisconnectPlatformMutation;
    }
  | {
      name: 'finalizePlatformConnectMutation';
      variables: FinalizePlatformConnectMutationVariables;
      response: FinalizePlatformConnectMutation;
    }
  | {
      name: 'runContentRecommendationMutation';
      variables: RunContentRecommendationMutationVariables;
      response: RunContentRecommendationMutation;
    }
  | {
      name: 'deleteBlobMutation';
      variables: DeleteBlobMutationVariables;
      response: DeleteBlobMutation;
    }
  | {
      name: 'releaseDeletedBlobsMutation';
      variables: ReleaseDeletedBlobsMutationVariables;
      response: ReleaseDeletedBlobsMutation;
    }
  | {
      name: 'setBlobMutation';
      variables: SetBlobMutationVariables;
      response: SetBlobMutation;
    }
  | {
      name: 'abortBlobUploadMutation';
      variables: AbortBlobUploadMutationVariables;
      response: AbortBlobUploadMutation;
    }
  | {
      name: 'completeBlobUploadMutation';
      variables: CompleteBlobUploadMutationVariables;
      response: CompleteBlobUploadMutation;
    }
  | {
      name: 'createBlobUploadMutation';
      variables: CreateBlobUploadMutationVariables;
      response: CreateBlobUploadMutation;
    }
  | {
      name: 'linkCalDavAccountMutation';
      variables: LinkCalDavAccountMutationVariables;
      response: LinkCalDavAccountMutation;
    }
  | {
      name: 'linkCalendarAccountMutation';
      variables: LinkCalendarAccountMutationVariables;
      response: LinkCalendarAccountMutation;
    }
  | {
      name: 'unlinkCalendarAccountMutation';
      variables: UnlinkCalendarAccountMutationVariables;
      response: UnlinkCalendarAccountMutation;
    }
  | {
      name: 'updateCalendarAccountMutation';
      variables: UpdateCalendarAccountMutationVariables;
      response: UpdateCalendarAccountMutation;
    }
  | {
      name: 'updateWorkspaceCalendarsMutation';
      variables: UpdateWorkspaceCalendarsMutationVariables;
      response: UpdateWorkspaceCalendarsMutation;
    }
  | {
      name: 'cancelSubscriptionMutation';
      variables: CancelSubscriptionMutationVariables;
      response: CancelSubscriptionMutation;
    }
  | {
      name: 'changeEmailMutation';
      variables: ChangeEmailMutationVariables;
      response: ChangeEmailMutation;
    }
  | {
      name: 'changePasswordMutation';
      variables: ChangePasswordMutationVariables;
      response: ChangePasswordMutation;
    }
  | {
      name: 'createCommentMutation';
      variables: CreateCommentMutationVariables;
      response: CreateCommentMutation;
    }
  | {
      name: 'deleteCommentMutation';
      variables: DeleteCommentMutationVariables;
      response: DeleteCommentMutation;
    }
  | {
      name: 'createReplyMutation';
      variables: CreateReplyMutationVariables;
      response: CreateReplyMutation;
    }
  | {
      name: 'deleteReplyMutation';
      variables: DeleteReplyMutationVariables;
      response: DeleteReplyMutation;
    }
  | {
      name: 'updateReplyMutation';
      variables: UpdateReplyMutationVariables;
      response: UpdateReplyMutation;
    }
  | {
      name: 'resolveCommentMutation';
      variables: ResolveCommentMutationVariables;
      response: ResolveCommentMutation;
    }
  | {
      name: 'updateCommentMutation';
      variables: UpdateCommentMutationVariables;
      response: UpdateCommentMutation;
    }
  | {
      name: 'uploadCommentAttachmentMutation';
      variables: UploadCommentAttachmentMutationVariables;
      response: UploadCommentAttachmentMutation;
    }
  | {
      name: 'applyDocUpdatesMutation';
      variables: ApplyDocUpdatesMutationVariables;
      response: ApplyDocUpdatesMutation;
    }
  | {
      name: 'addContextBlobMutation';
      variables: AddContextBlobMutationVariables;
      response: AddContextBlobMutation;
    }
  | {
      name: 'removeContextBlobMutation';
      variables: RemoveContextBlobMutationVariables;
      response: RemoveContextBlobMutation;
    }
  | {
      name: 'addContextCategoryMutation';
      variables: AddContextCategoryMutationVariables;
      response: AddContextCategoryMutation;
    }
  | {
      name: 'removeContextCategoryMutation';
      variables: RemoveContextCategoryMutationVariables;
      response: RemoveContextCategoryMutation;
    }
  | {
      name: 'createCopilotContextMutation';
      variables: CreateCopilotContextMutationVariables;
      response: CreateCopilotContextMutation;
    }
  | {
      name: 'addContextDocMutation';
      variables: AddContextDocMutationVariables;
      response: AddContextDocMutation;
    }
  | {
      name: 'removeContextDocMutation';
      variables: RemoveContextDocMutationVariables;
      response: RemoveContextDocMutation;
    }
  | {
      name: 'addContextFileMutation';
      variables: AddContextFileMutationVariables;
      response: AddContextFileMutation;
    }
  | {
      name: 'removeContextFileMutation';
      variables: RemoveContextFileMutationVariables;
      response: RemoveContextFileMutation;
    }
  | {
      name: 'queueWorkspaceEmbeddingMutation';
      variables: QueueWorkspaceEmbeddingMutationVariables;
      response: QueueWorkspaceEmbeddingMutation;
    }
  | {
      name: 'submitAudioTranscriptionMutation';
      variables: SubmitAudioTranscriptionMutationVariables;
      response: SubmitAudioTranscriptionMutation;
    }
  | {
      name: 'claimAudioTranscriptionMutation';
      variables: ClaimAudioTranscriptionMutationVariables;
      response: ClaimAudioTranscriptionMutation;
    }
  | {
      name: 'retryAudioTranscriptionMutation';
      variables: RetryAudioTranscriptionMutationVariables;
      response: RetryAudioTranscriptionMutation;
    }
  | {
      name: 'createCopilotMessageMutation';
      variables: CreateCopilotMessageMutationVariables;
      response: CreateCopilotMessageMutation;
    }
  | {
      name: 'rateMessageMutation';
      variables: RateMessageMutationVariables;
      response: RateMessageMutation;
    }
  | {
      name: 'cleanupCopilotSessionMutation';
      variables: CleanupCopilotSessionMutationVariables;
      response: CleanupCopilotSessionMutation;
    }
  | {
      name: 'createCopilotSessionWithHistoryMutation';
      variables: CreateCopilotSessionWithHistoryMutationVariables;
      response: CreateCopilotSessionWithHistoryMutation;
    }
  | {
      name: 'createCopilotSessionMutation';
      variables: CreateCopilotSessionMutationVariables;
      response: CreateCopilotSessionMutation;
    }
  | {
      name: 'forkCopilotSessionMutation';
      variables: ForkCopilotSessionMutationVariables;
      response: ForkCopilotSessionMutation;
    }
  | {
      name: 'updateCopilotSessionMutation';
      variables: UpdateCopilotSessionMutationVariables;
      response: UpdateCopilotSessionMutation;
    }
  | {
      name: 'addWorkspaceEmbeddingFilesMutation';
      variables: AddWorkspaceEmbeddingFilesMutationVariables;
      response: AddWorkspaceEmbeddingFilesMutation;
    }
  | {
      name: 'removeWorkspaceEmbeddingFilesMutation';
      variables: RemoveWorkspaceEmbeddingFilesMutationVariables;
      response: RemoveWorkspaceEmbeddingFilesMutation;
    }
  | {
      name: 'addWorkspaceEmbeddingIgnoredDocsMutation';
      variables: AddWorkspaceEmbeddingIgnoredDocsMutationVariables;
      response: AddWorkspaceEmbeddingIgnoredDocsMutation;
    }
  | {
      name: 'removeWorkspaceEmbeddingIgnoredDocsMutation';
      variables: RemoveWorkspaceEmbeddingIgnoredDocsMutationVariables;
      response: RemoveWorkspaceEmbeddingIgnoredDocsMutation;
    }
  | {
      name: 'createCheckoutSessionMutation';
      variables: CreateCheckoutSessionMutationVariables;
      response: CreateCheckoutSessionMutation;
    }
  | {
      name: 'createCustomerPortalMutation';
      variables: CreateCustomerPortalMutationVariables;
      response: CreateCustomerPortalMutation;
    }
  | {
      name: 'createSelfhostCustomerPortalMutation';
      variables: CreateSelfhostCustomerPortalMutationVariables;
      response: CreateSelfhostCustomerPortalMutation;
    }
  | {
      name: 'createWorkspaceMutation';
      variables: CreateWorkspaceMutationVariables;
      response: CreateWorkspaceMutation;
    }
  | {
      name: 'deleteAccountMutation';
      variables: DeleteAccountMutationVariables;
      response: DeleteAccountMutation;
    }
  | {
      name: 'deleteWorkspaceMutation';
      variables: DeleteWorkspaceMutationVariables;
      response: DeleteWorkspaceMutation;
    }
  | {
      name: 'generateLicenseKeyMutation';
      variables: GenerateLicenseKeyMutationVariables;
      response: GenerateLicenseKeyMutation;
    }
  | {
      name: 'grantDocUserRolesMutation';
      variables: GrantDocUserRolesMutationVariables;
      response: GrantDocUserRolesMutation;
    }
  | {
      name: 'leaveWorkspaceMutation';
      variables: LeaveWorkspaceMutationVariables;
      response: LeaveWorkspaceMutation;
    }
  | {
      name: 'activateLicenseMutation';
      variables: ActivateLicenseMutationVariables;
      response: ActivateLicenseMutation;
    }
  | {
      name: 'deactivateLicenseMutation';
      variables: DeactivateLicenseMutationVariables;
      response: DeactivateLicenseMutation;
    }
  | {
      name: 'installLicenseMutation';
      variables: InstallLicenseMutationVariables;
      response: InstallLicenseMutation;
    }
  | {
      name: 'forgetMemoryMutation';
      variables: ForgetMemoryMutationVariables;
      response: ForgetMemoryMutation;
    }
  | {
      name: 'pinMemoryMutation';
      variables: PinMemoryMutationVariables;
      response: PinMemoryMutation;
    }
  | {
      name: 'promoteMemoryToWorkspaceMutation';
      variables: PromoteMemoryToWorkspaceMutationVariables;
      response: PromoteMemoryToWorkspaceMutation;
    }
  | {
      name: 'mentionUserMutation';
      variables: MentionUserMutationVariables;
      response: MentionUserMutation;
    }
  | {
      name: 'setMongoIngestionConfigMutation';
      variables: SetMongoIngestionConfigMutationVariables;
      response: SetMongoIngestionConfigMutation;
    }
  | {
      name: 'deleteMongoIngestionConfigMutation';
      variables: DeleteMongoIngestionConfigMutationVariables;
      response: DeleteMongoIngestionConfigMutation;
    }
  | {
      name: 'publishPageMutation';
      variables: PublishPageMutationVariables;
      response: PublishPageMutation;
    }
  | {
      name: 'readAllNotificationsMutation';
      variables: ReadAllNotificationsMutationVariables;
      response: ReadAllNotificationsMutation;
    }
  | {
      name: 'readNotificationMutation';
      variables: ReadNotificationMutationVariables;
      response: ReadNotificationMutation;
    }
  | {
      name: 'recoverDocMutation';
      variables: RecoverDocMutationVariables;
      response: RecoverDocMutation;
    }
  | {
      name: 'removeAvatarMutation';
      variables: RemoveAvatarMutationVariables;
      response: RemoveAvatarMutation;
    }
  | {
      name: 'resumeSubscriptionMutation';
      variables: ResumeSubscriptionMutationVariables;
      response: ResumeSubscriptionMutation;
    }
  | {
      name: 'revokeDocUserRolesMutation';
      variables: RevokeDocUserRolesMutationVariables;
      response: RevokeDocUserRolesMutation;
    }
  | {
      name: 'revokeMemberPermissionMutation';
      variables: RevokeMemberPermissionMutationVariables;
      response: RevokeMemberPermissionMutation;
    }
  | {
      name: 'resendInviteMutation';
      variables: ResendInviteMutationVariables;
      response: ResendInviteMutation;
    }
  | {
      name: 'revokePublicPageMutation';
      variables: RevokePublicPageMutationVariables;
      response: RevokePublicPageMutation;
    }
  | {
      name: 'sendChangeEmailMutation';
      variables: SendChangeEmailMutationVariables;
      response: SendChangeEmailMutation;
    }
  | {
      name: 'sendChangePasswordEmailMutation';
      variables: SendChangePasswordEmailMutationVariables;
      response: SendChangePasswordEmailMutation;
    }
  | {
      name: 'sendSetPasswordEmailMutation';
      variables: SendSetPasswordEmailMutationVariables;
      response: SendSetPasswordEmailMutation;
    }
  | {
      name: 'sendVerifyChangeEmailMutation';
      variables: SendVerifyChangeEmailMutationVariables;
      response: SendVerifyChangeEmailMutation;
    }
  | {
      name: 'sendVerifyEmailMutation';
      variables: SendVerifyEmailMutationVariables;
      response: SendVerifyEmailMutation;
    }
  | {
      name: 'setWorkspacePublicByIdMutation';
      variables: SetWorkspacePublicByIdMutationVariables;
      response: SetWorkspacePublicByIdMutation;
    }
  | {
      name: 'refreshSubscriptionMutation';
      variables: RefreshSubscriptionMutationVariables;
      response: RefreshSubscriptionMutation;
    }
  | {
      name: 'requestApplySubscriptionMutation';
      variables: RequestApplySubscriptionMutationVariables;
      response: RequestApplySubscriptionMutation;
    }
  | {
      name: 'unverifyDocMutation';
      variables: UnverifyDocMutationVariables;
      response: UnverifyDocMutation;
    }
  | {
      name: 'updateDocDefaultRoleMutation';
      variables: UpdateDocDefaultRoleMutationVariables;
      response: UpdateDocDefaultRoleMutation;
    }
  | {
      name: 'updateDocUserRoleMutation';
      variables: UpdateDocUserRoleMutationVariables;
      response: UpdateDocUserRoleMutation;
    }
  | {
      name: 'updateSubscriptionMutation';
      variables: UpdateSubscriptionMutationVariables;
      response: UpdateSubscriptionMutation;
    }
  | {
      name: 'updateUserProfileMutation';
      variables: UpdateUserProfileMutationVariables;
      response: UpdateUserProfileMutation;
    }
  | {
      name: 'updateUserSettingsMutation';
      variables: UpdateUserSettingsMutationVariables;
      response: UpdateUserSettingsMutation;
    }
  | {
      name: 'uploadAvatarMutation';
      variables: UploadAvatarMutationVariables;
      response: UploadAvatarMutation;
    }
  | {
      name: 'verifyDocMutation';
      variables: VerifyDocMutationVariables;
      response: VerifyDocMutation;
    }
  | {
      name: 'verifyEmailMutation';
      variables: VerifyEmailMutationVariables;
      response: VerifyEmailMutation;
    }
  | {
      name: 'setEnableAiMutation';
      variables: SetEnableAiMutationVariables;
      response: SetEnableAiMutation;
    }
  | {
      name: 'setEnableDocEmbeddingMutation';
      variables: SetEnableDocEmbeddingMutationVariables;
      response: SetEnableDocEmbeddingMutation;
    }
  | {
      name: 'setEnableSharingMutation';
      variables: SetEnableSharingMutationVariables;
      response: SetEnableSharingMutation;
    }
  | {
      name: 'setEnableUrlPreviewMutation';
      variables: SetEnableUrlPreviewMutationVariables;
      response: SetEnableUrlPreviewMutation;
    }
  | {
      name: 'inviteByEmailsMutation';
      variables: InviteByEmailsMutationVariables;
      response: InviteByEmailsMutation;
    }
  | {
      name: 'acceptInviteByInviteIdMutation';
      variables: AcceptInviteByInviteIdMutationVariables;
      response: AcceptInviteByInviteIdMutation;
    }
  | {
      name: 'createInviteLinkMutation';
      variables: CreateInviteLinkMutationVariables;
      response: CreateInviteLinkMutation;
    }
  | {
      name: 'revokeInviteLinkMutation';
      variables: RevokeInviteLinkMutationVariables;
      response: RevokeInviteLinkMutation;
    }
  | {
      name: 'approveWorkspaceTeamMemberMutation';
      variables: ApproveWorkspaceTeamMemberMutationVariables;
      response: ApproveWorkspaceTeamMemberMutation;
    }
  | {
      name: 'grantWorkspaceTeamMemberMutation';
      variables: GrantWorkspaceTeamMemberMutationVariables;
      response: GrantWorkspaceTeamMemberMutation;
    };
