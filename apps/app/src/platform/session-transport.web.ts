import type { SessionTransport, TransportRequest } from "@manut/app-core";

export function createSessionTransport(apiBaseUrl: string): SessionTransport {
  return {
    async decorate(request: TransportRequest) {
      return { ...request, credentials: "include" };
    },
    async refresh() {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    async clear() {
      // The server clears the httpOnly cookie in the logout response.
    },
  };
}
