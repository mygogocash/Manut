---
type: Playbook
title: Fixed Asset Register
description: "Thailand statutory PPE ledger — depreciation is derived not stored, one event chain rebuilds past state, and account routing preflights fail-whole."
tags: [backend, accounting]
status: stable
verified:
  - at: 2026-08-24
    by: kunanon-ui
stale_after: 2027-02-24
---

# Fixed Asset Register

Thailand statutory PPE ledger, flag-gated by `ACCOUNTING_FIXED_ASSETS`. The rules
below are easy to break and hard to notice; each has regression tests.

## Shape

- **Depreciation is never stored.** It is derived from the register row on read
  so figures cannot drift. A period charge is closing accumulated minus opening
  accumulated, both valued through `assetStateAt` — never rate times days, which
  disagrees with the register at the memo floor, the final-period true-up and the
  opening anchor.
- **One event chain.** Disposal, impairment and transfer all change carrying
  amount. Each snapshots the asset state before it, and `fixed-asset-state.ts`
  rebuilds a past date from the EARLIEST event dated after it. A new event type
  shipping its own lookup means the second one to land silently restates the
  first — this bug already shipped once.
- **`openingBookValue` and `openingAsOfDate` are all-or-nothing.** A value with
  no date makes the engine depreciate from the start date instead of the anchor.
- **Account routing is category, then entity role, then throw**, and the run
  preflight is fail-whole via `assertFixedAssetAccountsConfigured`. Resolving
  lazily inside the posting loop lets an unmapped category be skipped,
  understating depreciation behind a successful-looking post.
