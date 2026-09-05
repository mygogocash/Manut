/** Reporting currency — the entity base every report total collapses to. */
const REPORTING_CURRENCY = "THB";

/**
 * Currency the report TOTAL is expressed in.
 *
 * The server converts every report to THB — a single foreign-currency
 * report (all-INR, all-LKR) as much as a mixed one — so the total never
 * carries a line item's native code. Line items stay native; only the
 * total is converted. See `computeReportTotal` in
 * `apps/api/src/modules/expenses/expense-reports.service.ts`.
 *
 * Call sites used to fall back to the first line's currency when
 * `totalCurrency` was absent, which printed "INR 412.34" over a THB
 * figure in the approve dialog.
 */
export function reportTotalCurrency(report: {
  totalCurrency?: string | null;
}): string {
  return report.totalCurrency?.trim().toUpperCase() || REPORTING_CURRENCY;
}
