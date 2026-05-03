import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_URL = 'https://api.github.com';

interface GitHubTokenResponse {
  access_token: string;
  scope: string;
  token_type: string;
  error?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string | null;
  avatar_url?: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
}

export class GitHubProvider extends OAuthProvider {
  name = 'github';
  displayName = 'GitHub';
  scopes = ['read:user', 'repo'];

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const clientId = process.env.GITHUB_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: this.scopes.join(' '),
      state,
    });
    return `${GITHUB_OAUTH_URL}?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.GITHUB_CLIENT_ID ?? '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
      throw new Error(
        'GitHub integration requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to be configured'
      );
    }

    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = (await response.json()) as GitHubTokenResponse;
    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error}`);
    }

    return {
      accessToken: data.access_token,
      scopes: data.scope ? data.scope.split(',') : this.scopes,
    };
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch(`${GITHUB_API_URL}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    const user = (await response.json()) as GitHubUser;
    return {
      externalId: String(user.id),
      displayName: user.name ?? user.login,
      email: user.email ?? undefined,
      avatarUrl: user.avatar_url,
    };
  }

  async listRepositories(
    accessToken: string
  ): Promise<{ id: string; name: string; url: string }[]> {
    const response = await fetch(
      `${GITHUB_API_URL}/user/repos?per_page=100&sort=updated`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );
    const repos = (await response.json()) as GitHubRepo[];
    return repos.map(r => ({
      id: String(r.id),
      name: r.full_name,
      url: r.html_url,
    }));
  }

  async listIssues(accessToken: string, repo: string): Promise<object[]> {
    const response = await fetch(
      `${GITHUB_API_URL}/repos/${repo}/issues?per_page=100&state=open`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );
    return (await response.json()) as object[];
  }
}
