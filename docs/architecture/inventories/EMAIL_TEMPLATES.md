# Email template keys / sendEmail call sites

> Phase 0.2 inventory (factual).
> Companion: [`email-templates.json`](./email-templates.json).

## Delivery adapter

| Item | Value |
| --- | --- |
| Module | `apps/api/src/infrastructure/email/email.service.ts` |
| Remote | `POST ${EMAIL_SERVICE_URL}/api/emails` |
| Auth | `x-api-key: EMAIL_SERVICE_API_KEY` |
| Body fields sent | `templateId`, `to`, `variables`, optional `replyTo` |
| **Not** sent to remote | local `subject`, local `html` (builders still produce them for potential future use / parity capture) |
| Env | `EMAIL_SERVICE_URL`, `EMAIL_SERVICE_API_KEY`, `EMAIL_FROM` |

`sendEmail` is best-effort (errors logged, not thrown). `sendRequiredEmail` rethrows after log.

## Template ID counts

| Source | Count |
| --- | ---: |
| In-repo builders (`templates.ts` `export function`) | 44 |
| Distinct `templateId` on builders | 43 |
| Hard-coded IDs outside builders | 14 |
| **All unique template IDs** | **56** |

Matches the master-plan “56 observed template keys” figure for this snapshot.

### All unique template IDs

- `attendance-correction-approved`
- `attendance-correction-pending`
- `attendance-correction-rejected`
- `attendance-manager-absentee`
- `attendance-manager-late`
- `attendance-manager-missed`
- `attendance-manager-pending-corrections`
- `attendance-missed-checkin`
- `attendance-missed-checkout`
- `awaiting-manager-approval`
- `cancelled-leave-request`
- `cash-advance-approved-2`
- `cash-advance-request-awaiting`
- `cash-advance-request-fully-approved`
- `cash-advance-request-rejected`
- `certificate-issued`
- `desk-summary`
- `escalation-reminder`
- `expense-allowance-filed`
- `expense-approved`
- `expense-desk-summary`
- `expense-monthly-reminder`
- `expense-reimbursed`
- `expense-rejected`
- `expense-submitted`
- `forwarded-leave-request`
- `it-access-decision`
- `it-access-request`
- `it-billing-reminder`
- `it-crm-deadline-reminder`
- `it-crm-task-assigned`
- `it-crm-task-status-updated`
- `it-crm-task-update`
- `leave-approved`
- `legal-document-expiry-digest`
- `legal-signature-request`
- `opportunity-created`
- `opportunity-stage-changed`
- `project-task-unblocked`
- `rejected-leave-request`
- `request-submitted-confirmation`
- `stale-lead-digest-2`
- `submitted-leave-request`
- `survey-form-response-submitted`
- `survey-upload-complete`
- `ticket-created-requester`
- `ticket-status-updated`
- `ticketcreatedteam`
- `travel-approved`
- `travel-cancelled`
- `travel-desk-summary`
- `travel-rejected`
- `travel-submitted`
- `visa-expiry-reminder-2`
- `visa-ninety-day-reminder`
- `welcome-intranet`

### Hard-coded IDs (no builder in `templates.ts`)

- `attendance-correction-pending` — `apps/api/src/modules/hrms/attendance-notification.service.ts:55`
- `attendance-correction-approved` — `apps/api/src/modules/hrms/attendance-notification.service.ts:76`
- `attendance-correction-rejected` — `apps/api/src/modules/hrms/attendance-notification.service.ts:94`
- `attendance-missed-checkin` — `apps/api/src/modules/hrms/attendance-notification.service.ts:104`
- `attendance-missed-checkout` — `apps/api/src/modules/hrms/attendance-notification.service.ts:114`
- `attendance-manager-absentee` — `apps/api/src/modules/hrms/attendance-notification.service.ts:128`
- `attendance-manager-late` — `apps/api/src/modules/hrms/attendance-notification.service.ts:143`
- `attendance-manager-missed` — `apps/api/src/modules/hrms/attendance-notification.service.ts:162`
- `attendance-manager-pending-corrections` — `apps/api/src/modules/hrms/attendance-notification.service.ts:173`
- `it-crm-task-assigned` — `apps/api/src/modules/it-crm/it-crm.service.ts:1687`
- `it-crm-task-status-updated` — `apps/api/src/modules/it-crm/it-crm.service.ts:1719`
- `legal-document-expiry-digest` — `apps/api/src/modules/legal/legal.service.ts:591`
- `legal-signature-request` — `apps/api/src/modules/legal/legal.service.ts:1060`
- `welcome-intranet` — `apps/api/src/infrastructure/email/email.service.ts:5`

## Disposition scaffold

Every key is listed in [`email-templates.json`](./email-templates.json) → `dispositionScaffold` with `disposition: pending`. Fill with `migrate` | `replace` | `repair` | `obsolete` per Epic 0.2 / acceptance criteria.

## sendEmail / sendRequiredEmail call sites (non-test)

