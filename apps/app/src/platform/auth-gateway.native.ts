import {
  ApiError,
  type AuthGateway,
  type AuthLinkResponse,
  type AuthSession,
} from "@manut/app-core";

import {
  getPlatformApiClient,
  getPlatformSessionTransport,
} from "./api-client.native";
import { getNativeSupabaseClient } from "./session-transport.native";

export function createPlatformAuthGateway(): AuthGateway {
  const api = getPlatformApiClient();
  const session = getPlatformSessionTransport();

  return {
    async login(email, password) {
      const client = getNativeSupabaseClient();
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        throw new ApiError(401, "INVALID_CREDENTIALS", error.message);
      }
      try {
        return await api.get<AuthSession>("/auth/me");
      } catch (cause) {
        await client.auth.signOut({ scope: "local" }).catch(() => undefined);
        throw cause;
      }
    },
    getMe: () => api.get("/auth/me"),
    requestPasswordReset: (email) =>
      api.post<AuthLinkResponse>("/auth/forgot-password", { email }),
    requestMagicLink: (email) =>
      api.post<AuthLinkResponse>("/auth/magic-link", { email }),
    async recoverPassword(input) {
      const result = await api.post<AuthSession>(
        "/auth/recover-password",
        input,
      );
      const { error } = await getNativeSupabaseClient().auth.signInWithPassword(
        { email: result.user.email, password: input.newPassword },
      );
      if (error) {
        throw new ApiError(
          401,
          "SESSION_ESTABLISHMENT_FAILED",
          "Your password was updated. Sign in with the new password to continue.",
        );
      }
      return result;
    },
    async exchangeSession(input) {
      const client = getNativeSupabaseClient();
      const { data, error } = await client.auth.setSession({
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
      });
      if (error || !data.session) {
        throw new ApiError(
          401,
          "INVALID_LINK_SESSION",
          "This sign-in link is invalid or has expired.",
        );
      }
      try {
        return await api.get<AuthSession>("/auth/me");
      } catch (cause) {
        await client.auth.signOut({ scope: "local" }).catch(() => undefined);
        throw cause;
      }
    },
    async changePassword(input) {
      await api.post<{ success: boolean }>("/auth/change-password", input);
    },
    async logout() {
      await session.clear();
    },
  };
}
