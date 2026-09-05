import { createMiddleware } from "hono/factory";
import { createDb } from "@nexora/db";
import { createAuth, kvSecondaryStorage } from "@nexora/auth";
import type { AppEnv } from "../lib/context";
import { createEmailSender } from "../lib/email";

/**
 * One DB handle + one Better Auth instance per request (isolates share nothing);
 * the pg client is closed after the response is sent.
 */
export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
  c.set("requestId", c.req.header("cf-ray") ?? crypto.randomUUID());
  const { db, client } = createDb(c.env.HYPERDRIVE.connectionString);
  c.set("db", db);
  c.set(
    "auth",
    createAuth(c.env, db, kvSecondaryStorage(c.env.KV_SESSIONS), createEmailSender(c.env)),
  );
  c.set("user", null);
  try {
    await next();
  } finally {
    c.executionCtx.waitUntil(client.end({ timeout: 1 }));
  }
});
