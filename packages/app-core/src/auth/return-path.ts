import type { AuthSession } from "./auth-types";

const AUTH_FLOW_PATHS = [
  "/sign-in",
  "/auth/callback",
  "/forgot-password",
  "/magic-link",
  "/reset-password",
];

function pathOnly(value: string): string {
  return value.split(/[?#]/, 1)[0] ?? "";
}

function containsUnsafeCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127 || character === "\\") return true;
  }
  return false;
}

function decodePath(value: string): string | undefined {
  let current = value;
  for (let pass = 0; pass < 4; pass += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return undefined;
    }
    if (decoded === current) return decoded;
    current = decoded;
  }
  return /%[0-9a-f]{2}/i.test(current) ? undefined : current;
}

/** Return a same-origin application path without discarding its query string. */
export function sanitizeReturnPath(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || containsUnsafeCharacter(trimmed)) return undefined;

  let candidate = trimmed;
  if (!candidate.startsWith("/")) {
    try {
      candidate = decodeURIComponent(candidate);
    } catch {
      return undefined;
    }
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return undefined;
  }

  const encodedPath = pathOnly(candidate);
  const decodedPath = decodePath(encodedPath);
  if (
    !decodedPath ||
    containsUnsafeCharacter(decodedPath) ||
    decodedPath.startsWith("//")
  ) {
    return undefined;
  }
  if (
    decodedPath
      .split("/")
      .some((segment) => segment === "." || segment === "..")
  ) {
    return undefined;
  }
  if (
    AUTH_FLOW_PATHS.some(
      (path) => decodedPath === path || decodedPath.startsWith(`${path}/`),
    )
  ) {
    return undefined;
  }

  return candidate;
}

export function isEmployeeOnly(roles: AuthSession["roles"]): boolean {
  return roles.length > 0 && roles.every((role) => role.name === "Employee");
}

export function postLoginPath(
  session: AuthSession,
  returnTo?: string | null,
): string {
  if (session.user.mustChangePassword) return "/change-password";
  return (
    sanitizeReturnPath(returnTo) ??
    (isEmployeeOnly(session.roles) ? "/my-portal" : "/dashboard")
  );
}
