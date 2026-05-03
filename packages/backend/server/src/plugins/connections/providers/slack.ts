import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

const SLACK_OAUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_API_URL = 'https://slack.com/api';

interface SlackTokenResponse {
  ok: boolean;
  error?: string;
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope: string;
  authed_user: {
    id: string;
  };
}

interface SlackUserIdentity {
  id: string;
  name: string;
  email?: string;
  image_192?: string;
}

interface SlackIdentityResponse {
  ok: boolean;
  error?: string;
  user: SlackUserIdentity;
}

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackConversationsResponse {
  ok: boolean;
  error?: string;
  channels: SlackChannel[];
}

export class SlackProvider extends OAuthProvider {
  name = 'slack';
  displayName = 'Slack';
  scopes = ['channels:read', 'users:read', 'files:read', 'identity.basic', 'identity.email', 'identity.avatar'];

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const clientId = process.env.SLACK_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      scope: this.scopes.join(','),
      state,
      redirect_uri: redirectUri,
    });
    return `${SLACK_OAUTH_URL}?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.SLACK_CLIENT_ID ?? '';
    const clientSecret = process.env.SLACK_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
      throw new Error(
        'Slack integration requires SLACK_CLIENT_ID and SLACK_CLIENT_SECRET to be configured'
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(SLACK_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = (await response.json()) as SlackTokenResponse;
    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error ?? 'unknown error'}`);
    }

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      scopes: data.scope ? data.scope.split(',') : this.scopes,
    };
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch(`${SLACK_API_URL}/users.identity`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = (await response.json()) as SlackIdentityResponse;
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error ?? 'unknown error'}`);
    }

    return {
      externalId: data.user.id,
      displayName: data.user.name,
      email: data.user.email,
      avatarUrl: data.user.image_192,
    };
  }

  async listChannels(
    accessToken: string
  ): Promise<{ id: string; name: string }[]> {
    const params = new URLSearchParams({
      types: 'public_channel,private_channel',
      limit: '200',
    });

    const response = await fetch(
      `${SLACK_API_URL}/conversations.list?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = (await response.json()) as SlackConversationsResponse;
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error ?? 'unknown error'}`);
    }

    return data.channels.map(ch => ({ id: ch.id, name: ch.name }));
  }
}
