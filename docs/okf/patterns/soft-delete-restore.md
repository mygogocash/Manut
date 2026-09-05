---
type: Playbook
title: Soft delete + restore/remove (and the IDOR trap)
description: Add `deletedAt`, expose restore/permanent routes, and enforce owner-or-HR in the service, not the route.
tags: [backend, rbac, security]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Soft delete + restore/remove (and the IDOR trap)

Used by users, accounting, leave, travel, expenses, cash-advance, visa.

## Steps

1. Add a `deletedAt DateTime?` column (`@@index([deletedAt])` on hot tables);
   filter every list/count with `excludeDeleted()` and turn the destructive
   delete into `softDeleteUpdate()` (both from
   `apps/api/src/infrastructure/soft-delete.ts`; `restoreUpdate()` nulls it back).
2. Expose `POST /<resource>/:id/restore` + `DELETE /<resource>/:id/permanent`.
3. **The default `findById` excludes deleted rows**, so restore/remove MUST
   re-fetch via a dedicated `find*ByIdIncludingDeleted` repo method — otherwise
   restore always 404s.
4. **Enforce owner-or-HR in the service, not at the route.**
   `requirePermission("<x>:create")` lets *any* employee hit restore; the
   service then checks `existing.employeeId === actorId ||
   permissions.includes(<hr-perm>)` and throws `ForbiddenException` otherwise
   (leave→`leave:hr-read`, travel→`travel:hr-read`,
   expenses→`expense:hr-delete`, cash-advance→`cash-advance:approve`; users
   guard cross-admin edits via `assertActorMayManageAdminUser`). Skipping that
   service check is an IDOR — a user could restore or destroy another user's
   record by guessing an id.

## Known deviation

The `visa` restore/permanent path is gated only by `visa:manage` and does not
carry the owner check. `visa:manage` is already HR-only, but do not copy that
shape into an owner-scoped module.

## Reference

`cash-advance.service.ts` / `leave.service.ts` `restore*`.
