---
type: Playbook
title: Bulk select-and-act
description: Resolve bulk actions through the same `where` builder the list uses, accepting either explicit ids or an `allMatching` + filter selection, with owner-scope ANDed in for non-read-all callers.
tags: [backend, rbac]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Bulk select-and-act

Used by the investors list.

## Shape

Selection is EITHER explicit `ids` OR `allMatching: true` + a `filter`
("select all N matching"), resolved through the SAME `buildInvestorWhere`
the list uses so the action hits exactly the visible rows. Owner-scope is
ANDed into the where for non-`read-all` callers — never validate ids
one-by-one; a foreign id just matches nothing.

## Reference

`POST /investors/bulk-update` / `bulk-delete`.
