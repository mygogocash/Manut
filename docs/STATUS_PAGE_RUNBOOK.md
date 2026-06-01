# Manut Status Page Runbook

> **Audience:** launch-window operators, incident owners, and support/comms.
> **Scope:** repo-only operating procedure for standing up and running a public
> Manut status page. Provider selection, automation, DNS, and API tokens remain
> **TBD** until the operator records the approved provider and secrets path.

Use this alongside [MANUT_DEPLOY_RUNBOOK.md](./MANUT_DEPLOY_RUNBOOK.md),
[MANUT_LAUNCH_CHECKLIST.md](./MANUT_LAUNCH_CHECKLIST.md), and
[MANUT_LAUNCH_COMMS_TEMPLATE.md](./MANUT_LAUNCH_COMMS_TEMPLATE.md). Do not mark
the public status page operational until the evidence gate in
[§8](#8-operational-evidence-gate) is complete.

## 1. Provider Placeholders

Do not commit provider credentials or real API tokens.

| Field                   | Launch value                                          |
| ----------------------- | ----------------------------------------------------- |
| Status page provider    | TBD                                                   |
| Public status URL       | TBD (`status.manut.xyz` or equivalent after approval) |
| Provider admin URL      | TBD                                                   |
| API token secret name   | TBD                                                   |
| API token owner         | TBD                                                   |
| Manual fallback owner   | TBD                                                   |
| Subscriber email source | TBD                                                   |
| Escalation channel      | TBD                                                   |

Environment or secret placeholders, if automation is later added:

```text
STATUS_PAGE_PROVIDER=TBD
STATUS_PAGE_BASE_URL=TBD
STATUS_PAGE_API_TOKEN_SECRET=TBD
STATUS_PAGE_COMPONENT_WEB_APP=TBD
STATUS_PAGE_COMPONENT_GRAPHQL_API=TBD
STATUS_PAGE_COMPONENT_AI_CHAT=TBD
STATUS_PAGE_COMPONENT_AUTH=TBD
STATUS_PAGE_COMPONENT_STORAGE=TBD
STATUS_PAGE_COMPONENT_BILLING=TBD
STATUS_PAGE_COMPONENT_EMAIL=TBD
STATUS_PAGE_COMPONENT_SOCIAL_ANALYTICS=TBD
```

## 2. Components

Create one public component per customer-visible failure boundary. Keep internal
service names out of public copy unless needed for support clarity.

| Component         | Covers                                                        | Evidence source before status change                  |
| ----------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| Web App           | `manut.xyz`, shell load, route rendering, mobile entry points | Browser smoke, `/info`, Cloud Run logs                |
| GraphQL API       | `/graphql`, workspace reads/writes, settings pages            | Cloud Run smoke, GraphQL query result, server logs    |
| AI Chat / Copilot | Ask AI, model routing, streaming, Vertex-backed providers     | Manual chat smoke, provider quota/error logs          |
| Authentication    | Login, OAuth callbacks, sessions, invitations                 | Login smoke, OAuth callback check, email invite check |
| Storage / Uploads | Workspace files, GCS-backed assets, import/export             | Upload/download smoke, GCS errors                     |
| Billing           | Checkout, plan state, Stripe webhooks                         | Checkout dry run or provider health, webhook logs     |
| Email Delivery    | Invitations and transactional email                           | Resend/provider dashboard and backend mail logs       |
| Social Analytics  | Meta/TikTok/LINE connection and ingestion surfaces            | Connection test, webhook logs, analytics UI smoke     |
| Database / Search | Workspace persistence, migrations, pgvector-backed search     | Migration job, Cloud SQL health, smoke queries        |

## 3. Customer-Facing States

Use the provider's closest equivalent labels if the selected provider uses
different wording.

| State                | Use when                                                                           | Operator rule                                                                   |
| -------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Operational          | The component passes its evidence gate and has no active customer-impacting errors | Do not use for newly recovered incidents until monitoring evidence is collected |
| Degraded Performance | The component works but has elevated latency, retries, or partial provider errors  | Include the user-visible symptom and the next update time                       |
| Partial Outage       | A subset of users, regions, workspaces, or features cannot complete the workflow   | List affected scope and known workaround if one exists                          |
| Major Outage         | Most users cannot access Manut or a launch-critical path is down                   | Page immediately, pause launch comms, and prepare rollback                      |
| Maintenance          | A planned operator action may interrupt service                                    | Publish in advance unless it is emergency maintenance                           |

Incident lifecycle labels:

1. **Investigating:** impact is confirmed but root cause is not.
2. **Identified:** root cause or failing dependency is known.
3. **Monitoring:** mitigation is deployed and evidence is being collected.
4. **Resolved:** evidence gate passes and comms handoff is complete.

## 4. Update Cadence

| Situation             | First public update                               | Follow-up cadence                               |
| --------------------- | ------------------------------------------------- | ----------------------------------------------- |
| Major outage          | Within 5 minutes of confirmation                  | Every 15 minutes until monitoring               |
| Partial outage        | Within 15 minutes                                 | Every 30 minutes                                |
| Degraded performance  | Within 30 minutes                                 | Every 60 minutes or sooner if impact changes    |
| Planned maintenance   | At least 24 hours before the window when possible | Start, every 30 minutes during work, completion |
| Emergency maintenance | As soon as the operator approves action           | Every 15 minutes until complete                 |

Post-incident notes:

- P0/P1 incidents require a public or customer-facing summary within 48 hours.
- If impact was launch-window only and no public users were affected, record the
  timeline in the launch handoff instead of publishing a public postmortem.

## 5. Manual Incident Flow

1. Assign roles: incident owner, technical lead, status-page operator, and
   comms/support owner.
2. Confirm impact with live evidence, not assumptions. Use deploy smoke, Cloud
   Run logs, provider dashboards, and manual browser checks.
3. Open or update the provider status page incident.
4. Select affected components and set the least-severe accurate customer state.
5. Publish a short update with:
   - customer-visible symptom,
   - affected component or workflow,
   - current lifecycle label,
   - next update time,
   - workaround, if available.
6. Keep internal root-cause notes in the incident channel until validated.
7. Move to **Monitoring** only after a fix, rollback, or provider recovery is
   live.
8. Move to **Resolved** only after the evidence gate passes and support/comms
   confirms no active customer thread needs a different message.

Suggested first update:

```text
We are investigating reports that [workflow/component] is [symptom]. We have
confirmed customer impact and are checking [current evidence source]. Next
update by [time].
```

## 6. Planned Maintenance Flow

Before maintenance:

- Confirm the owner, start/end window, rollback owner, and affected components.
- Confirm the change is approved in the current launch/go-no-go process.
- Publish maintenance with customer-visible impact and expected duration.
- Pause scheduled launch announcements if the maintenance touches signup, auth,
  billing, or AI chat.

During maintenance:

- Set affected components to **Maintenance**.
- Update at the promised cadence even if there is no change.
- If impact exceeds the planned scope or window, convert the event to an
  incident and follow [§5](#5-manual-incident-flow).

After maintenance:

- Run the evidence gate for every affected component.
- Publish completion only after smoke, logs, and manual checks are green.
- Record the maintenance timeline in the launch handoff or release notes.

## 7. Rollback And Communication Handoff

Rollback decisions stay with the deploy/incident owner. Public wording stays
with the status-page operator and comms/support owner.

Rollback triggers:

- Cloud Run revision boot failure, repeated 5xx, or failed migration job.
- `serverConfig.initialized: false` or wrong database after deploy.
- Login, workspace open, billing, or AI chat fails during launch smoke.
- A provider outage blocks the launch-critical path and no workaround exists.

Rollback references:

- Revision rollback:
  [MANUT_DEPLOY_RUNBOOK.md §7](./MANUT_DEPLOY_RUNBOOK.md#7-rollback).
- DNS or data-migration rollback:
  [GCP_CLOUD_RUN_RUNBOOK.md §9](./GCP_CLOUD_RUN_RUNBOOK.md#9-rollback).
- Launch comms hold/resume:
  [MANUT_LAUNCH_COMMS_TEMPLATE.md](./MANUT_LAUNCH_COMMS_TEMPLATE.md).

Handoff template:

```text
Incident:
Status page URL:
Current state:
Affected components:
Customer impact:
Rollback target:
Mitigation applied:
Evidence collected:
Next update due:
Comms/support owner:
Open follow-ups:
```

## 8. Operational Evidence Gate

Before marking the status page itself operational:

- Provider is selected and recorded in [§1](#1-provider-placeholders).
- Public URL resolves and is reachable from an unauthenticated browser.
- Subscriber flow is enabled or explicitly deferred with an owner and date.
- Every component in [§2](#2-components) exists in the provider dashboard.
- Incident and maintenance templates are saved in the provider dashboard.
- API token placeholder has a real secret-manager path, owner, rotation policy,
  and no committed token value.
- At least one manual test incident or private draft incident has been created,
  updated, and resolved by the operator.

Before marking any Manut component **Operational**:

- Latest release handoff records commit SHA, image digest, Cloud Run revision,
  migration job id/status, and rollback target.
- Automated smoke passes:

  ```bash
  BASE_URL=https://manut.xyz TIMEOUT_SECONDS=120 \
    scripts/gcp/smoke-test-cloud-run.sh
  ```

- Manual smoke passes for login, existing workspace open, Ask AI streaming,
  mobile Ask AI, Settings, Members, Integrations, Analytics, and invitation
  email behavior where relevant to the component.
- Cloud Run logs show no new launch-blocking `[ERROR]`, boot failure,
  migration error, or 5xx pattern for the agreed monitoring window.
- Dependent provider dashboards show no active incident for the component path.
- Support/comms owner confirms there are no unresolved customer reports that
  contradict the proposed state.

If any required evidence is missing, leave the component in **Degraded
Performance**, **Partial Outage**, **Major Outage**, or **Maintenance** with the
next update time instead of marking it operational.
