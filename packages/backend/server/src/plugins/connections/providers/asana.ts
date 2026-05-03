import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

export class AsanaProvider extends OAuthProvider {
  name = 'asana';
  displayName = 'Asana';
  scopes = ['default'];

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const clientId = process.env.ASANA_CLIENT_ID ?? '';
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state });
    return `https://app.asana.com/-/oauth_authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.ASANA_CLIENT_ID ?? '';
    const clientSecret = process.env.ASANA_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) throw new Error('Asana requires ASANA_CLIENT_ID and ASANA_CLIENT_SECRET');
    const response = await fetch('https://app.asana.com/-/oauth_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    });
    const data = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    return { accessToken: data.access_token, refreshToken: data.refresh_token, scopes: ['default'] };
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch('https://app.asana.com/api/1.0/users/me', { headers: { Authorization: `Bearer ${accessToken}` } });
    const { data } = await response.json() as { data: { gid: string; name: string; email: string; photo?: { image_128x128?: string } } };
    return { externalId: data.gid, displayName: data.name, email: data.email, avatarUrl: data.photo?.image_128x128 };
  }
}
