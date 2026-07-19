# Auth / Supabase touchpoints inventory

> Phase 0.2 inventory (factual).
> Companion: [`auth-supabase.json`](./auth-supabase.json).

## Trust chain (current)

1. Client sends `Authorization: Bearer …` **or** httpOnly cookies `manut_access_token` / `manut_refresh_token`.
2. `auth.guard` → `supabaseAdmin.auth.getUser(token)`.
3. Prisma `User` row loaded by auth user id; `isAuthenticationEligible` gates active/non-deleted accounts.
4. Permissions resolved separately (roles + manager implicit perms).

Native Expo clients send `x-manut-client: native` to receive session tokens in the JSON body for SecureStore (cookies still set).

## Core files

- `apps/api/src/infrastructure/supabase/admin.ts`
- `apps/api/src/core/guards/auth.guard.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/api/src/modules/users/users.controller.ts`
- `apps/api/src/infrastructure/storage/supabase-storage.ts`

## HTTP routes (`/api/auth`)

- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/magic-link`
- `POST /api/auth/recover-password`
- `POST /api/auth/exchange-session`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `GET /api/auth/me/profile`
- `PATCH /api/auth/me/profile`
- `POST /api/auth/change-password`

## Supabase Auth admin / client calls

### `auth.service.ts`

- `supabaseAdmin.auth.admin.createUser`
- `supabaseAdmin.auth.admin.deleteUser`
- `supabaseAdmin.auth.admin.updateUserById`
- `supabaseAdmin.auth.getUser`
- `supabaseAdmin.auth.refreshSession`
- `supabaseAdmin.auth.resetPasswordForEmail`
- `supabaseAdmin.auth.signInWithOtp`
- `supabaseAdmin.auth.signInWithPassword`

### `users.service.ts`

- `supabaseAdmin.auth.admin.createUser`
- `supabaseAdmin.auth.admin.deleteUser`
- `supabaseAdmin.auth.admin.listUsers`
- `supabaseAdmin.auth.admin.updateUserById`

## Identity flows (disposition hints)

| Flow | Route / via | Supabase API | Notes |
| --- | --- | --- | --- |
| password-login | `POST /api/auth/login` | `signInWithPassword` |  |
| forgot-password | `POST /api/auth/forgot-password` | `resetPasswordForEmail` | retire-for-passwordless |
| magic-link | `POST /api/auth/magic-link` | `signInWithOtp` | migrate-to-identity-outbox |
| recover-password | `POST /api/auth/recover-password` | `admin.updateUserById` | retire-with-password |
| change-password | `POST /api/auth/change-password` | `—` | retire-with-password |
| refresh | `POST /api/auth/refresh` | `refreshSession` |  |
| logout | `POST /api/auth/logout` | `—` |  |
| me | `GET /api/auth/me` | `—` |  |
| exchange-session | `POST /api/auth/exchange-session` | `—` |  |
| update-profile | `PATCH /api/auth/me` | `—` |  |
| admin-create-user | `users.service` | `admin.createUser` |  |
| admin-delete-user | `users.service` | `admin.deleteUser` |  |
| admin-update-user | `users.service` | `admin.updateUserById` |  |

## Environment

| Class | Keys |
| --- | --- |
| Legacy Supabase | `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Target auth hints (`.env.example`) | `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE` |

## Still open (Epic 0.2)

- Export/classify all potential login emails/phones (no activation)
- `AuthLog` retention / fingerprint redesign
- Passwordless SMS Low/Base/High + Thailand quotes
