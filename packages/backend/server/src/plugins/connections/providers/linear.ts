import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

export class LinearProvider extends OAuthProvider {
  name = 'linear';
  displayName = 'Linear';
  scopes = ['read'];

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const clientId = process.env.LINEAR_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      scope: this.scopes.join(','),
      state,
      redirect_uri: redirectUri,
      response_type: 'code',
    });
    return `https://linear.app/oauth/authorize?${params}`;
  }

  async exchangeCode(_code: string, _redirectUri: string): Promise<OAuthTokens> {
    // TODO: implement with LINEAR_CLIENT_ID + LINEAR_CLIENT_SECRET env vars
    throw new Error(
      'Linear integration requires LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET to be configured'
    );
  }

  async getUserInfo(_accessToken: string): Promise<UserInfo> {
    // TODO: implement using https://api.linear.app/graphql
    throw new Error('Linear getUserInfo not yet implemented');
  }

  async listIssues(_accessToken: string, _teamId: string): Promise<object[]> {
    // TODO: implement using Linear GraphQL API
    throw new Error('Linear listIssues not yet implemented');
  }
}
