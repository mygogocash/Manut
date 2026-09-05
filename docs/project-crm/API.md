# Project CRM API Reference

Base path `/api/projects` unless stated otherwise. The proposals API lives under `/api/proposals` and is documented in [Proposals §8](PROPOSALS.md#8-api). Every endpoint requires a Supabase JWT (`Authorization: Bearer <token>`) except the email-action endpoint in §4.

Responses are `{ "data": ... }`. Errors are `{ "message": string, "statusCode": number }`.

`PROJECT_READ_PERMS` below means any of `projects:read`, `projects:read-all`, or `projects:manage`. Admin bypasses every gate.

---

## 1. Queue and detail

### `GET /projects/workflow/queue`

Rows for one view plus the counts for all five, so tab badges cost no extra round trips.

**Gate:** `PROJECT_READ_PERMS`

| Query | Type | Default |
|---|---|---|
| `view` | `list` \| `mine` \| `pending` \| `completed` \| `rejected` | `list` |

```jsonc
{
  "data": {
    "counts": { "list": 14, "mine": 3, "pending": 4, "completed": 5, "rejected": 2 },
    "rows": [
      {
        "id": "cmr…",
        "name": "Wallet data pipeline",
        "department": "Engineering",
        "status": "pending_pm_approval",
        "label": "Pending PM Approval",
        "owner": "Priya N.",
        "goLiveDate": "2026-09-01T00:00:00.000Z",
        "updatedAt": "2026-07-30T09:12:00.000Z",
        "availableActions": ["approve", "reject", "return"]
      }
    ]
  }
}
```

`availableActions` is filtered by **the caller's** authority, it is what the UI should render, and it is safe to render directly. `pending` contains only stages the caller can act on, so it is a personal queue rather than a shared inbox.

Capped at 200 rows.

### `GET /projects/:id/workflow`

Current state and full history.

**Gate:** `PROJECT_READ_PERMS`

```jsonc
{
  "data": {
    "projectId": "cmr…",
    "status": "pending_business_head_approval",
    "label": "Escalated for Approval",
    "isTerminal": false,
    "allowedActions": ["approve", "reject"],   // legal from this state
    "availableActions": ["approve"],           // ...and permitted for you
    "history": [
      {
        "id": "ckt…",
        "fromStatus": null,
        "toStatus": "pending_pm_approval",
        "actor": "Priya N.",
        "comment": "Initial submission",
        "at": "2026-07-28T04:10:00.000Z"
      }
    ]
  }
}
```

The distinction matters: `allowedActions` is what the state machine permits, `availableActions` is what *you* may do. Render the second; the first is for diagnostics.

### `GET /projects/:id/workflow/detail`

Everything the detail page needs in one call: project fields, workflow state, history, and the comments and attachments on the project's tasks.

**Gate:** `PROJECT_READ_PERMS`

---

## 2. Actions

All are `POST /projects/:id/workflow/<action>`, gated on `PROJECT_READ_PERMS` at the route with the real authority check in the service. All return the new workflow state.

| Endpoint | Body | Capability |
|---|---|---|
| `/submit` | `{ comment?: string }` | `workflow:submit` |
| `/approve` | `{ comment?: string }` | `workflow:pm-approve`, or being the escalation target |
| `/reject` | `{ reason: string }` **required, at least 5 chars** | that stage's authority |
| `/complete` | `{ comment?: string }` | `workflow:complete` |
| `/escalate` | `{ escalateToId: uuid, comment?: string }` | `workflow:escalate` |
| `/return` | `{ comment?: string }` | `workflow:return`, or being the escalation target |
| `/reopen` | `{ comment?: string }` | `workflow:reopen` |
| `/archive` | `{ archived: boolean, comment?: string }` | `workflow:archive` |

Comments are trimmed and capped at 2000 characters.

**Status codes**

| Code | Meaning |
|---|---|
| `200` | Transition applied and logged |
| `400` | Illegal for the current state, or a reject with no reason |
| `403` | Legal, but you lack the authority |
| `404` | No such project |

`400` versus `403` is deliberate: `400` means nobody could do this right now, `403` means someone could, but not you.

---

## 3. Notification log

### `GET /projects/:id/workflow/emails`

Delivery log for the project, stage, kind, recipient, status, attempts, error, timestamps.

**Gate:** `PROJECT_READ_PERMS`

### `POST /projects/:id/workflow/emails/retry`

Re-attempts failed sends for the project. Idempotency keys are already claimed, so this cannot produce duplicates.

**Gate:** `PROJECT_READ_PERMS`

---

## 4. Email action (unauthenticated)

### `GET /api/project-workflow/email-action`

Mounted **outside** the auth guard, the signed token is the credential. Not under `/api/projects`.

| Query | Notes |
|---|---|
| `token` | HMAC-SHA256 signed, carries project, user, action and stage |

Always responds `302` to `PORTAL_URL/projects/requests/<id>?emailAction=<status>`, never a JSON body.

| `emailAction` | Meaning |
|---|---|
| `approved` | Applied |
| `disabled` | `WORKFLOW_EMAIL_TOKEN_SECRET` not configured |
| `invalid` / `expired` | Token missing, malformed, or past its lifetime |
| `superseded` | Project already left the stage the token was issued for |
| `forbidden` | User inactive or no longer holds the permission |
| `notfound` | Project deleted |
| `failed` | Passed all checks but the transition itself was refused |

Controls that still apply despite there being no session: signature verified before any database query; token bound to one project, user, action and stage; permissions re-resolved live; the transition runs through the same service as the in-app path, with the same atomicity and audit logging.

Only `approve` and `complete` are reachable here. Rejection needs a reason and always opens the app.

> The link is a `GET` that mutates state, mail scanners that pre-fetch links can trigger it. Leave `WORKFLOW_EMAIL_TOKEN_SECRET` unset to disable one-click entirely (it fails closed) until this becomes a confirmation interstitial.

---

## 5. Permission codes

| Code | Grants |
|---|---|
| `workflow:submit` | Submit a request; edit own draft |
| `workflow:pm-approve` | Decide at the PM stage; edit details |
| `workflow:complete` | Mark completed |
| `workflow:return` | Return to requester |
| `workflow:reopen` | Reopen a rejection |
| `workflow:archive` | Archive / unarchive |
| `workflow:escalate` | Escalate *(gated; no endpoint yet)* |
| `workflow:reassign` | Reassign *(gated; no endpoint yet)* |
| `workflow:timeline-manage` | Assign or modify expected completion |
| `workflow:progress-update` | Update progress; upload deliverables |

`escalate` and `reassign` are enforced by the authority layer but have no data operation behind them yet. `timeline-manage` and `progress-update` map to the existing `revised_go_live_date` and `progress` columns and are likewise not yet exposed as endpoints.

**No role currently holds any of these codes**, so in practice only Admin can drive the workflow until a seed migration provisions them.
