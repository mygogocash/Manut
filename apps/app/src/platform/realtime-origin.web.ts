/**
 * Edge RealtimeRoom WebSocket origin for web.
 * Same-origin is required so the httpOnly session cookie is sent on upgrade.
 */
export function getRealtimeOrigin(): string | null {
  if (typeof window === "undefined" || !window.location?.origin) {
    return null;
  }
  return window.location.origin;
}
