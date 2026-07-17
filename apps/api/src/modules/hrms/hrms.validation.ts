import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

export const ESOP_GRANT_TYPES = [
  "equity",
  "tokens",
  "sign_up_bonus",
  "executive_equity",
  "retention",
  "annual_review",
  "performance_bonus",
  "advisory",
  "other",
] as const;

export const ESOP_VALUE_TYPES = ["shares", "currency", "percent"] as const;

export const ESOP_ALLOCATION_MODES = ["one_time", "monthly_recurring"] as const;

export const ESOP_STATUSES = ["vesting", "vested", "cancelled"] as const;

export const ESOP_CURRENCIES = [
  "THB",
  "USD",
  "INR",
  "SGD",
  "EUR",
  "IDR",
  "VND",
  "BDT",
  "AED",
] as const;

const grantTypeEnum = z.enum(ESOP_GRANT_TYPES);
const valueTypeEnum = z.enum(ESOP_VALUE_TYPES);
const allocationModeEnum = z.enum(ESOP_ALLOCATION_MODES);
const currencyEnum = z.enum(ESOP_CURRENCIES);
const statusEnum = z.enum(ESOP_STATUSES);

const baseGrantFields = z.object({
  grantType: grantTypeEnum.default("equity"),
  valueType: valueTypeEnum.default("shares"),
  shares: z.coerce.number().int().nonnegative().default(0),
  currencyCode: currencyEnum.optional().nullable(),
  currencyAmount: z.coerce.number().nonnegative().optional().nullable(),
  percentOfBase: z.coerce
    .number()
    .min(0)
    .max(100, "Percent of base must be between 0 and 100")
    .optional()
    .nullable(),
  // Periods are nullable so HR's "blank xlsx cell → blank UI" rule
  // holds. Manual create / edit can omit them; the importer keeps
  // null when the spreadsheet leaves Lock / Vesting / Increasing
  // empty rather than rewriting them with the legacy defaults.
  // vestingMonths accepts 0 (granted outright / already fully vested):
  // rollupGrants treats vestingMonths ≤ 0 as Vested, so 0 lands in the
  // Vested pool exactly like an immediate grant. null still renders "—".
  vestingMonths: z.coerce.number().int().nonnegative().optional().nullable(),
  cliffMonths: z.coerce.number().int().nonnegative().optional().nullable(),
  lockMonths: z.coerce.number().int().nonnegative().optional().nullable(),
  strikePrice: z.coerce.number().nonnegative().default(0),
  allocationMode: allocationModeEnum.default("one_time"),
  monthlyAmount: z.coerce.number().nonnegative().optional().nullable(),
  allocationStartMonth: dateString.optional().nullable(),
  allocationEndMonth: dateString.optional().nullable(),
  // Pins "Total Vesting to date" for a scheduled grant. Omitted / null →
  // auto-compute (linear by elapsed months). Only meaningful when the
  // grant vests over a schedule; ignored for outright grants.
  vestedToDateOverride: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .nullable(),
  source: z.string().max(200).optional(),
  status: statusEnum.default("vesting"),
  notes: z.string().max(5000).optional(),
});

type GrantRefinementValue = {
  valueType?: (typeof ESOP_VALUE_TYPES)[number];
  shares?: number | null;
  currencyCode?: (typeof ESOP_CURRENCIES)[number] | null;
  currencyAmount?: number | null;
  percentOfBase?: number | null;
  allocationMode?: (typeof ESOP_ALLOCATION_MODES)[number];
  allocationStartMonth?: string | null;
  allocationEndMonth?: string | null;
};

function validateGrantValue(value: GrantRefinementValue, ctx: z.RefinementCtx) {
  if (
    value.valueType === "shares" &&
    !(typeof value.shares === "number" && value.shares > 0)
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Shares must be greater than 0",
      path: ["shares"],
    });
  }
  if (
    value.valueType === "currency" &&
    !(
      value.currencyCode &&
      typeof value.currencyAmount === "number" &&
      value.currencyAmount > 0
    )
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Currency and amount are required for currency grants",
      path: ["currencyAmount"],
    });
  }
  if (
    value.valueType === "percent" &&
    !(typeof value.percentOfBase === "number" && value.percentOfBase > 0)
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Percent must be greater than 0 for percent grants",
      path: ["percentOfBase"],
    });
  }

  const hasStart = Boolean(value.allocationStartMonth);
  const hasEnd = Boolean(value.allocationEndMonth);
  if (value.allocationMode === "monthly_recurring" && (!hasStart || !hasEnd)) {
    ctx.addIssue({
      code: "custom",
      message: "Start and end months are required for recurring grants",
      path: ["allocationEndMonth"],
    });
  }
  if (value.allocationMode === "one_time" && hasStart !== hasEnd) {
    ctx.addIssue({
      code: "custom",
      message:
        "Enter both a start and end date for a vesting schedule, or leave both blank for an outright grant",
      path: ["allocationEndMonth"],
    });
  }
  if (
    value.allocationStartMonth &&
    value.allocationEndMonth &&
    value.allocationEndMonth < value.allocationStartMonth
  ) {
    ctx.addIssue({
      code: "custom",
      message:
        value.allocationMode === "monthly_recurring"
          ? "End month must not be before start month"
          : "End date must not be before start date",
      path: ["allocationEndMonth"],
    });
  }
}

