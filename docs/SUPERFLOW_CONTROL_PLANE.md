# Superflow Control Plane

Superflow needs its own operating model for AI-assisted work. Paperclip's
useful idea is not the implementation details; it is the product shape:
a company-level control plane where goals, workers, tasks, adapters, and
handover evidence stay connected.

This document defines the Superflow-native version. It is intentionally
grounded in the AFFiNE fork, GitHub Actions, GCE deploy scripts, Vertex AI,
and the handover docs that already exist here.

## Concept

Superflow treats each major initiative as an operating company:

- **Company**: the workspace or product unit, currently GoGoCash Superflow.
- **Goal**: the outcome that justifies work, such as "ship a verified
  production release" or "import Google content into AFFiNE docs".
- **Employees**: human operators and AI agents with named responsibilities.
- **Adapters**: the systems that can actually act: Codex, GitHub Actions,
  GCE deploy scripts, Vertex-backed Copilot routes, docs, and future APIs.
- **Task tree**: a parent goal decomposed into build, verification, deploy,
  smoke test, rollback, and follow-up tasks.
- **Handover**: the durable artifact that records what happened, what is
  still pending, and which evidence proves the claim.

The control plane owns coordination and evidence. It does not pretend to be
the execution runtime. GitHub Actions still builds images. `deploy.sh` still
does smoke-then-swap. AFFiNE still stores docs. The control plane gives those
pieces a common operating vocabulary.

## First Slice

The first implementation is release handover generation:

```
main or v* tag
  -> Superflow Build or Superflow Release
  -> scripts/superflow-release-handover.mjs
  -> superflow-handover.md and superflow-handover.json artifacts
  -> operator, deploy workflow, or future AFFiNE UI reads the same contract
```

This gives every build a machine-readable and human-readable control-plane
handover without adding runtime risk to the AFFiNE server.

## Operating Roles

| Role            | Responsibility                                                      | Current Adapter                                                            |
| --------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Release Captain | Names the release, records commit/image facts, keeps the goal clear | GitHub Actions summary, `docs/RELEASES/*`                                  |
| Builder         | Produces the immutable Linux amd64 image                            | `superflow-build.yml`, `superflow-release.yml`                             |
| Verifier        | Checks build, bundle, prompt seed, GraphQL, and smoke evidence      | CI jobs, `deploy.sh`, handover artifact                                    |
| Deployer        | Swaps production only after sidecar validation                      | `superflow-autodeploy.yml`, `superflow-deploy.yml`, `scripts/vm/deploy.sh` |
| Historian       | Keeps durable docs current and lists follow-up risk                 | `docs/HANDOVER.md`, `docs/CICD*.md`, release notes                         |

Future AI employees can attach to these roles, but the roles are useful even
when a human is doing all the work.

## Handover Contract

Every generated handover records:

- product goal and control-plane source document
- workflow mode: build, release, or deploy
- status and generated timestamp
- commit SHA, short SHA, ref, actor, run id, and run URL
- image tag, image digest, registry, and deploy URL when known
- agent board: role, adapter, and responsibility
- task tree: build, verify, deploy, observe, document
- verification gates and rollback pointer

The Markdown artifact is for operators. The JSON artifact is the seed for a
future AFFiNE-native board or doc importer.

## Why Build Our Own

Paperclip's concept is intentionally broad and runtime-neutral. Superflow
already has strong opinions:

- AFFiNE docs are the durable workspace.
- GitHub Actions owns build orchestration.
- GCE and `deploy.sh` own production swaps.
- Vertex-backed Copilot routes are the AI provider boundary.
- Handover quality matters as much as code because this fork is operated by
  multiple agents over time.

Building our own control plane lets us keep those constraints as first-class
product rules instead of wrapping them in a generic external adapter.

## Phases

### Phase 1 - Release Handover Artifacts

Ship the generator and emit artifacts from build/release workflows.

Done when every CI image build has `superflow-handover.md` and
`superflow-handover.json` alongside `image-tag.txt`.

### Phase 2 - Handover Inbox

Add an AFFiNE-facing importer or admin view that can ingest the JSON handover
and create or update a workspace doc. This should reuse existing doc writer
paths instead of adding a parallel storage model.

### Phase 3 - Agent Registry

Represent operating roles as editable Superflow records: owner, adapter,
permissions, escalation notes, and last successful task. Start read-only.

### Phase 4 - Task Board

Expose the task tree as a board linked to docs, releases, and deploy runs.
Actions should remain behind existing workflow and permissions boundaries.

## Design Rules

- Keep execution adapters explicit. Do not hide production actions behind a
  vague "agent did it" label.
- Every autonomous action needs evidence, a rollback path, and an owner.
- Prefer generated artifacts before database schema. The JSON contract can
  stabilize before we make it user-facing.
- Keep the release path boring. The control plane should improve handover,
  not increase deploy risk.
