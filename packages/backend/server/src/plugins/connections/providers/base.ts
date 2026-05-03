export abstract class OAuthProvider {
  abstract name: string;
  abstract displayName: string;
  abstract scopes: string[];

  abstract getAuthorizationUrl(state: string, redirectUri: string): string;
  abstract exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  abstract getUserInfo(accessToken: string): Promise<UserInfo>;

  /**
   * Optional. If implemented, the connections service will call this to obtain
   * a fresh access token when the stored one is expired. Providers that don't
   * issue refresh tokens (e.g. GitHub classic OAuth apps) should leave this
   * undefined; the user will be prompted to re-authorize on expiry.
   */
  refreshAccessToken?(refreshToken: string): Promise<OAuthTokens>;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
}

export interface UserInfo {
  externalId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
}
