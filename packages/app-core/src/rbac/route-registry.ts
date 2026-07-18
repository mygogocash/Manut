export interface RoutePolicy {
  path: string;
  access: "public" | "protected";
  permissions: readonly string[];
  employeeAllowed: boolean;
  prefix?: boolean;
}

export const ROUTE_REGISTRY: readonly RoutePolicy[] = [
  { path: "/", access: "public", permissions: [], employeeAllowed: true },
  {
    path: "/sign-in",
    access: "public",
    permissions: [],
    employeeAllowed: true,
  },
  {
    path: "/auth/callback",
    access: "public",
    permissions: [],
    employeeAllowed: true,
  },
  {
    path: "/forgot-password",
    access: "public",
    permissions: [],
    employeeAllowed: true,
  },
  {
    path: "/magic-link",
    access: "public",
    permissions: [],
    employeeAllowed: true,
  },
  {
    path: "/reset-password",
    access: "public",
    permissions: [],
    employeeAllowed: true,
  },
  {
    path: "/change-password",
    access: "protected",
    permissions: [],
    employeeAllowed: true,
  },
  {
    path: "/dashboard",
    access: "protected",
    permissions: ["home:read"],
    employeeAllowed: false,
  },
  {
    path: "/my-portal",
    access: "protected",
    permissions: [],
    employeeAllowed: true,
  },
  {
    path: "/settings",
    access: "protected",
    permissions: [],
    employeeAllowed: true,
  },
  {
    path: "/performance",
    access: "protected",
    permissions: [
      "performance:read",
      "performance:self-review",
      "performance:manager-review",
      "performance:hr-manage",
      "performance:goals",
    ],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/leave",
    access: "protected",
    permissions: ["leave:read"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/travel",
    access: "protected",
    permissions: ["travel:read"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/expenses-v1",
    access: "protected",
    permissions: ["expense:read"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/expenses",
    access: "protected",
    permissions: ["expense:read"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/cash-advance",
    access: "protected",
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
    path: "/payroll",
    access: "protected",
    permissions: [
      "payroll:read",
      "payroll:create",
      "payroll:approve",
      "payroll:hr-admin",
    ],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/hrms",
    access: "protected",
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
    access: "protected",
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
    path: "/visa",
    access: "protected",
    permissions: ["visa:read", "visa:hr-read", "visa:manage"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/benefits",
    access: "protected",
    permissions: ["benefits:read", "benefits:enroll", "benefits:manage"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/office",
    access: "protected",
    permissions: ["office:read", "office:book", "office:manage"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/careers",
    access: "protected",
    permissions: [
      "career:read",
      "career:create",
      "career:update",
      "career:delete",
    ],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/applications",
    access: "protected",
    permissions: ["application:read", "application:delete"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/directory",
    access: "protected",
    permissions: ["directory:read", "directory:view-sensitive"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/employees",
    access: "protected",
    permissions: ["user:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/roles",
    access: "protected",
    permissions: ["role:read"],
    employeeAllowed: false,
    prefix: true,
  },
  {
    path: "/it-helpdesk",
    access: "protected",
    permissions: ["it:read", "it:read-all", "it:create"],
    employeeAllowed: true,
    prefix: true,
  },
  {
    path: "/projects",
    access: "protected",
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
    prefix: true,
  },
];

export interface RouteOverride {
  matches(pathname: string): boolean;
  policy: RoutePolicy;
}

export const ROUTE_OVERRIDES: readonly RouteOverride[] = [
  {
    matches: (pathname) => /^\/sign\/[^/]+$/.test(pathname),
    policy: {
      path: "/sign/[token]",
      access: "public",
      permissions: [],
      employeeAllowed: true,
    },
  },
  {
    matches: (pathname) => /^\/projects\/[^/]+(?:\/|$)/.test(pathname),
    policy: {
      path: "/projects/[projectId]",
      access: "protected",
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
      access: "protected",
      permissions: ["leave:read", "leave:hr-read"],
      employeeAllowed: true,
    },
  },
  {
    matches: (pathname) => pathname === "/leave/holidays",
    policy: {
      path: "/leave/holidays",
      access: "protected",
      permissions: ["leave:read", "leave:hr-read", "leave:hr-settings"],
      employeeAllowed: true,
    },
  },
  {
    matches: (pathname) => pathname === "/leave/approval",
    policy: {
      path: "/leave/approval",
      access: "protected",
      permissions: ["leave:assign-approver", "leave:hr-settings"],
      employeeAllowed: false,
    },
  },
  {
    matches: (pathname) => pathname === "/leave/policies",
    policy: {
      path: "/leave/policies",
      access: "protected",
      permissions: ["leave:hr-settings"],
      employeeAllowed: false,
    },
  },
  {
    matches: (pathname) => pathname === "/travel",
    policy: {
      path: "/travel",
      access: "protected",
      permissions: ["travel:read", "travel:approve", "travel:hr-read"],
      employeeAllowed: true,
    },
  },
  {
    matches: (pathname) => pathname === "/expenses-v1",
    policy: {
      path: "/expenses-v1",
      access: "protected",
      permissions: ["expense:read", "expense:approve", "expense:hr-read"],
      employeeAllowed: true,
    },
  },
  {
    matches: (pathname) => pathname === "/expenses",
    policy: {
      path: "/expenses",
      access: "protected",
      permissions: ["expense:read", "expense:approve", "expense:hr-read"],
      employeeAllowed: true,
    },
  },
  {
    matches: (pathname) => pathname === "/expenses/approval",
    policy: {
      path: "/expenses/approval",
      access: "protected",
      permissions: [
        "expense:assign-approver",
        "expense:hr-settings",
        "expense:hr-read",
        "expense:approve",
      ],
      employeeAllowed: false,
    },
  },
  {
    matches: (pathname) => pathname === "/cash-advance/approval",
    policy: {
      path: "/cash-advance/approval",
      access: "protected",
      permissions: ["cash-advance:approve"],
      employeeAllowed: false,
    },
  },
];
