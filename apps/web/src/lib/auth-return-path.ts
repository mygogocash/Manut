const AUTH_FLOW_PATHS = [
  "/sign-in",
  "/auth/callback",
  "/forgot-password",
  "/magic-link",
  "/reset-password",
] as const;

interface PostLoginIdentity {
  mustChangePassword: boolean;
  roles: readonly { name: string }[];
}

function pathOnly(value: string): string {
  return value.split(/[?#]/, 1)[0] ?? "";
}

function hasUnsafeCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 || character === "\\";
  });
}

/** Return a same-origin application path without discarding query or hash. */
export function sanitizeReturnPath(value?: string | null): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed || hasUnsafeCharacter(trimmed)) {
    return undefined;
  }

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

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathOnly(candidate));
  } catch {
    return undefined;
  }

  if (decodedPath.startsWith("//") || decodedPath.includes("\\")) {
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

export function isEmployeeOnlyRoles(
  roles: readonly { name: string }[],
): boolean {
  return roles.length > 0 && roles.every((role) => role.name === "Employee");
}

export function postLoginPath(
  identity: PostLoginIdentity,
  returnTo?: string | null,
): string {
  if (identity.mustChangePassword) return "/change-password";
  return (
    sanitizeReturnPath(returnTo) ??
    (isEmployeeOnlyRoles(identity.roles) ? "/my-portal" : "/dashboard")
  );
}

export function browserReturnPath(
  location: Pick<Location, "pathname" | "search" | "hash">,
): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function signInPath(returnTo?: string | null): string {
  const safeReturnPath = sanitizeReturnPath(returnTo);
  return safeReturnPath
    ? `/sign-in?returnTo=${encodeURIComponent(safeReturnPath)}`
    : "/sign-in";
}
