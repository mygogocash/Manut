import { ASSISTANT_DISPLAY_NAME } from "@/lib/brand";

export type NavItem = {
  href: string;
  label: string;
  permissions?: string[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/** Public URL for the signed-in home. Matches Next.js `/dashboard`. */
export const DASHBOARD_HOME = "/dashboard";

/** Routes that exist under apps/app/app/(dashboard). Permission codes match the Next.js sidebar. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: DASHBOARD_HOME, label: "Home", permissions: ["home:read"] },
      { href: "/aria", label: ASSISTANT_DISPLAY_NAME, permissions: ["aria:use"] },
      { href: "/messages", label: "Messaging", permissions: ["messages:read"] },
      { href: "/docs", label: "Repository", permissions: ["docs:read"] },
      { href: "/projects", label: "Projects", permissions: ["projects:read"] },
      { href: "/proposals", label: "Proposals", permissions: ["proposals:read", "projects:manage"] },
      { href: "/partners", label: "Partners", permissions: ["partners:read"] },
      { href: "/deals", label: "Sales CRM", permissions: ["crm:read", "deals:read"] },
      { href: "/leads", label: "Leads", permissions: ["crm:read"] },
      { href: "/accounts", label: "Accounts", permissions: ["crm:read"] },
      { href: "/contacts", label: "Contacts", permissions: ["crm:read"] },
      { href: "/product-crm", label: "Product CRM", permissions: ["product-crm:read", "product-crm:read-all"] },
      { href: "/it-crm", label: "IT CRM", permissions: ["it-crm:read", "it-crm:read-all"] },
      { href: "/legal-crm", label: "Legal CRM", permissions: ["legal-crm:read", "legal-crm:read-all"] },
      { href: "/qa-crm", label: "QA CRM", permissions: ["qa-crm:read", "qa-crm:read-all"] },
      { href: "/voucher-crm", label: "Voucher CRM", permissions: ["voucher-crm:read", "voucher-crm:read-all"] },
      { href: "/helpdesk", label: "IT Helpdesk", permissions: ["it:read", "it:read-all", "it:create"] },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/hrms", label: "HRMS", permissions: ["hrms:read", "hrms:esop-manage"] },
      { href: "/leave", label: "Leave", permissions: ["leave:read"] },
      { href: "/travel", label: "Travel", permissions: ["travel:read"] },
      { href: "/payroll", label: "Payroll", permissions: ["payroll:read"] },
      { href: "/learning", label: "Learning", permissions: ["learning:read"] },
      { href: "/visa", label: "Visa", permissions: ["visa:read", "visa:hr-read"] },
      { href: "/benefits", label: "Benefits", permissions: ["benefits:read"] },
      { href: "/office", label: "Office", permissions: ["office:read"] },
      { href: "/policies", label: "Policies", permissions: ["policy:read"] },
      { href: "/survey", label: "Survey" },
      { href: "/survey-forms", label: "Awards" },
      { href: "/certificates", label: "Certificates", permissions: ["certificate:manage"] },
      { href: "/career", label: "Careers", permissions: ["career:read"] },
      { href: "/performance", label: "Performance", permissions: ["performance:read"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/accounting", label: "Accounting", permissions: ["accounting:read"] },
      { href: "/accounting-crm", label: "Accounting CRM", permissions: ["accounting-crm:read"] },
      { href: "/expenses", label: "Expenses", permissions: ["expense:read"] },
      { href: "/cash-advance", label: "Cash Advance", permissions: ["cash-advance:read"] },
      { href: "/vendors", label: "Vendors", permissions: ["vendor:read"] },
      { href: "/exchange-rates", label: "Exchange rates", permissions: ["exchange-rate:read"] },
    ],
  },
  {
    label: "Fundraising",
    items: [
      { href: "/investors", label: "Investors", permissions: ["investor-dashboard:read", "investors:read"] },
      { href: "/dataroom", label: "Data Room", permissions: ["dataroom:read"] },
      { href: "/investor-updates", label: "Updates", permissions: ["investor-updates:read"] },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/blogs", label: "Blogs", permissions: ["blog:read"] },
      { href: "/articles", label: "PR Articles", permissions: ["pr:read"] },
      { href: "/news", label: "News", permissions: ["news:read"] },
      { href: "/wall", label: "Wall", permissions: ["wall:read"] },
    ],
  },
];

export const EMPLOYEE_NAV_GROUPS: NavGroup[] = [
  {
    label: "Personal",
    items: [
      { href: DASHBOARD_HOME, label: "Home" },
      { href: "/messages", label: "Messaging", permissions: ["messages:read"] },
      { href: "/leave", label: "Leave", permissions: ["leave:read"] },
      { href: "/travel", label: "Travel", permissions: ["travel:read"] },
      { href: "/expenses", label: "Expenses", permissions: ["expense:read"] },
      { href: "/cash-advance", label: "Cash Advance", permissions: ["cash-advance:read"] },
      { href: "/helpdesk", label: "IT Helpdesk", permissions: ["it:read", "it:create"] },
      { href: "/survey", label: "Survey" },
      { href: "/hrms", label: "HRMS", permissions: ["hrms:read"] },
      { href: "/learning", label: "Learning", permissions: ["learning:read"] },
      { href: "/visa", label: "Visa", permissions: ["visa:read"] },
      { href: "/benefits", label: "Benefits", permissions: ["benefits:read"] },
      { href: "/office", label: "Office", permissions: ["office:read"] },
      { href: "/policies", label: "Policies", permissions: ["policy:read"] },
    ],
  },
];

export function itemVisible(
  item: NavItem,
  hasPermission: (code: string) => boolean,
): boolean {
  if (!item.permissions?.length) return true;
  return item.permissions.some((code) => hasPermission(code));
}

export function navItemActive(pathname: string, href: string): boolean {
  if (href === DASHBOARD_HOME) return pathname === DASHBOARD_HOME || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function filterNavGroups(
  groups: NavGroup[],
  hasPermission: (code: string) => boolean,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => itemVisible(item, hasPermission)),
    }))
    .filter((group) => group.items.length > 0);
}
