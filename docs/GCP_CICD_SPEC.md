# Manut GCP-Owned CI/CD Spec

**Status:** implementation contract  
**Date:** 2026-05-26  
**R-tier:** R1 for live Cloud Build triggers, R2 for repo config and docs  
**Target project:** `affine-495114` (`602860445793`)  
**Target region:** `asia-southeast1` for runtime, `global` for first-gen
GitHub Cloud Build triggers

## Goal

Move Manut's deploy control plane from GitHub Actions to GCP Cloud Build while
keeping GitHub only as the source repository and PR status surface.

Success means:

- Pull requests to `main` can run Manut CI through Cloud Build.
- Pushes to `main` can deploy the staging Cloud Run service through Cloud Build.
- Production Cloud Run deploy is present as an approval-gated manual Cloud
  Build trigger, not an automatic push trigger.
- The Cloud Build deploy path still runs migrations once through a Cloud Run
  Job, then deploys the web service with startup migrations disabled.
- GitHub Actions can remain temporarily as fallback until Cloud Build is green
  on real PR and main events.

## Trigger Model

| Trigger                  | Event             | Config                            | Risk | Behavior                                      |
| ------------------------ | ----------------- | --------------------------------- | ---- | --------------------------------------------- |
| `manut-gcp-pr-ci`        | PR to `main`      | `cloudbuild.manut-ci.yaml`        | R2   | Lint, GraphQL codegen drift, web/admin/mobile |
| `manut-gcp-main-staging` | Push to `main`    | `cloudbuild.manut-cloud-run.yaml` | R1   | Build image, migrate staging, deploy staging  |
| `manut-gcp-prod-deploy`  | Manual invocation | `cloudbuild.manut-cloud-run.yaml` | R1   | Approval-gated production deploy              |

Production is intentionally manual until:

1. Staging custom-domain TLS is ready.
2. A rehearsal database restore proves durable workspaces and Ask AI.
3. DNS cutover has a maintenance window and rollback owner.

## Task Plan

### T1. Repo CI on Cloud Build

**Intended behavior:** Cloud Build can run the equivalent of `Manut CI` without
depending on GitHub Actions runners.

**Affected files:**

- `cloudbuild.manut-ci.yaml`
- `scripts/gcp/validate-cloud-build-cicd.sh`
- `docs/GCP_CICD_SPEC.md`

**Test names:**

- `cloud build ci > given pr source > then oxlint runs with deny warnings`
- `cloud build ci > given graphql operation changes > then codegen drift fails`
- `cloud build ci > given frontend source > then web admin mobile bundles build`

**Rollback:** disable or delete `manut-gcp-pr-ci`; GitHub `Manut CI` remains as
fallback during the transition.

### T2. Trigger-safe Cloud Run deploy

**Intended behavior:** The existing Cloud Run template works from Cloud Build
triggers, uses immutable commit image tags, and smokes the deployed service.

**Affected files:**

- `cloudbuild.manut-cloud-run.yaml`
- `scripts/gcp/smoke-test-cloud-run.sh`
- `docs/GCP_CLOUD_RUN_RUNBOOK.md`

**Test names:**

- `cloud build deploy > given main push > then image tag comes from SHORT_SHA`
- `cloud build deploy > given smoke base omitted > then service URL is used`
- `cloud build deploy > given api endpoint redirects to setup > then smoke fails`

**Rollback:** disable `manut-gcp-main-staging` or `manut-gcp-prod-deploy` and
use the previous GitHub Actions/Railway flow.

### T3. Trigger installation

**Intended behavior:** Operators can create or update all Cloud Build triggers
idempotently from one script without pasting secrets.

**Affected files:**

- `scripts/gcp/upsert-cloud-build-triggers.sh`
- `docs/GCP_CLOUD_RUN_RUNBOOK.md`

**Test names:**

- `trigger install > given no existing triggers > then creates pr staging and prod triggers`
- `trigger install > given existing triggers > then updates substitutions in place`
- `trigger install > given production deploy > then manual approval is required`

**Rollback:** run `gcloud builds triggers delete <trigger-id>` for the affected
trigger, or disable it in the Cloud Build console.

## Edge Cases

- **Production auto-deploy before cutover:** Do not create a production push
  trigger until Cloud Run owns `manut.xyz` and the database write path is
  migrated.
- **Production smoke before DNS:** The production manual trigger must leave
  `_SMOKE_BASE_URL` unset before DNS cutover so the deploy template resolves and
  smokes the generated Cloud Run service URL. After `manut.xyz` points at Cloud
  Run, operators may rerun the installer with
  `PROD_SMOKE_BASE_URL=https://manut.xyz`.
- **Staging TLS lag:** The staging trigger should smoke the generated Cloud Run
  URL until `staging.manut.xyz` managed TLS is `Ready=True`.
- **GitHub App not connected:** Trigger creation may fail until the Cloud Build
  GitHub App is installed for `mygogocash/Manut`.
- **IAM drift:** Prefer a dedicated Cloud Build service account. If the default
  Cloud Build service account is used temporarily, record it in the runbook and
  replace it before production cutover.
- **Secret exposure:** Trigger substitutions must reference Secret Manager
  secret names only. Never put secret values in trigger substitutions.

## Verification Strategy

Repo validation:

```bash
bash -n scripts/gcp/*.sh
scripts/gcp/validate-cloud-build-cicd.sh
yarn prettier --check cloudbuild.manut-ci.yaml cloudbuild.manut-cloud-run.yaml docs/GCP_CICD_SPEC.md docs/GCP_CLOUD_RUN_RUNBOOK.md scripts/gcp/validate-cloud-build-cicd.sh scripts/gcp/upsert-cloud-build-triggers.sh
```

GCP validation:

```bash
gcloud builds triggers list --project affine-495114 --region=global
gcloud builds triggers run manut-gcp-pr-ci --branch=main --project affine-495114 --region=global
gcloud builds triggers run manut-gcp-main-staging --branch=main --project affine-495114 --region=global
```

Production trigger validation stays manual until the Cloud Run production
cutover checklist is complete.
