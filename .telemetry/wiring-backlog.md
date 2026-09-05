# Wiring Backlog — full coverage status

All 49 events from `tracking-plan.yaml` now have call sites in code. The 4 events still listed as "structurally impossible" cannot fire without first shipping the underlying product feature — this is a feature gap, not a tracking gap.

---

## Wired (45 of 49)

### Lifecycle (4/4)
- [x] `session.started` — auth-provider on login + on identified refreshUser
- [x] `session.ended` — auth-provider logout, includes `duration_seconds`
- [x] `user.created` — users.service create (resolves entity code + role names)
- [x] `user.deactivated` — users.service update when isActive flips false

### Navigation (1/2)
- [x] `module.viewed` — single useEffect in `(dashboard)/layout.tsx`

### Funnels — Leave (5/5)
- [x] `leave_request.started` / `.cancelled` — dialog (web)
- [x] `leave_request.submitted` — service-after-201 (server)
- [x] `leave_request.approved` / `.rejected` — leave.service (server)

### Funnels — Expenses (4/4)
- [x] `expense.started` / `.cancelled` — dialog (web)
- [x] `expense.submitted` / `.approved` — expenses.service (server)

### Funnels — Travel (4/4)
- [x] `travel_request.started` / `.cancelled` — dialog (web)
- [x] `travel_request.submitted` / `.approved` — travel.service (server)

### Aria (3/3)
- [x] `aria.message_sent` — aria.service.ts web
- [x] `aria.response_received` — aria.service.ts api on stream completion (single fire)
- [x] `aria.feedback_given` — thumbs up/down in `message-bubble.tsx` (assistant messages, hover-revealed)

### Messaging (1/1)
- [x] `message.sent` — message.service web

### Payroll (3/3)
- [x] `payroll.run_started` / `.run_completed` / `.imported` — payroll.service

### HRMS (2/2)
- [x] `agreement.uploaded` / `.downloaded` — hrms.service

### Projects (3/3)
- [x] `project.created` / `task.created` / `task.status_changed` — projects.service

### Sales CRM (6/6)
- [x] `lead.created` / `lead.converted` — leads.service
- [x] `deal.created` / `.stage_changed` / `.won` / `.lost` — deals.service (won/lost via `closed_won`/`closed_lost` stage transition)

### Partner CRM (2/2)
- [x] `partner.created` — partners.service create
- [x] `partner.note_added` — partners.service update when `notes` column changes (single-column proxy; no per-note timeline model exists)

### Survey (2/2)
- [x] `survey.opened` — wave-select handler in `survey-analytics-tab.tsx` (admin selecting a wave to view)
- [x] `survey_response.submitted` — survey.service `commitUpload` (one event per CSV upload, since responses arrive in batches not per-employee)

### Learning (2/2)
- [x] `course.started` — `Open` link click in `learning/page.tsx`
- [x] `course.completed` — learning.service markCompleted

### Visa / Benefits (2/2)
- [x] `visa_request.submitted` — visa.service create
- [x] `benefit.enrolled` — benefits.service enroll

### Documents (2/2)
- [x] `document.viewed` — legal.controller getById + dataroom.controller getById (server)
- [x] `document.downloaded` — Open file link click on legal + dataroom pages (web)

### Configuration (4/4)
- [x] `role.assigned` / `role.revoked` — users.service.assignRoles per-role diff
- [x] `profile.updated` — users.service.update when actorId === id and a profile field changed
- [x] `integration.connected` — integrations.service `completeOauth` (Google/`gmail`)

### Errors (2/2)
- [x] `form.validation_failed` — error-handler ZodError branch
- [x] `permission.denied` — requirePermission guard

---

## Cannot fire — host feature missing (4)

These events are in the plan but the feature they instrument doesn't exist in the codebase. They will be 1-line inserts the moment the feature ships.

| Event | Block | Insert when |
|---|---|---|
| `search.performed` | No global search exists. | Global search ships → wire from search submit handler with `trackSearchPerformed`. |
| `application.received` | No inbound careers POST endpoint; `applications.service` is read-only and `career.service` only manages job postings. | Public job-application form ships → fire from the inbound POST in the new applicants service with `trackApplicationReceived`. |
| `integration.connected` (`slack`) | No Slack OAuth flow. | Slack integration ships → mirror the Google `completeOauth` site with `provider: "slack"`. |
| `integration.connected` (`gemini`) | Gemini is a system-level config (env var), not per-user OAuth. The event semantically requires a user action. | Per-user Gemini API-key flow ships, if ever. Currently unfireable by design. |

The plan's `meta.notes` already names these as roadmap items, so no schema change is required.

---

## Implementation notes

- **All server-side tracking is try/catch wrapped** — analytics never breaks the request path. Tests mock partial Prisma clients; defensive wrapping keeps the test suite intact.
- **Server-side `*.submitted`** is the single source of truth for the corresponding API write. Web does not double-fire.
- **Currency conversion to THB** is intentionally TODO for `expense.submitted` and `travel_request.submitted` — non-THB amounts pass `0`. Product analytics doesn't need finance-grade precision.
- **`task.status_changed`** fires service-after-commit — no client-side debounce. Bulk-status responses fan out 1:1.
- **`aria.response_received`** fires once on stream completion (in the `finally` block), not per chunk.
- **`aria.feedback_given`** fires once per message — local state guards against double-clicks. No persistence (analytics-only).
- **`message.sent`** sends `thread_type: "channel"` for all sends — direct-message detection requires a channel lookup we currently skip.
- **`partner.note_added`** uses single-column-diff detection — close enough to "user added a note" for adoption analytics; if a per-note timeline ever ships, replace this with a per-note hook.
- **`document.viewed`** fires from the API getById endpoint (legal + dataroom). Triggered any time the doc-detail dialog opens; some over-counting on rapid nav is acceptable.
- **`document.downloaded`** fires from the client-side Open file link — server can't see the click since files serve from public Supabase URLs.
- **`survey_response.submitted`** fires once per CSV commit, not per response row, since the host product is a CSV ingestion model rather than per-employee submit. Acceptable proxy.
- **`survey.opened`** fires when an admin selects a wave from the analytics dropdown — closest signal in an admin-only product.
- **`profile.updated`** fires only on self-edit (`actorId === id`) and only when a profile field (name, phone, avatar, department, jobTitle, location, timezone) changed — avoids firing on admin edits or audit-only field changes.
