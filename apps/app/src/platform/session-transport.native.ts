import * as SecureStore from "expo-secure-store";

import type { SessionTransport, TransportRequest } from "@manut/app-core";

const ACCESS_TOKEN_KEY = "manut_access_token";
const REFRESH_TOKEN_KEY = "manut_refresh_token";

export interface NativeSessionTokens {
  accessToken: string;
  refreshToken: string;
}

export async function persistNativeSession(
  session: NativeSessionTokens,
): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken);
}

export async function clearNativeSession(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function getNativeAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

async function getNativeRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readSessionTokens(body: unknown): NativeSessionTokens | null {
  if (!isRecord(body) || !isRecord(body.session)) return null;
  const accessToken = body.session.accessToken;
  const refreshToken = body.session.refreshToken;
  if (typeof accessToken !== "string" || !accessToken.trim()) return null;
  if (typeof refreshToken !== "string" || !refreshToken.trim()) return null;
  return { accessToken, refreshToken };
}

export function createSessionTransport(apiBaseUrl: string): SessionTransport {
  const baseUrl = apiBaseUrl.replace(/\/+$/u, "");

  return {
    async decorate(request: TransportRequest) {
      const token = await getNativeAccessToken();
      return {
        ...request,
        headers: {
          ...request.headers,
          "X-Manut-Client": "native",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "omit",
      };
    },
    async refresh() {
      const refreshToken = await getNativeRefreshToken();
      if (!refreshToken) return false;
      try {
        const response = await fetch(`${baseUrl}/auth/refresh`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Manut-Client": "native",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return false;
        const body: unknown = await response.json();
        const session = readSessionTokens(body);
        if (!session) return false;
        await persistNativeSession(session);
        return true;
      } catch {
        return false;
      }
    },
    async clear() {
      await clearNativeSession();
    },
  };
}
