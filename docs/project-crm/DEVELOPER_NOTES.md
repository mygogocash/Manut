# Project CRM Developer Notes

Things worth knowing before you change this module.

---

## 1. Where to make a change

| Change | Touch |
|---|---|
| New status or transition | `workflow.types.ts`, `TRANSITIONS` only |
| New action | `TRANSITIONS` + `capabilityFor()` + `CAPABILITY_PERMISSION` + the web `LABEL`/`ICON` tables |
| Change who may do something | `workflow-authority.ts`, nothing else |
| New endpoint | `projects.controller.ts`, **literal paths before `/:id`** |
| Email copy | `templates.ts`, escape every interpolated value |

Adding a transition should be a one-line change to a table. If you find yourself writing a new code path for an action, stop, the design is that every action shares `transition()`.

---

## 2. Rules that are not obvious

**Route order.** Express matches in declaration order. `/workflow/queue` must precede `/:id`, or `:id` swallows `"workflow"`. This has caused bugs here more than once.

**Authority belongs in the service.** `requirePermission` cannot express "the approver for the stage this project is currently in." Routes gate read access; the service decides the action. Putting a state- or ownership-dependent check at the route is how you write an IDOR.

**Never stamp `workflowUpdatedAt` on an ordinary edit.** It is written only when the status actually changes, which is what makes stage-aging exact rather than a guess derived from `updatedAt`.

**Email goes after the commit, never inside it.** A mail outage must not roll back an approval that already happened.

**Idempotency is a database constraint, not application logic.** `project_workflow_emails.idempotency_key` is `UNIQUE` and claimed before sending. Under concurrency the constraint is what saves you; an `if (alreadySent)` check would not.

**`null` in `CAPABILITY_PERMISSION` means no permission gate at all.** `UPLOAD_ATTACHMENT`, `COMMENT` and `VIEW_HISTORY` are currently `null`. That is safe only because none is wired to a route, attachments and comments go through existing Project CRM endpoints with their own gates. **Give them real codes before wiring them up.**

**Escape everything interpolated into an email body.** Free-text, comments, reasons, names, lands in approver inboxes. Unescaped, it injects HTML. `escapeHtml()` tolerates `null`/`undefined`. Plain-text subjects are exempt.

**Tailwind cannot see dynamic class strings.** `` `border-${colour}` `` gets purged. Use a literal map.

**Never compute a total from the rows on screen.** A page holds one page. Totals come from a server roll-up, `listQueue` returns every tab's count precisely so the client never has to add anything up.

---

## 3. Testing

Three suites, all part of `pnpm test`:

| File | Guards |
|---|---|
| `workflow.service.test.ts` | State machine, atomicity, logging, queue counts |
| `workflow-email.service.test.ts` | Idempotency, retry, token signing, escaping |
| `workflow-authority.test.ts` | All five roles, every "Can" and every "Cannot" |

**When you change the role matrix, add cases to `workflow-authority.test.ts`, do not relax existing ones.** The "Cannot" assertions are the specification. A test that stops passing because you widened access is telling you something.

The service tests mock Prisma. Add any new model you touch to the mock or you get `Cannot read properties of undefined`.

---

## 4. Known gaps

**No role holds any `workflow:*` code.** `ROLE_PERMISSION_MATRIX` documents the intended grants and the tests assert it, but nothing provisions it, it is referenced only by its own file and the tests. The workflow is Admin-only until a seed migration lands. This is the single biggest thing standing between the module and production.

**`escalate` and `reassign` are gated but inert.** Codes exist, `can()` enforces them, no endpoint or data operation sits behind them. Same for `timeline-manage` and `progress-update`, which map to the existing `revised_go_live_date` and `progress` columns.

**The email action link is a `GET` that mutates state.** Mail scanners that pre-fetch links can approve unattended. The token engineering is sound, signature checked before any query, stage-bound, live permission re-check, fails closed. The HTTP verb is the weakness. Fix is an interstitial: `GET` renders a confirmation, the button `POST`s.

**The development database has no `_prisma_migrations` ledger.** Built with `db push`. `migrate status` reports all 188 migrations unapplied against a schema that is current. Baseline before running `migrate deploy` anywhere.

**Repo-wide, 696 exports are never imported outside their own file.** Pre-existing, overwhelmingly types. A `knip` or `ts-prune` step would stop it growing.

---

## 5. Performance notes

Already done, so do not undo them:

- `listQueue` derives four of five tab counts from a single `groupBy`. Only `mine` needs its own query, it filters on owner, not status.
- Row actions are resolved once per distinct status, not once per row. A 200-row page does at most seven resolutions.
- `getState` fetches the project and its history in parallel; only the actor lookup waits, because it needs ids the history returns.
- `WorkflowActions` is memoized. The queue re-renders on every search keystroke and `projectId` / `availableActions` / `onDone` are all stable, so the memo genuinely holds. **If you make `onDone` an inline arrow at the call site you defeat it.**

Not done, deliberately: the project→partner conversion in `projects.repository.ts` creates tasks and comments in a loop. It needs each created id for the parent remap, it runs rarely, and it sits inside a transaction. The risk of rewriting it exceeds the gain.

---

## 6. Local setup

```bash
pnpm install
pnpm db:generate
pnpm dev:api      # :3001
pnpm dev:web      # :3000
```

`http://localhost:3001` serves the API, the app is on `:3000`.

Before opening a PR:

```bash
pnpm type-check && pnpm lint && pnpm test
```

Base the PR on `main` or `dev`. `pr-checks.yml` only triggers for those branches, a PR based on a feature branch gets **no CI at all**, which looks like passing.

Windows: `pnpm --filter @nexora/web build` fails at the end with `EPERM: symlink` during standalone file tracing. Compilation and page generation succeed first; it needs Developer Mode or elevation. CI and Docker build on Linux and are unaffected.

If `pnpm db:generate` fails with `EPERM`, the dev server is holding the Prisma DLL. Stop it and re-run.
