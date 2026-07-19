export type ApiBaseUrlPlatform = "web" | "native";

const RELATIVE_API_BASE = "/api";

type ParsedAbsoluteUrl = {
  protocol: string;
  hostname: string;
  origin: string;
  pathname: string;
};

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

/** Parse absolute http(s) URLs without depending on browser/Node URL globals. */
function parseAbsoluteHttpUrl(value: string): ParsedAbsoluteUrl {
  const match =
    /^(https?):\/\/((?:\[[^\]]+\]|[^/?#:]+)(?::\d+)?)(\/[^?#]*)?/iu.exec(
      value,
    );
  if (!match?.[1] || !match[2]) {
    throw new Error(`EXPO_PUBLIC_API_URL is not a valid URL: ${value}`);
  }

  const protocol = `${match[1].toLowerCase()}:`;
  const host = match[2];
  const hostname = host.replace(/:\d+$/u, "");
  const pathname = (match[3] ?? "/").replace(/\/+$/u, "") || "/";
  const origin = `${protocol}//${host}`;

  return { protocol, hostname, origin, pathname };
}

function ensureAbsoluteEndsWithApi(value: string): string {
  const withScheme = /^[a-z][a-z\d+.-]*:/iu.test(value)
    ? value
    : `https://${value}`;
  let parsed: ParsedAbsoluteUrl;
  try {
    parsed = parseAbsoluteHttpUrl(withScheme);
  } catch {
    throw new Error(`EXPO_PUBLIC_API_URL is not a valid URL: ${value}`);
  }

  const pathname = parsed.pathname.replace(/\/+$/u, "") || "/";
  let nextPath: string;
  if (pathname === "/") {
    nextPath = RELATIVE_API_BASE;
  } else if (pathname === RELATIVE_API_BASE || pathname.endsWith("/api")) {
    nextPath = pathname;
  } else {
    nextPath = `${pathname}${RELATIVE_API_BASE}`;
  }

  return `${parsed.origin}${nextPath}`.replace(/\/+$/u, "");
}

/**
 * Normalize Expo `EXPO_PUBLIC_API_URL` to the hosted `/api` contract:
 * - web: same-origin `/api` when unset
 * - native: HTTPS Worker origin + `/api` (http loopback allowed locally)
 * - app-core endpoint paths stay relative beneath this base (`/auth/login`)
 */
export function normalizeApiBaseUrl(
  configured: string | undefined,
  platform: ApiBaseUrlPlatform,
): string {
  const raw = configured?.trim() ?? "";

  if (!raw) {
    if (platform === "web") return RELATIVE_API_BASE;
    throw new Error("EXPO_PUBLIC_API_URL is required for native API routing.");
  }

  if (raw.startsWith("/")) {
    const relative = raw.replace(/\/+$/u, "") || "/";
    if (relative === RELATIVE_API_BASE) return RELATIVE_API_BASE;
    throw new Error(
      `EXPO_PUBLIC_API_URL relative base must be "${RELATIVE_API_BASE}" (received "${relative}").`,
    );
  }

  const trimmed = raw.replace(/\/+$/u, "");
  const normalized = ensureAbsoluteEndsWithApi(trimmed);

  if (platform === "native") {
    const parsed = parseAbsoluteHttpUrl(normalized);
    const loopback = isLoopbackHostname(parsed.hostname);
    if (
      parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" && loopback)
    ) {
      throw new Error(
        "EXPO_PUBLIC_API_URL for native must be an HTTPS Worker origin plus /api (http loopback allowed for local tests).",
      );
    }
  }

  return normalized;
}
