# Authenticated E2E project

This harness may reset only the `public` schema of the dedicated hosted
Supabase project named `manut-intranet-e2e`. It never resets `auth`, `storage`,
or any other schema.

## Origins

| Project | Origin | Notes |
| --- | --- | --- |
| `admin-chromium` | `http://127.0.0.1:3000` | Next.js parity reference |
| `employee-chromium` (`employee` + `leave`) | `http://127.0.0.1:8081` | Expo universal cutover |
| `expo-web-chromium` | `http://127.0.0.1:8081` | Public Expo sign-in surface |

Employee auth setup signs in on Expo `:8081` so httpOnly cookies are usable with
credentialed CORS to the API on `:3001` (`CORS_ALLOWED_ORIGINS` includes both
web origins). Do **not** soft-skip when the five `E2E_*` secrets are missing —
`global-setup` / `loadE2EEnvironment` must fail closed.

Configure only these environment variables:

- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`
- `E2E_SUPABASE_SERVICE_ROLE_KEY`
- `E2E_DATABASE_URL`
- `E2E_DIRECT_URL`

Before the first run, inspect both database URLs in the Supabase dashboard and
then install the out-of-band guard once:

```sh
DATABASE_URL="$E2E_DATABASE_URL" \
DIRECT_URL="$E2E_DIRECT_URL" \
pnpm --dir packages/database exec prisma db execute \
  --schema prisma/schema \
  --file ../../scripts/e2e/bootstrap-project-guard.sql
```

`pnpm test:e2e` then verifies that the Supabase URL and both database URLs use
the same project ref, verifies the database guard, resets only `public`, runs
the checked-in migrations, creates confirmed random-password personas through
the server-side Admin API, and deletes those users during teardown.

Runtime passwords and Playwright storage state live under the ignored
`.playwright/e2e-auth/` directory. Setup projects disable trace, screenshots, and video;
the service-role key is passed only to Node-side setup and the real API server.
