---
type: Pitfall
title: System Admin role
description: The System Admin bypass key is `isSystem && name === "Admin"`, never a permission-string check.
tags: [backend, rbac]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# System Admin role

## Rule

`isSystem && name === "Admin"` is the bypass key.

## Why

Don't gate on `permissions.includes("admin:manage")` for "is admin" checks —
custom roles can hold that perm.
