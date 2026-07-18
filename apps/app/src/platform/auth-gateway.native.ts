import {
  ApiError,
  type AuthGateway,
  type AuthLinkResponse,
  type AuthLinkTokens,
  type AuthSession,
} from "@manut/app-core";

import {
  getPlatformApiClient,
  getPlatformSessionTransport,
} from "./api-client.native";
import {
  clearNativeSession,
  persistNativeSession,
  type NativeSessionTokens,
} from "./session-transport.native";

interface NativeAuthPayload extends AuthSession {
  session?: NativeSessionTokens & { expiresIn?: number; expiresAt?: number };
}

function stripSession(payload: NativeAuthPayload): AuthSession {
  return {
    user: payload.user,
    roles: payload.roles,
    permissions: payload.permissions,
  };
}

function requireNativeSession(payload: NativeAuthPayload): NativeSessionTokens {
  const accessToken = payload.session?.accessToken?.trim();
  const refreshToken = payload.session?.refreshToken?.trim();
  if (!accessToken || !refreshToken) {
    throw new ApiError(
      503,
      "NATIVE_SESSION_UNAVAILABLE",
      "Native bearer session was not returned. Configure Manut API auth for native clients (X-Manut-Client) and Cloudflare Access JWKS on the Worker.",
    );
  }
  return { accessToken, refreshToken };
}

export function createPlatformAuthGateway(): AuthGateway {
  const api = getPlatformApiClient();
  const session = getPlatformSessionTransport();

  return {
    async login(email, password) {
      try {
        const payload = await api.post<NativeAuthPayload>("/auth/login", {
          email: email.trim(),
          password,
        });
        await persistNativeSession(requireNativeSession(payload));
        return stripSession(payload);
      } catch (cause) {
        await clearNativeSession().catch(() => undefined);
        throw cause;
      }
    },
    getMe: () => api.get("/auth/me"),
    requestPasswordReset: (email) =>
      api.post<AuthLinkResponse>("/auth/forgot-password", { email }),
    requestMagicLink: (email) =>
      api.post<AuthLinkResponse>("/auth/magic-link", { email }),
    async recoverPassword(input) {
      try {
        const payload = await api.post<NativeAuthPayload>(
          "/auth/recover-password",
          input,
        );
        await persistNativeSession(requireNativeSession(payload));
        return stripSession(payload);
      } catch (cause) {
        await clearNativeSession().catch(() => undefined);
        throw cause;
      }
    },
    async exchangeSession(input: AuthLinkTokens) {
      try {
        const payload = await api.post<NativeAuthPayload>(
          "/auth/exchange-session",
          input,
        );
        await persistNativeSession(requireNativeSession(payload));
        return stripSession(payload);
      } catch (cause) {
        await clearNativeSession().catch(() => undefined);
        throw cause;
      }
    },
    async changePassword(input) {
      await api.post<{ success: boolean }>("/auth/change-password", input);
    },
    async logout() {
      try {
        await api.post("/auth/logout");
      } finally {
        await session.clear();
      }
    },
  };
}
