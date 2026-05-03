export abstract class OAuthProvider {
  abstract name: string;
  abstract displayName: string;
  abstract scopes: string[];

  abstract getAuthorizationUrl(state: string, redirectUri: string): string;
  abstract exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  abstract getUserInfo(accessToken: string): Promise<UserInfo>;
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
