---
type: Pitfall
title: Express route order
description: Literal paths must register before `:param` routes or they are shadowed.
tags: [backend, express, routing]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Express route order

## Rule

Routes register on the `Router()` at the bottom of the controller. **Literal
paths must come before `:param` routes.** Express matches in order, so
`/import-template` is eaten by `/:id` if listed second.

## Why

This has been hit twice. The failure is silent at build time and at type-check
time: the literal route simply never receives a request, and the `:id`
handler gets called with `id === "import-template"`.

## Reference

`apps/api/src/modules/<module>/<module>.controller.ts` — the route block at the
bottom of any controller. Once `/patterns/` documents exist for a module, its
`apis.md` (generated in PR2) lists routes in registration order, which makes a
violation visible on inspection.
