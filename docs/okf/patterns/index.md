# Patterns

Reusable module shapes with a proven reference implementation. Read the
relevant entry before building something that resembles an existing module.

- [Per-entity scoping](/patterns/per-entity-scoping.md) — `entityId` + `__all__` filter
- [Signed-URL downloads](/patterns/signed-url-downloads.md) — private `documents` bucket
- [xlsx imports](/patterns/xlsx-imports.md) — `coerceNumber` for HR's comma numbers
- [Two-row header xlsx](/patterns/two-row-header-xlsx.md) — composite header keys
- [Login redirect](/patterns/login-redirect.md) — `/dashboard` for staff, `/my-portal` for employee-only
- [Branding](/patterns/branding.md) — user-visible name is "Intranet"; `@nexora/*` stays
- [ARIA evals](/patterns/aria-evals.md) — three suites gate assistant changes
- [Configurable list](/patterns/configurable-list.md) — admin-editable enum with two-phase reorder
- [Approval chain](/patterns/approval-chain.md) — config steps + per-request decision snapshot
- [Bulk select-and-act](/patterns/bulk-select-and-act.md) — ids OR `allMatching` + filter
- [Native-table / shared-board mirror](/patterns/native-table-shared-board-mirror.md) — lazy heal on first open
- [Dashboard intelligence](/patterns/dashboard-intelligence.md) — transition-stamped lifecycle columns + SLA constants
- [Soft delete + restore](/patterns/soft-delete-restore.md) — `deletedAt` and the IDOR trap
- [ESOP sheet-aligned KPIs](/patterns/esop-sheet-aligned-kpis.md) — `rollupGrants()` definitions
- [Announce to dashboard surfaces](/patterns/announce-to-dashboard-surfaces.md) — wall + news + company date
- [Timezone-correct daily records](/patterns/timezone-correct-daily-records.md) — store the IANA zone on the row
- [Global config block](/patterns/global-config-block.md) — one `SystemSetting` row + `DEFAULT_X` fallback
- [Multi-value tag column + admin-editable list, shared by two modules](/patterns/multi-value-tag-column.md) — a filterable `text[]` tag plus a no-FK code lookup, one module serving two CRMs.
- [Nav children that are filtered views of one board](/patterns/nav-children-filtered-views.md) — sidebar children that differ only by a query param, built from a config list.
- [Two-tier decision flow](/patterns/two-tier-decision-flow.md) — non-blocking questions that move nothing
- [Configurable approval chain](/patterns/configurable-approval-chain-scoped.md) — per-record snapshot, approval segment only
- [Fixed Asset Register](/patterns/fixed-asset-register.md) — depreciation derived, one event chain
- [Submitter-conditional routing](/patterns/submitter-conditional-routing.md) — route one person's own requests differently; the self-approval bypass
- [Monthly spend series over rows that span months](/patterns/monthly-spend-series.md) — per-month series when one row spans many months; the "active only" filter that destroys the history.
- [Importing a hand-maintained purchase log](/patterns/importing-purchase-log.md) — day-first dates, baht money strings, and the serial-only match key that duplicates a whole sheet.
