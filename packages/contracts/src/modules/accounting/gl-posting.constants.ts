// Account-mapping roles for the GL posting engine (extracted from apps/api
// gl-posting.service.ts so validation schemas can share them without pulling
// in Prisma). Keep in sync with the legacy file until Phase 9.
export const MAPPING_ROLES = [
  "ar_control",
  "ap_control",
  "revenue_default",
  "expense_default",
  "vat_output",
  "vat_output_deferred",
  "vat_input",
  "vat_input_deferred",
  "wht_payable",
  "wht_receivable",
  "retained_earnings",
  "rounding",
  "fx_gain",
  "fx_loss",
  "bank_charges",
  "customer_advances",
  "vendor_advances",
  "customer_overpayments_refundable",
  "vendor_overpayments_refundable",
  "sales_returns",
  "settlement_writeoff",
  "opening_balance_equity",
  "fa_asset_cost",
  "fa_depreciation_expense",
  "fa_accumulated_depreciation",
  "fa_disposal_gain",
  "fa_disposal_loss",
] as const;
export type MappingRole = (typeof MAPPING_ROLES)[number];

/** Roles that must be mapped before an entity is "ready to post". The rest are situational. */
export const REQUIRED_MAPPING_ROLES = [
  "ar_control",
  "ap_control",
  "revenue_default",
  "expense_default",
  "vat_output",
  "vat_input",
  "wht_payable",
  "wht_receivable",
  "retained_earnings",
  "rounding",
] as const satisfies readonly MappingRole[];
