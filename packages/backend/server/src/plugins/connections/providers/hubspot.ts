import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

export class HubspotProvider extends OAuthProvider {
  name = 'hubspot';
  displayName = 'HubSpot';
  scopes = ['oauth', 'crm.objects.contacts.read', 'crm.objects.deals.read'];

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const clientId = process.env.HUBSPOT_CLIENT_ID ?? '';
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: this.scopes.join(' '), state });
    return `https://app.hubspot.com/oauth/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.HUBSPOT_CLIENT_ID ?? '';
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) throw new Error('HubSpot requires HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET');
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code }),
    });
    const data = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    return { accessToken: data.access_token, refreshToken: data.refresh_token, scopes: this.scopes };
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + accessToken);
    const data = await response.json() as { user_id: number; user: string; hub_id: number };
    return { externalId: String(data.user_id), displayName: data.user };
  }
}
