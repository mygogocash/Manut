/** Resolve the Worker origin on web (same-origin) and native (EXPO_PUBLIC_APP_URL). */
export function getAppUrl(): string {
  const fromEnv =
    typeof process !== "undefined"
      ? (process.env.EXPO_PUBLIC_APP_URL as string | undefined)
      : undefined;
  if (fromEnv) return fromEnv;
  if (typeof globalThis !== "undefined" && "location" in globalThis) {
    const loc = (globalThis as { location?: { origin?: string } }).location;
    if (loc?.origin) return loc.origin;
  }
  return "http://localhost:8787";
}
