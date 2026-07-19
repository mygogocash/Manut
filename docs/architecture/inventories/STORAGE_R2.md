# Storage / R2 / upload consumers inventory

> Phase 0.2 inventory (factual).
> Companion: [`storage-r2.json`](./storage-r2.json).

## Legacy Supabase Storage (API runtime)

Source of truth: `apps/api/src/infrastructure/storage/supabase-storage.ts`.

| Bucket | Max size | Visibility | Notes |
| --- | --- | --- | --- |
| `article` | 10 MB | public |  |
| `avatars` | 2 MB | public |  |
| `blog` | 10 MB | public |  |
| `uploads` | 50 MB | public | SVG excluded; application/zip allowed on public bucket — policy drift per master plan |
| `receipts` | 10 MB | private |  |
| `documents` | 50 MB | private | HTML and x-zip-compressed private-only |

**Public buckets:** `article`, `avatars`, `blog`, `uploads`.  
**Private buckets** (signed URL / service-role download): `receipts`, `documents`.

Policy flags called out by the master plan (confirmed in code comments):

- SVG excluded from public `uploads`
- `text/html` + `application/x-zip-compressed` allowed only on private `documents`
- Public `uploads` still allows `application/zip` — treat as **policy drift** until tightened or explicitly approved

## Upload / storage consumers (API + app-core)

Runtime files importing `STORAGE_BUCKETS` (14):

- `apps/api/src/infrastructure/storage/supabase-storage.ts`
- `apps/api/src/modules/admin/usage/storage-snapshot.service.ts`
- `apps/api/src/modules/cash-advance/cash-advance.service.ts`
- `apps/api/src/modules/certificates/certificates.service.ts`
- `apps/api/src/modules/expenses/expense-shared.ts`
- `apps/api/src/modules/hrms/hrms.service.ts`
- `apps/api/src/modules/legal-announcements/legal-announcements.service.ts`
- `apps/api/src/modules/legal/legal.service.ts`
- `apps/api/src/modules/ninety-day/ninety-day.service.ts`
- `apps/api/src/modules/payroll/payroll.service.ts`
- `apps/api/src/modules/policies/policies.service.ts`
- `apps/api/src/modules/projects/projects.service.ts`
- `apps/api/src/modules/uploads/uploads.controller.ts`
- `apps/api/src/modules/visa/visa.service.ts`

### `uploadFile` call sites

- `apps/api/src/infrastructure/storage/supabase-storage.ts`
- `apps/api/src/modules/certificates/certificates.service.ts`
- `apps/api/src/modules/payroll/payroll.service.ts`
- `apps/api/src/modules/uploads/uploads.controller.ts`

### Signed URL helpers

- `apps/api/src/infrastructure/storage/supabase-storage.ts`
- `apps/api/src/modules/cash-advance/cash-advance.service.ts`
- `apps/api/src/modules/certificates/certificates.service.ts`
- `apps/api/src/modules/expenses/expense-items.service.ts`
- `apps/api/src/modules/expenses/expense-shared.ts`
- `apps/api/src/modules/hrms/hrms.service.ts`
- `apps/api/src/modules/legal-announcements/legal-announcements.service.ts`
- `apps/api/src/modules/legal/legal.service.ts`
- `apps/api/src/modules/ninety-day/ninety-day.service.ts`
- `apps/api/src/modules/payroll/payroll.service.ts`
- `apps/api/src/modules/policies/policies.service.ts`
- `apps/api/src/modules/projects/projects.service.ts`
- `apps/api/src/modules/uploads/uploads.controller.ts`
- `apps/api/src/modules/uploads/uploads.service.ts`
- `apps/api/src/modules/visa/visa.service.ts`
- `apps/api/src/test/mocks/supabase.mock.ts`

### Bucket → consumer files

**`documents`** (10):
- `apps/api/src/modules/cash-advance/cash-advance.service.ts`
- `apps/api/src/modules/certificates/certificates.service.ts`
- `apps/api/src/modules/hrms/hrms.service.ts`
- `apps/api/src/modules/legal-announcements/legal-announcements.service.ts`
- `apps/api/src/modules/legal/legal.service.ts`
- `apps/api/src/modules/ninety-day/ninety-day.service.ts`
- `apps/api/src/modules/payroll/payroll.service.ts`
- `apps/api/src/modules/policies/policies.service.ts`
- `apps/api/src/modules/projects/projects.service.ts`
- `apps/api/src/modules/visa/visa.service.ts`
**`receipts`** (2):
- `apps/api/src/modules/cash-advance/cash-advance.service.ts`
- `apps/api/src/modules/expenses/expense-shared.ts`

## Cloudflare R2 (edge target path)

Presign / transfer intent lives under `apps/edge` (`r2-presign.ts`, `trusted-storage.ts`). Env keys: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.

Discovered R2-related files (17):

- `apps/edge/worker-configuration.d.ts`
- `apps/edge/tests/upload-intent.test.ts`
- `apps/edge/tests/cloudflare-builds.test.ts`
- `apps/edge/tests/index.test.ts`
- `apps/edge/tests/cash-advance-routes.test.ts`
- `apps/edge/tests/trusted-storage.test.ts`
- `apps/edge/tests/r2-presign.test.ts`
- `apps/edge/tests/uploads.integration.test.ts`
- `apps/edge/tests/deploy-workflow-secrets.test.ts`
- `apps/edge/scripts/ensure-cloudflare-resources.mjs`
- `apps/edge/src/trusted-storage.ts`
- `apps/edge/src/runtime.ts`
- `apps/edge/src/r2-presign.ts`
- `apps/edge/src/cash-advance/routes.ts`
- `apps/app/src/features/cash-advance/cash-advance-screen.tsx`
- `apps/app/src/features/expenses/expenses-screen.tsx`
- `apps/app/src/features/travel/travel-screen.tsx`

Most module uploads still go through Supabase Storage today; R2 is the strangler/target path for selected Expo/edge flows.
