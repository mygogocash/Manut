---
type: Pitfall
title: Tailwind static scan
description: Dynamic class strings must be full literals Tailwind can see in source, or they get purged.
tags: [frontend, tailwind]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Tailwind static scan

## Rule

Dynamic class strings must be full literals Tailwind can see in source. Keep
a literal `Record<key, "border-t-blue-500">` map instead.

## Why

`border-t-${color}` or `\`bg-${x}-500\`` get purged → no style.

## Reference

See the investor pipeline + stage colours.
