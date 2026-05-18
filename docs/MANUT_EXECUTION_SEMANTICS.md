# Manut Execution Semantics (M7)

> Owner: Manut control plane
> Status: shipped as of M7
> Audience: agents, dispatchers, and humans reasoning about who owns a task
> right now and what they're allowed to do with it.

This document is the contract that the rest of the Manut suite reads to
answer the question **"who is currently allowed to act on this task?"**
The answer is more subtle than "the assignee" — a Manut task carries
four orthogonal kinds of relationship, and exactly one of them is the
execution lock that the agent runtime checks before doing real work.
Read all four before changing any of them.

## 1. Four orthogonal relationships

### 1.1 Structure — `parentTaskId`

The hierarchical tree of work. `MnTask.parentTaskId` is a self-FK with
`onDelete: SetNull`; cycles are forbidden by the service layer
(`MnTaskService.assertNoCycle`). Structure answers "where does this
task live in the project's task tree?" — it is not a permission, not a
lock, and not an execution claim. It exists purely so a goal-context
prompt can walk ancestors and explain a task's place in the bigger
plan.

### 1.2 Dependency — `MnTaskBlocker`

A directed edge that says "task A is blocked by task B." Stored in the
join table `MnTaskBlocker` with `onDelete: Restrict` on the blocker
side so a task with active dependents can't be silently deleted.
Dependency is read-only context: a dispatcher that wants to execute A
must check whether B has reached a terminal state. Dependency does
**not** confer a lock; two unrelated agents can still race to execute
B, in which case the checkout protocol below kicks in.

### 1.3 Ownership — assignee

`assigneeUserId` or `assigneeAgentId` (XOR; at most one is non-null,
enforced by service-layer validation). Assignment is a *responsibility*
relationship: this human or agent is the canonical name to attribute
the task to in reports, dashboards, and SLA timers. **It is not an
exclusive execution right.** A dispatcher can still hand the task to a
different worker; the assignee is for accountability, not capacity.

### 1.4 Execution — `checkoutRunId` and `executionRunId`

This is the only relationship that gates real work. Two fields, each
with a distinct purpose:

- **`checkoutRunId`** — soft reservation. Held by a queue dispatcher
  that's about to hand the task to a worker. Cleared once the worker
  picks up. Mostly useful for queue-ordering visibility ("which
  scheduler currently claims this task?") and is allowed to drift
  with no recovery side-effect; the lazy stale-lock recovery in
  `tryCheckout` will reclaim it if a stale value persists past 5
  minutes.

- **`executionRunId`** — hard execution lock. Held only by the
  process actually doing work. Set atomically by
  `MnTaskCheckoutService.tryCheckout`, cleared by `release` (only the
  holder can release) or by the watchdog cron on stale-lock cleanup.
  `executionLockedAt` is the timestamp the lock was last acquired and
  is what the staleness predicate is evaluated against.

If you are writing code that *modifies* a task — running a tool,
updating state, marking complete — you must hold the `executionRunId`
lock. Reads do not need the lock; structural moves (parent re-parenting,
assignee change) do not need the lock; only execution does.

## 2. Atomic checkout protocol

The R0 invariant: **at most one caller may hold `executionRunId` on a
given task at any instant.** The lock is acquired via a single atomic
SQL:

```sql
UPDATE mn_tasks
   SET execution_run_id = $1,
       execution_locked_at = NOW(),
       updated_at = NOW()
 WHERE id = $2
   AND (execution_run_id IS NULL
        OR execution_locked_at < NOW() - INTERVAL '5 minutes')
RETURNING *
```

Postgres serialises row writes, so concurrent callers re-evaluate the
WHERE clause against the post-lock row. The first caller to find
`execution_run_id IS NULL` (or stale) wins; everyone else's UPDATE
returns zero rows, and the service maps that to `null`. The service
**does not retry on loss** — callers must back off and decide their
own retry policy (typically the queue picks up the next task instead).

The 5-minute staleness threshold is hard-coded in the SQL because
Postgres rejects bound parameters in INTERVAL positions. If the
threshold needs to change, change the SQL and the corresponding
watchdog threshold in lockstep.

### 2.1 Successful checkout side-effects

When `tryCheckout` returns a non-null row, the service also writes a
new `MnExecutionRun` row in `RUNNING` state with the provided
`runId`. The two writes are not in a transaction; the `MnExecutionRun
.create` is best-effort and treated as fire-and-forget. If the row
creation fails (duplicate id from a retry, transient DB hiccup), the
lock is still held; the watchdog cron will reconcile state on the
next sweep.

### 2.2 Release

`release(taskId, runId)` clears `execution_run_id` and
`execution_locked_at` **only if** the current holder matches `runId`.
The runId-match guard is a security boundary: a stale process that
crashed and restarted with a fresh runId must not be able to clobber a
healthy execution that successfully acquired the lock after the stale
one died.

### 2.3 Marking a run complete

`markRunComplete(runId, status, error?)` updates the `MnExecutionRun`
row with a terminal status (`SUCCEEDED`, `FAILED`, `CANCELLED`,
`TIMED_OUT`) and the finishedAt timestamp. It does **not** clear the
task lock — that's `release`'s job, and the two are deliberately
separate so a dispatcher can mark a run complete-with-error while
keeping the lock briefly for cleanup before releasing.

## 3. Agent-owned vs user-owned execution

The execution lock is independent of the assignee. Two common
patterns:

- **Agent-owned execution:** an `MnAgent` is the assignee
  (`assigneeAgentId`), and the agent's runtime holds the
  `executionRunId` while it's doing work. This is the normal
  background-agent flow.
- **User-owned execution:** the assignee is a user
  (`assigneeUserId`), but an agent is *temporarily* holding the
  execution lock to do work on the user's behalf (e.g. an AI helper
  drafting a doc that the user owns). The agent acquires the lock,
  does the work, and releases before the user opens the task.

