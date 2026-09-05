# Project CRM Documentation

Projects, tasks, the PM-gated approval workflow, proposals, and the configurable approval chains behind both.

## Documents

| Document | For | Covers |
|---|---|---|
| [Architecture](ARCHITECTURE.md) | Engineers | System context, request path, module layout, design decisions |
| [Database](DATABASE.md) | Engineers | ER diagram, workflow columns, the three logs, migrations |
| [Workflow](WORKFLOW.md) | Everyone | State machine, actions, authority, logging, email |
| [Proposals](PROPOSALS.md) | Everyone | The decision flow for ideas and change requests |
| [Approval Chains](CHAINS.md) | Administrators, engineers | Configurable stages for both Project CRM flows, and who may change them |
| [API Reference](API.md) | Engineers, integrators | Every endpoint, payloads, status codes, permission codes |
| [Deployment Guide](DEPLOYMENT.md) | Whoever ships it | Blockers, env vars, pipeline, checklist, rollback |
| [Admin Guide](ADMIN_GUIDE.md) | Administrators | Roles, permissions, monitoring, common situations |
| [User Guide](USER_GUIDE.md) | Everyone | Raising requests, approving, reading history |
| [Developer Notes](DEVELOPER_NOTES.md) | Engineers | Non-obvious rules, testing, known gaps, performance |

Related: [QA Regression Report](../QA_REGRESSION_REPORT.md) · [Rollback records](../archive/)

## Read this first

The module is code-complete and every gate is green, type-check, lint, 1191 tests, clean production compile. It is **not yet deployable**, for reasons that are entirely provisioning:

1. **No role holds any `workflow:*` permission.** The workflow is Admin-only until a seed migration creates the five business roles and grants their codes.
2. **The target database has no `_prisma_migrations` ledger.** `migrate deploy` would try to replay every migration from scratch.
3. **One-click email approval is a `GET` that mutates state**, so mail scanners can trigger it. It fails closed while `WORKFLOW_EMAIL_TOKEN_SECRET` is unset, which is the safe default.

Details and remedies in the [Deployment Guide](DEPLOYMENT.md#1-before-you-deploy-anything).

## The chain

```
create (auto-submits) → Project Manager → Development → Completed
                              |
                              +→ Escalated to a named person → Development
```

The Project Manager is the single gate. Most requests they approve outright. When another owner's sign-off is genuinely needed, the PM escalates to a named person rather than a fixed role.

Six statuses, seven actions, one transition path. Every transition is atomic and logged twice, once to the approval and timeline log, once to the audit log.

## Proposals

A separate flow in the same module: ideas and change requests get a decision, rather than a project getting a gate.

```
raise (auto-submits) → stage 1 → … → stage N → Approved
                          |                       |
                          +→ declined             +→ declined
```

Stages come from the configurable chain, each naming one person. A reviewer passes, declines, or asks named people for more information — and asking deliberately moves nothing, so the queue never stops saying who owns the proposal. Full detail in [Proposals](PROPOSALS.md).

## Approval chains

Who approves what is **configured, not coded**. Both Project CRM flows run on an ordered list of stages, each naming one person, editable by a **system administrator only**:

```
submitted → stage 1 → stage 2 → … → stage N → approved
```

A record copies the chain onto itself when submitted, so editing a chain never moves anything already in flight. Escalate, send-back, reopen and complete stay coded transitions — none of them is "the next step in an order". Full detail in [Approval Chains](CHAINS.md).

Travel, leave, expenses, cash advance and payroll keep their own separate approval-step tables and their own HR/Finance permissions; this engine does not touch them.
