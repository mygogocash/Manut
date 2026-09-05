---
type: Playbook
title: Configurable list (admin-editable enum)
description: Turn a hardcoded enum into a user-editable, ordered list backed by a key-keyed config table, a CRUD module, and a Manage dialog.
tags: [backend, frontend, config]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Configurable list (admin-editable enum)

Used by investor pipeline stages, investor types, cash-advance approval
steps.

## Shape

When a hardcoded enum needs to become user-editable, follow this shape.

## Steps

1. An id/key-keyed config table (`key` PK or `order @unique`, `label`,
   `sortOrder`, no FK from the consuming row — the row stores the key as an
   open string so the list stays freely editable).
2. An `/api/<x>` module with list/create/update/delete + a two-phase
   `reorder` (park at negative orders, then write 1..N to dodge the unique
   constraint).
3. Gate writes on an EXISTING module perm (`investors:update`,
   `cash-advance:approve`) — don't mint new permission codes + a seed
   migration unless the access boundary genuinely differs.
4. Web: a `use<X>` hook that fetches once + exposes a `label(key)` resolver
   (fallback: prettify the key), feeding every picker/filter/group-label.
5. A Manage dialog (add/rename/delete/reorder).

## Related

Cash Advance's approval steps
([/patterns/approval-chain.md](/patterns/approval-chain.md)) are a
consuming example of this shape.

## Reference

`investor-pipeline-stages`, `investor-types`.