- `apps/api/src/modules/cash-advance/cash-advance.service.ts:524` — `void sendEmail({ to: email, ...mail });`
- `apps/api/src/modules/cash-advance/cash-advance.service.ts:665` — `void sendEmail({ to: row.employee.email, ...approvedMail });`
- `apps/api/src/modules/cash-advance/cash-advance.service.ts:681` — `void sendEmail({ to: recipients, ...hrMail });`
- `apps/api/src/modules/cash-advance/cash-advance.service.ts:736` — `void sendEmail({ to: row.employee.email, ...mail });`
- `apps/api/src/modules/opportunities/opportunities.service.ts:81` — `await Promise.all(to.map((addr) => sendEmail({ to: addr, ...email })));`
- `apps/api/src/modules/opportunities/opportunities.service.ts:114` — `await Promise.all(to.map((addr) => sendEmail({ to: addr, ...email })));`
- `apps/api/src/modules/revenue-opportunities/opportunities.service.ts:81` — `await Promise.all(to.map((addr) => sendEmail({ to: addr, ...email })));`
- `apps/api/src/modules/revenue-opportunities/opportunities.service.ts:114` — `await Promise.all(to.map((addr) => sendEmail({ to: addr, ...email })));`
- `apps/api/src/modules/expenses/expense-reports.service.ts:461` — `void sendEmail({ to: updated.employee.email, ...email });`
- `apps/api/src/modules/expenses/expense-reports.service.ts:488` — `void sendEmail({ to: deskRecipients, ...deskEmail });`
- `apps/api/src/modules/expenses/expense-reports.service.ts:1111` — `void sendEmail({ to: approverEmail, ...email });`
- `apps/api/src/modules/expenses/expense-reports.service.ts:1141` — `void sendEmail({ to: desk, ...deskEmail });`
- `apps/api/src/modules/expenses/expense-reports.service.ts:1325` — `void sendEmail({ to: updated.employee.email, ...email });`
- `apps/api/src/modules/expenses/expense-reports.service.ts:1350` — `void sendEmail({ to: deskRecipients, ...deskEmail });`
- `apps/api/src/modules/expenses/expense-reports.service.ts:1392` — `void sendEmail({ to: nextEmail, ...email });`
- `apps/api/src/modules/expenses/expense-reports.service.ts:1492` — `void sendEmail({ to: updated.employee.email, ...email });`
- `apps/api/src/modules/expenses/expense-reports.service.ts:1571` — `void sendEmail({ to: updated.employee.email, ...email });`
- `apps/api/src/modules/expenses/expense-settings.service.ts:416` — `await sendEmail({ to: user.email, ...email });`
- `apps/api/src/modules/expenses/expense-items.service.ts:226` — `void sendEmail({ to: manager.email, ...email });`
- `apps/api/src/modules/expenses/expense-items.service.ts:359` — `void sendEmail({ to: expense.employee.email, ...email });`
- `apps/api/src/modules/expenses/expense-items.service.ts:405` — `void sendEmail({ to: expense.employee.email, ...email });`
- `apps/api/src/modules/expenses/expense-items.service.ts:436` — `void sendEmail({ to: expense.employee.email, ...email });`
- `apps/api/src/modules/leads/leads.service.ts:123` — `await sendEmail({ to: bucket.owner.email, ...email });`
- `apps/api/src/modules/projects/projects.service.ts:1229` — `await sendEmail({`
- `apps/api/src/modules/survey-forms/survey-forms.service.ts:1024` — `void sendEmail({ to: emails, ...email });`
- `apps/api/src/modules/certificates/certificates.service.ts:122` — `void sendEmail({ to: recipient.email, ...email });`
- `apps/api/src/modules/visa/visa.service.ts:946` — `await sendEmail({`
- `apps/api/src/modules/hrms/attendance-notification.service.ts:53` — `void sendEmail({`
- `apps/api/src/modules/hrms/attendance-notification.service.ts:74` — `void sendEmail({`
- `apps/api/src/modules/hrms/attendance-notification.service.ts:92` — `void sendEmail({`
- `apps/api/src/modules/hrms/attendance-notification.service.ts:102` — `void sendEmail({`
- `apps/api/src/modules/hrms/attendance-notification.service.ts:112` — `void sendEmail({`
- `apps/api/src/modules/hrms/attendance-notification.service.ts:126` — `void sendEmail({`
- `apps/api/src/modules/hrms/attendance-notification.service.ts:141` — `void sendEmail({`
- `apps/api/src/modules/hrms/attendance-notification.service.ts:160` — `void sendEmail({`
- `apps/api/src/modules/hrms/attendance-notification.service.ts:171` — `void sendEmail({`
- `apps/api/src/modules/it-crm/it-crm.service.ts:1685` — `await sendEmail({`
- `apps/api/src/modules/it-crm/it-crm.service.ts:1717` — `await sendEmail({`
- `apps/api/src/modules/crm-shared/crm-notifications.ts:111` — `void sendEmail({ to: emails, ...mail });`
- `apps/api/src/modules/crm-shared/crm-reminders.ts:178` — `void sendEmail({ to: emails, ...mail });`
- `apps/api/src/modules/crm-shared/crm-reminders.ts:239` — `void sendEmail({ to: emails, ...mail });`
- `apps/api/src/modules/crm-shared/crm-reminders.ts:292` — `void sendEmail({ to: emails, ...mail });`
- `apps/api/src/modules/crm-shared/crm-reminders.ts:397` — `void sendEmail({ to: emails, ...mail });`
- `apps/api/src/modules/it-billing/it-billing.reminders.ts:107` — `void sendEmail({ to: sub.owner.email, ...mail });`
- `apps/api/src/modules/it-access/it-access.service.ts:415` — `void sendEmail({ to: approver.email, ...mail });`
- `apps/api/src/modules/it-access/it-access.service.ts:500` — `void sendEmail({ to: row.employee.email, ...mail });`
- `apps/api/src/modules/it-access/it-access.service.ts:574` — `void sendEmail({ to: row.employee.email, ...mail });`
- `apps/api/src/modules/it-access/it-access.service.ts:654` — `void sendEmail({ to: row.employee.email, ...mail });`
- `apps/api/src/modules/it-access/it-access.service.ts:715` — `void sendEmail({ to: existing.employee.email, ...mail });`
- `apps/api/src/modules/survey/survey.service.ts:1020` — `void sendEmail({ to: emails, ...email });`
- `apps/api/src/modules/legal/legal.service.ts:589` — `await sendEmail({`
- `apps/api/src/modules/revenue-leads/leads.service.ts:123` — `await sendEmail({ to: bucket.owner.email, ...email });`
- `apps/api/src/modules/helpdesk/helpdesk-github-sync.service.ts:270` — `void sendEmail({ to: ticket.createdBy.email, ...tpl });`
- `apps/api/src/modules/helpdesk/helpdesk.service.ts:252` — `await sendEmail({`
- `apps/api/src/modules/helpdesk/helpdesk.service.ts:267` — `await sendEmail({`
- `apps/api/src/modules/helpdesk/helpdesk.service.ts:414` — `await sendEmail({`
- `apps/api/src/modules/ninety-day/ninety-day.service.ts:598` — `await sendEmail({`
- `apps/api/src/modules/travel/travel.service.ts:409` — `void sendEmail({ to: approverEmail, ...email });`
- `apps/api/src/modules/travel/travel.service.ts:642` — `void sendEmail({ to: nextEmail, ...email });`
- `apps/api/src/modules/travel/travel.service.ts:681` — `void sendEmail({ to: Array.from(recipients), ...email });`
- `apps/api/src/modules/travel/travel.service.ts:717` — `void sendEmail({ to: deskRecipients, ...deskEmail });`
- `apps/api/src/modules/travel/travel.service.ts:787` — `void sendEmail({ to: request.employee.email, ...email });`
- `apps/api/src/modules/travel/travel.service.ts:968` — `void sendEmail({ to: manager.email, ...email });`
- `apps/api/src/modules/leave/leave.service.ts:747` — `void sendEmail({ to: approver.email, ...email });`
- `apps/api/src/modules/leave/leave.service.ts:763` — `void sendEmail({ to: manager.email, ...email });`
- `apps/api/src/modules/leave/leave.service.ts:789` — `void sendEmail({ to: targetUser.email, ...email });`
- `apps/api/src/modules/leave/leave.service.ts:821` — `void sendEmail({ to: deskRecipients, ...deskEmail });`
- `apps/api/src/modules/leave/leave.service.ts:1254` — `void sendEmail({ to: delegate.email, ...email });`
- `apps/api/src/modules/leave/leave.service.ts:1284` — `void sendEmail({ to: manager.email, ...email });`
- `apps/api/src/modules/leave/leave.service.ts:1369` — `void sendEmail({ to: request.employee.email, ...email });`
- `apps/api/src/modules/leave/leave.service.ts:1401` — `void sendEmail({ to: deskRecipients, ...deskEmail });`
- `apps/api/src/modules/leave/leave.service.ts:1426` — `void sendEmail({ to: nextUser.email, ...email });`
- `apps/api/src/modules/leave/leave.service.ts:1507` — `void sendEmail({ to: request.employee.email, ...email });`
- `apps/api/src/modules/leave/leave.service.ts:1582` — `void sendEmail({ to: manager.email, ...email });`
- `apps/api/src/infrastructure/email/email.service.ts:81` — `export async function sendEmail(input: SendEmailInput): Promise<void> {`
- `apps/api/src/infrastructure/email/email.service.ts:107` — `await sendEmail({`

## Outside the adapter

Supabase Auth originates forgot-password and magic-link mail (`auth.service` → `resetPasswordForEmail` / `signInWithOtp`). Those paths are **not** in the adapter call count — see [`AUTH_SUPABASE.md`](./AUTH_SUPABASE.md).
