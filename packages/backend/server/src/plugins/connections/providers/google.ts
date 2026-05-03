import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export class GoogleProvider extends OAuthProvider {
  name = 'google';
  displayName = 'Google (Gmail + Drive)';
  scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ];

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${GOOGLE_AUTH_URL}?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    // TODO: requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
    const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
      throw new Error('Google integration requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    }
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const data = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope: string };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scopes: data.scope.split(' '),
    };
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = await response.json() as { id: string; name: string; email: string; picture?: string };
    return { externalId: user.id, displayName: user.name, email: user.email, avatarUrl: user.picture };
  }

  async listDriveFiles(accessToken: string, query?: string) {
    const q = query ? `&q=${encodeURIComponent(query)}` : '';
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?pageSize=100${q}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.json();
  }

  async listGmailMessages(accessToken: string, maxResults = 20) {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.json();
  }
}
