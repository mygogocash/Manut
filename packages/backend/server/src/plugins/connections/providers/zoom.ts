import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

export class ZoomProvider extends OAuthProvider {
  name = 'zoom';
  displayName = 'Zoom';
  scopes = ['user:read', 'recording:read'];

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const clientId = process.env.ZOOM_CLIENT_ID ?? '';
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state });
    return `https://zoom.us/oauth/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.ZOOM_CLIENT_ID ?? '';
    const clientSecret = process.env.ZOOM_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) throw new Error('Zoom requires ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET');
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });
    const data = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope: string };
    return { accessToken: data.access_token, refreshToken: data.refresh_token, scopes: data.scope.split(' ') };
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch('https://api.zoom.us/v2/users/me', { headers: { Authorization: `Bearer ${accessToken}` } });
    const user = await response.json() as { id: string; display_name: string; email: string; pic_url?: string };
    return { externalId: user.id, displayName: user.display_name, email: user.email, avatarUrl: user.pic_url };
  }
}
