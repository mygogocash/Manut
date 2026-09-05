---
type: Pitfall
title: Migration consolidation
description: Squashing migrations into a fresh `0000_init` requires deleting every later migration whose schema is now part of it.
tags: [database, migrations]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Migration consolidation

## Rule

When squashing migrations into a fresh `0000_init`, also delete every later
migration whose schema is now part of `0000_init`.

## Why

Leftover migrations will re-attempt their CREATE / ALTER and fail.
