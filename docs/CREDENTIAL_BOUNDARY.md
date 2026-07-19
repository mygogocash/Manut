# Credential boundary

> **Ops / security boundary (current).** Sole forward roadmap:
> [`docs/EXPO_CLOUDFLARE_MASTER_PLAN.md`](./EXPO_CLOUDFLARE_MASTER_PLAN.md).
> Also see temporary [`DEPENDENCY_FREEZE.md`](./DEPENDENCY_FREEZE.md).

Manut Intranet is a clean operational boundary. It must use newly issued Manut
accounts, projects, domains, keys, OAuth applications, storage buckets, service
accounts, and CI environments. Credentials and provider identifiers inherited
from the audited source snapshot are prohibited even when they still work.

## Rules

- Only public Supabase URL and anon-key values may enter an Expo browser or
  native bundle. Service-role, database, webhook, OAuth, and provider secrets
  remain server-side.
- The E2E suite may target only the dedicated `manut-intranet-e2e` project.
  Runtime users are created with random passwords and deleted after each run.
- `.env`, `.env.e2e`, `.dev.vars`, Playwright storage state, traces containing
  credentials, Expo signing material, and Wrangler state are ignored.
- GitHub Actions use repository or environment secrets; no workflow embeds a
  credential or provider-specific account identifier.
- `pnpm security:credentials` and Gitleaks run before tests. Release candidates
  repeat the scan against generated web, Worker, Android, and iOS artifacts.
- First-admin bootstrap (`pnpm ops:create-first-admin`) is fail-closed: it
  creates `admin@manut.xyz` with `mustChangePassword=true` only when
  Manut-owned `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`),
  `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL` are present in the operator
  environment. Missing or malformed values refuse with a clear error. The
  temporary password is printed once to stdout (or taken from
  `FIRST_ADMIN_TEMPORARY_PASSWORD`) and must never be committed.

Provider revocation evidence belongs in the private cutover record, not in Git.
The replacement PR may merge only after the previously exposed E2E account is
rotated, all sessions are revoked, and a negative login test proves the old
credential no longer authenticates.

## Accepted OSV / Dependabot residuals

After patchable Dependabot/OSV hits were cleared (#217), one residual remains.
Documented acceptance is not a soft-skip: the OSV lockfile scan in
`.github/workflows/pr-checks.yml` stays fail-closed (no `osv-scanner.toml`
ignore, no `continue-on-error`, no severity downgrade that hides findings).

| Package / path | Advisory | Severity | Patch available? | Disposition |
| -------------- | -------- | -------- | ---------------- | ----------- |
| `quill@2.0.3` (transitive via `apps/web` → `react-quill-new@3.8.3`) | GHSA-v3m3-f69x-jf25 / CVE-2025-15056 (HTML-export XSS) | low (GHSA); CVSS 6.1 | **No** — npm latest is `2.0.3`; Dependabot `first_patched_version` is null (alert #149) | **Accepted residual** until an upstream patched release exists or `apps/web` rich-text is retired with the Expo parity cutover |

### Fail-closed rationale (`quill`)

1. **Cannot bump:** no published fixed version; overriding to a non-existent
   release would break install. Do not invent a pin that pretends the CVE is
   gone.
2. **Blast radius is temporary and scoped:** only the legacy Next.js parity
   surface (`apps/web`). Universal Expo (`apps/app`) does not depend on Quill.
3. **Compensating control:** every Quill HTML render sink must pass through
   `sanitizeRichHtml` in `apps/web/src/lib/utils.ts` (strips script/iframe,
   event handlers, `javascript:` URLs). Covered by
   `apps/web/src/lib/sanitize-rich-html.test.ts`.
4. **Gate honesty:** OSV and Dependabot may continue to report this finding.
   That red signal is preferred over silencing the scanner. New patchable
   high/critical hits must still be fixed; this table is not a blanket waiver.

### Exit criteria

- Prefer: bump `quill` (and `react-quill-new` if needed) when a patched release
  ships, then remove this row.
- Or: remove `react-quill-new` / Quill with `apps/web` retirement after Expo
  browser E2E acceptance of the replaced rich-text routes.
