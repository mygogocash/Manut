/**
 * The 28 knowledge bullets that lived in CLAUDE.md's "Common pitfalls" and
 * "Module-specific patterns to reuse" sections as of 2026-08-17, and the
 * concept document each one must land in.
 *
 * This list is a RATCHET, not a wall. It is the contract that PR3 (which trims
 * CLAUDE.md and deletes AGENTS.md / CONTEXT.md) cannot violate without turning
 * the build red. Adding a new bullet to CLAUDE.md means adding an entry here AND
 * the concept file it points at AND bumping the count assertion in
 * coverage.test.ts in the same commit — the count is a tripwire against
 * accidental drift, not a prohibition on deliberate growth.
 *
 * 2026-08-24: grown 28 -> 34. The dev -> main release brought six bullets that
 * landed on dev after the 2026-08-17 freeze; dev has never carried packages/okf,
 * so nothing claimed them until the branches met.
 *
 * `bullet` must stay byte-identical to the source text — it is matched by
 * strict equality against the bold label in CLAUDE.md.
 *
 * Honest limit: markers plus the body-length floor catch truncation and
 * filename-only drift — a document reduced to frontmatter, or to frontmatter
 * plus a bare heading, cannot also carry its markers or clear the floor. They
 * do NOT catch mid-document degradation: on the longest documents most body
 * lines carry no marker at all, so an edit that silently drops or corrupts an
 * unmarked paragraph while leaving every marker and the floor intact will not
 * be caught. A green run means "the marked substance survived," not "nothing
 * changed" — pick markers for a bullet's load-bearing claims, not as a proxy
 * for reviewing the whole document.
 */
export interface CoverageEntry {
  bullet: string;
  conceptFile: string;
  /**
   * 2-5 distinctive, load-bearing strings (file paths, function names,
   * permission codes, table names, endpoint paths) drawn from this bullet's
   * CLAUDE.md text. Each marker must appear verbatim in the concept file's
   * body. This is a marker-count assertion, not a review: a conflict-free
   * port can silently drop hunks while `tsc` stays green, so counted markers
   * are the only proof that the document's substance survived intact.
   */
  markers: string[];
}

