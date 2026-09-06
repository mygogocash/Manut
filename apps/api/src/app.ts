import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import type { Request, Response } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { errorHandler } from "@/core/middleware/error-handler";
import { requestLogger } from "@/core/middleware/request-logger";
import { registerModules } from "@/modules";

const app = express();

// Cloud Run sits behind a single Google front-end hop. Vercel Fluid sits
// behind more. Use a numeric trust count (not `true`) so `req.ip` still
// resolves from X-Forwarded-For while express-rate-limit's trust-proxy
// validation stays satisfied.
app.set("trust proxy", process.env.VERCEL ? 2 : 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  compression({
    filter: (req, res) => {
      if (req.method === "POST" && req.originalUrl.includes("/api/aria/chat")) {
        return false;
      }
      return compression.filter(req, res);
    },
  }),
);
// CORS allowlist — env-driven so prod and staging origins land in the
// list without code changes, while wildcard exposure is removed in
// production. `credentials` stays false: the web app rides same-site
// httpOnly cookies and never needs cross-origin credentialed
// requests. Leaving the default at "*" was acceptable while every
// caller was the same Cloud Run deployment, but as documented in
// #525 it becomes a trap the moment another origin (a staging UI,
// an embedded widget, a CLI test from a coworker's laptop) starts
// "fixing" CORS by flipping credentials on.
//
// Resolution order:
//   1. Explicit `CORS_ALLOWED_ORIGINS` env var (comma-separated).
//      Use this in production / staging deploys.
//   2. `PORTAL_URL` if set (the canonical web origin).
//   3. Dev fallback list — covers local Next.js + a couple of common
//      tunnels. NEVER reached when `NODE_ENV === "production"`.
const PROD_FALLBACK_ORIGIN = "https://intranet.thebinaryholdings.com";

function resolveCorsOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS ?? "";
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;

  const origins: string[] = [];
  if (process.env.PORTAL_URL) origins.push(process.env.PORTAL_URL);
  // Vercel injects the deployment host without a scheme (web or API project).
  // Prefer PORTAL_URL / CORS_ALLOWED_ORIGINS for the web origin; these are
  // only fallbacks when those are unset during a preview deploy.
  for (const host of [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ]) {
    if (host) origins.push(host.startsWith("http") ? host : `https://${host}`);
  }
  if (origins.length > 0) return [...new Set(origins)];

  if (process.env.NODE_ENV === "production") {
    return [PROD_FALLBACK_ORIGIN];
  }

  return [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:8082",
    "http://127.0.0.1:8082",
    "http://localhost:19006",
    "http://127.0.0.1:19006",
  ];
}

const CORS_ORIGINS = resolveCorsOrigins();

app.use(
  cors({
    // Function form so we can reject unlisted origins instead of
    // echoing the request's `Origin` header back unconditionally.
    // Same-origin requests (no `Origin` header, e.g. server-to-server
    // health checks) pass through with `cb(null, true)`.
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
    credentials: false,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Client",
      "Cookie",
    ],
  }),
);
// Stash the raw request body on `req.rawBody` BEFORE the JSON parser
// consumes the stream. GitHub / DocuSign webhooks verify a signature
// computed over the literal bytes; without this hook the verifier
// computes HMAC over an empty string and rejects every real delivery.
// The body bytes are kept in addition to the parsed `req.body`, not
// instead — so non-webhook routes are unaffected.
app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate-limit 429 must match the API error contract `{ error: { code, message } }`
// so the frontend can render a real message instead of "non-JSON response (429)".
const rateLimitHandler = (_req: Request, res: Response) => {
  res.status(429).json({
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests, please try again later.",
    },
  });
};

// Strict bucket for credential endpoints. Brute-force protection.
// `skipSuccessfulRequests`: successful logins (2xx) do not consume the bucket so
// many employees behind one NAT IP are not blocked after a few valid sign-ins.
// Failed attempts (e.g. wrong password → 401) still count toward `max`.
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skipSuccessfulRequests: true,
  }),
);

// Generic bucket for the rest of /api. Sized for dashboard fan-out
// (auth provider polls /me on mount, visibility-return, and a timer).
// Login is metered by its own limiter above; skip here to avoid double-counting.
app.use(
  "/api/",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skip: (req) => req.path === "/auth/login",
  }),
);

app.use(requestLogger);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.json({
    app: "Intranet API",
    version: "1.0.0",
    company: "The Binary Holdings",
  });
});

registerModules(app);

app.use(errorHandler);

export default app;
