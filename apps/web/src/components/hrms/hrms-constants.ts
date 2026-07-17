export const ALL_FILTER = "__all__";

export const ESOP_STATUS_VALUES = ["vesting", "vested", "cancelled"] as const;
export type EsopStatus = (typeof ESOP_STATUS_VALUES)[number];

export const ESOP_STATUSES: Array<{ value: EsopStatus; label: string }> = [
  { value: "vesting", label: "Vesting" },
  { value: "vested", label: "Vested" },
  { value: "cancelled", label: "Cancelled" },
];

export const ONBOARDING_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export const OFFBOARDING_STATUSES = [
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

// Offboarding parts + their default tasks are now HR-customisable via
// the admin template (GET/PUT /hrms/offboarding/template). The create
// dialog seeds from that template; this fallback only applies if the
// template fetch fails, so the dialog is never empty.
export const FALLBACK_OFFBOARDING_TEMPLATE: {
  parts: Array<{ name: string; tasks: string[] }>;
} = {
  parts: [
    {
      name: "Exit Process",
      tasks: [
        "Confirm last day",
        "Process final pay",
        "Terminate benefits",
        "Knowledge transfer",
        "Exit interview",
        "Collect company property",
        "Close records",
      ],
    },
    {
      name: "Company Assets (Return)",
      tasks: [
        "Employee Card",
        "Health Insurance Card",
        "Work Permit",
        "Laptop",
        "SOE Laptop, Charger, Token and Laptop Bag",
      ],
    },
    {
      name: "System Access (Deactivate)",
      tasks: ["Email account", "Finger Print", "CCTV"],
    },
  ],
};

// Fallback if the onboarding template fetch fails, so the create dialog
// is never empty. HR's saved template (GET /hrms/onboarding/template) is
// the real source.
export const FALLBACK_ONBOARDING_TEMPLATE: {
  parts: Array<{ name: string; tasks: string[] }>;
} = {
  parts: [
    {
      name: "Onboarding Checklist",
      tasks: [
        "Set up laptop and accounts",
        "Sign NDA and employment agreement",
        "Team introductions",
        "Office tour and seat assignment",
        "Benefits + payroll enrolment",
        "Policy + handbook briefing",
      ],
    },
  ],
};

export const TABS_LIST = [
  { id: "attendance", label: "Attendance" },
  { id: "equity-monthly-salary", label: "Equity Monthly Salary" },
  { id: "payslips", label: "Payslip Management" },
  { id: "esop", label: "ESOP Grants" },
  { id: "onboarding", label: "Onboarding" },
  { id: "offboarding", label: "Offboarding" },
  { id: "agreements", label: "Agreements" },
];
