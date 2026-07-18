import { createRemoteJWKSet, jwtVerify } from "jose";

import { sha256Base64Url } from "./crypto";
import { HttpError, isRecord } from "./http-error";
import type {
  AuthPrincipal,
  PresentedCredential,
  RuntimeBindings,
} from "./runtime";

const PUBLIC_AUTH_ROUTES = new Set([
  "POST /api/auth/exchange-session",
  "POST /api/auth/forgot-password",
  "POST /api/auth/login",
  "POST /api/auth/magic-link",
  "POST /api/auth/recover-password",
  "POST /api/auth/refresh",
]);

const TOKEN_PATTERN = /^[A-Za-z0-9._~+/-]+=*$/u;
const UNSAFE_METHODS = new Set(["DELETE", "PATCH", "POST", "PUT"]);

export type VerifyAccessToken = (
  token: string,
  env: RuntimeBindings,
) => Promise<AuthPrincipal>;

let cachedJwks:
  | {
      resolver: ReturnType<typeof createRemoteJWKSet>;
      url: string;
    }
  | undefined;

function validToken(token: string): boolean {
  return (
    token.length >= 16 && token.length <= 8192 && TOKEN_PATTERN.test(token)
  );
}

function cookieValue(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1 || part.slice(0, separator).trim() !== name) continue;
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}

export function extractCredential(
  headers: Headers,
): PresentedCredential | null {
  const authorization = headers.get("authorization");
  if (authorization) {
    const [scheme, token, ...extra] = authorization.trim().split(/\s+/u);
    if (scheme?.toLowerCase() !== "bearer" || !token || extra.length > 0) {
      return null;
    }
    return validToken(token) ? { source: "bearer", token } : null;
  }

  const token = cookieValue(headers.get("cookie") ?? "", "manut_access_token");
  return token && validToken(token) ? { source: "cookie", token } : null;
}

const REALTIME_BRIDGE_EVENT_PATH =
  /^\/api\/v1\/realtime\/rooms\/[A-Za-z0-9_-]{1,96}\/events$/u;

export function isPublicApiRoute(method: string, pathname: string): boolean {
  const normalizedMethod = method.toUpperCase();
  const normalizedPathname = pathname.toLowerCase();
  if (PUBLIC_AUTH_ROUTES.has(`${normalizedMethod} ${normalizedPathname}`)) {
    return true;
  }
  if (normalizedPathname.startsWith("/api/legal-public/sign/")) {
    return normalizedMethod === "GET" || normalizedMethod === "POST";
  }
  // Express→DO fan-out authenticates with EDGE_SIGNING_KEY, not a user session.
  if (
    normalizedMethod === "POST" &&
    REALTIME_BRIDGE_EVENT_PATH.test(pathname)
  ) {
    return true;
  }
  return false;
}

export function enforceSameOrigin(
  request: Request,
  credential: PresentedCredential,
): void {
  const websocketUpgrade =
    request.headers.get("upgrade")?.toLowerCase() === "websocket";
  if (
    credential.source !== "cookie" ||
    (!UNSAFE_METHODS.has(request.method) && !websocketUpgrade)
  ) {
    return;
  }
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new HttpError(
      403,
      "CROSS_ORIGIN_REQUEST",
      "Cross-origin request rejected.",
    );
  }
}

export function enforceRefreshOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new HttpError(
      403,
      "CROSS_ORIGIN_REQUEST",
      "Cross-origin request rejected.",
    );
  }
}

function configuredHttpsUrl(value: string, code: string): string {
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error("unsafe URL");
    }
    return url.toString();
  } catch {
    throw new HttpError(503, code, "Authentication is not configured.");
  }
}

function remoteJwks(url: string): ReturnType<typeof createRemoteJWKSet> {
  if (cachedJwks?.url === url) {
    return cachedJwks.resolver;
  }
  const resolver = createRemoteJWKSet(new URL(url), {
    cacheMaxAge: 5 * 60 * 1000,
    cooldownDuration: 30 * 1000,
    timeoutDuration: 5 * 1000,
  });
  cachedJwks = { resolver, url };
  return resolver;
}

const TERMINAL_TOKEN_ERROR_CODES = new Set([
  "ERR_JOSE_ALG_NOT_ALLOWED",
  "ERR_JOSE_NOT_SUPPORTED",
  "ERR_JWKS_MULTIPLE_MATCHING_KEYS",
  "ERR_JWKS_NO_MATCHING_KEY",
  "ERR_JWS_INVALID",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWT_EXPIRED",
  "ERR_JWT_INVALID",
]);

function isTerminalTokenError(error: unknown): boolean {
  return (
    isRecord(error) &&
    typeof error.code === "string" &&
    TERMINAL_TOKEN_ERROR_CODES.has(error.code)
  );
}

export const verifyAccessToken: VerifyAccessToken = async (token, env) => {
  const jwksUrl = configuredHttpsUrl(
    env.AUTH_JWKS_URL,
    "AUTH_JWKS_NOT_CONFIGURED",
  );
  const issuer = configuredHttpsUrl(
    env.AUTH_ISSUER,
    "AUTH_ISSUER_NOT_CONFIGURED",
  ).replace(/\/$/u, "");
  const audience = env.AUTH_AUDIENCE.trim();
  if (!audience) {
    throw new HttpError(
      503,
      "AUTH_AUDIENCE_NOT_CONFIGURED",
      "Authentication is not configured.",
    );
  }

  let payload: unknown;
  try {
    const verified = await jwtVerify(token, remoteJwks(jwksUrl), {
      algorithms: ["ES256", "RS256"],
      audience,
      issuer,
      requiredClaims: ["sub", "exp", "iat"],
    });
    payload = verified.payload;
  } catch (error) {
    if (isTerminalTokenError(error)) {
      throw new HttpError(
        401,
        "INVALID_SESSION",
        "Authentication is required.",
      );
    }
    throw new HttpError(
      503,
      "AUTH_VERIFICATION_UNAVAILABLE",
      "Authentication verification is temporarily unavailable.",
    );
  }

  if (
    !isRecord(payload) ||
    typeof payload.sub !== "string" ||
    !payload.sub.trim() ||
    typeof payload.exp !== "number" ||
    !Number.isSafeInteger(payload.exp) ||
    typeof payload.iat !== "number" ||
    !Number.isSafeInteger(payload.iat)
  ) {
    throw new HttpError(401, "INVALID_SESSION", "Authentication is required.");
  }

  return {
    role: typeof payload.role === "string" ? payload.role : null,
    subject: payload.sub,
  };
};

export async function principalKey(principal: AuthPrincipal): Promise<string> {
  return sha256Base64Url(principal.subject);
}