In both cases the lock is the only thing that gates writes; the
assignee is a separate dimension. A user can re-assign a task
mid-execution — the lock survives the assignee change, and the
holding agent keeps working until it releases or the watchdog steps
in.

## 4. Stale-lock recovery

Two complementary mechanisms keep the system honest when a lock-holder
crashes without releasing:

### 4.1 Lazy recovery (in `tryCheckout`)

The atomic SQL itself treats any `executionLockedAt` older than 5
minutes as re-acquirable. A fresh checkout attempt on such a task
wins, overwriting the stale runId. This is the fast path — recovery
happens at the moment of the next checkout, with zero extra round
trips.

### 4.2 Proactive recovery (the watchdog cron)

`MnTaskWatchdogCron` runs every minute. For each `MnExecutionRun` in
`RUNNING` state whose `startedAt` is older than 2 minutes AND whose
owning agent has not emitted an `MnHeartbeatRun` in the same window,
the watchdog:

1. Marks the run `FAILED` with `error='watchdog: stale execution'`.
2. Releases the task lock (runId-matched, so this is safe even if a
   fresh checkout has already happened mid-flight).
3. Writes an `MnTaskActivity` row with `action='recovery_lock_cleared'`
   so the audit log shows what happened.

The watchdog's job is **visibility**, not safety — the lazy recovery
in `tryCheckout` already makes the lock re-acquirable. The watchdog
exists so dashboards reflect "this run died" without waiting for the
next checkout attempt.

### 4.3 Why two thresholds (2 min watchdog, 5 min lock)

The watchdog runs at the 2-minute mark to give the next legitimate
holder ~3 minutes of grace before the lazy-recovery path would also
have re-acquired the lock anyway. This ordering means a watchdog
sweep can never "race" with a fresh checkout on the lazy path — by
the time the lazy path would re-acquire, the watchdog has already
marked the previous run terminal and the activity log has been
written.

## 5. Explicit recovery actions

When a stale lock is cleared, the audit trail is the
`MnTaskActivity` row. Operators triaging a stuck task should look
there first; the `metadata` field carries `{ runId, agentId,
staleSince }` so the failure cause is reconstructable without
walking the heartbeat table by hand.

Manual recovery (for an operator with backend access):

```sql
-- Force-release a lock that nobody is honoring. Use with care.
UPDATE mn_tasks
   SET execution_run_id = NULL,
       execution_locked_at = NULL,
       updated_at = NOW()
 WHERE id = $taskId;

INSERT INTO mn_task_activities (id, task_id, action, metadata, created_at)
VALUES (gen_random_uuid(), $taskId, 'manual_lock_cleared',
        jsonb_build_object('operator', $operatorId, 'reason', $reason),
        NOW());

-- Optional: mark the dangling MnExecutionRun row terminal.
UPDATE mn_execution_runs
   SET status = 'CANCELLED',
       error = 'manual recovery',
       finished_at = NOW()
 WHERE task_id = $taskId AND status = 'RUNNING';
```

## 6. GraphQL surface

The M7 resolver exposes:

- **Query** `mnExecutionRunsForTask(taskId, limit?)` — list runs
  newest-first. Requires `Workspace.Read` on the owning workspace.
- **Mutation** `tryCheckoutMnTask(taskId, runId, executingAgentId?)`
  — atomic lock attempt. Returns
  `{ acquired, taskId, executionRunId, executionLockedAt }`. The
  resolver requires `Workspace.Settings.Update` because a successful
  checkout is a write.
- **Mutation** `releaseMnTaskCheckout(taskId, runId)` — release
  (no-op if `runId` doesn't match the holder).
- **Mutation** `markMnExecutionRunComplete(runId, status, error?)` —
  update a run to a terminal status.

## 7. What this is NOT

- **Not a queue.** The lock just serializes execution on a given
  task; it doesn't pick which task gets executed next. That's the
  dispatcher's job (e.g. routine cron + budget enforcer).
- **Not a transaction.** The lock spans many database transactions
  by design — typical execution involves many small writes over
  many seconds.
- **Not a permission.** Permissions are enforced separately via
  `AccessController`. The lock is a coordination primitive between
  workers that have already passed permission checks.

## 8. Comparable systems

The closest analogue in the upstream Paperclip stack is the
`task_executions` table with its `checkout_token` column; the M7
design preserves the same two-token (`checkout_run_id` vs
`execution_run_id`) distinction Paperclip's execution-semantics doc
warns about, and the watchdog mirror's Paperclip's sweep job.
Differences are in the storage: Manut keeps the execution-state JSON
on the task row itself (`execution_state`) rather than on the run
row, because the task is the durable record and we want post-mortem
inspection without a JOIN.
