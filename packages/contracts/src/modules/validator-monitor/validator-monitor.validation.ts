import { z } from "zod";

/**
 * Shape of `report.json` produced by `bnry-validator-monitor` on every
 * scheduled run. Mirrors the file written by `monitor.js` in the
 * upstream repo. If the upstream format changes, Zod fails loudly here
 * so we don't render a broken dashboard.
 */
export const validatorReportRowSchema = z.object({
  nodeID: z.string(),
  validationID: z.string(),
  balanceAvax: z.number(),
  burnAvaxPerDay: z.number(),
  runwayDays: z.number(),
  alerts: z.array(z.string()).default([]),
});

export const validatorReportSchema = z.object({
  generatedAt: z.string(),
  subnet: z.string(),
  summary: z.object({
    count: z.number().int().nonnegative(),
    totalBalanceAvax: z.number(),
    alerting: z.number().int().nonnegative(),
    minRunwayDays: z.number().nullable().optional(),
  }),
  rows: z.array(validatorReportRowSchema),
});

export type ValidatorReport = z.infer<typeof validatorReportSchema>;
export type ValidatorReportRow = z.infer<typeof validatorReportRowSchema>;

// ─── Node alert rules ─────────────────────────────────────

/** Metric a rule watches. Mirrors the row fields in `report.json`. */
export const alertFieldEnum = z.enum(["balance", "burn", "runway"]);
export type AlertField = z.infer<typeof alertFieldEnum>;

/** Numeric comparison applied to the metric. */
export const alertOperatorEnum = z.enum(["lt", "lte", "gt", "gte", "eq"]);
export type AlertOperator = z.infer<typeof alertOperatorEnum>;

export const createNodeAlertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  // null = match any node in the report. Otherwise the exact NodeID-… string.
  nodeId: z.string().trim().min(1).max(200).nullable().optional(),
  field: alertFieldEnum,
  operator: alertOperatorEnum,
  threshold: z.number().finite(),
  email: z.string().trim().email().max(255),
  enabled: z.boolean().optional().default(true),
  cooldownMinutes: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 30)
    .optional(),
});

export const updateNodeAlertSchema = createNodeAlertSchema.partial();

export type CreateNodeAlertInput = z.infer<typeof createNodeAlertSchema>;
export type UpdateNodeAlertInput = z.infer<typeof updateNodeAlertSchema>;
