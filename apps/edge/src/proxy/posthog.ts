import { Hono } from "hono";
import type { Bindings } from "../env";

/**
 * Same-origin PostHog reverse proxy (ports apps/web/next.config.ts rewrites):
 *   /ingest/static/*  -> POSTHOG_ASSETS_HOST/static/*
 *   /ingest/*         -> POSTHOG_HOST/*
 * Keeps analytics working behind ad blockers; strips cookies so PostHog never
 * sees the session.
 */
export const posthogProxy = new Hono<{ Bindings: Bindings }>();

posthogProxy.all("/*", async (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname.replace(/^\/ingest/, "");
  const upstream = path.startsWith("/static/") ? c.env.POSTHOG_ASSETS_HOST : c.env.POSTHOG_HOST;
  const target = new URL(path + url.search, upstream);
  const headers = new Headers(c.req.raw.headers);
  headers.delete("cookie");
  headers.set("host", target.host);
  return fetch(target, { method: c.req.method, headers, body: c.req.raw.body, redirect: "manual" });
});
