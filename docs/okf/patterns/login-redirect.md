---
type: Playbook
title: Login redirect
description: Post-login routes to `/dashboard` for any non-employee-only account and to `/my-portal` for employee-only accounts, with no per-role `defaultRoute` lookup.
tags: [frontend, auth]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Login redirect

## Shape

Post-login goes to `/dashboard` for any non-employee-only account.
Employee-only accounts go to `/my-portal`. Don't reintroduce a per-role
`defaultRoute` lookup (#208 dropped that).

## Reference

#208.