export const COVERAGE_MANIFEST: ReadonlyArray<CoverageEntry> = [
  // 2026-08-27 — grown 35 -> 37 alongside the expense approval-chain work.
  {
    bullet: "Approval-step order gaps",
    conceptFile: "pitfalls/approval-step-order-gaps.md",
    markers: ["deleteApprovalStep", "planOrderCompaction", "ORDER_PARK_OFFSET"],
  },
  {
    bullet: "Submitter-conditional approval routing",
    conceptFile: "patterns/submitter-conditional-routing.md",
    markers: [
      "skipWhenSubmitterIds",
      "onlyWhenSubmitterIds",
      "hasAllowanceApprovalChain",
    ],
  },
  // ## Common pitfalls — 11 bullets
  {
    bullet: "Permissions cache",
    conceptFile: "pitfalls/permissions-cache.md",
    markers: ["AuthProvider", "visibility-return", "periodic timer"],
  },
  {
    bullet: "Form-dialog reopen",
    conceptFile: "pitfalls/form-dialog-reopen.md",
    markers: [
      "*ListItem",
      "re-fetch the full detail on open",
      "silently overwrite real data on save",
    ],
  },
  {
    bullet: "Express route order",
    conceptFile: "pitfalls/express-route-order.md",
    markers: ["/import-template", "/:id", "Router()"],
  },
  {
    bullet: "System Admin role",
    conceptFile: "pitfalls/system-admin-role.md",
    markers: [
      'isSystem && name === "Admin"',
      "admin:manage",
      "custom roles can hold that perm",
    ],
  },
  {
    bullet: "Migration consolidation",
    conceptFile: "pitfalls/migration-consolidation.md",
    markers: [
      "0000_init",
      "re-attempt their CREATE / ALTER",
      "squashing migrations into a fresh",
    ],
  },
  {
    bullet: "Singapore region",
    conceptFile: "pitfalls/singapore-region.md",
    markers: ["aws-1-ap-southeast-1", "P1001", "6543"],
  },
  {
    bullet: "Paginated aggregates",
    conceptFile: "pitfalls/paginated-aggregates.md",
    markers: [
      "/investors/pipeline-totals",
      "not all 199",
      "server roll-up endpoint",
    ],
  },
  {
    bullet: "Email HTML injection",
    conceptFile: "pitfalls/email-html-injection.md",
    markers: [
      "escapeHtml()",
      "apps/api/src/infrastructure/email/templates.ts",
      "unescaped they inject HTML",
    ],
  },
  {
    bullet: "Tailwind static scan",
    conceptFile: "pitfalls/tailwind-static-scan.md",
    markers: ["border-t-blue-500", "border-t-${color}", "bg-${x}-500"],
  },
  {
    bullet: "Generated Prisma client is gitignored",
    conceptFile: "pitfalls/generated-prisma-client-gitignored.md",
    markers: [
      "packages/database/src/generated/",
      "apps/web/tsconfig.tsbuildinfo",
      "pnpm db:generate",
    ],
  },
  {
    bullet: "Notification bell is (mostly) a server read-model, not a table.",
    conceptFile: "pitfalls/notification-bell-read-model.md",
    markers: [
      "ItCrmNotification",
      "notifyItTaskEvent",
      "seen-ids-v2",
      "getItCrmRemindersForUser",
    ],
  },

  // ## Module-specific patterns to reuse — 17 bullets
  {
    bullet: "Per-entity scoping",
    conceptFile: "patterns/per-entity-scoping.md",
    markers: [
      "entityId",
      "__all__",
      "SELECT id FROM entities WHERE code = 'TH'",
    ],
  },
  {
    bullet: "Signed-URL downloads",
    conceptFile: "patterns/signed-url-downloads.md",
    markers: ["parseStorageUrl", "fileUrl", "/:id/download"],
  },
  {
    bullet: "xlsx imports",
    conceptFile: "patterns/xlsx-imports.md",
    markers: ["coerceNumber", "NBSP", "NaN"],
  },
  {
    bullet: "Two-row header xlsx",
    conceptFile: "patterns/two-row-header-xlsx.md",
    markers: ["row1[i] || row2[i]", "Allowances", "Employee Name"],
  },
  {
    bullet: "Login redirect",
    conceptFile: "patterns/login-redirect.md",
    markers: ["/my-portal", "defaultRoute", "#208"],
  },
  {
    bullet: "Branding",
    conceptFile: "patterns/branding.md",
    markers: ["@nexora/*", "#210", "Don't rename them"],
  },
  {
    bullet: "ARIA evals",
    conceptFile: "patterns/aria-evals.md",
    markers: [
      "aria-tools.eval.test.ts",
      "aria-retrieval.eval.test.ts",
      "80% hit-rate floor",
    ],
  },
  {
    bullet: "Configurable list (admin-editable enum)",
    conceptFile: "patterns/configurable-list.md",
    markers: [
      "investor-pipeline-stages",
      "cash-advance:approve",
      "park at negative orders",
    ],
  },
  {
    bullet: "Approval chain",
    conceptFile: "patterns/approval-chain.md",
    markers: ["assertCanActOnStep", "*ApprovalStep", "currentStepOrder"],
  },
  {
    bullet: "Bulk select-and-act",
    conceptFile: "patterns/bulk-select-and-act.md",
    markers: [
      "buildInvestorWhere",
      "allMatching: true",
      "/investors/bulk-update",
    ],
  },
  {
    bullet: "Native-table / shared-board mirror",
    conceptFile: "patterns/native-table-shared-board-mirror.md",
    markers: [
      "projectRepository.findById",
      "*_native_workspace",
      "shared board 404s",
    ],
  },
  {
    bullet: "Dashboard intelligence (flow metrics + SLA)",
    conceptFile: "patterns/dashboard-intelligence.md",
    markers: ["statusChangedAt", "helpdesk.sla.ts", "it-crm.service.ts"],
  },
  {
    bullet: "Soft delete + restore/remove (and the IDOR trap)",
    conceptFile: "patterns/soft-delete-restore.md",
    markers: [
      "deletedAt",
      "excludeDeleted()",
      "find*ByIdIncludingDeleted",
      "ForbiddenException",
      "visa:manage",
    ],
  },
  {
    bullet: "ESOP sheet-aligned KPIs",
    conceptFile: "patterns/esop-sheet-aligned-kpis.md",
    markers: ["rollupGrants()", "hrms:esop-manage", "vestedSharesToDate"],
  },
  {
    bullet: "Announce a record to the dashboard surfaces",
    conceptFile: "patterns/announce-to-dashboard-surfaces.md",
    markers: [
      "survey.announcement_defaults",
      "announcePublishedForm",
      "WALL_CREATE",
    ],
  },
  {
    bullet: "Timezone-correct daily records",
    conceptFile: "patterns/timezone-correct-daily-records.md",
    markers: [
      "employeeTimezone",
      "zonedLocalToUtc",
      "computeLateMinutesInTimezone",
    ],
  },
  {
    bullet: "Global config block on a generated document",
    conceptFile: "patterns/global-config-block.md",
    markers: [
      "payslip.company",
      "InputJsonValue",
      "payslip-company-dialog.tsx",
    ],
  },
  // ── Added by the 2026-08-24 dev -> main release (bullets that landed on dev
  // after the 2026-08-17 freeze). 28 -> 34.
  {
    bullet:
      "AI Orchestrator notifications = EMAIL push only; the bell stays read-model.",
    conceptFile: "pitfalls/orchestrator-notifications-email-only.md",
    markers: [
      "notifyOrchestratorEvent",
      "orchestrator.reminder_recipients",
      "crmTaskUpdateEmail",
    ],
  },
  {
    bullet: "Two-tier decision flow with non-blocking questions",
    conceptFile: "patterns/two-tier-decision-flow.md",
    markers: [
      "proposal_information_requests",
      "proposals.first_reviewer",
      "assignedToId === actorId",
    ],
  },
  {
    bullet:
      "Configurable approval chain (Project CRM only) + the super-admin-only guard.",
    conceptFile: "patterns/configurable-approval-chain-scoped.md",
    markers: [
      "approval_chains",
      "CHAIN_ADVANCE_TARGET",
      "chain.types.ts",
      "project_request",
    ],
  },
  {
    bullet: "Fixed Asset Register (Accounting)",
    conceptFile: "patterns/fixed-asset-register.md",
    markers: [
      "ACCOUNTING_FIXED_ASSETS",
      "assetStateAt",
      "fixed-asset-state.ts",
      "assertFixedAssetAccountsConfigured",
    ],
  },
  // Added 2026-08-24 with the Sales CRM business-unit promotion (#1117 →
  // #1125). The bullets arrived on main with that promotion; `packages/okf`
  // does not exist on dev, so the gate only sees them here.
  {
    bullet:
      "Multi-value tag column + admin-editable list, shared by two modules",
    conceptFile: "patterns/multi-value-tag-column.md",
    markers: ["crm_business_units", "array_remove", "VARIANT_STYLES"],
  },
  {
    bullet: "Nav children that are filtered views of one board",
    conceptFile: "patterns/nav-children-filtered-views.md",
    markers: ["matchParams", "bestMatchHref", "history.replaceState"],
  },
  // Added 2026-08-26 with the ARIA Revenue retirement (#1164).
  {
    bullet:
      "ARIA Revenue CRM is RETIRED; its `revenue_*` tables are PARKED, not dropped",
    conceptFile: "pitfalls/aria-revenue-parked-tables.md",
    markers: [
      "business-units/revenue-rollup.repository.ts",
      "legacyDealId",
      "/sales?tab=pipeline&bu=aria",
    ],
  },
  // Added 2026-08-28 with the IT Billing Monthly tab (#1186).
  {
    bullet: "Spend time series over rows that span months",
    conceptFile: "patterns/monthly-spend-series.md",
    markers: [
      "it-billing-monthly.ts",
      "subscriptionsForMonthlySeries",
      "toMonthlySpend",
      "lastChargedMonth",
    ],
  },
  // Added 2026-08-28 with the Office asset-import extension.
  {
    bullet: "Importing a hand-maintained purchase log",
    conceptFile: "patterns/importing-purchase-log.md",
    markers: [
      "parseDayFirstDate",
      "asset-inventory-mapping.ts",
      "seenKeys",
      "assetImportRowSchema",
    ],
  },
];
