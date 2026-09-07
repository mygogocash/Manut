const EXPRESS_DEV = "http://localhost:3001";
const EXPO_DEV_PORTS = new Set(["8081", "19006", "8082"]);

function isExpoDevOrigin(origin: string): boolean {
  try {
    return EXPO_DEV_PORTS.has(new URL(origin).port);
  } catch {
    return false;
  }
}

/** Express :3001 by default. Set EXPO_PUBLIC_APP_URL to the Worker (:8787) for edge. */
export function getAppUrl(): string {
  const fromEnv =
    typeof process !== "undefined"
      ? (process.env.EXPO_PUBLIC_APP_URL as string | undefined)
      : undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof globalThis !== "undefined" && "location" in globalThis) {
    const loc = (globalThis as { location?: { origin?: string } }).location;
    if (loc?.origin && !isExpoDevOrigin(loc.origin)) return loc.origin;
  }
  return EXPRESS_DEV;
}
