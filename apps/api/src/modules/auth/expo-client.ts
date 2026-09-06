import type { IncomingHttpHeaders } from "node:http";

export const EXPO_CLIENT_HEADER = "x-client";
export const EXPO_CLIENT_VALUE = "expo";

/** Expo web/native sends this so login/refresh can return JWTs (cookies stay same-origin only). */
export function isExpoClient(req: { headers: IncomingHttpHeaders }): boolean {
  const raw = req.headers[EXPO_CLIENT_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === EXPO_CLIENT_VALUE;
}
