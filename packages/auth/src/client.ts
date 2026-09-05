import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";

export type AuthClientOptions = {
  /** Origin of the Worker, e.g. https://intranet.thebinaryholdings.com */
  baseURL: string;
};

/**
 * Browser / Expo Better Auth client. Native SecureStore plugin lands with
 * `@better-auth/expo` in Phase 2 polish; web uses cookies against the same origin.
 */
export function createAuthClientForApp(options: AuthClientOptions) {
  return createAuthClient({
    baseURL: options.baseURL,
    basePath: "/api/auth",
    plugins: [magicLinkClient()],
  });
}

export type AuthClient = ReturnType<typeof createAuthClientForApp>;
