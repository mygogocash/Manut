# Project CRM Administrator Guide

For whoever manages roles, permissions and workflow configuration.

---

## 1. How access actually works

Two things decide whether someone can act:

1. **The permission code** attached to their role.
2. **The state of the project**, approvals only count at their own stage, closed requests cannot be edited, archived projects are read-only.

Both must pass. Granting a code does not let someone approve at the wrong stage.

**Admin bypasses everything.** The system Admin role (`isSystem` and named exactly `Admin`) resolves to every permission code. This is why the workflow appears to function today even though no role has been granted anything.

> Do not treat `admin:manage` as "is admin". A custom role can hold that code. The bypass key is `isSystem && name === "Admin"`.

---

## 2. Setting up the five roles

**This has not been done.** No role holds any `workflow:*` code, and the five business roles do not exist. Until an engineer applies the seed migration, only Admin can drive the workflow.

Grant these once the roles exist:

| Role | Codes |
|---|---|
| Sales & Marketing | `workflow:submit` |
| **Project Manager** | `workflow:pm-approve`, `workflow:return`, `workflow:reopen`, `workflow:complete`, `workflow:archive`, `workflow:escalate`, `workflow:reassign`, `workflow:timeline-manage`, `workflow:progress-update` |
| Business Head | `workflow:business-head-approve` |
| Product Admin | `workflow:product-admin-approve` |
| Development Team | `workflow:timeline-manage`, `workflow:progress-update` |

Everyone also needs `projects:read` to see the module at all.

### Two rules worth holding to

**Do not give one person both the Business Head and Product Admin codes.** The chain has three approval tiers so that three different people look at a request. One person holding two tiers approves twice and the tier is decorative.

**Do not "help" by granting a PM the Business Head code.** The Project Manager is the workflow owner and keeps wide authority, editing, timelines, reassignment, escalation, archival, and completion, even after the later stages have approved. What the PM deliberately cannot do is cast the Business Head's or Product Admin's approval. That boundary is the separation of duties. If approvals are stalling, add an approver to that role rather than collapsing the tier.

---

## 3. Changing someone's access

1. Assign or remove the role in **Admin → Users**.
2. Permission changes take effect after their session reloads `/me`, on mount, on login, on returning to the tab, or on the periodic timer. If someone reports stale access, a page refresh resolves it.
3. Every change is written to the audit log with actor, target, timestamp.

Revoking a role also invalidates any outstanding one-click email links for that person, permissions are re-checked at click time, not at send time.

---

## 4. Monitoring

**Emails.** Each project's detail view exposes its delivery log: recipient, stage, status, attempt count and error. Failed sends can be retried from there; retrying cannot produce duplicates because idempotency keys are already claimed.

If *every* email is failing, check `EMAIL_SERVICE_URL` and `EMAIL_SERVICE_API_KEY` before anything workflow-specific.

**Who is receiving approval emails?** Everyone holding the relevant stage code, capped at 25. If nobody holds it, the system falls back to system Admins so a request never stalls silently, which is what happens today, given §2. A `No explicit holder for workflow stage permission` warning in the logs means the fallback fired.

**Audit trail.** Every permission-sensitive action records the acting user, their role names, the capability used, whether they were the workflow owner, the timestamp and any comment. Append-only, nothing in the application updates or deletes it.

---

## 5. One-click approval in email

Off unless `WORKFLOW_EMAIL_TOKEN_SECRET` is configured. When off, emails carry a "Review Request" button instead and nothing breaks.

Understand the trade before asking for it on: the approve link is a URL that performs the approval when fetched. Mail-security products that pre-open links, Microsoft Defender Safe Links among them, can therefore approve a request with nobody having read it. If your approvers are on Microsoft 365, treat this as likely rather than theoretical.

Rejection is never one-click. It needs a written reason, so it always opens the app.

---

## 6. Archiving

Archiving makes a project read-only for everyone, Admin included. It is reversible, the same control unarchives. Use it for cancelled or superseded requests you want out of the queue without destroying the history.

Archiving is not deletion. The project, its transitions and its email log all remain.

---

## 7. Common situations

| Situation | Explanation |
|---|---|
| "I can't approve, but I have the permission" | Check the project's stage. Codes are stage-specific; a Business Head cannot act while it sits at PM. |
| "The Approve button isn't there" | The queue only renders actions you may actually take. Absence means no authority at this stage. |
| "My Pending Approvals is empty" | It holds only stages you can act on. Empty means nothing is waiting on you, or you hold no stage code. |
| Nobody can approve anything except Admin | Permission grants are not seeded. See §2. |
| A rejected request needs to come back | Only the Project Manager can reopen it, which returns it to Draft. |
| Approval emails going to Admins | The fallback fired because nobody holds that stage's code. See §2. |
