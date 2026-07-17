/**
 * Pure HTTP helpers for Google OAuth 2.0 (no DB, no Prisma).
 * Each function maps 1:1 to a Google endpoint.
 */

const AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

const SCOPES = [
  "openid",
  "email",
  // Documented scopes for Google's Gmail + Drive MCP gateways.
  // Source: https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server
  //         https://developers.google.com/workspace/drive/api/guides/configure-mcp-server
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  // Calendar read scope lets the
  // `lookup_my_calendar` tool list upcoming events without write
  // permission. Users with stale tokens trip the insufficient-scope
  // detection and are prompted to reconnect.
  "https://www.googleapis.com/auth/calendar.readonly",
];

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
}

export function buildAuthUrl(params: {
  state: string;
  redirectUri: string;
  clientId: string;
}): string {
  const qs = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: params.state,
  });
  return `${AUTH_BASE_URL}?${qs.toString()}`;
}

async function postForm(
  url: string,
  body: Record<string, string>,
): Promise<Response> {
  const params = new URLSearchParams(body);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

function mapTokens(data: GoogleTokenResponse): GoogleTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
    tokenType: data.token_type,
  };
}

export async function exchangeCode(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokens> {
  const res = await postForm(TOKEN_URL, {
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${txt}`);
  }
  const data = (await res.json()) as GoogleTokenResponse;
  return mapTokens(data);
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokens> {
  const res = await postForm(TOKEN_URL, {
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${txt}`);
  }
  const data = (await res.json()) as GoogleTokenResponse;
  return mapTokens(data);
}

export async function fetchUserInfo(
  accessToken: string,
): Promise<{ email: string; sub: string }> {
  const res = await fetch(USERINFO_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google userinfo failed (${res.status}): ${txt}`);
  }
  const data = (await res.json()) as { email: string; sub: string };
  return { email: data.email, sub: data.sub };
}

export async function revoke(token: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
  });
  return { ok: res.ok };
}
