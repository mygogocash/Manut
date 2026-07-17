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

// The API runs behind the Manut edge Worker / Container ingress. Keep a
// numeric trust count so rate limiting derives the client IP from exactly one
// controlled proxy hop.
app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
// CORS is environment-driven and fails closed in production. Web requests use
// same-origin HTTP-only cookies; native bearer requests do not need credentialed
// browser CORS.
//
// Resolution order:
//   1. Explicit `CORS_ALLOWED_ORIGINS` env var (comma-separated).
//      Use this in production / staging deploys.
//   2. `PORTAL_URL` if set (the canonical web origin).
//   3. Dev fallback list — covers local Expo web and the API.
//      tunnels. NEVER reached when `NODE_ENV === "production"`.
function resolveCorsOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS ?? "";
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;

  if (process.env.PORTAL_URL) return [process.env.PORTAL_URL];

  if (process.env.NODE_ENV === "production") {
    return [];
  }

  return [
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
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
      "Cookie",
    ],
  }),
);
// Other JSON webhooks (currently GitHub) also need their literal bytes. Keep a
// defensive copy in addition to the parsed body so downstream code cannot
// accidentally change the signature input.
app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
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
    company: "Manut",
  });
});

registerModules(app);

app.use(errorHandler);

export default app;
