/** Cloudflare Zero Trust / Access helpers. Fail-open when CF_ACCESS_AUD is unset. */

const ACCESS_HEADER = "cf-access-jwt-assertion";

export type AccessEnv = {
  CF_ACCESS_AUD?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
};

export function accessIsConfigured(env: AccessEnv): boolean {
  return Boolean(env.CF_ACCESS_AUD?.trim());
}

export function readAccessAssertion(headers: Headers): string | null {
  return headers.get(ACCESS_HEADER) ?? headers.get("Cf-Access-Jwt-Assertion");
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  const payloadB64 = parts[1];
  if (parts.length !== 3 || !payloadB64) return null;
  try {
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
    const payload = JSON.parse(json) as unknown;
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function accessAudienceMatches(payload: Record<string, unknown>, aud: string): boolean {
  const value = payload.aud;
  if (typeof value === "string") return value === aud;
  return Array.isArray(value) && value.includes(aud);
}

export function accessIssuerMatches(payload: Record<string, unknown>, teamDomain: string): boolean {
  const iss = payload.iss;
  if (typeof iss !== "string") return false;
  const host = teamDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return iss === `https://${host}` || iss === host;
}

export function accessTokenIsFresh(payload: Record<string, unknown>, nowSec = Math.floor(Date.now() / 1000)): boolean {
  const exp = payload.exp;
  if (typeof exp !== "number") return true;
  return exp > nowSec;
}

export function evaluateAccessJwt(
  token: string,
  env: AccessEnv,
  nowSec = Math.floor(Date.now() / 1000),
): { ok: true; payload: Record<string, unknown> } | { ok: false; reason: string } {
  const aud = env.CF_ACCESS_AUD?.trim();
  if (!aud) return { ok: true, payload: {} };
  const payload = decodeJwtPayload(token);
  if (!payload) return { ok: false, reason: "invalid_jwt" };
  if (!accessAudienceMatches(payload, aud)) return { ok: false, reason: "aud_mismatch" };
  if (env.CF_ACCESS_TEAM_DOMAIN?.trim() && !accessIssuerMatches(payload, env.CF_ACCESS_TEAM_DOMAIN)) {
    return { ok: false, reason: "iss_mismatch" };
  }
  if (!accessTokenIsFresh(payload, nowSec)) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}
