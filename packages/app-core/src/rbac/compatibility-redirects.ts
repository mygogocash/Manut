/**
 * Compatibility redirects for replaced or orphaned paths.
 *
 * Active redirects are safe bookmark/email shims. Pending entries document
 * product decisions that must not auto-redirect until approved.
 */

export type PendingCompatibilityRedirect = {
  fromPrefix: string;
  proposedToPrefix: string;
  decision: "pending-product-approval";
  note: string;
};

/** Orphans that stay in the RBAC registry until an explicit product decision. */
export const PENDING_COMPATIBILITY_REDIRECTS: readonly PendingCompatibilityRedirect[] =
  [
    {
      fromPrefix: "/expenses-v1",
      proposedToPrefix: "/expenses",
      decision: "pending-product-approval",
      note: "Registry orphan (no Expo ledger row). Same expense:read gate as /expenses. Do not auto-redirect or delete the registry entry until product signs redirect-to-/expenses or removal.",
    },
  ] as const;

function splitPathQueryHash(value: string): {
  pathname: string;
  suffix: string;
} {
  const match = /[?#]/.exec(value);
  if (match?.index == null) {
    return { pathname: value, suffix: "" };
  }
  return {
    pathname: value.slice(0, match.index),
    suffix: value.slice(match.index),
  };
}

function normalizePathname(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

/**
 * Returns an in-app destination for an active compatibility redirect, or null
 * when the path is not redirected (including pending product decisions).
 */
export function resolveCompatibilityRedirect(
  pathWithOptionalQueryHash: string,
): string | null {
  const { pathname, suffix } = splitPathQueryHash(pathWithOptionalQueryHash);
  const normalized = normalizePathname(pathname);
  const esopMatch = /^\/hrms\/esop\/([^/]+)$/.exec(normalized);
  const employeeId = esopMatch?.[1];
  if (employeeId == null || employeeId.length === 0) {
    return null;
  }
  return `/hrms/grants/${employeeId}${suffix}`;
}
