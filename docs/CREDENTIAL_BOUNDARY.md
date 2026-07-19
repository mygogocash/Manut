# Credential boundary

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
