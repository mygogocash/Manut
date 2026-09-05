# Pitfalls

Mistakes this codebase has actually made, one concept per file. Read the
relevant entry before editing an unfamiliar module.

- [Permissions cache](/pitfalls/permissions-cache.md) — stale `useAuth()` state after a role change
- [Form-dialog reopen](/pitfalls/form-dialog-reopen.md) — slim list items silently overwrite real data
- [Express route order](/pitfalls/express-route-order.md) — literal paths must precede `:param` routes
- [System Admin role](/pitfalls/system-admin-role.md) — the bypass key is `isSystem && name === "Admin"`
- [Migration consolidation](/pitfalls/migration-consolidation.md) — squashing leaves later migrations to re-fail
- [Singapore region](/pitfalls/singapore-region.md) — Supabase is `aws-1-ap-southeast-1`; expect transient P1001s
- [Paginated aggregates](/pitfalls/paginated-aggregates.md) — never total from the loaded page
- [Email HTML injection](/pitfalls/email-html-injection.md) — `escapeHtml()` every interpolated free-text field
- [Tailwind static scan](/pitfalls/tailwind-static-scan.md) — dynamic class strings get purged
- [Generated Prisma client is gitignored](/pitfalls/generated-prisma-client-gitignored.md) — run `pnpm db:generate`
- [Notification bell read-model](/pitfalls/notification-bell-read-model.md) — recompute server-side; seen-set governs the badge
- [AI Orchestrator notifications](/pitfalls/orchestrator-notifications-email-only.md) — email only; the bell stays a read-model
- [ARIA Revenue parked tables](/pitfalls/aria-revenue-parked-tables.md) — the retired module's tables are the rollback net; don't code against them
- [Approval-step order gaps](/pitfalls/approval-step-order-gaps.md) — delete left a hole in a `@unique`, user-visible `order`; routing was fine, the page was not
