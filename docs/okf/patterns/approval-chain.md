---
type: Playbook
title: Approval chain
description: Model a configurable, ordered approval workflow with a per-step config table, a per-request decision snapshot, and authorization enforced in a service-level `assertCanActOnStep` check.
tags: [backend, workflow]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Approval chain

Travel is the canonical template; Cash Advance mirrors it.

## Shape

A `*ApprovalStep` config table (ordered, `approverType: manager|user`,
conditional fields) + a per-request `*ApprovalDecision` snapshot +
`currentStepOrder` on the request.

On submit, evaluate each step's conditions against the request and snapshot
the matching ones as decision rows; empty chain → fall back to a single
manager step (submitter's `reportingTo`). Approve marks the current
decision, advances to the next pending step (emailing that approver) or
finalises (emailing applicant + an admin-managed recipient list stored in
`SystemSetting`). Conditions seen: amount band, payout-mode / category
filter, submitter `skipWhen`/`onlyWhen`.

**Authz**: open the approve/reject route to any reader and enforce in
`assertCanActOnStep` (HR-with-approve, or the step's manager/assigned user)
— `requirePermission` alone can't express "the current step's manager."

## Related

The step config table is a natural candidate for
[/patterns/configurable-list.md](/patterns/configurable-list.md) if the step
definitions themselves need to become admin-editable.

## Reference

`travel`, `cash-advance`; `assertCanActOnStep`.
