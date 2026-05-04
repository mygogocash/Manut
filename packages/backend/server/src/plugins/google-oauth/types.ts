/**
 * v1.10.1 Google OAuth scaffold.
 *
 * Two scopes are exposed independently so a workspace can connect Gmail
 * without granting Drive access (and vice-versa). Internally each scope is
 * stored as a row in `IntegrationConnection` keyed by a distinct provider
 * name (`google_gmail` / `google_drive`) — this avoids a Prisma migration
 * for v1.10.1 while still keeping the two consents separable.
 */
export type GoogleScope = 'gmail' | 'drive';

export const GOOGLE_OAUTH_SCOPES: Record<GoogleScope, string> = {
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  drive: 'https://www.googleapis.com/auth/drive.readonly',
};

/**
 * Provider name persisted in `IntegrationConnection.provider`. Each scope
 * gets its own row so disconnecting Gmail doesn't revoke Drive.
 */
export const GOOGLE_PROVIDER_NAME: Record<GoogleScope, string> = {
  gmail: 'google_gmail',
  drive: 'google_drive',
};

export interface GoogleConnectionStatus {
  /** True when a stored, non-expired connection exists for this scope. */
  connected: boolean;
  /** Email of the connected Google account, when available. */
  email?: string;
}

export interface GoogleOAuthStartState {
  userId: string;
  workspaceId: string;
  scope: GoogleScope;
  redirectUri: string;
}

export interface GoogleOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

export interface GoogleUserInfoResponse {
  id: string;
  email: string;
  verified_email?: boolean;
  name?: string;
  picture?: string;
}
