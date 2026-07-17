import { z } from "zod";

export const createPayrollRunSchema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM format"),
  notes: z.string().max(2000).optional(),
  /** When set, the run includes payslips for this full-time employee only. */
  employeeId: z.string().uuid().optional(),
});

export const prepareImportRunSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM format"),
  identifiers: z
    .array(
      z.object({
        name: z.string().optional(),
        email: z.string().optional(),
      }),
    )
    .min(1, "Spreadsheet has no employee rows"),
});

export const payrollRunQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  entityId: z.string().optional(),
  status: z.enum(["draft", "approved", "paid"]).optional(),
  period: z.string().optional(),
});

const payslipAmountMap = z
  .record(z.string().min(1).max(80), z.coerce.number().nonnegative())
  .nullable();

export const updatePayslipSchema = z
  .object({
    baseSalary: z.coerce.number().nonnegative().optional(),
    allowances: payslipAmountMap.optional(),
    deductions: payslipAmountMap.optional(),
    currency: z.string().min(2).max(8).optional(),
    grossPay: z.coerce.number().nonnegative().optional(),
    netPay: z.coerce.number().nonnegative().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.baseSalary !== undefined ||
      v.allowances !== undefined ||
      v.deductions !== undefined ||
      v.currency !== undefined ||
      v.grossPay !== undefined ||
      v.netPay !== undefined,
    { message: "At least one field is required" },
  );

export type UpdatePayslipInput = z.infer<typeof updatePayslipSchema>;

export const createConsultantInvoiceSchema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  consultantId: z.string().uuid("Invalid consultant ID"),
  invoiceNo: z.string().min(1, "Invoice number is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  whtRate: z.coerce.number().min(0).max(100).default(0),
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM format"),
});

export const consultantInvoiceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  entityId: z.string().optional(),
  status: z.enum(["pending", "approved", "paid"]).optional(),
  period: z.string().optional(),
});

export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;
export type PrepareImportRunInput = z.infer<typeof prepareImportRunSchema>;
export type PayrollRunQuery = z.infer<typeof payrollRunQuerySchema>;
export type CreateConsultantInvoiceInput = z.infer<
  typeof createConsultantInvoiceSchema
>;
export type ConsultantInvoiceQuery = z.infer<
  typeof consultantInvoiceQuerySchema
>;

// HR-facing single-row payslip create. Mirrors the bulk-import shape
// (allowances / deductions as a {key: amount} JSON map) so the same
// downstream rollup math applies. Server computes gross/net from the
// supplied parts when omitted; otherwise trusts the caller's totals.
export const createPayslipSchema = z.object({
  employeeId: z.string().uuid("Invalid employee ID"),
  baseSalary: z.coerce.number().nonnegative(),
  allowances: payslipAmountMap.optional(),
  deductions: payslipAmountMap.optional(),
  currency: z.string().min(2).max(8).default("THB"),
  grossPay: z.coerce.number().nonnegative().optional(),
  netPay: z.coerce.number().nonnegative().optional(),
});

export type CreatePayslipInput = z.infer<typeof createPayslipSchema>;

// HR-facing flat payslip list query (HRMS → Payslip Management tab).
// Empty filters return everything; `hasDocument` toggles uploaded-only
// or missing-only views without forcing the UI into two endpoints.
export const hrPayslipQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  entityId: z.string().optional(),
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM format")
    .optional(),
  hasDocument: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type HrPayslipQuery = z.infer<typeof hrPayslipQuerySchema>;

// HRMS Payslip Management bulk delete. Caps at 500 ids per request so a
// runaway selection (e.g. "All periods" → 5k rows) can't blow up a
// single transaction. The UI is expected to chunk above that.
export const bulkDeletePayslipsSchema = z.object({
  ids: z
    .array(z.string().uuid("Each payslip id must be a UUID"))
    .min(1, "At least one payslip id is required")
    .max(500, "Cannot delete more than 500 payslips per request"),
});

export type BulkDeletePayslipsInput = z.infer<typeof bulkDeletePayslipsSchema>;

// Global company legal block printed in the payslip footer (admin-
// managed via HRMS → Payslip Management).
export const payslipCompanySchema = z.object({
  legalName: z.string().max(200),
  address: z.string().max(500),
  phone: z.string().max(50),
});

export type PayslipCompanyInput = z.infer<typeof payslipCompanySchema>;
