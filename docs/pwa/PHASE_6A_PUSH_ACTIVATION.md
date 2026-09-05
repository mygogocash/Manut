# Phase 6A — Push Activation + Approval Integration

Migration applied, lifecycle verified against the real database, and one real producer wired: **project approval transitions**.

References: [PHASE_6](PHASE_6_NOTIFICATIONS_WEB_PUSH.md) · [SCHEMA PROPOSAL](PHASE_6_SCHEMA_PROPOSAL.md) · Completed 2026-08-25

> **Note on the brief.** The Phase 6A instructions were truncated mid-sentence at Step 13 — there were no testing, documentation, scope or Definition-of-Done sections. This phase delivers the four stated objectives and Steps 1–13, and follows the conventions of the previous eight phases for the rest.

---

## 1. Database environment verification

| Check | Result |
| --- | --- |
| ORM | Prisma 6, schema at `packages/database/prisma/schema/`, migrations at `prisma/migrations/` |
| `DATABASE_URL` source | `.env` and `.env.development` — **the same database** |
| Host | `aws-1-ap-southeast-1.pooler.supabase.com:6543`, db `postgres` (secrets not printed) |
| Environment | **Shared dev/staging.** Not production — `.env.production` was not read and no production command was run |
| Existing tables | 271 |
| `push_subscriptions` already present? | No |
| Anything matching `%push%`? | None |
| Conflicting model in schema? | None |
| Migration already applied? | No |

## 2. STOP-condition finding: `migrate deploy` is unsafe on this database

**`_prisma_migrations` is ABSENT**, on a database with 271 tables and **247 migration directories** in the repo.

`pnpm db:migrate:deploy` would therefore create the bookkeeping table, find zero applied migrations, and attempt to replay **all 247** against a database that already has everything. Most would fail on existing objects, and a partial failure leaves the P3009 failed-migration state `CLAUDE.md` documents as a recurring incident.

So the repository's nominal migration workflow was **not** used, and `db:push` was not used either (forbidden by the brief, and destructive against a shared database). Instead the **migration file's own SQL was executed directly** — three idempotent statements, exactly as written:

```
CREATE TABLE IF NOT EXISTS "push_subscriptions" …
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" …
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" …
```

**Recommendation for the team, not actioned here:** this database needs baselining (`prisma migrate resolve --applied` across the 247, or a documented decision that it is `db:push`-managed and `migrate deploy` must never be run against it). That is a decision with repo-wide consequences and is not mine to take unilaterally.

## 3. Migration applied

| | |
| --- | --- |
| Migration | `20261218000000_push_subscriptions` |
| Target | shared dev/staging (§1) |
| Mechanism | migration SQL executed directly (§2) |
| Tables before → after | **271 → 272** — exactly one, nothing else touched |

Verified afterwards:

| Check | Result |
| --- | --- |
| Columns | all 10 present, correct types and nullability |
| `failure_count` default | `0` |
| `created_at` default | `CURRENT_TIMESTAMP` |
| Primary key | `push_subscriptions_pkey (id)` |
| Unique index | `push_subscriptions_endpoint_key (endpoint)` |
| Index | `push_subscriptions_user_id_idx (user_id)` |
| Prisma client can query it | Yes — 0 rows |

### Drift found and corrected

`prisma migrate diff` reported drift on the new table immediately after applying it:

> `Altered column id (default changed from gen_random_uuid() to None)`

My migration set a `DEFAULT gen_random_uuid()` that the Prisma model does not declare — `@default(uuid())` generates the id **client-side**. That is the same class of schema/migration mismatch that broke a staging deploy earlier in this project.

Checked against the house pattern: `it_crm_notifications` (also `@default(uuid()) @db.Uuid`) defines `"id" UUID NOT NULL` with **no** DB default, and shows **zero** drift. So the migration was wrong, not the model.

Corrected in both places — the migration file now omits the default, and the live column's default was dropped (table was empty, verified before altering). Re-checked: **`push_subscriptions` no longer appears in the drift report.**

The 19 other tables that do drift are pre-existing and unrelated; none was touched.

## 4. Migration safety

| | |
| --- | --- |
| Name / version | `20261218000000_push_subscriptions` |
| Rollback | `DROP TABLE push_subscriptions;` — no other table has a foreign key to it, so the drop is unconstrained |
| Destructive? | Only of push subscriptions. **No business data exists in this table** — it holds browser endpoints, and losing them means users re-enable notifications |
| Data retention | Rows are deleted on unsubscribe, logout, 404/410, or the failure cap. Nothing is retained after a subscription ends |
| Disable without rollback | Unset `VAPID_PRIVATE_KEY` — sending no-ops, subscribing refuses, the table simply sits idle |

Rollback was **not** executed; it is documented, not tested.

## 5–7. Subscription lifecycle, verified against the real database

