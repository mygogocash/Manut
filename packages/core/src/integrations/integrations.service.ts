import type { Db } from "@nexora/db";
import * as repo from "./integrations.repository";

function hasGmailSendScope(scope: string): boolean {
  return scope.split(/\s+/).includes("https://www.googleapis.com/auth/gmail.send");
}

export type IntegrationsEnv = {
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
};

export async function getStatus(db: Db, userId: string, env: IntegrationsEnv) {
  const hasGoogleEnv = !!(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
  const conn = await repo.findGoogleConnectionByUserId(db, userId);
  const google = conn
    ? {
        connected: true as const,
        accountEmail: conn.accountEmail,
        scope: conn.scope,
        expiresAt: conn.expiresAt,
        canSendMail: hasGmailSendScope(conn.scope),
      }
    : { connected: false as const };

  return {
    anthropic: {
      configured: !!env.ANTHROPIC_API_KEY,
      status: env.ANTHROPIC_API_KEY ? "connected" : "not_configured",
    },
    gmail: { configured: hasGoogleEnv, status: hasGoogleEnv ? "connected" : "not_configured" },
    drive: { configured: hasGoogleEnv, status: hasGoogleEnv ? "connected" : "not_configured" },
    google,
  };
}
