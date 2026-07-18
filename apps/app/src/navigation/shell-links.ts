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
  { href: "/accounting" as const, label: "Accounting" },
  { href: "/revenue" as const, label: "Revenue" },
  { href: "/sales" as const, label: "Sales" },
  { href: "/benefits" as const, label: "Benefits" },
  { href: "/learning" as const, label: "Learning" },
  { href: "/office" as const, label: "Office" },
  { href: "/careers" as const, label: "Careers" },
  { href: "/applications" as const, label: "Applications" },
  { href: "/it-helpdesk" as const, label: "IT Helpdesk" },
  { href: "/projects" as const, label: "Projects" },
  { href: "/partners" as const, label: "Partners" },
  { href: "/blog-management" as const, label: "Blog" },
  { href: "/legal/announcements" as const, label: "Announcements" },
  { href: "/pr-management" as const, label: "PR" },
  { href: "/docs" as const, label: "Docs" },
  { href: "/it-crm" as const, label: "IT CRM" },
  { href: "/product-crm" as const, label: "Product CRM" },
  { href: "/legal-crm" as const, label: "Legal CRM" },
  { href: "/accounting-crm" as const, label: "Accounting CRM" },
  { href: "/qa-crm" as const, label: "QA CRM" },
  { href: "/voucher-crm" as const, label: "Voucher CRM" },
  { href: "/files" as const, label: "Files" },
  { href: "/drive" as const, label: "Drive" },
  { href: "/messages" as const, label: "Messages" },
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
