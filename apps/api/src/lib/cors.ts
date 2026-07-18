export interface CorsEnv {
  CORS_ALLOWED_ORIGINS?: string;
  PORTAL_URL?: string;
  NODE_ENV?: string;
}

export interface ResolvedCorsOptions {
  origins: string[];
  credentials: boolean;
}

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "*") {
    return null;
  }

  // Browser `Origin` never includes a trailing slash; strip so allowlists match.
  return trimmed.replace(/\/+$/, "");
}

function parseOriginList(raw: string): string[] {
  const seen = new Set<string>();
  const origins: string[] = [];

  for (const part of raw.split(",")) {
    const origin = normalizeOrigin(part);
    if (!origin || seen.has(origin)) {
      continue;
    }
    seen.add(origin);
    origins.push(origin);
  }

  return origins;
}

/**
 * Exact allowlist match only — never substring / prefix reflection.
 */
export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowlist: readonly string[],
): boolean {
  if (!origin || allowlist.length === 0) {
    return false;
  }
  return allowlist.includes(origin);
}

/**
 * Web cookie sessions need credentialed CORS when the Expo SPA and API are on
 * different localhost ports (E2E / local). Production stays fail-closed unless
 * an explicit allowlist is configured.
 */
export function resolveCorsOptions(
  env: CorsEnv = process.env,
): ResolvedCorsOptions {
  const fromEnv = parseOriginList(env.CORS_ALLOWED_ORIGINS ?? "");

  let origins: string[];
  if (fromEnv.length > 0) {
    origins = fromEnv;
  } else {
    const portalOrigin = env.PORTAL_URL
      ? normalizeOrigin(env.PORTAL_URL)
      : null;
    if (portalOrigin) {
      origins = [portalOrigin];
    } else if (env.NODE_ENV === "production") {
      origins = [];
    } else {
      origins = [
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8081",
      ];
    }
  }

  return {
    origins,
    credentials: origins.length > 0,
  };
}
