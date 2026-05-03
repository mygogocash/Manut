import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token';
const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';

interface LinearTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope: string;
  error?: string;
  error_description?: string;
}

interface LinearViewer {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

interface LinearTeamNode {
  id: string;
  name: string;
}

interface LinearViewerResponse {
  data?: {
    viewer: LinearViewer;
    teams: {
      nodes: LinearTeamNode[];
    };
  };
  errors?: Array<{ message: string }>;
}

interface LinearIssueState {
  name: string;
}

interface LinearIssueNode {
  id: string;
  title: string;
  state: LinearIssueState;
}

interface LinearIssuesResponse {
  data?: {
    team: {
      issues: {
        nodes: LinearIssueNode[];
      };
    };
  };
  errors?: Array<{ message: string }>;
}

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

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.LINEAR_CLIENT_ID ?? '';
    const clientSecret = process.env.LINEAR_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
      throw new Error(
        'Linear integration requires LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET to be configured'
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(LINEAR_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = (await response.json()) as LinearTokenResponse;
    if (data.error) {
      throw new Error(
        `Linear OAuth error: ${data.error_description ?? data.error}`
      );
    }

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined;

    return {
      accessToken: data.access_token,
      expiresAt,
      scopes: data.scope ? data.scope.split(',') : this.scopes,
    };
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ viewer { id name email avatarUrl } teams { nodes { id name } } }',
      }),
    });

    const data = (await response.json()) as LinearViewerResponse;
    if (data.errors && data.errors.length > 0) {
      throw new Error(`Linear GraphQL error: ${data.errors[0].message}`);
    }
    if (!data.data) {
      throw new Error('Linear API returned no data');
    }

    const viewer = data.data.viewer;
    return {
      externalId: viewer.id,
      displayName: viewer.name,
      email: viewer.email,
      avatarUrl: viewer.avatarUrl,
    };
  }

  async listTeams(
    accessToken: string
  ): Promise<{ id: string; name: string }[]> {
    const response = await fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ viewer { id name email avatarUrl } teams { nodes { id name } } }',
      }),
    });

    const data = (await response.json()) as LinearViewerResponse;
    if (data.errors && data.errors.length > 0) {
      throw new Error(`Linear GraphQL error: ${data.errors[0].message}`);
    }
    if (!data.data) {
      throw new Error('Linear API returned no data');
    }

    return data.data.teams.nodes.map(t => ({ id: t.id, name: t.name }));
  }

  async listIssues(
    accessToken: string,
    teamId: string
  ): Promise<{ id: string; title: string; state: string }[]> {
    const response = await fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query:
          'query($teamId: String!) { team(id: $teamId) { issues { nodes { id title state { name } } } } }',
        variables: { teamId },
      }),
    });

    const data = (await response.json()) as LinearIssuesResponse;
    if (data.errors && data.errors.length > 0) {
      throw new Error(`Linear GraphQL error: ${data.errors[0].message}`);
    }
    if (!data.data) {
      throw new Error('Linear API returned no data');
    }

    return data.data.team.issues.nodes.map(issue => ({
      id: issue.id,
      title: issue.title,
      state: issue.state.name,
    }));
  }
}
