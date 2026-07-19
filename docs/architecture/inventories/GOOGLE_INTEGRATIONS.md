# Google integration inventory

> Phase 0.2 inventory (factual, repo-visible).
> Companion: [`google-integrations.json`](./google-integrations.json).

## OAuth (per-user Workspace)

| Item | Value |
| --- | --- |
| Service | `apps/api/src/modules/integrations/google-oauth.service.ts` |
| Scope helpers | `apps/api/src/modules/integrations/google-scopes.ts` |
| HTTP surface | `/api/integrations` |
| Env | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` |

### Requested scopes

- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/gmail.compose`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`

Gmail send detection also treats `gmail.modify` and `https://mail.google.com/` as send-capable markers when present on stored tokens (`google-scopes.ts`).

## Other Google surfaces

| Surface | Location | Env |
| --- | --- | --- |
| Gmail → CRM sync | `apps/api/src/modules/accounts/crm-email-sync.service.ts` | OAuth refresh tokens |
| Google Sheets (service account) | `apps/api/src/infrastructure/sheets/google-sheets.ts` | `GOOGLE_SHEETS_SA_KEY` |
| Calendar (read) | OAuth `calendar.readonly` + HRMS attendance calendar view | OAuth |

## Code files touching Google APIs

- `apps/api/src/modules/hrms/attendance-notification.service.ts`
- `apps/api/src/modules/hrms/attendance-executive.service.ts`
- `apps/api/src/modules/hrms/attendance-calendar-view.service.ts`
- `apps/api/src/modules/hrms/attendance-manager.service.ts`
- `apps/api/src/modules/hrms/attendance-analytics.service.ts`
- `apps/api/src/modules/hrms/attendance.service.ts`
- `apps/api/src/modules/hrms/attendance-missed.service.ts`
- `apps/api/src/modules/hrms/attendance-export.service.ts`
- `apps/api/src/modules/integrations/google-oauth.service.ts`
- `apps/api/src/modules/integrations/google-scopes.ts`
- `apps/api/src/modules/integrations/integrations.controller.ts`
- `apps/api/src/modules/integrations/integrations.service.spec.ts`
- `apps/api/src/modules/integrations/integrations.service.ts`
- `apps/api/src/infrastructure/sheets/google-sheets.ts`

## Live ops (not in repo — record externally)

- GCP project/org owner and billing — not discoverable from repo; record in ops register
- OAuth consent screen publishing/verification/test users — Dashboard
- Authorized/verified domains and callback origins per environment — Dashboard + GOOGLE_OAUTH_REDIRECT_URI
- API quotas and refresh-token population — live measurement
