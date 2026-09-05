---
type: Playbook
title: Announce a record to the dashboard surfaces
description: Broadcast a record org-wide by writing to the existing Company Wall, Company News, Company Date, and notification-bell surfaces instead of inventing a new feed.
tags: [backend, dashboard, notifications]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Announce a record to the dashboard surfaces

Survey Forms publish.

## Shape

To broadcast something org-wide, write to the existing surfaces rather than
inventing a feed: a Company Wall post (`type: "survey"`), a Company News
item, and a Company Date (deadline), each stamped with `linkUrl` for the
dashboard deep-link, plus the notification-bell read-model (see
[/pitfalls/notification-bell-read-model.md](/pitfalls/notification-bell-read-model.md)).

Each write is permission-guarded independently (`WALL_CREATE` /
`NEWS_CREATE` / `ADMIN_MANAGE`) and wrapped in try/catch so one failing
surface doesn't abort publish.

Announcement defaults live in a single `SystemSetting` row
(`survey.announcement_defaults`) with a hardcoded fallback; a manual `POST
/:id/announce` re-broadcasts on demand.

## Reference

`survey-forms.service.ts` `announcePublishedForm`.