export const createEsopGrantSchema = baseGrantFields
  .extend({
    employeeId: z.string().uuid("Invalid employee ID"),
    grantDate: dateString,
  })
  .superRefine(validateGrantValue);

export const updateEsopGrantSchema = baseGrantFields
  .partial()
  .extend({
    exercisedShares: z.coerce.number().int().nonnegative().optional(),
  })
  .superRefine(validateGrantValue);

export const ESOP_SORT_FIELDS = [
  "employee",
  "grantType",
  "usd",
  "thb",
  "shares",
  "lockMonths",
  "vestingMonths",
  "cliffMonths",
  "status",
] as const;
export type EsopSortField = (typeof ESOP_SORT_FIELDS)[number];

export const esopGrantQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  sortBy: z.enum(ESOP_SORT_FIELDS).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const bulkDeleteEsopGrantsSchema = z
  .object({
    all: z.boolean().optional(),
    ids: z.array(z.string().uuid()).max(500).optional(),
  })
  .refine((v) => v.all === true || (v.ids && v.ids.length > 0), {
    message: "Provide `ids` to delete specific grants or set `all: true`",
  });

export type BulkDeleteEsopGrantsInput = z.infer<
  typeof bulkDeleteEsopGrantsSchema
>;

// Each task carries a free-form `part` label so HR can group the
// checklist into their own sections (mirrors offboarding). Part order
// is taken from task order.
const ONBOARDING_PART_MAX = 120;

const onboardingTaskSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  part: z.string().trim().min(1, "Part is required").max(ONBOARDING_PART_MAX),
  done: z.boolean().default(false),
  doneAt: z.string().optional(),
});

export const createOnboardingSchema = z.object({
  employeeId: z.string().uuid().optional(),
  employeeName: z.string().min(1, "Employee name is required").max(200),
  department: z.string().min(1, "Department is required"),
  startDate: dateString,
  entityId: z.string().optional(),
  tasks: z.array(onboardingTaskSchema).min(1, "At least one task is required"),
});

export const updateOnboardingTaskSchema = z.object({
  taskKey: z.string().min(1, "Task key is required"),
  done: z.boolean(),
});

// Full-array replace: HR can rename / add / delete / reorder tasks
// on an existing onboarding run. Single endpoint keeps the JSON
// blob the source of truth — no per-task verbs to coordinate.
export const replaceOnboardingTasksSchema = z.object({
  tasks: z
    .array(
      z.object({
        // Generated client-side for new tasks (slug + timestamp). The
        // server doesn't trust client-supplied keys for uniqueness;
        // see service for dedupe + regeneration of conflicts.
        key: z.string().min(1).max(120).optional(),
        label: z.string().trim().min(1, "Task label is required").max(200),
        part: z
          .string()
          .trim()
          .min(1, "Part is required")
          .max(ONBOARDING_PART_MAX),
        done: z.boolean().default(false),
        doneAt: z.string().optional(),
      }),
    )
    .min(1, "At least one task is required")
    .max(80, "At most 80 tasks per onboarding run"),
});

// Admin-managed default parts + tasks new onboarding runs start from.
export const onboardingTemplateSchema = z.object({
  parts: z
    .array(
      z.object({
        name: z
          .string()
          .trim()
          .min(1, "Part name is required")
          .max(ONBOARDING_PART_MAX),
        tasks: z
          .array(z.string().trim().min(1).max(200))
          .max(50, "At most 50 tasks per part"),
      }),
    )
    .max(20, "At most 20 parts"),
});

export const onboardingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  // "true" → only soft-deleted runs (the Deleted view); else active only.
  deleted: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

// ── Offboarding (exit checklist) ───────────────────────────
// Each task carries a free-form `part` label so HR can define their own
// sections (parts) and the tasks inside them — instead of the old fixed
// Company-Assets / System-Access enum. Part order is taken from task
// order: the first task tagged with a part fixes that part's position.
const OFFBOARDING_PART_MAX = 120;

const offboardingTaskSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  part: z.string().trim().min(1, "Part is required").max(OFFBOARDING_PART_MAX),
  done: z.boolean().default(false),
  doneAt: z.string().optional(),
});

