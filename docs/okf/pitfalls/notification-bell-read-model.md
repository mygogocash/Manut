---
type: Pitfall
title: Notification bell is (mostly) a server read-model, not a table.
description: The notification bell is mostly a server read-model recomputed on demand from source tables, not a stored table of notification rows.
tags: [backend, dashboard, notifications]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Notification bell is (mostly) a server read-model, not a table.

## Rule

Notification bell is (mostly) a server read-model, not a table. Prefer the
read-model: to surface something computable from source tables, add/extend a
stats query, don't insert a record.

**Exception — event notifications that can't be recomputed** (a status
change / comment happened): the `it-crm-update` group reads the
`ItCrmNotification` store (`dashboard.repository.ts`
`getItCrmNotificationsForUser`), written best-effort by
`it-crm-notifications.ts` `notifyItTaskEvent` from the shared
`projects.service` write paths gated `team==='it'`.

Even then, **read/unread stays the localStorage per-id seen set**
(`seen-ids-v2`, stable ids) — the store persists the event, the seen-set
governs the badge — never a timestamp threshold (that re-showed urgent items
every few hours, #bug 2026-05-26).

## Why

`notification-bell.tsx` renders `approval` / `urgent` / `survey` / `it-crm`
(deadlines) / `news` groups built from the dashboard stats payload — each
recomputed on demand server-side (e.g. `dashboard.repository.ts`
`getOpenSurveyFormsForUser`; `getItCrmRemindersForUser` = self-scoped
upcoming/overdue project + task deadlines).

## Reference

`notification-bell.tsx`; `dashboard.repository.ts`
(`getOpenSurveyFormsForUser`, `getItCrmRemindersForUser`,
`getItCrmNotificationsForUser`); `it-crm-notifications.ts`
`notifyItTaskEvent`; `projects.service`; `seen-ids-v2`; #bug 2026-05-26.
