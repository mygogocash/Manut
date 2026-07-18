import { evaluateRouteAccess } from "@manut/app-core";

export const SHELL_LINKS = [
  { href: "/dashboard" as const, label: "Dashboard" },
  { href: "/my-portal" as const, label: "My Portal" },
  { href: "/directory" as const, label: "Directory" },
  { href: "/performance" as const, label: "Performance" },
  { href: "/leave" as const, label: "Leave" },
  { href: "/travel" as const, label: "Travel" },
  { href: "/expenses" as const, label: "Expenses" },
  { href: "/hrms" as const, label: "HRMS" },
  { href: "/visa" as const, label: "Visas" },
  { href: "/cash-advance" as const, label: "Cash advance" },
  { href: "/payroll" as const, label: "Payroll" },
  { href: "/benefits" as const, label: "Benefits" },
  { href: "/learning" as const, label: "Learning" },
  { href: "/employees" as const, label: "Employees" },
  { href: "/roles" as const, label: "Roles" },
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
