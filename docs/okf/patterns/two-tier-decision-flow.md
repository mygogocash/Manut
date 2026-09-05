---
type: Playbook
title: Two-tier decision flow with non-blocking questions
description: "Approval by a named person, where a reviewer can chase missing detail without stalling the record — positional transitions plus a child question table that moves nothing."
tags: [backend, workflow]
status: stable
verified:
  - at: 2026-08-24
    by: kunanon-ui
stale_after: 2027-02-24
---

# Two-tier decision flow with non-blocking questions

Proposals.

## Shape

1. The state machine stays **positional** — a from/action to-state table,
   nothing computed. Resist adding an `awaiting_information` status: both tiers
   can ask, so passing from it would resolve differently depending on who asked,
   and it hides which tier the record is actually at. Instead a question writes a
   row in `proposal_information_requests` and moves NOTHING; "waiting on 2
   answers" is a filtered relation count on the list query.
2. **Identity is not a permission.** Answering maps to a null permission code
   and gates on `assignedToId === actorId`; the module super-grant satisfies
   every permission gate but must NOT satisfy identity.
3. Approvers are SystemSetting rows (`proposals.first_reviewer`,
   `proposals.final_approver`) re-resolved on every read, falling back to
   permission holders then system Admins, so a setting naming somebody who left
   resolves to nobody rather than a stale name.
