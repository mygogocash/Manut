import { HttpError } from "./http-error";
import type { RuntimeBindings } from "./runtime";

const NO_BODY_METHODS = new Set(["GET", "HEAD"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
/** Reserved marker set by this Worker on Express proxy hops; never accepted inbound. */
export const PROXY_HOP_HEADER = "x-manut-proxy-hop";
const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
] as const;

export function configuredApiOrigin(value: string): URL {
  try {
    const origin = new URL(value.trim());
    const safeProtocol =
      origin.protocol === "https:" ||
      (origin.protocol === "http:" && LOOPBACK_HOSTS.has(origin.hostname));
    if (
      !safeProtocol ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash
    ) {
      throw new Error("Unsafe API origin.");
    }
    return origin;
  } catch {
    throw new HttpError(
      503,
      "API_ORIGIN_NOT_CONFIGURED",
      "The API origin is unavailable.",
    );
  }
}

function effectivePort(url: URL): string {
  if (url.port) return url.port;
  if (url.protocol === "https:") return "443";
  if (url.protocol === "http:") return "80";
  return "";
}

/** True when API_ORIGIN would recurse into the same Worker front door. */
export function isSelfProxyApiOrigin(apiOrigin: URL, incoming: URL): boolean {
  return (
    apiOrigin.hostname.toLowerCase() === incoming.hostname.toLowerCase() &&
    effectivePort(apiOrigin) === effectivePort(incoming)
  );
}

export function assertDistinctApiOrigin(apiOrigin: URL, incoming: URL): void {
  if (isSelfProxyApiOrigin(apiOrigin, incoming)) {
    throw new HttpError(
      503,
      "API_ORIGIN_SELF_PROXY",
      "The API origin must be a distinct Express service, not this Worker.",
    );
  }
}

function assertNoRepeatedProxyHop(request: Request): void {
  if (request.headers.has(PROXY_HOP_HEADER)) {
    throw new HttpError(
      503,
      "API_PROXY_HOP_LOOP",
      "The API proxy refused a repeated Worker hop.",
    );
  }
}

/**
 * Explicit Express fallback for routes the Worker does not own yet, or when
 * the Hyperdrive boundary is disabled.
 */
export async function proxyApiRequest(
  request: Request,
  env: RuntimeBindings,
): Promise<Response> {
  assertNoRepeatedProxyHop(request);

  const origin = configuredApiOrigin(env.API_ORIGIN);
  const incoming = new URL(request.url);
  assertDistinctApiOrigin(origin, incoming);

  const basePath = origin.pathname.replace(/\/+$/u, "");
  const target = new URL(origin);
  target.pathname = `${basePath}${incoming.pathname}`;
  target.search = incoming.search;

  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP_HEADERS) headers.delete(name);
  headers.delete("host");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  headers.delete("x-manut-connection-id");
  headers.delete("x-manut-principal-key");
  headers.delete(PROXY_HOP_HEADER);
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", "https");
  headers.set(PROXY_HOP_HEADER, "1");

  const upstreamRequest = new Request(target.toString(), {
    body: NO_BODY_METHODS.has(request.method) ? undefined : request.body,
    headers,
    method: request.method,
    redirect: "manual",
  });
  try {
    return await fetch(upstreamRequest);
  } catch {
    throw new HttpError(
      502,
      "API_UPSTREAM_UNAVAILABLE",
      "The API is temporarily unavailable.",
    );
  }
}
