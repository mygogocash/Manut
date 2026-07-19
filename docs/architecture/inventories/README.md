# Architecture inventories (Phase 0.2–0.3)

Factual inventories for the Expo + Cloudflare migration. No production behavior changes.

| Document | JSON companion | Topic |
| --- | --- | --- |
| [EXPRESS_ROUTES.md](./EXPRESS_ROUTES.md) | [express-routes.json](./express-routes.json) | Express mounts + route handlers |
| [PRISMA_MODELS.md](./PRISMA_MODELS.md) | [prisma-models.json](./prisma-models.json) | Prisma schema / migrations |
| [STORAGE_R2.md](./STORAGE_R2.md) | [storage-r2.json](./storage-r2.json) | Supabase buckets + R2/edge consumers |
| [EMAIL_TEMPLATES.md](./EMAIL_TEMPLATES.md) | [email-templates.json](./email-templates.json) | Template IDs + sendEmail sites |
| [AUTH_SUPABASE.md](./AUTH_SUPABASE.md) | [auth-supabase.json](./auth-supabase.json) | Auth/Supabase touchpoints |
| [GOOGLE_INTEGRATIONS.md](./GOOGLE_INTEGRATIONS.md) | [google-integrations.json](./google-integrations.json) | Google OAuth / Sheets / Gmail |
| [GOLDEN_FIXTURES.md](./GOLDEN_FIXTURES.md) | [golden-fixtures.json](./golden-fixtures.json) | Epic 0.3 capture checklist |
| [DISPOSITION_REGISTER.md](./DISPOSITION_REGISTER.md) | [disposition-register.json](./disposition-register.json) | API mounts ↔ ROUTE_DISPOSITION |

Plan reference: `docs/EXPO_CLOUDFLARE_MASTER_PLAN.md` §20 Epic 0.2–0.3.

## Snapshot counts

| Inventory | Count |
| --- | ---: |
| API mounts | 87 |
| API route handlers | 1013 |
| Prisma models | 214 |
| Email template IDs | 56 |
| Storage buckets | 6 |
| Auth `/api/auth` routes | 11 |
