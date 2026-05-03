import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

export class JiraProvider extends OAuthProvider {
  name = 'jira';
  displayName = 'Jira';
  scopes = ['read:jira-work', 'read:jira-user', 'offline_access'];

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const clientId = process.env.JIRA_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: this.scopes.join(' '),
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    });
    return `https://auth.atlassian.com/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.JIRA_CLIENT_ID ?? '';
    const clientSecret = process.env.JIRA_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) throw new Error('Jira integration requires JIRA_CLIENT_ID and JIRA_CLIENT_SECRET');

    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
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
    const response = await fetch('https://api.atlassian.com/me', { headers: { Authorization: `Bearer ${accessToken}` } });
    const user = await response.json() as { account_id: string; display_name: string; email?: string; picture?: string };
    return { externalId: user.account_id, displayName: user.display_name, email: user.email, avatarUrl: user.picture };
  }

  async listIssues(accessToken: string, cloudId: string, projectKey?: string) {
    const jql = projectKey ? `project = ${projectKey}` : 'assignee = currentUser()';
    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=100`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
    );
    return response.json();
  }
}
