# Phase 7A — Project Requests + Approval UX

**Status:** implementation complete; authenticated and push end-to-end verification **not performed** (see §29, §30).
**Scope:** Project Requests and the approval workflow it drives. No other module changed.

---

## 1. Existing Project Requests architecture

Project Requests is not a separate record type. **A request _is_ a project** — the same
`projects` row, carrying a `workflowStatus`, driven through a state machine. That single
fact explains most of the module's shape: there is no request table, no request id, and
the "request id" in every URL is the project id.

```
apps/web/src/app/(dashboard)/projects/requests/page.tsx        queue, 5 views      292 lines
apps/web/src/app/(dashboard)/projects/requests/[id]/page.tsx   detail + decide     327 lines
apps/web/src/components/projects/workflow/workflow-actions.tsx approve/reject UI   506 lines
apps/web/src/components/projects/workflow/workflow-timeline.tsx progress + history 146 lines
apps/web/src/services/workflow.service.ts                      API client          224 lines

apps/api/src/modules/projects/workflow/workflow.types.ts       state machine       247 lines
apps/api/src/modules/projects/workflow/workflow.service.ts     transitions        1072 lines
apps/api/src/modules/projects/workflow/workflow-authority.ts   capability rules    337 lines
apps/api/src/modules/projects/workflow/workflow-email.service.ts  email fan-out    467 lines
apps/api/src/modules/projects/workflow/workflow-push.service.ts   Web Push (6A)    100 lines
apps/api/src/modules/projects/workflow/workflow-public.controller.ts one-click     130 lines
apps/api/src/modules/projects/workflow/workflow-token.ts       signed email token  118 lines
```

Only teams in `WORKFLOW_TEAMS` (`general`) enter the workflow. Any other board — HR,
Legal, Accounting, QA — shares `POST /api/projects` but is refused by `transition()`,
which is what stops a `workflow:submit` holder stamping `pending_pm_approval` onto an HR
row and freezing that board's tasks.

**Unlike the Phase 7 project list, this module already used the shared `DataTable`.** That
turned most of the conversion into declaration rather than reconstruction.

---

## 2. Routes

| Route | Purpose | Auth | Permission | Mutates |
|---|---|---|---|---|
| `/projects/requests` | Queue, five views | Yes | any of `projects:read` / `projects:read-all` / `projects:manage` | no |
| `/projects/requests/[id]` | Detail + decision | Yes | same | via actions |

API (all under `/api/projects`, literal paths registered before `/:id`):

| Endpoint | Purpose |
|---|---|
| `GET /workflow/queue?view=` | the five views + counts |
| `GET /:id/workflow` | state + history |
| `GET /:id/workflow/detail` | everything the detail page needs, one round trip |
| `POST /:id/workflow/{submit,approve,complete,reject,return,escalate,reopen,archive}` | transitions |
| `GET /:id/workflow/emails`, `POST .../retry` | delivery log |
| `GET /api/workflow-actions/email-action?token=` | one-click from email, **unauthenticated by design** |

There is **one** canonical request route. Phase 7A did not add any route, and the
one-click email endpoint stays outside the `authenticate` guard because the signed token
is the credential.

---

## 3. Approval workflow, UI to database

```
tap Approve  ->  WorkflowActions.start()  ->  runWorkflowAction()
             ->  POST /api/projects/:id/workflow/approve
             ->  requirePermission(PROJECT_READ_PERMS)          route: "can you see it at all"
             ->  workflowService.transition()
                   1  isWorkflowTeam(project.team)              refuse foreign boards
                   2  assertCanViewRequest()
                   3  TRANSITIONS[from][action]                 legality
                   4  can(capability, ...)                      permission + stage rules
                   5  chain.canDecideStage                      identity, when a chain exists
                   6  reject requires a reason
             ->  prisma.$transaction
                   settleDecision()  conditional update, status = 'pending'
                   project.update    workflowStatus, workflowUpdatedAt
                   projectWorkflowTransition.create
                   auditLog.create
             ->  (after commit, best effort)
                   workflowEmailService  ->  email
                   workflowPushService   ->  Web Push
```

The route guard deliberately checks only "can you see this request". The permission that
matters depends on the request's **current status**, which `requirePermission` cannot
express, so authority lives in the service. This matches the travel / cash-advance
pattern already used in this codebase. **Unchanged by this phase.**

