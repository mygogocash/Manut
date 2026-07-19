# Durable `session_assurance` (Epic 1.1 notes)

## Requirement

The Better Auth session and its `session_assurance` extension are created or
upgraded in **one Identity-D1 primary transaction**, or the session remains
unusable. Sensitive requests reload `amr` / `aal` / `acr` / freshness /
`assurancePolicyVersion` from D1 primary through a private service binding —
never from client claims, cookie-cache copies, async replicas, or a
reconstructed `amr` string.

## Stub migration

File: `apps/identity-worker/migrations/0000_session_assurance.stub.sql`

- **Not auto-applied**
- **Not bound** to a D1 id (wrangler `d1_databases` stays `[]`)
- FK to Better Auth `session(id)` is intentionally deferred until the
  generated schema is reviewed

## Columns (application-owned)

| Column | Role |
| ------ | ---- |
| `session_id` | PK; 1:1 with Better Auth session |
| `amr_json` | Authentication method reference list |
| `aal` / `acr` | Assurance level / context class |
| `primary_authenticated_at` / `mfa_authenticated_at` | Freshness stamps |
| `assurance_policy_version` | Policy pin (`identity-assurance-v1`) |
| `authenticated_by_ceremony_id` | Originating passwordless ceremony |
| `fresh_until` | Sensitive-action window |
| `row_version` | Optimistic concurrency |

## Spike proof still required

- [ ] Atomic session create + assurance insert under concurrent Workers
- [ ] Missing/stale assurance → sensitive route reject
- [ ] Cookie cache remains disabled until revocation/load gate
- [ ] Native session ADR (Expo SecureStore cookie vs OAuth fallback)

## Passwordless methods → aal1

Email magic link and phone OTP produce `aal1` only. Privileged actions still
require passkey/TOTP step-up per master plan §6.4.
