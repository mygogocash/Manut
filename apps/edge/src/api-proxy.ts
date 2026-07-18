import { HttpError } from "./http-error";
import type { RuntimeBindings } from "./runtime";

const NO_BODY_METHODS = new Set(["GET", "HEAD"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
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

/**
 * Explicit Express fallback for routes the Worker does not own yet, or when
 * the Hyperdrive boundary is disabled.
 */
export async function proxyApiRequest(
  request: Request,
  env: RuntimeBindings,
): Promise<Response> {
  const origin = configuredApiOrigin(env.API_ORIGIN);
  const incoming = new URL(request.url);
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
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", "https");

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