---

## 4. Request states

From `workflow.types.ts` — no state was invented, renamed or added.

| Status | Meaning | Who acts |
|---|---|---|
| `draft` | returned or reopened; never the initial state | submitter (`workflow:submit`) |
| `pending_pm_approval` | awaiting a stage of the chain | the stage's approver, or `workflow:pm-approve` |
| `pending_escalation` | awaiting the person the PM named | **only** `escalatedToId` — identity, not a permission |
| `approved` | work may start; completing is optional | `workflow:complete` |
| `completed` | delivered | terminal |
| `rejected` | declined | terminal, except PM `reopen` |
| `pending_development` | legacy name for `approved`, read-only | as `approved` |

Actions: `submit`, `approve`, `complete`, `reject`, `return`, `reopen`, `escalate`.

---

## 5. Permissions / RBAC

`workflow:submit`, `workflow:pm-approve`, `workflow:complete`, `workflow:return`,
`workflow:reopen`, `workflow:escalate`, `workflow:archive`, plus the `projects:*` read
gates. **No permission code was added, removed or changed.**

The property that makes the UI safe: **the list and detail pages never decide what a user
may do.** The server computes `availableActions` per caller (legal ∩ permitted) and the UI
renders exactly that; `WorkflowActions` returns `null` for an empty list. Frontend
visibility is presentation only — `transition()` re-checks every gate regardless of what
the client sends.

