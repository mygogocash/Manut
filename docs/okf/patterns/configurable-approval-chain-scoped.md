---
type: Playbook
title: Configurable approval chain with a super-admin guard
description: "A generic approval-chain config pair plus a per-record decision snapshot, scoped to two flows only, owning the approval segment and nothing else."
tags: [backend, workflow, rbac]
status: stable
verified:
  - at: 2026-08-24
    by: kunanon-ui
stale_after: 2027-02-24
---

# Configurable approval chain with a super-admin guard

## Shape

When "who approves this" must stop being code:

1. A generic `approval_chains` / `approval_chain_steps` config pair keyed by a
   scope string, plus an `approval_chain_decisions` **per-record snapshot** taken
   on submit. The snapshot is the whole point: editing a chain must never move a
   record already in flight, which is what every existing configurable chain here
   (travel, leave, expenses, cash advance) already does. Scope is an explicit
   union in `chain.types.ts`: ONLY `project_request` and `proposal` use this.
2. The chain owns the **approval segment only**. Escalate, return, reopen and
   complete stay coded transitions — none is "the next step in an order", and an
   escalation target is per-request data, not config. Where an approval lands
   when a later stage remains goes in a SEPARATE map
   (`CHAIN_ADVANCE_TARGET`), so the allowed-actions helper keeps describing what
   a person may click.
3. **Authority becomes identity**: being the person the current stage names IS
   the authority, so the capability maps to a null permission code. The module
   super-grant still decides any stage, so a chain whose approver has left is
   never a dead end.
