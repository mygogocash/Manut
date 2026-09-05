---
type: Playbook
title: Two-row header xlsx
description: Build composite header keys (`row1[i] || row2[i]`) when an xlsx template's second row carries sub-headers under a merged parent header.
tags: [backend, import, xlsx]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Two-row header xlsx

Used by the payroll template.

## Shape

When row 2 holds sub-headers (e.g. `Meal` / `Transportation` under a merged
`Allowances`), build composite keys: `row1[i] || row2[i]`. Skip data rows
with no Employee Name so trailing reference rows don't get treated as data.

## Reference

Payroll xlsx template import.
