---
type: Playbook
title: xlsx imports
description: Coerce numeric xlsx cells with a helper that strips whitespace and digit-group separators before calling `Number(...)`, because plain `Number(v)` returns `NaN` on HR's templates.
tags: [backend, import, xlsx]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# xlsx imports

Used by payroll, agreements roster.

## Shape

Incoming numeric cells often arrive as `" 300,000.00 "`. Always coerce via
the `coerceNumber` helper (or equivalent) — strip whitespace incl. NBSP /
thin-space, drop digit-group separators (`,` `'` `_`), then `Number(...)`.
Plain `Number(v)` returns `NaN` for HR's templates.

## Reference

`coerceNumber`; payroll, agreements roster imports.
