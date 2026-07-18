export interface CorsEnv {
  CORS_ALLOWED_ORIGINS?: string;
  PORTAL_URL?: string;
  NODE_ENV?: string;
}

export interface ResolvedCorsOptions {
  origins: string[];
  credentials: boolean;
}

/**
 * Web cookie sessions need credentialed CORS when the Expo SPA and API are on
 * different localhost ports (E2E / local). Production stays fail-closed unless
 * an explicit allowlist is configured.
 */
export function resolveCorsOptions(
  env: CorsEnv = process.env,
): ResolvedCorsOptions {
  const fromEnv = (env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  let origins: string[];
  if (fromEnv.length > 0) {
    origins = fromEnv;
  } else if (env.PORTAL_URL?.trim()) {
    origins = [env.PORTAL_URL.trim()];
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

  return {
    origins,
    credentials: origins.length > 0,
  };
}
