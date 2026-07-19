# Private phone challenge wrapper

## Why stock routes are blocked

Better Auth’s public phone plugin endpoints
(`/phone-number/send-otp`, `/phone-number/verify`) accept the phone number
again and may send an OTP **before** application eligibility
(pre-provisioned verified contact, tenant/sponsor budget, enumeration-safe
timing) is enforced.

Therefore the Identity Worker **must not** expose those routes to customers.

## Public vs private

| Surface | Contract |
| ------- | -------- |
| Public | `POST /api/identity/sign-in/phone` → opaque `challengeId` envelope |
| Public | `POST /api/identity/phone/verify` with `{ challengeId, code }` only |
| Private | `PrivatePhoneChallengeWrapper` inside the Worker trust boundary |

Stock paths return `404 IDENTITY_STOCK_PHONE_ROUTE_BLOCKED`.

## Private wrapper requirements (target, not yet implemented)

1. Server-side E.164 parse (Thai `08x…` → `+66…`); reject disallowed ranges.
2. Eligibility + sponsor reservation **before** any SMS provider call.
3. Six-digit OTP, 300s expiry, max 3 app-owned attempts.
4. Challenge/purpose/expiry-bound **keyed** HMAC (or equivalent peppered)
   verifier — not a plain unsalted hash of a 6-digit code.
5. Identifier-only Queue payload; raw OTP never in logs/DLQ.
6. Purpose isolation: `customer_sign_in` ≠ `phone_enrollment` ≠
   `phone_replacement`.

If the pinned Better Auth phone plugin cannot meet (3)–(5), choose a
provider-managed verification adapter behind the same public contract, or
**defer phone login**. Do not weaken the contract.

## Stub in this PR

`apps/identity-worker/src/private/phone-challenge-wrapper.ts` implements the
TypeScript surface and returns `stub_not_wired` / `ceremonyCreated: false`.
No SMS is sent. Phone verify routes fail closed without Identity D1.

## Enrollment gate (reminder)

Legacy `User.phone` / CRM phones are **not** login contacts until a
fresh-authenticated enrollment ceremony attaches
`phoneNumberVerified=true` to exactly one pre-provisioned identity.
