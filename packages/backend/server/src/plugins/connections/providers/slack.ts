import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

export class SlackProvider extends OAuthProvider {
  name = 'slack';
  displayName = 'Slack';
  scopes = ['channels:read', 'users:read', 'files:read'];

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const clientId = process.env.SLACK_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      scope: this.scopes.join(','),
      state,
      redirect_uri: redirectUri,
    });
    return `https://slack.com/oauth/v2/authorize?${params}`;
  }

  async exchangeCode(_code: string, _redirectUri: string): Promise<OAuthTokens> {
    // TODO: implement with SLACK_CLIENT_ID + SLACK_CLIENT_SECRET env vars
    throw new Error(
      'Slack integration requires SLACK_CLIENT_ID and SLACK_CLIENT_SECRET to be configured'
    );
  }

  async getUserInfo(_accessToken: string): Promise<UserInfo> {
    // TODO: implement using https://slack.com/api/users.identity
    throw new Error('Slack getUserInfo not yet implemented');
  }

  async listChannels(
    _accessToken: string
  ): Promise<{ id: string; name: string }[]> {
    // TODO: implement using https://slack.com/api/conversations.list
    throw new Error('Slack listChannels not yet implemented');
  }
}
