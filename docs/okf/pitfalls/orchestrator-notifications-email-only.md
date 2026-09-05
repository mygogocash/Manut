---
type: Pitfall
title: AI Orchestrator notifications are email-only
description: "Request Tracking already surfaces every orchestrator transition in the bell read-model, so the only gap was email — never insert bell rows for orchestrator events."
tags: [backend, notifications]
status: stable
verified:
  - at: 2026-08-24
    by: kunanon-ui
stale_after: 2027-02-24
---

# AI Orchestrator notifications are email-only

## Rule

Do NOT insert notification-bell rows for AI Orchestrator events. The Request
Tracking pipeline already surfaces every transition live from the dashboard
read-model: reviewers see pending gates in the `approval` group, submitters see
approve / reject / in-dev in the `urgent` group. The only real gap was email,
which `notifyOrchestratorEvent` fills best-effort AFTER `logAudit` at each
transition.

## Why

The bell is a recomputed read-model, not a table. Writing rows for something
already derivable double-reports the event and then drifts from the source of
truth. Email is the additive channel: recipients are the stage's configured
reviewers, plus the submitter, plus the admin CC list held in the SystemSetting
`orchestrator.reminder_recipients`. It reuses the shipping `crmTaskUpdateEmail`
template, because a brand-new templateId would silently fail as
TEMPLATE_NOT_FOUND on the email service.
