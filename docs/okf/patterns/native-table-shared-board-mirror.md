---
type: Playbook
title: Native-table / shared-board mirror
description: Heal a native-table CRM row into the shared `projects` board lazily on first open in `projectRepository.findById`, idempotently and concurrency-safely.
tags: [backend, crm, database]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Native-table / shared-board mirror

Legal & IT CRM open the shared `/projects/:id` board.

## Shape

The `*_native_workspace` migrations copied pre-existing `team='legal'`/`'it'`
rows into `legal_*`/`it_*` with the SAME id, but rows created afterwards live
only in the native table → the shared board 404s.

Fix is a lazy heal in `projectRepository.findById`: on a miss, mirror the
native row (+ members/columns/tasks) into `projects` on first open. Idempotent
+ concurrency-safe.

## Reference

`projectRepository.findById`; `*_native_workspace` migrations.
