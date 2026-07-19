# Auth Recovery Fraud Prevention

> **Temporary legacy runbook.** Sole forward identity/recovery roadmap:
> [`docs/EXPO_CLOUDFLARE_MASTER_PLAN.md`](../EXPO_CLOUDFLARE_MASTER_PLAN.md)
> (§§6 and 14). Password-reset paths are retired in the target; do not extend
> this runbook as the long-term design.

This note covers the public auth recovery endpoints added for password reset
and magic-link sign-in.

## Public flows

- `POST /api/auth/forgot-password` accepts `{ email }` and asks Supabase to send
  a password reset link to `/reset-password`.
- `POST /api/auth/magic-link` accepts `{ email }` and asks Supabase to send a
  magic sign-in link to `/auth/callback`.
- `POST /api/auth/recover-password` accepts Supabase link tokens plus the new
  password, validates the tokens server-side, updates the Supabase password,
  clears `mustChangePassword`, and sets the normal httpOnly cookies.
- `POST /api/auth/exchange-session` accepts Supabase magic-link tokens,
  validates them server-side, and sets the normal httpOnly cookies.

## Fraud controls

1. **Company allowlist via `users`.** The API only calls Supabase email actions
   when the submitted email matches an active `User` row. Unknown and inactive
   emails are logged but never receive a link.
2. **No user enumeration.** Forgot-password and magic-link requests always return
   `200` with the same "if this email belongs to an active account" message.
3. **No auto-provisioning.** Magic links use
   `signInWithOtp({ options: { shouldCreateUser: false } })`, so a public
   request can never create a new Supabase user.
4. **Sliding-window throttles.** `auth_logs` backs a one-hour window:
   3 recovery-link requests per email and 10 per IP across both reset and
   magic-link actions. Rate-limited requests are logged and return the same
   no-enumeration response.
5. **Audit trail.** `auth_logs` records email, IP, action, success/failure,
   best-effort `userId`, and short failure reason for recovery, magic-link,
   password update, and session exchange attempts.
6. **Server-side token validation.** Recovery/callback pages never trust URL
   fragments directly. They post tokens to the API; the API verifies the access
   token with Supabase, refreshes the session, checks both tokens resolve to the
   same user, and then checks the local `User` row is active.
7. **HttpOnly session cookies only.** The browser receives normal API cookies
   after token exchange; no long-lived Supabase session is stored in localStorage.
8. **Redirect allowlist required.** Supabase Auth URL Configuration must include
   the production URLs for `/reset-password` and `/auth/callback` before release.

## Optional Phase 2

- Add CAPTCHA after the first failed/rate-limited request from an IP window.
- Add an explicit company-domain allowlist if HR decides contractor/guest emails
  should never be eligible for self-service recovery.
- Add alerting for repeated `ip-rate-limited`, `email-rate-limited`, and
  `session-user-mismatch` records.
