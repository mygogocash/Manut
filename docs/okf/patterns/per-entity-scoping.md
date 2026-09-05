---
type: Playbook
title: Per-entity scoping
description: Scope a model to an entity via a cuid `entityId` column, selected in the UI and looked up by `code` in seed migrations.
tags: [backend, hr, scoping]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Per-entity scoping

Used by Leave Policies, Public Holidays.

## Shape

The model holds `entityId` (cuid). UI uses an Entity selector + `__all__`
filter. Migrations that seed for a specific entity look the id up by `code`
(`SELECT id FROM entities WHERE code = 'TH'`) — entity ids are cuid-generated
by the prisma seed, not fixed.

## Reference

Leave Policies, Public Holidays.
