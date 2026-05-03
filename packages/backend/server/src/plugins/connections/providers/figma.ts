import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token';
const FIGMA_API_URL = 'https://api.figma.com/v1';

interface FigmaTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface FigmaUser {
  id: string;
  handle: string;
  email?: string;
  img_url?: string;
}

interface FigmaProjectFile {
  key: string;
  name: string;
  last_modified: string;
}

interface FigmaFilesResponse {
  files: FigmaProjectFile[];
}

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

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.FIGMA_CLIENT_ID ?? '';
    const clientSecret = process.env.FIGMA_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
      throw new Error(
        'Figma integration requires FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET to be configured'
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code',
    });

    const response = await fetch(FIGMA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = (await response.json()) as FigmaTokenResponse;
    if (data.error) {
      throw new Error(
        `Figma OAuth error: ${data.error_description ?? data.error}`
      );
    }

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      scopes: this.scopes,
    };
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch(`${FIGMA_API_URL}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const user = (await response.json()) as FigmaUser;
    return {
      externalId: user.id,
      displayName: user.handle,
      email: user.email,
      avatarUrl: user.img_url,
    };
  }

  async listFiles(
    accessToken: string,
    projectId: string
  ): Promise<{ files: { key: string; name: string; last_modified: string }[] }> {
    const response = await fetch(
      `${FIGMA_API_URL}/projects/${projectId}/files`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = (await response.json()) as FigmaFilesResponse;
    return {
      files: data.files.map(f => ({
        key: f.key,
        name: f.name,
        last_modified: f.last_modified,
      })),
    };
  }
}
