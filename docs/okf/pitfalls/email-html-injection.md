---
type: Pitfall
title: Email HTML injection
description: Every caller-supplied string interpolated into an email template HTML body must go through `escapeHtml()`.
tags: [backend, email, security]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Email HTML injection

## Rule

Every caller-supplied string interpolated into an email template HTML body
must go through `escapeHtml()` (`apps/api/src/infrastructure/email/templates.ts`).
Plain-text `subject:` lines are exempt. `escapeHtml` tolerates
`null`/`undefined`.

## Why

Free-text fields (notes, reasons, bank details, names) reach approver/HR
inboxes — unescaped they inject HTML.

## Reference

`escapeHtml()` in `apps/api/src/infrastructure/email/templates.ts`.
