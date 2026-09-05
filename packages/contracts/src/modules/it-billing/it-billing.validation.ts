import { z } from "zod";

export const SUBSCRIPTION_STATUSES = [
  "active",
  "expiring-soon",
  "pending-payment",
  "renewed",
  "cancelled",
] as const;

export const PAYMENT_STATUSES = ["paid", "pending", "overdue", "na"] as const;

export const BILLING_FREQUENCIES = [
  "monthly",
  "quarterly",
  "annual",
  "one-time",
] as const;

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
  .nullable()
  .optional();

/** A calendar month, `YYYY-MM`, as the monthly spend series addresses them. */
const monthKeyParam = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, "Must be YYYY-MM");

// ── Vendors ──
export const createVendorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactPerson: z.string().trim().max(200).nullable().optional(),
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .nullable()
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

const seatCount = z.coerce.number().int().nonnegative().max(1_000_000);

// ── Subscriptions ──
export const createSubscriptionSchema = z.object({
  vendorId: z.string().uuid(),
  category: z.string().trim().min(1).max(50).default("saas"),
  productName: z.string().trim().min(1).max(200),
  contractStartDate: optionalDate,
  renewalDate: optionalDate,
  billingFrequency: z.enum(BILLING_FREQUENCIES).default("monthly"),
  invoiceAmount: z.coerce.number().nonnegative().default(0),
  currency: z.string().trim().min(1).max(10).default("USD"),
  paymentStatus: z.enum(PAYMENT_STATUSES).default("pending"),
  status: z.enum(SUBSCRIPTION_STATUSES).default("active"),
  ownerUserId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  // Effective date the cost stops (paid-through), not the decision date.
  // Editable here so a wrong one recorded at cancellation can be corrected —
  // it moves the step-down in the spend trend.
  cancelledAt: optionalDate,
  // License utilization. totalSeats null = not seat-based.
  totalSeats: seatCount.nullable().optional(),
  assignedSeats: seatCount.optional(),
  activeSeats: seatCount.optional(),
});

export const updateSubscriptionSchema = createSubscriptionSchema.partial();

// ── Renewal decision ──
export const renewalDecisionSchema = z.object({
  decision: z.enum(["renew", "cancel"]),
  notes: z.string().trim().max(2000).optional(),
  /**
   * When a cancellation takes effect. Omitted, it defaults to the
   * subscription's renewal date — the paid-through date, because cancelling in
   * August a service paid through December still costs money until December.
   * Ignored for a `renew` decision, which clears the date instead.
   */
  effectiveDate: optionalDate,
});

// ── Document attachments - shared `uploads` bucket shape ──
const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(300),
  url: z.string().trim().url().max(2000),
  mimeType: z.string().trim().max(150).optional(),
  size: z.coerce.number().int().nonnegative().optional(),
  /// 'contract' | 'invoice' | 'renewal' | 'quotation' | 'other'
  kind: z
    .enum(["contract", "invoice", "renewal", "quotation", "other"])
    .default("other"),
});
export const addAttachmentSchema = attachmentSchema;
export const removeAttachmentSchema = z.object({
  url: z.string().trim().url().max(2000),
});

// ── License utilization report filters ──
export const licenseReportQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  category: z.string().trim().optional(),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
});

export const subscriptionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  vendorId: z.string().uuid().optional(),
});

// ── Billing records ──
export const createBillingRecordSchema = z.object({
  periodStart: optionalDate,
  periodEnd: optionalDate,
  amount: z.coerce.number().nonnegative().default(0),
  currency: z.string().trim().min(1).max(10).default("USD"),
  paymentStatus: z.enum(["paid", "pending", "overdue"]).default("pending"),
  paidAt: z.string().datetime().nullable().optional(),
  invoiceUrl: z.string().trim().url().max(1000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const updateBillingRecordSchema = createBillingRecordSchema.partial();

// ── Monthly spend series ──
// `months` is a convenience alternative to `from`; when both arrive `from`
// wins. The service clamps the resolved window to MAX_WINDOW_MONTHS, so the
// generous ceiling here cannot produce an unbounded series.
export const monthlySeriesQuerySchema = z.object({
  from: monthKeyParam.optional(),
  to: monthKeyParam.optional(),
  months: z.coerce.number().int().positive().max(120).optional(),
  currency: z.string().trim().min(1).max(10).optional(),
});

export const monthDetailQuerySchema = z.object({
  month: monthKeyParam,
  currency: z.string().trim().min(1).max(10).optional(),
});

export type CreateVendorInput = z.output<typeof createVendorSchema>;
export type UpdateVendorInput = z.output<typeof updateVendorSchema>;
export type CreateSubscriptionInput = z.output<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.output<typeof updateSubscriptionSchema>;
export type SubscriptionQuery = z.output<typeof subscriptionQuerySchema>;
export type CreateBillingRecordInput = z.output<
  typeof createBillingRecordSchema
>;
export type UpdateBillingRecordInput = z.output<
  typeof updateBillingRecordSchema
>;
export type RenewalDecisionInput = z.output<typeof renewalDecisionSchema>;
export type AddAttachmentInput = z.output<typeof addAttachmentSchema>;
export type RemoveAttachmentInput = z.output<typeof removeAttachmentSchema>;
export type LicenseReportQuery = z.output<typeof licenseReportQuerySchema>;
export type MonthlySeriesQuery = z.output<typeof monthlySeriesQuerySchema>;
export type MonthDetailQuery = z.output<typeof monthDetailQuerySchema>;