Backend authorization already has strong coverage in `workflow-authority.test.ts` (CAN /
CANNOT pairs per role, including "escalation CANNOT be satisfied by the PM's own
permissions" and "a super-admin satisfies the permission gate but still obeys stage
rules"). Phase 7A added no RBAC tests because it changed no RBAC.

---

## 6. Responsive list

`DataTable` already renders cards below 768px (Phase 1). The queue therefore *already*
produced cards — but from the **derived** roles, and the derivation cannot tell an action
column from a data column:

```
derived (before)                     declared (after)
  title    Request                     title    Request
  field    Owner                       badge    Status
  field    Status        <- plain text field    Owner
  detail   Go Live                     field    Go Live
  detail   Updated                     detail   Updated
  detail   Actions       <- BURIED      actions  Actions   <- on the card's action bar
```

The defect that mattered: **the Approve / Reject control rendered as a labelled value
inside the collapsed expansion.** An approver on a phone had to expand every row to find
the decision — one tap further away than on desktop, on the single most important control
in the module.

Fix: an additive `mobileRole: "actions"` on `DataTable`, plus six column annotations on
the queue. Nothing else changed; every column still appears somewhere.

---

## 7. Mobile card strategy

| Desktop column | Mobile placement |
|---|---|
| Request | card title (links to the same detail route) |
| Status | badge, top-right, using the module's own `WORKFLOW_STATUS_TONE` |
| Owner | field, on the face |
| Go Live | field, on the face |
| Updated | expansion |
| Actions | **action bar, on the face** |

Nothing is dropped. A test enumerates the mapping and fails if a column falls out of it.

---

## 8. Search

Client-side, over the already-fetched rows, matching name **or** owner — unchanged.
Server-side search does not exist here, so none was invented. The existing input already
used the base `Input` (`text-base`, 16px, `md:text-sm` above 768px), so **there was no iOS
zoom defect on this page** — unlike the Project CRM list in Phase 7. A test pins the
16px base so a future `text-xs` cannot creep in.

---

## 9. Filters

**This module has no filters.** The five views are tabs, not filters, and they are the
module's own concept. `FilterSheet` / `FilterChip` / `useFilterDraft` were therefore
**not** introduced — adding a filter sheet with nothing to put in it would be inventing a
feature. The tab strip was fixed instead (§10).

---

## 10. Tabs (in place of sorting)

There is no column sorting in this module, so none was preserved and none invented.

The five views had a real mobile defect: the strip declared `flex-wrap` **and**
`overflow-x-auto`, which contradict — wrapping means it never overflows, so it never
scrolls, and five tabs consumed roughly a third of a 320px screen. Now one scrolling row
(`allow-x-scroll`, `flex-nowrap`, `min-w-0`), with the active tab scrolled into view and
proper `role="tablist"` / `role="tab"` / `aria-selected` semantics.

Desktop is unaffected: the tabs fit, so nothing scrolls (measured `tabsScroll: false` at
1440px).

---

## 11. Pagination

Client-side slice over the filtered rows via `usePagination`, rendered by
`DataPagination`. Unchanged — no redesign, no mobile-only variant.

---

## 12. Request detail

Already largely responsive: the header/action row is `lg:flex-row`, the body is
`lg:grid-cols-[1fr_380px]`, and both stack below `lg`. Phase 7A changed only:

- page padding `px-6 py-6` → `px-4 py-5 sm:px-6 sm:py-6` (24px each side is a lot of 320px)
- the empty-value placeholder (§16)
- the email-outcome notice (§17)
- the 44px touch target on the decision controls (§14)

Attachments, comments, timeline and approval history were audited and left alone — they
already wrap, truncate and stack correctly.

---

## 13. Approval UX

`layout="menu"` in the queue (one trigger per row, so row heights stay uniform) and
`layout="split"` on the detail page (Approve stays a real button; the rest behind "More").
Order is fixed by `ACTION_ORDER`, never by what the API returned, and `reject` renders
below a separator in the destructive colour. **All unchanged.**

Measured at 375px: Approve 113×44, More 47×44, both inside the viewport.

---

## 14. Rejection UX

`reject` and `return` both require a written reason (≥5 characters, enforced client-side
and again by the service, which throws `BadRequestException` on an empty comment). The
dialog at 375px: 326px wide, 274px tall, fits the viewport, **textarea 16px** so iOS does
not zoom, explicit Cancel, closes on Escape.

Escalation gets its own dialog because it needs a *person*, not a note.

**Touch targets.** `size="sm"` is `h-7` — **28px**, under the 44px WCAG 2.5.5 / Apple HIG
minimum, on the module's primary control. Raised to 44px below 768px only
(`max-md:h-11`), so the desktop queue and detail page are byte-for-byte unchanged
(verified: 28px at 768px and 1440px, 44px at 320–430px). A real height rather than the
`.touch-target` pseudo-element, because the split layout's two buttons sit 8px apart and
two overlapping 44px hit areas would let "More" swallow part of "Approve".

---

## 15. Confirmation

Reuses the existing shared `Dialog`. No shared dialog component was rewritten.
Double submission is already prevented: `busy` disables the promoted button, every menu
item and the dialog's confirm button for the duration of the request.

---

## 16. Stale approval

**Backend — already correct, and verified.** `chainRepository.settleDecision` is a
conditional `updateMany` (`where: { id, status: "pending" }`); a zero match raises
`ConflictException` — *"Somebody else has already decided this stage. Reload to see where
it is now."* Beyond that, an illegal transition raises `BadRequestException`. Neither was
changed.

**Frontend — fixed.** The UI showed the error and left the stale row on screen, so the
only thing left to do with it was click the same dead action again for the same error.
A failure carrying 400 / 403 / 404 / 409 now closes any open dialog and refetches; 500s
and network failures deliberately do not, because nothing about them says the record
moved and refetching on a transport blip is how a retry loop starts.

A conflict is never turned into a success: the toast shows the API's own message.

---

## 17. Notification integration

Unchanged. Approval events already fan out to email (`workflowEmailService`) and Web Push
(`workflowPushService`), both **after commit** and both best-effort. Push cannot fail an
approval — `sendToUsers` swallows delivery errors and `onTransition` wraps recipient
resolution in its own try/catch. No second notification mechanism was created.

### The email-outcome gap — found and fixed

The one-click email approval runs the decision server-side and then 302s to
`/projects/requests/:id?emailAction=<outcome>`. **Nothing read that parameter.** Every
outcome looked identical — the request page, silently — so someone who tapped Approve in
their inbox could not tell an approval from an expired link, from a request a colleague
had already decided. The most likely reading of that silence, "it worked", is wrong for
six of the nine outcomes.

`EmailActionNotice` now renders the outcome (`approved`, `superseded`, `forbidden`,
`expired`, `invalid`, `malformed`, `disabled`, `notfound`, `failed`) and strips the
parameter so a refresh cannot re-announce a decision that happened once. Two tests read
the **API's own source** and assert every redirect status and every token-failure reason
has a message, so a new outcome fails the build instead of rendering nothing.

---

## 18. Push integration

Reused as built in Phase 6A. Recipients still come from
`workflowEmailService.transitionRecipientIds()` — the same rule email uses — resolved
**server-side**; the client never sends userIds, recipientIds or deviceIds. The payload is
still exactly five keys and still says nothing a lock screen should not show: not the
project name, not the requester, not the comment.

### The deep-link defect — found and fixed

Push pointed at **`/projects/:id`** — the delivery **board**. Email, the one-click email
action, the board's own back-link and the sidebar all point at
**`/projects/requests/:id`** — the request, which is where the approve/reject controls
are. An approver tapping *"A request is waiting for your decision"* landed on a kanban
with no decision on it.

The existing test was named *"deep-links to the existing request route"* and asserted
`/projects/p-1` — the name stated the intent, the assertion encoded the defect. Both are
now correct, and a new test compares the push URL against the email service's own path
literal so the two cannot drift apart again.

---

## 19. Deep-link behaviour

All four surfaces now land on the same canonical route:

| Surface | Destination |
|---|---|
| Approval email | `/projects/requests/:id` |
| One-click email action | `/projects/requests/:id?emailAction=…` |
| **Web Push** | `/projects/requests/:id` **(fixed)** |
| Sidebar / board back-link | `/projects/requests` / `/projects/requests/:id` |

The push URL stays root-relative, so `isSafeNotificationUrl()` validates it on the server
and the service worker validates it again before opening.

---

## 20. Security

- RBAC unchanged; no permission code touched.
- Backend authorization unchanged; the service remains the boundary.
- Push recipients remain server-resolved; payload unchanged and still minimal.
- Deep link is root-relative and validated twice; no external redirect is reachable.
- No secrets in frontend source; no VAPID key moved.
- **No request data is cached by the service worker** — `/api/*` is never intercepted
  (Phase 3 rule, re-verified: `sw.js` still excludes it).
- Nothing sensitive written to `localStorage`; `EmailActionNotice` keeps its value in
  React state and removes the parameter from the URL.
- No test endpoint added.

---

## 21–24. Desktop / tablet / mobile / PWA behaviour

Measured in a browser against the real components (temporary harness, since the pages
need a session; harness deleted, no records created).

| Width | Mode | Page overflow | Uncontained elements | Action height |
|---|---|---|---|---|
| 320 | cards | 0 | 0 | 44 |
| 375 | cards | 0 | 0 | 44 |
| 430 | cards | 0 | 0 | 44 |
| 768 | table | 0 | 0 | 28 |
| 1440 | table | 0 | 0 | 28 |

Also confirmed: card 288px at 320px; search 16px at every width; expansion toggles
`aria-expanded` and reveals `Updated` with a real value; per-card expansion state is
independent; the action menu opens inside the viewport with all four actions in fixed
order; a 62-character unbreakable string causes no overflow; a null Go Live renders `—`.

**Tablet caveat.** Between 768px and roughly 1024px the table is retained (that is
`DataTable`'s fixed 768px card breakpoint) and scrolls **inside its own container** when
content is wide — measured 1074px of table in a 768px viewport with a deliberately long
project name. The page itself never scrolls sideways. Raising that breakpoint is a shared
`DataTable` change affecting ~75 tables and was out of scope; see §32.

**PWA.** Not verified — see §29.

---

## 25. Accessibility

- Tab strip now `role="tablist"` / `role="tab"` / `aria-selected`; active tab scrolled into view.
- Expander already exposes `aria-expanded` and a Show more / Show less label.
- Action trigger has a real accessible name (`Request actions` / `More actions for this request`) — a lone chevron per row would say nothing.
- Reject dialog has a real `<label>`, autofocus, explicit Cancel, Escape to close.
- Approval controls are 44×44 below 768px.
- `EmailActionNotice` is `role="status"`, so it is announced on a page the user did not choose to open.

Known gap: the dialog's `Close` X measures 27px.

---

## 26. Performance

One fetch per view change, exactly as before. Search and pagination are client-side over
the fetched rows, so neither refetches. The card and table render from the **same**
`data` array and the same column definitions, so mobile costs no extra request. No
duplicate calls were observed; the directory fetch for escalation still happens on dialog
open, not on mount, so a 25-row queue does not fetch it 25 times.

---

## 27. Tests

**34 added; 2,488 pass (1,958 API + 530 web); none weakened.**

| File | Added | Covers |
|---|---|---|
| `projects/requests/__tests__/requests-page.test.tsx` | 11 | table preserved on desktop; cards on mobile; every column accounted for; decision on the card face; no control when no action is available; `—` placeholder; search; 16px input; tablist; refetch on view change |
| `components/projects/workflow/__tests__/email-action-notice.test.tsx` | 12 | each outcome's message; unknown ignored; parameter stripped but notice retained; other params preserved; announced; **and both cross-checks against the API's own source** |
| `components/shared/__tests__/data-table-responsive.test.tsx` | 4 | action column reachable without expanding; not duplicated as a value; unchanged for tables that do not declare it |
| `components/projects/workflow/__tests__/action-menu.test.ts` | 6 | which failures mean "stale view", and which deliberately do not |
| `api/.../workflow-push.service.test.ts` | 1 (+1 corrected) | push lands where the emails link |

The one assertion changed was the push URL, whose test name already asked for the request
route. That is a corrected assertion, not a weakened one.

---

## 28. Browser verification

Done, as tabulated in §21–24, against the real `DataTable`, the real column definitions
and the real `WorkflowActions`. The harness rendered fixture rows only — **no production
data was read or written, and no records were created.** Harness deleted; API restored.

---

## 29. Authenticated manual verification — NOT PERFORMED

**No authenticated session was available, so nothing in this phase was exercised against a
real request.** The brief requires a human pass. What follows still needs doing:

1. Sign in on a phone; open `/projects/requests`.
2. Check each of the five views loads and the counts match the rows.
3. Open a real pending request; confirm every field, attachment and comment renders.
4. Approve or reject a **safe test** request; confirm the toast, the status, and that it leaves the pending view.
5. Confirm the in-app notification and the approval email still arrive.
6. **Two-device stale test:** open the same pending request on two devices, decide on one, act on the other — expect the conflict message *and* the list refreshing itself, not a silent success.
7. **RBAC:** sign in as a non-approver; confirm no action control is offered, and that a hand-made POST is still refused.
8. Verify at 320/375/390/414/430, 768/834/1024, 1280/1440/1920.
9. Installed PWA: list, detail, decision, refresh, session, notification click.

---

## 30. Push end-to-end — NOT VERIFIED

**PUSH E2E NOT VERIFIED — infrastructure exists but device delivery configuration is
unavailable.**

VAPID keys are not set in this environment and no device subscription exists, so no
notification was delivered, tapped, or followed. The deep link is verified **in code and
by test** (§18) but not on a device.

The `push_subscriptions` migration is also still **not applied to production** (carried
over from Phase 6A).

---

## 31. Known limitations

1. **Nothing authenticated was rendered** (§29) — the largest gap.
2. **Push E2E unverified** (§30).
3. **Tablet 768–1024px keeps a scrolling table** (§21–24).
4. **Other tables still bury their action column.** The `actions` role is opt-in, so the
   ~75 tables that predate it keep today's behaviour. Deliberate: changing them all was
   out of scope. They have the same latent defect.
5. **Label inconsistency, not fixed.** The badge shows the API's `Pending Approval` while
   the timeline shows the web constant `Pending PM Approval`. Cosmetic, and changing
   wording is behaviour, so it was left alone and is recorded here instead.
6. **Dialog close X is 27px** (§25).
7. **No sticky action bar on a long detail page.** After scrolling through description,
   attachments and comments, the approver must scroll back up. Adding one would be
   inventing UX the brief did not ask for; flagged as a recommendation instead.

---

## 32. Recommended next phase

**Phase 7B — Project detail and board**, but with a decision made *first*, not during:
what a kanban board should be on a phone. It is the largest remaining surface (918-line
detail page, 1,829-line task sheet) and the only one where the answer is a product
question rather than a layout pass. Do not start it as a conversion task.

Two smaller items worth doing before or alongside:

- **Raise the `DataTable` card breakpoint to `lg` behind an opt-in prop**, then adopt it on
  the wide tables. That closes the tablet gap (§21–24) without touching 75 tables at once.
- **Sweep the `actions` role across the other action-bearing tables** (§31.4) — mechanical,
  testable, and each one is currently a buried control on mobile.
