---
type: Playbook
title: ARIA evals
description: Three eval suites under `apps/api/src/modules/aria/__tests__/*.eval.test.ts` guard the ARIA assistant's tool registry, knowledge lookup, and auto-sync workers as part of `pnpm test`.
tags: [backend, aria, testing]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# ARIA evals

Location: `apps/api/src/modules/aria/__tests__/*.eval.test.ts`.

## Shape

Three suites guard the assistant — tool registry (schema + RBAC), knowledge
lookup (keyword Q→article, 80% hit-rate floor), and auto-sync workers
(deterministic slugs + tag/perm shape). They run as part of `pnpm test` so a
tool definition change or scoring regression blocks PR merge.

When you add a new ARIA tool, add a happy-path + a permission-denied case to
`aria-tools.eval.test.ts`. When you tune retrieval thresholds, add or update
cases in `aria-retrieval.eval.test.ts` rather than relaxing the hit-rate
floor.

## Reference

`aria-tools.eval.test.ts`; `aria-retrieval.eval.test.ts`.