Run through the **real service and repository against the live table** — not mocks. All 15 checks passed:

| # | Check | Result |
| --- | --- | --- |
| 1 | Subscription persists | 1 row |
| 2 | Same endpoint again → no duplicate | still 1 |
| 3 | Re-subscribe refreshes the keys | updated |
| 4 | Second device coexists | 2 rows |
| 5 | Another user's device independent | 1 row |
| **6** | **User A cannot unsubscribe user B's device** | **refused** |
| 7 | Victim's device survives | intact |
| 8 | Own device unsubscribes | removed |
| 9 | Other own device untouched | intact |
| 10 | Logout clears all own devices | 2 removed |
| 11 | Logout leaves other users alone | intact |
| 12 | Re-subscribe after logout works | 1 row |
| 13 | Shared device re-points to the new user | A → 0 |
| 14 | …and now belongs to them | B → 2 |
| 15 | Cleanup leaves nothing behind | 0 rows |

Every row created was removed; the table is empty again. Row 6 is the authorization property from Step 6, proven against real data rather than argued.

Routes were also exercised over HTTP: all five return **401** unauthenticated.

## 8. Approval producer audit

Located, not guessed:

| Question | Answer |
| --- | --- |
| Where does an approval complete? | `workflow.service.ts` `transition()`, inside `prisma.$transaction` |
| What commits? | project row update, `projectWorkflowTransition` row, `auditLog` row |
| What happens after? | `workflowEmailService.onTransition(...)`, **outside** the transaction |
| Existing comment there | *"Email fan-out happens AFTER the transaction has committed, so a rolled-back transition can never notify anyone. The service swallows its own failures — mail must never undo an approval that succeeded."* |
| Existing notification record? | The workflow does **not** write `CrmNotification`; the bell surfaces workflow state through the dashboard read-model |

That existing comment describes exactly the property Step 13 demands, so push was placed **immediately beside the email call** — same position, same semantics. No transaction boundary was changed.

## 9. Reusing the existing notification, not creating a second

No new notification record was created. The workflow's notification surfaces are the read-model (bell) and email; push is a third channel on the same transition, keyed to the **existing `transitionId`**.

## 10. Recipient resolution

**The rule is the existing one, and it is now stated exactly once.**

`workflow-email.service.ts` already resolved recipients:

- `rejected` / `completed` → the **requester** (project owner)
- any other stage → **`approversFor(...)`**, which defers to the approval chain, then a configured default approver, then stage-permission holders, then system admins

Rather than restate that for push — which would drift the moment either changed — it was extracted into a public `transitionRecipientIds()` on the email service, returning **user ids** (channel-agnostic; push has no use for an address). Email's own `onTransition` is **unchanged**, and `workflowPushService` calls the new method.

One addition on top of the shared rule: **the actor is excluded.** Being notified about your own click is noise, and on a shared device it is a needless disclosure.

## 11. Payload

```json
{ "title": "Approval required",
  "body": "A request is waiting for your decision.",
  "url": "/projects/<id>",
  "notificationId": "<transitionId>",
  "tag": "workflow-<transitionId>" }
```

For a requester: *"Request update" / "A request you raised has been decided."* — note it does **not** say rejected, even when it was.

**The project name is deliberately omitted.** It is the most tempting field to include and the worst: *"Q3 redundancy programme"* on a lock screen is precisely the leak the minimal-payload rule exists to prevent. No comment, no decision, no actor, no amount. A test asserts only those five keys ever go over the wire.

## 12. Deep link

`/projects/<id>` — the existing request detail page. **No route invented.** Root-relative, so it passes `isSafeNotificationUrl()` server-side and `safeTargetPath()` again in the worker. A logged-out tap lands on sign-in and returns via the Phase 4 redirect handling, query string intact.

## 13. Transaction safety

```
BEGIN
  update project
  insert transition
  insert audit
COMMIT            ← the approval is now durable
  ↓
  email fan-out   (best effort, swallows failures)
  ↓
  push fan-out    (best effort, swallows failures)
```

Push is **never** inside the transaction. Two layers of protection:

1. `pushService.sendToUsers()` already swallows per-device delivery errors.
2. `workflowPushService.onTransition()` wraps recipient resolution **and** sending in its own try/catch and logs a warning.

Both are tested: a delivery failure and a recipient-resolution failure each resolve without throwing.

## 14. Tests

**18 new** (13 producer + 5 controller), and the pre-existing workflow suite still passes **unmodified**.

`workflow-push.service.test.ts` (13) — transaction safety (delivery failure swallowed, resolution failure swallowed, no recipients → no send); recipients (asks the email service, matches it exactly, excludes the actor, sends nothing when the actor is the only recipient, no recipient field in the signature); payload (generic title/body, no leak of reject/comment/name, exactly five keys, root-relative existing route, reuses the transition id).

