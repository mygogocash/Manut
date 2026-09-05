---
type: Pitfall
title: Permissions cache
description: AuthProvider only refreshes permissions on mount, login, visibility-return, and its periodic timer.
tags: [frontend, auth, caching]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Permissions cache

## Rule

`AuthProvider` reloads `/me` on mount, login, visibility-return, and the
periodic timer.

## Why

Adding a new role assignment without one of those triggers leaves React state
stale.
