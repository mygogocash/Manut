# Epic 1.1 — Better Auth on Workers / D1 / Expo (spike scaffold)

**Status:** Preview-only scaffold (delete-able)  
**Date:** 2026-07-19  
**Production auth cutover:** **No** — Supabase + Express remain authoritative

## Authority

Tasks and acceptance criteria come from
`docs/EXPO_CLOUDFLARE_MASTER_PLAN.md` §21 Epic 1.1 and §6 (identity).

## Scaffold layout

```text
apps/identity-worker/          # Hono spike Worker (stub adapter)
packages/identity-contracts/   # IdentityPort + public envelopes
docs/identity/                 # this pack
```

## Pinned directions (this PR)

1. **Magic link** is the preferred email passwordless path
   (`disableSignUp: true`, `expiresIn: 300`, `storeToken: "hashed"`).
   See `MAGIC-LINK-DIRECTION.md`.
2. **Stock Better Auth phone routes are blocked**
   (`/phone-number/send-otp`, `/phone-number/verify`, and `/api/auth/...`
   variants). Public clients use opaque `challengeId` only.
3. **Private phone challenge wrapper** is documented and stubbed
   (`PRIVATE-PHONE-CHALLENGE-WRAPPER.md` +
   `apps/identity-worker/src/private/phone-challenge-wrapper.ts`).
4. **`session_assurance`** has a reviewed SQL stub
   (`SESSION-ASSURANCE.md` +
   `apps/identity-worker/migrations/0000_session_assurance.stub.sql`).
5. **Fail closed** if preview Identity D1 is missing. Hyperdrive is not used
   by this Worker. No invented binding ids in git.

## Stub vs real

| Capability | This PR |
| ---------- | ------- |
| Route inventory + config pin tests | Real |
| Fail-closed without `IDENTITY_DB` | Real |
| Enumeration-safe `IDENTITY_SIGN_IN_ACCEPTED` shape | Real (stub ceremony) |
| `better-auth` npm install + D1 adapter | **Not yet** (pin `1.6.23` only) |
| Email / SMS delivery | **Not yet** (Epics 1.6 / 1.7) |
| Expo SecureStore session ADR | **Not yet** |
| Production JWKS / cookie cutover | **Forbidden here** |

## Next gates (not this PR)

- [ ] Ops creates Manut-owned **preview** Identity D1; commit the real
      `database_id` only after provisioning (never invent).
- [ ] Install pinned `better-auth@1.6.23` (+ `@better-auth/expo` when native
      path is chosen); review generated schema before apply.
- [ ] Wire magic-link hashed tokens + scanner-resistant redeem page.
- [ ] Implement keyed OTP verifier in the private phone wrapper or choose
      provider-managed verification ADR / defer phone.
- [ ] Atomic session + `session_assurance` write proof.
- [ ] Publish native-session ADR (cookie SecureStore vs OAuth fallback).

## Rollback

Delete the scaffold paths listed above. No production Worker, DNS, or auth
issuer change is required.
