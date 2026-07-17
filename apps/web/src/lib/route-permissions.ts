export interface RoutePermissionPolicy {
  path: string;
  permissions: readonly string[];
  employeeAllowed: boolean;
  prefix?: boolean;
}

interface RoutePermissionOverride {
  matches: (pathname: string) => boolean;
  policy: RoutePermissionPolicy;
}

const performancePermissions = [
  "performance:read",
  "performance:self-review",
  "performance:manager-review",
  "performance:hr-manage",
  "performance:goals",
] as const;

/**
 * Explicit leaf-route registry for browser UX guards.
 *
 * These checks decide whether to render a page shell; Express permission and
 * row-scope checks remain authoritative for every API request.
 */
export const ROUTE_PERMISSION_REGISTRY: readonly RoutePermissionPolicy[] = [
  {
    path: "/dashboard",
    permissions: ["home:read"],
    employeeAllowed: false,
  },
  { path: "/my-portal", permissions: [], employeeAllowed: true },
  { path: "/settings", permissions: [], employeeAllowed: true },
  {
    path: "/messages",
    permissions: ["messages:read"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/docs",
    permissions: ["docs:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/projects/dashboard",
    permissions: ["projects:read", "projects:read-all"],
    employeeAllowed: false,
  },
  {
    path: "/projects",
    permissions: ["projects:read", "projects:read-all"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/partners",
    permissions: ["partners:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/sales",
    permissions: ["crm:read", "deals:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/deals",
    permissions: ["crm:read", "deals:read"],
    employeeAllowed: false,
  },
  {
    path: "/sales-revenue",
    permissions: ["sales-revenue:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/product-crm",
    permissions: ["product-crm:read", "product-crm:read-all", "projects:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/it-crm/dashboard",
    permissions: ["it-crm:read", "it-crm:read-all"],
    employeeAllowed: false,
  },
  {
    path: "/it-crm",
    permissions: ["it-crm:read", "it-crm:read-all", "projects:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/legal-crm",
    permissions: ["legal-crm:read", "legal-crm:read-all", "projects:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/hr-crm",
    permissions: ["hr-crm:read", "hr-crm:read-all", "projects:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/qa-crm",
    permissions: ["qa-crm:read", "qa-crm:read-all"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/voucher-crm",
    permissions: ["voucher-crm:read", "voucher-crm:read-all"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/it-helpdesk",
    permissions: ["it:read", "it:read-all", "it:create"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/it-operations/access",
    permissions: ["it:access:view", "it:access:request", "it:access:manage"],
    employeeAllowed: false,
  },
  {
    path: "/it-operations/billing",
    permissions: ["it:billing:view", "it:billing:manage"],
    employeeAllowed: false,
  },
  {
    path: "/it-operations",
    permissions: [
      "it:dashboard:view",
      "it:billing:view",
      "it:access:view",
      "it:access:request",
      "it:access:manage",
    ],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/employees",
    permissions: ["user:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/certificates",
    permissions: ["certificate:manage"],
    employeeAllowed: false,
  },
  {
    path: "/performance",
    permissions: performancePermissions,
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/leave/approval",
    permissions: ["leave:assign-approver", "leave:hr-settings"],
    employeeAllowed: false,
  },
  {
    path: "/leave/policies",
    permissions: ["leave:hr-settings", "leave:bulk-import"],
    employeeAllowed: false,
  },
  {
    path: "/leave/holidays",
    permissions: ["leave:read", "leave:hr-read", "leave:hr-settings"],
    employeeAllowed: true,
  },
  {
    path: "/leave",
    permissions: ["leave:read"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/travel/approval",
    permissions: ["travel:hr-settings"],
    employeeAllowed: false,
  },
  {
    path: "/travel",
    permissions: ["travel:read"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/expenses/approval",
    permissions: ["expense:assign-approver", "expense:hr-settings"],
    employeeAllowed: false,
  },
  {
    path: "/expenses",
    permissions: ["expense:read"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/cash-advance/approval",
    permissions: ["cash-advance:approve"],
    employeeAllowed: false,
  },
  {
    path: "/cash-advance",
    permissions: [
      "cash-advance:read",
      "cash-advance:read-all",
      "cash-advance:create",
      "cash-advance:approve",
    ],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/careers",
    permissions: ["career:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/applications",
    permissions: ["application:read", "career:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/survey/new",
    permissions: ["survey:manage"],
    employeeAllowed: false,
  },
  { path: "/survey", permissions: [], employeeAllowed: true, prefix: true },
  {
    path: "/survey-forms/new",
    permissions: ["survey:manage-wave"],
    employeeAllowed: false,
  },
  {
    path: "/survey-forms",
    permissions: [],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/payroll/approval",
    permissions: ["payroll:hr-admin"],
    employeeAllowed: false,
  },
  {
    path: "/payroll",
    permissions: ["payroll:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/legal/announcements",
    permissions: ["legal:announcement-read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/legal/shared",
    permissions: ["legal:view-shared"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/legal",
    permissions: ["legal:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/hrms",
    permissions: [
      "hrms:read",
      "hrms:esop-manage",
      "hrms:onboarding-manage",
      "hrms:attendance-read",
      "hrms:attendance-manage",
      "hrms:attendance-policy-manage",
      "hrms:attendance-correction-approve",
      "hrms:attendance-report-export",
    ],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/learning",
    permissions: [
      "learning:read",
      "learning:manage",
      "learning:hr-read",
      "learning:complete",
    ],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/visa/checklist-templates",
    permissions: ["visa:manage"],
    employeeAllowed: false,
  },
  {
    path: "/visa/knowledge-base",
    permissions: ["visa:read", "visa:hr-read", "visa:manage"],
    employeeAllowed: true,
  },
  {
    path: "/visa",
    permissions: ["visa:read", "visa:hr-read", "visa:manage"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/benefits",
    permissions: ["benefits:read", "benefits:enroll", "benefits:manage"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/office",
    permissions: ["office:read", "office:book", "office:manage"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/policies",
    permissions: ["policy:read", "policy:manage"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/directory",
    permissions: ["directory:read", "directory:view-sensitive"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/accounting",
    permissions: ["accounting:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/accounting-crm",
    permissions: [
      "accounting-crm:read",
      "accounting-crm:read-all",
      "projects:read",
    ],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/revenue",
    permissions: ["revenue:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/investors",
    permissions: ["investor-dashboard:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/investor-crm",
    permissions: ["investor-crm:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/dataroom",
    permissions: ["dataroom:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/investor-updates",
    permissions: ["investor-updates:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/blog-management",
    permissions: ["blog:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/pr-management",
    permissions: ["pr:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/gmail",
    permissions: ["integrations:use"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/drive",
    permissions: ["integrations:use"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/admin/form-config",
    permissions: ["admin:manage"],
    employeeAllowed: false,
  },
  {
    path: "/admin",
    permissions: ["admin:manage"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/roles",
    permissions: ["role:read"],
    employeeAllowed: false,
    prefix: true,
  },
];

export const ROUTE_PERMISSION_OVERRIDES: readonly RoutePermissionOverride[] = [
  {
    matches: (pathname) =>
      pathname !== "/projects/dashboard" &&
      /^\/projects\/[^/]+(?:\/|$)/.test(pathname),
    policy: {
      path: "/projects/[projectId]",
      permissions: [
        "projects:read",
        "projects:read-all",
        "it-crm:read",
        "it-crm:read-all",
        "product-crm:read",
        "product-crm:read-all",
        "legal-crm:read",
        "legal-crm:read-all",
        "accounting-crm:read",
        "accounting-crm:read-all",
        "hr-crm:read",
        "hr-crm:read-all",
      ],
      employeeAllowed: false,
    },
  },
  {
    matches: (pathname) => pathname === "/leave",
    policy: {
      path: "/leave",
      permissions: [
        "leave:read",
        "leave:approve",
        "leave:approve-wfh",
        "leave:hr-read",
      ],
      employeeAllowed: true,
    },
  },
  {
    matches: (pathname) => pathname === "/travel",
    policy: {
      path: "/travel",
      permissions: ["travel:read", "travel:approve", "travel:hr-read"],
      employeeAllowed: true,
    },
  },
  {
    matches: (pathname) => pathname === "/expenses",
    policy: {
      path: "/expenses",
      permissions: ["expense:read", "expense:approve", "expense:hr-read"],
      employeeAllowed: true,
    },
  },
];

function normalizePathname(value: string): string {
  const pathname = value.split(/[?#]/, 1)[0] || "/";
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

function isSegmentPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Resolve override, then exact leaf, then longest segment-boundary prefix. */
export function resolveRoutePermissionPolicy(
  pathname: string,
): RoutePermissionPolicy | undefined {
  const normalized = normalizePathname(pathname);

  for (const override of ROUTE_PERMISSION_OVERRIDES) {
    if (override.matches(normalized)) return override.policy;
  }

  const exact = ROUTE_PERMISSION_REGISTRY.find(
    (policy) => policy.path === normalized,
  );
  if (exact) return exact;

  return ROUTE_PERMISSION_REGISTRY.filter(
    (policy) => policy.prefix && isSegmentPrefix(normalized, policy.path),
  ).sort((left, right) => right.path.length - left.path.length)[0];
}
