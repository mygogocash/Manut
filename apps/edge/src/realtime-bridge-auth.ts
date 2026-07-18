import { HttpError } from "./http-error";
import type { RuntimeBindings } from "./runtime";

const BRIDGE_HEADER = "x-manut-realtime-bridge";

function secretsEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export function bridgeSigningKey(env: RuntimeBindings): string {
  const value = env.EDGE_SIGNING_KEY?.trim();
  if (!value || value.length < 32) {
    throw new HttpError(
      503,
      "EDGE_SIGNING_KEY_NOT_CONFIGURED",
      "Realtime bridge is unavailable.",
    );
  }
  return value;
}

/**
 * Authenticate an Express→Worker bus fan-out. The shared secret must match
 * `EDGE_SIGNING_KEY` on the Worker and `EDGE_REALTIME_BRIDGE_SECRET` on the API.
 */
export function assertRealtimeBridgeSecret(
  request: Request,
  env: RuntimeBindings,
): void {
  const expected = bridgeSigningKey(env);
  const header = request.headers.get(BRIDGE_HEADER)?.trim() ?? "";
  const bearer = request.headers.get("authorization")?.trim() ?? "";
  const bearerToken = bearer.toLowerCase().startsWith("bearer ")
    ? bearer.slice("bearer ".length).trim()
    : "";
  const provided = header || bearerToken;
  if (!provided || !secretsEqual(provided, expected)) {
    throw new HttpError(
      401,
      "REALTIME_BRIDGE_UNAUTHORIZED",
      "Realtime bridge authentication failed.",
    );
  }
}

export { BRIDGE_HEADER };
