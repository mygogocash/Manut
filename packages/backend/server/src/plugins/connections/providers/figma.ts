import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

export class FigmaProvider extends OAuthProvider {
  name = 'figma';
  displayName = 'Figma';
  scopes = ['file_read'];

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const clientId = process.env.FIGMA_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      scope: this.scopes.join(','),
      state,
      redirect_uri: redirectUri,
      response_type: 'code',
    });
    return `https://www.figma.com/oauth?${params}`;
  }

  async exchangeCode(_code: string, _redirectUri: string): Promise<OAuthTokens> {
    // TODO: implement with FIGMA_CLIENT_ID + FIGMA_CLIENT_SECRET env vars
    throw new Error(
      'Figma integration requires FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET to be configured'
    );
  }

  async getUserInfo(_accessToken: string): Promise<UserInfo> {
    // TODO: implement using https://api.figma.com/v1/me
    throw new Error('Figma getUserInfo not yet implemented');
  }
}
