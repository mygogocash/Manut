---
type: Playbook
title: Timezone-correct daily records
description: Store the employee's IANA zone on the row and instants in UTC, deriving every date/time calculation through the zone-aware helpers instead of comparing a UTC instant to a local `HH:mm`.
tags: [backend, attendance, timezone]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Timezone-correct daily records

Attendance.

## Shape

When a row is "one per employee per calendar day," store the employee's IANA
zone *on the row* (`employeeTimezone`) and the instants in UTC
(`checkInUtc`), and derive everything in zone via
`attendance-timezone.util.ts` (`resolveEmployeeTimezone` → user tz → policy
default → `Asia/Bangkok`; `zonedLocalToUtc` for wall-clock→UTC;
`computeLateMinutesInTimezone`).

Never compare a UTC instant against a shift's local `HH:mm` without the
zone — late-minutes and "which day" both break across the dateline. Cron
alerts resolve "today" per-employee-zone and guard re-sends idempotently.

## Reference

`attendance.service.ts`; `/api/cron/attendance-missed-checks` +
`/attendance-manager-alerts`.
