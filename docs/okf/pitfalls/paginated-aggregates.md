---
type: Pitfall
title: Paginated aggregates
description: A total/count/sum must come from a server roll-up endpoint, never from reducing the rows currently loaded in the client.
tags: [backend, frontend, pagination]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Paginated aggregates

## Rule

Never compute a total/count/sum by reducing the rows currently loaded in the
client — a kanban column or table only holds one page. Totals that must cover
the whole set come from a server roll-up endpoint (see `GET
/investors/pipeline-totals`).

## Why

Bitten on the investor pipeline column totals (showed the one loaded card's
amount, not all 199).

## Reference

`GET /investors/pipeline-totals`.
