import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

export class OneDriveProvider extends OAuthProvider {
  name = 'onedrive';
  displayName = 'OneDrive (Microsoft)';
  scopes = ['Files.Read', 'User.Read', 'offline_access'];

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const clientId = process.env.MICROSOFT_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      scope: this.scopes.join(' '),
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });
    return `${MICROSOFT_AUTH_URL}?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.MICROSOFT_CLIENT_ID ?? '';
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) throw new Error('OneDrive requires MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET');
    const response = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, scope: this.scopes.join(' ') }),
    });
    const data = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope: string };
    return { accessToken: data.access_token, refreshToken: data.refresh_token, scopes: data.scope.split(' ') };
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${accessToken}` } });
    const user = await response.json() as { id: string; displayName: string; mail?: string; userPrincipalName?: string };
    return { externalId: user.id, displayName: user.displayName, email: user.mail ?? user.userPrincipalName };
  }

  async listFiles(accessToken: string) {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.json();
  }
}
