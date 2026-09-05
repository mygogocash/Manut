# Bundle log

## 2026-08-27

**+1 pattern, +1 pitfall — approval-chain routing and ordering.**

`/patterns/submitter-conditional-routing.md` documents `skipWhenSubmitterIds` /
`onlyWhenSubmitterIds`, which route a chain approver's own requests elsewhere.
Written because the expenses module has **no self-approval guard**, so those
fields are the only thing preventing an approver signing off their own report —
and because three ways to get the config wrong all produce something that looks
like a working chain: an empty `categoryFilter` matching every category, losing
`allowance` from every filter (which sends allowance reports straight to
`reimbursed` with no approval), and a no-match submitter falling back silently to
a single manager step.

`/pitfalls/approval-step-order-gaps.md` records the "1, 3, 4" Order column:
`deleteApprovalStep` never renumbered the survivors of a `@unique`, user-visible
`order`. Sequencing was unaffected — the chain compares steps relative to each
other — so only the page looked broken.

## 2026-08-17

**Creation.** Bundle established with the 17 patterns and 11 pitfalls lifted
from `CLAUDE.md`, plus conformance, link-integrity, and coverage gates. No
existing documentation was moved or deleted — `CLAUDE.md`, `AGENTS.md`,
`CONTEXT.md`, and `docs/` are unchanged. Root de-duplication and the monolith
split land in later PRs per the design spec.
