import {
  ROUTE_OVERRIDES,
  ROUTE_REGISTRY,
  type RoutePolicy,
} from "./route-registry";

function normalizePathname(value: string): string {
  const pathname = value.split(/[?#]/, 1)[0] || "/";
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

function segmentPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Override, then exact path, then longest segment-boundary prefix. */
export function resolveRoutePolicy(pathname: string): RoutePolicy | undefined {
  const normalized = normalizePathname(pathname);

  for (const override of ROUTE_OVERRIDES) {
    if (override.matches(normalized)) return override.policy;
  }

  const exact = ROUTE_REGISTRY.find((route) => route.path === normalized);
  if (exact) return exact;

  return ROUTE_REGISTRY.filter(
    (route) => route.prefix && segmentPrefix(normalized, route.path),
  ).sort((a, b) => b.path.length - a.path.length)[0];
}

export interface RouteAccessInput {
  pathname: string;
  permissions: readonly string[];
  employeeOnly: boolean;
}

export type RouteAccessDecision =
  | { allowed: true; policy: RoutePolicy }
  | {
      allowed: false;
      policy?: RoutePolicy;
      reason: "unknown-route" | "employee-boundary" | "missing-permission";
    };

export function evaluateRouteAccess(
  input: RouteAccessInput,
): RouteAccessDecision {
  const policy = resolveRoutePolicy(input.pathname);
  if (!policy) return { allowed: false, reason: "unknown-route" };
  if (policy.access === "public") return { allowed: true, policy };
  if (input.employeeOnly && !policy.employeeAllowed) {
    return { allowed: false, policy, reason: "employee-boundary" };
  }
  if (
    policy.permissions.length > 0 &&
    !policy.permissions.some((permission) =>
      input.permissions.includes(permission),
    )
  ) {
    return { allowed: false, policy, reason: "missing-permission" };
  }
  return { allowed: true, policy };
}
