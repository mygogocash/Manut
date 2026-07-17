import type {
  AuthGateway,
  AuthLinkResponse,
  AuthSession,
} from "@manut/app-core";

import {
  getPlatformApiClient,
  getPlatformSessionTransport,
} from "./api-client.web";

export function createPlatformAuthGateway(): AuthGateway {
  const api = getPlatformApiClient();
  const session = getPlatformSessionTransport();

  return {
    login: (email, password) =>
      api.post("/auth/login", { email: email.trim(), password }),
    getMe: () => api.get("/auth/me"),
    requestPasswordReset: (email) =>
      api.post<AuthLinkResponse>("/auth/forgot-password", { email }),
    requestMagicLink: (email) =>
      api.post<AuthLinkResponse>("/auth/magic-link", { email }),
    recoverPassword: (input) =>
      api.post<AuthSession>("/auth/recover-password", input),
    exchangeSession: (input) =>
      api.post<AuthSession>("/auth/exchange-session", input),
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
