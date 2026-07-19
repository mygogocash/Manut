# Magic-link direction (Epic 1.1 pin)

## Decision

**Email magic link** is the preferred customer passwordless email method for
the target Identity Worker.

Pinned Better Auth magic-link plugin intent (`better-auth@1.6.23`):

| Option | Value | Why |
| ------ | ----- | --- |
| `disableSignUp` | `true` | No public self-signup; invitation-only B2B |
| `expiresIn` | `300` | Five-minute single-use link |
| `storeToken` | `"hashed"` | Raw token never at rest in Identity D1 |
| `emailAndPassword.enabled` | `false` | Target is passwordless |

UI copy: “Email link” (Thai/English). Do not call SMS a magic link.

## Public contract

1. Client `POST /api/identity/sign-in/magic-link` with normalized email +
   allowlisted relative `returnPath`.
2. Worker always returns `IDENTITY_SIGN_IN_ACCEPTED` + opaque `challengeId` +
   cooldown — eligible and ineligible alike.
3. Eligible path (when D1 + adapter are real): hashed token ceremony +
   encrypted email intent; Queue gets identifiers only.
4. Redemption: first-party HTTPS landing `GET` does **not** consume the token;
   user confirms via same-origin `POST`. No session/access/refresh tokens in
   the URL.

## Explicitly out of scope for this scaffold

- Cloudflare Email Service delivery (Epic 1.6)
- Scanner / deep-link device matrix
- Migrated `emailVerified=false` re-verification ceremony wiring
- Production cutover away from current Supabase magic-link Express routes

## Source of pin

- Config constants: `apps/identity-worker/src/better-auth-config.ts`
- CI: `apps/identity-worker/tests/config-pin.test.ts`
- Master plan: §6.5 “Email magic-link flow”
