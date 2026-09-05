# Delta: current → target

## Current state

**Greenfield.** Zero product analytics today. No `posthog` / `mixpanel` / `amplitude` / `segment` package in any workspace. The only "analytics" hits in the codebase are the `survey:analytics` permission and the `SurveyAnalyticsTab` component — both are domain features (survey results), not user telemetry.

This means the delta is trivially equal to the target plan: **every event is an ADD**.

## Add (new — not tracked today)

| Event | Category | Why |
|---|---|---|
| `session.started` | lifecycle | Anchor for DAU/WAU and stitching multi-tab sessions. |
| `session.ended` | lifecycle | Bounded session length; voluntary signouts only. |
| `user.created` | lifecycle | HR onboarding signal. Drives entity headcount snapshot. |
| `user.deactivated` | lifecycle | Offboarding; needed for active-user math. |
| `module.viewed` | navigation | **Workhorse for module-adoption + dead-weight.** Single event with `module` enum across all 18 modules. |
| `search.performed` | navigation | Optional — only after global search ships. |
| `leave_request.started` | core_value | Funnel start for drop-off analysis. |
| `leave_request.submitted` | core_value | Primary value action for Leave. |
| `leave_request.cancelled` | core_value | Form abandonment. |
| `leave_request.approved` | core_value | Manager flow. |
| `leave_request.rejected` | core_value | Manager flow. |
| `expense.started` | core_value | Funnel start. |
| `expense.submitted` | core_value | Primary value action for Expenses. |
| `expense.cancelled` | core_value | Abandonment. |
| `expense.approved` | core_value | Manager flow. |
| `travel_request.started` | core_value | Funnel start. |
| `travel_request.submitted` | core_value | Primary value action for Travel. |
| `travel_request.cancelled` | core_value | Abandonment. |
| `travel_request.approved` | core_value | Manager flow. |
| `payroll.run_started` | core_value | Admin-only critical action. |
| `payroll.run_completed` | core_value | Pairs with `run_started` for runtime + success rate. |
| `payroll.imported` | core_value | xlsx ingest path; surfaces error_count for data-quality dashboards. |
| `agreement.uploaded` | core_value | HRMS signal. |
| `agreement.downloaded` | core_value | Pair with `document.downloaded`? Kept separate: signed-URL flow has distinct ownership rules. |
| `aria.message_sent` | core_value | AI usage adoption. |
| `aria.response_received` | core_value | Latency + error budget for the AI feature. |
| `aria.feedback_given` | core_value | Quality signal. |
| `message.sent` | core_value | Messaging adoption + dead-weight check. |
| `project.created` | core_value | |
| `task.created` | core_value | |
| `task.status_changed` | core_value | Throughput proxy. |
| `lead.created` | core_value | Sales CRM top of funnel. |
| `lead.converted` | core_value | Conversion. |
| `deal.created` | core_value | |
| `deal.stage_changed` | core_value | Pipeline movement. |
| `deal.won` | core_value | |
| `deal.lost` | core_value | Includes `lost_reason_code`. |
| `partner.created` | core_value | |
| `partner.note_added` | core_value | Partner CRM activity proxy. |
| `survey.opened` | core_value | Funnel start. |
| `survey_response.submitted` | core_value | Completion. |
| `course.started` | core_value | Learning funnel start. |
| `course.completed` | core_value | Learning value. |
| `visa_request.submitted` | core_value | |
| `benefit.enrolled` | core_value | |
| `application.received` | core_value | Inbound careers funnel. |
| `document.viewed` | core_value | Legal / dataroom / payroll-slip access. |
| `document.downloaded` | core_value | Pair with `document.viewed`. |
| `role.assigned` | configuration | RBAC change audit + adoption. |
| `role.revoked` | configuration | |
| `profile.updated` | configuration | |
| `integration.connected` | configuration | |
| `form.validation_failed` | error | 422/400 signal — finds confusing forms. |
| `permission.denied` | error | 403 signal — finds mis-scoped UI. |

**Total target events: 49.** All ADD.

## Remove (tracked today, shouldn't be)

None. Greenfield.

## Rename (tracked but wrong name)

None. Greenfield.

## Keep (tracked today, unchanged in target)

None. Greenfield.

## Change (tracked but wrong shape)

None. Greenfield.

## Coverage check

ADD (49) + RENAME (0) + KEEP (0) = 49 = total target events. ✅

## Implementation backlog

Suggested order, smallest viable slice first:

1. **Wire the SDK + identify/group plumbing** — pick PostHog (recommended for low-volume self-serve analytics with group support), install in `apps/web`, gate with `NODE_ENV === "production"`, fire `identify()` from `AuthProvider` (it already reloads `/me` on mount + visibility-return — perfect identify hook), fire `group()` for entity. Add a thin `tracking` helper module in `apps/web/src/lib/tracking.ts` and `apps/api/src/lib/tracking.ts` so events have a single chokepoint.
2. **Lifecycle + navigation** — `session.started`, `module.viewed`. This alone answers the "which modules do people use" question.
3. **Funnel coverage for the four highest-traffic forms** — Leave, Expense, Travel, Aria. Pairs of `*.started` / `*.submitted` / `*.cancelled` reveal drop-offs.
4. **Manager / admin flows** — approvals, payroll runs, role grants.
5. **Long tail** — Survey, Learning, Visa, Benefits, Careers. These are exactly the modules most likely to be dead weight; instrument last so the absence of events itself is the signal.
6. **Snapshot sync cron** — daily Cloud Run job that posts updated traits via the `/identify` and `/groups/identify` endpoints.

## Non-goals for v1

- Page views / route-change tracking.
- Per-component click tracking.
- Front-end performance metrics (use a separate APM like Sentry instead).
- Per-keystroke search.
- Accoil / Mixpanel / Amplitude. PostHog covers 100% of the stated diagnostic goals at zero cost for this volume.

## Open questions for the owner

1. **Destination** — confirm PostHog. If finance / IT prefers Mixpanel or Amplitude, the plan is destination-agnostic; only the SDK wrapper changes.
2. **Consent / disclosure** — internal users on a corporate tool: a one-line note in the employee handbook is usually enough. Confirm with HR / Legal before the prod toggle flips.
3. **Retention window** — PostHog defaults to 7y for events. Likely want 1–2y for an internal tool. Set at project-creation time.
4. **Cron secret reuse** — the snapshot-sync cron should hit a new `/api/cron/sync-telemetry` route. Reuse the existing `X-Cron-Secret` header pattern.
