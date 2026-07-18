/**
 * Edge RealtimeRoom origin for native.
 * Prefer an explicit edge origin; fall back to the API host when it is absolute.
 */
export function getRealtimeOrigin(): string | null {
  const configured = process.env.EXPO_PUBLIC_REALTIME_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const api = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (api && /^https?:\/\//i.test(api)) {
    try {
      return new URL(api).origin;
    } catch {
      return null;
    }
  }
  return null;
}