---
type: Pitfall
title: Form-dialog reopen
description: Re-fetch the full detail on open whenever a form needs detail-only fields a list-item shape lacks.
tags: [frontend, forms]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Form-dialog reopen

## Rule

Parents pass slim `*ListItem` shapes. Always re-fetch the full detail on open
if your form needs detail-only fields.

## Why

Or you'll silently overwrite real data on save.