export const createOffboardingSchema = z.object({
  employeeId: z.string().uuid().optional(),
  employeeName: z.string().min(1, "Employee name is required").max(200),
  position: z.string().max(200).optional(),
  department: z.string().min(1, "Department is required"),
  lastWorkingDay: dateString,
  entityId: z.string().optional(),
  tasks: z.array(offboardingTaskSchema).min(1, "At least one task is required"),
});

export const updateOffboardingTaskSchema = z.object({
  taskKey: z.string().min(1, "Task key is required"),
  done: z.boolean(),
});

export const replaceOffboardingTasksSchema = z.object({
  tasks: z
    .array(
      z.object({
        key: z.string().min(1).max(120).optional(),
        label: z.string().trim().min(1, "Task label is required").max(200),
        part: z
          .string()
          .trim()
          .min(1, "Part is required")
          .max(OFFBOARDING_PART_MAX),
        done: z.boolean().default(false),
        doneAt: z.string().optional(),
      }),
    )
    .min(1, "At least one task is required")
    .max(80, "At most 80 tasks per offboarding run"),
});

// Admin-managed default parts + tasks that new offboarding runs start
// from. Stored as JSON in SystemSetting (`offboarding.template`); tasks
// are bare labels (run-create slugs them into keys). Order is preserved.
export const offboardingTemplateSchema = z.object({
  parts: z
    .array(
      z.object({
        name: z
          .string()
          .trim()
          .min(1, "Part name is required")
          .max(OFFBOARDING_PART_MAX),
        tasks: z
          .array(z.string().trim().min(1).max(200))
          .max(50, "At most 50 tasks per part"),
      }),
    )
    .max(20, "At most 20 parts"),
});

// Records the employee or HR sign-off shown on the printable checklist.
export const signOffboardingSchema = z.object({
  party: z.enum(["employee", "hr"]),
  name: z.string().trim().min(1, "Signatory name is required").max(200),
});

export const offboardingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  // "true" → only soft-deleted runs (the Deleted view); else active only.
  deleted: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type CreateEsopGrantInput = z.infer<typeof createEsopGrantSchema>;
export type UpdateEsopGrantInput = z.infer<typeof updateEsopGrantSchema>;
export type EsopGrantQuery = z.infer<typeof esopGrantQuerySchema>;
export type CreateOnboardingInput = z.infer<typeof createOnboardingSchema>;
export type UpdateOnboardingTaskInput = z.infer<
  typeof updateOnboardingTaskSchema
>;
export type ReplaceOnboardingTasksInput = z.infer<
  typeof replaceOnboardingTasksSchema
>;
export type OnboardingQuery = z.infer<typeof onboardingQuerySchema>;
export type OnboardingTemplateInput = z.infer<typeof onboardingTemplateSchema>;
export type CreateOffboardingInput = z.infer<typeof createOffboardingSchema>;
export type UpdateOffboardingTaskInput = z.infer<
  typeof updateOffboardingTaskSchema
>;
export type ReplaceOffboardingTasksInput = z.infer<
  typeof replaceOffboardingTasksSchema
>;
export type SignOffboardingInput = z.infer<typeof signOffboardingSchema>;
export type OffboardingQuery = z.infer<typeof offboardingQuerySchema>;
export type OffboardingTemplateInput = z.infer<
  typeof offboardingTemplateSchema
>;

export const AGREEMENT_TYPES = [
  "employment_contract",
  "contract_amendment",
  "increment_letter",
  "equity_agreement",
  "passport",
  "id_card",
  "work_permit",
  "work_visa",
  "other_visas",
  "tax_id",
  "other",
] as const;

const agreementTypeEnum = z.enum(AGREEMENT_TYPES);

export const createAgreementSchema = z.object({
  employeeId: z.string().uuid("Invalid employee ID"),
  type: agreementTypeEnum,
  title: z.string().min(1, "Title is required").max(200),
  // fileUrl can be either an absolute URL (Supabase public URL) or a
  // storage path like "documents/<user>/<file>". Both round-trip through
  // the upload service, so just require non-empty.
  fileUrl: z.string().min(1, "File URL is required").max(2000),
  fileName: z.string().min(1).max(300),
  mimeType: z.string().max(120).optional().nullable(),
  fileSize: z.coerce.number().int().nonnegative().optional().nullable(),
  effectiveDate: dateString.optional().nullable(),
  expiryDate: dateString.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateAgreementSchema = createAgreementSchema
  .omit({ employeeId: true })
  .partial();

export const agreementQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  employeeId: z.string().uuid().optional(),
  type: agreementTypeEnum.optional(),
});

export type CreateAgreementInput = z.infer<typeof createAgreementSchema>;
export type UpdateAgreementInput = z.infer<typeof updateAgreementSchema>;
export type AgreementQuery = z.infer<typeof agreementQuerySchema>;

// ─── Equity Monthly Salary ─────────────────────────────────

export const equitySalaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type EquitySalaryQuery = z.infer<typeof equitySalaryQuerySchema>;
