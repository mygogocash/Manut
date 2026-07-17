import { evaluateRouteAccess } from "@manut/app-core";

export const SHELL_LINKS = [
  { href: "/dashboard" as const, label: "Dashboard" },
  { href: "/my-portal" as const, label: "My Portal" },
  { href: "/directory" as const, label: "Directory" },
  { href: "/performance" as const, label: "Performance" },
  { href: "/leave" as const, label: "Leave" },
  { href: "/settings" as const, label: "Settings" },
] as const;

export function allowedShellLinks(
  permissions: readonly string[],
  employeeOnly: boolean,
): readonly (typeof SHELL_LINKS)[number][] {
  return SHELL_LINKS.filter(
    (link) =>
      evaluateRouteAccess({
        pathname: link.href,
        permissions,
        employeeOnly,
      }).allowed,
  );
}
