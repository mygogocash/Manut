# Product model — Intranet (TBH)

## Identity

- **Product**: Intranet (formerly "Nexora"; rebrand landed in #210)
- **URL**: intranet.thebinaryholdings.com
- **Category**: Internal B2B back-office suite (HR + CRM + ops)
- **Audience**: ~50 staff across The Binary Holdings entities (TBH Thailand, TBH India, TBH Vietnam, TBH Indonesia)
- **Stack**: Next.js 16 + Express 5 + Prisma + Supabase (Singapore)

## Tenancy model

Single-tenant in the SaaS sense: one customer (TBH group). But the app is multi-**entity** internally — staff belong to one of four legal entities. Most modules scope data and policy by `entityId`. Entity is the primary group dimension that matters for analytics; accounts/workspaces are not meaningful here.

## Primary value action

There is no single primary value action — this is a multi-module suite. Per module the value action is:

| Module | Primary value action |
|---|---|
| Leave | `leave_request.submitted` |
| Expenses | `expense.submitted` |
| Travel | `travel_request.submitted` |
| Payroll | `payroll.run` (admin) |
| HRMS | `agreement.uploaded`, `employee.created` |
| Aria | `aria.message_sent` (AI chat) |
| Messaging | `message.sent` |
| Projects | `project.created`, `task.created` |
| Sales CRM | `deal.created`, `lead.created` |
| Partner CRM | `partner.created` |
| Survey | `survey_response.submitted` |
| Learning | `course.completed` |
| Visa | `visa_request.submitted` |
| Benefits | `benefit.enrolled` |
| Legal / Dataroom | `document.viewed` |
| Careers | `application.received` |

## Modules in scope (sidebar order)

Workspace · Home · Aria · Messaging · Projects · Partner CRM · Sales CRM
People · Employees · Leave · Travel · Careers · Survey · Payroll · Legal · HRMS · Learning · Visa · Benefits

## Entity model

- `User` — `id`, `email`, `name`, `entityId?`, `roles[]`, `permissions[]`, `reportingTo?`, `isActive`
- `Entity` — `id`, `code` (TH/IN/VN/ID), `name` (TBH Thailand …)
- `Role` — `name`, `isSystem`, `permissions[]`
- Plus per-module entities (LeaveRequest, ExpenseClaim, TravelRequest, …)

## Goal of telemetry

> Understand **which modules people actually use**, **where they drop off**, and **which features are dead weight**.

Not for billing, not for marketing. Pure internal product diagnostics. Three questions every quarterly review should answer:

1. Module adoption — DAU/WAU/MAU per module per entity.
2. Funnel completion — for every form (leave, expense, travel, …): `started → submitted` rate.
3. Dead-weight detection — modules / sub-pages with near-zero event counts → candidate for removal.

## Current tracking state

Greenfield. No analytics SDKs installed. No `posthog` / `mixpanel` / `amplitude` / `segment` packages in any workspace. The only "analytics" code is `survey:analytics` permission + `SurveyAnalyticsTab` (a domain feature, not product telemetry).

## Notes for the design phase

- Single-tenant → no "account" group level. Top group is **entity**.
- ~50 users → volume cost is irrelevant. Even a 200-event-per-user-per-day budget is < 10K events / day.
- All users known and on payroll → PII (email, name) acceptable in traits.
- Internal-user exclusion not applicable (everyone IS internal). Instead exclude by `NODE_ENV !== "production"` so dev / staging traffic doesn't pollute the prod project.