`push.controller.test.ts` (5) — subscription routes registered in every environment; **the test trigger is not registered in production** (proven by inspecting the router stack, not asserted in prose); registered outside production; fails closed when `NODE_ENV` is unset; **no route anywhere names a recipient**.

### A bug the tests caught

The pre-existing `workflow.service.test.ts` failed the moment push was wired in: *"No `authenticate` export is defined on the `@/core/guards/auth.guard` mock."*

The cause was mine. `workflow-push.service.ts` imported `pushService` from the `@/modules/push` **barrel** — which also exports the controller, dragging Express and the auth guard into every consumer of a service. Fixed by importing `@/modules/push/push.service` directly, which is the convention this codebase already follows for `chainService`. **The existing test was not weakened**; the import was wrong.

| Gate | Result |
| --- | --- |
| type-check | 10/10 workspaces clean |
| lint | **0 errors** |
| Full suite | **2,437 passing** (1,952 API + 485 web), up from 2,424 |

## 15. Objective 4 — real browser/device verification: NOT DONE

Stated plainly, because it was one of the four objectives.

**No push notification has been delivered to a device.** It requires a signed-in session (a password I do not enter) and a real push service. What *is* verified: the table, the lifecycle against real data, route mounting and gating, recipient resolution, payload shape, transaction safety, and that the worker parses.

### What a human needs to do

Prerequisites: `npx web-push generate-vapid-keys`; add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:it@thebinaryholdings.com` to `.env`; restart the API; run a **production** web build (the worker does not register in dev).

1. Sign in as an approver. Open the bell → **Enable** → accept the prompt.
2. Confirm a row appears: `select count(*) from push_subscriptions;`
3. As a **different** user, raise or submit a project request.
4. The approver's device should show *"Approval required"* — with the app **closed or backgrounded**.
5. Tap it → the existing window focuses (or one opens) at `/projects/<id>`; no second window.
6. With the approver's window **focused**, repeat → **no** system banner (by design; the bell shows it).
7. Confirm the actor never receives their own notification.
8. Reject the request → the **requester** gets *"Request update"*, and the body does not say "rejected".
9. Enable on a second browser → confirm both receive.
10. Turn off on one → confirm only the other receives.
11. Sign out → confirm `push_subscriptions` has no rows for that user and delivery stops.
12. Android Chrome, and an installed iOS 16.4+ PWA.

## 16. Known limitations

1. **No delivery observed end to end** (§15). The remaining gap.
2. **The migration is on the shared dev/staging database only.** Production is unmigrated — `/api/push/*` will fail there until it is applied, and the same `migrate deploy` hazard (§2) needs resolving first. **Check production's `_prisma_migrations` state before assuming `migrate deploy` is safe there.**
3. **The shared database is re-synced by `db:push` from `dev`'s schema.** Until this branch merges, a staging deploy will **drop `push_subscriptions`** — the same mechanism that removed a column in Phase 3. Re-applying is one command.
4. **Only project-workflow approvals produce push.** Leave, travel, expenses, cash-advance and proposals have their own approval chains and are untouched, as instructed.
5. **No queue** — the fan-out runs in-request (Phase 6 §19). Fine at this scale.
6. **`transitionRecipientIds` duplicates the rejected/completed branch** that `onTransition` also contains. Refactoring email's own branch to call it would have risked the email tests for no functional gain; the two are adjacent in one file, and a change to one is visible from the other.
7. **iOS standalone session-cookie question still open** since Phase 0 — a subscription is useless if the tap lands on a signed-out app.
8. **VAPID keys are not set anywhere yet.** Until they are, push is inert: the API logs a warning, the opt-in renders nothing, and everything else works normally.

---

## Definition of Done

| Item | Status |
| --- | --- |
| Environment verified before migrating | Yes — §1 |
| Schema proposal reviewed against current schema | Yes — no duplicate, no conflict |
| Migration applied safely | Yes — +1 table, non-destructive, `migrate deploy` avoided with reason |
| Drift checked | **Found and fixed** — §3 |
| Rollback documented | Yes, not executed |
| Subscription lifecycle verified | **15/15 against the real database** |
| Authorization verified | Yes — cross-user unsubscribe refused |
| Logout lifecycle verified | Yes — own devices only |
| Approval producer wired | Yes — project workflow transitions |
| Existing notification reused | Yes — no second record, existing transition id |
| Recipients server-resolved from the existing rule | Yes — shared with email |
| Payload minimal | Yes — five keys, no project name |
| Deep link is an existing route | Yes — `/projects/<id>`, validated twice |
| Transaction safety | Yes — post-commit, best-effort, tested |
| Real browser/device verification | **Not done** — §15 |
| Type-check / lint / tests | Clean / 0 errors / 2,437 passing |
