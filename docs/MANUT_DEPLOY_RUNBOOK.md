# Manut Production Deploy Runbook

> **Audience:** the operator deploying Manut to the GCP production stack.
> **Current path:** GCP Cloud Build -> Artifact Registry -> Cloud Run service
> `manut` plus Cloud Run job `manut-migrate`.
> **R-tier:** R1. Production deploys touch migrations, auth, AI providers,
> storage, GraphQL, and public DNS.

Use [GCP_CLOUD_RUN_RUNBOOK.md](./GCP_CLOUD_RUN_RUNBOOK.md) for the full
cutover and data-migration procedure. This file is the short deploy checklist
for normal production releases after Cloud Run is the active production path.

## 1. Pre-Deploy Gates

Run these before building or approving a production deploy:

- [ ] Confirm the target commit is on `main` or an approved release branch.
- [ ] Confirm the current rollback target is recorded: previous Cloud Run
      revision, image tag or digest, database state, and DNS fallback.
- [ ] Confirm no operator is running a concurrent migration, secret rotation, or
      DNS change.
- [ ] Confirm the required GitHub/Cloud Build checks are green for the target
      commit.
- [ ] Confirm any new environment variables are documented in `.env.example`,
      Secret Manager, and the release notes.
- [ ] Confirm production migrations are additive or have an explicit rollback
      and operator approval.

## 2. Secrets And Runtime Config

Production secrets are stored in GCP Secret Manager and injected into Cloud Run
at revision startup. Do not paste secret values into chat, commits, issue
comments, CI logs, or docs.

Current required secret contract:

```text
manut-database-url
manut-affine-config-json-b64
manut-affine-private-key
manut-google-oauth-client-id
manut-google-oauth-client-secret
manut-resend-api-key
```

Add provider-specific OAuth, Stripe, analytics, and social-integration secrets
with the same `manut-*` naming pattern. After rotating any secret, deploy a new
Cloud Run revision; running instances do not pick up Secret Manager changes
mid-flight.

## 3. Build And Image Publication

Cloud Build is the preferred build path:

```bash
gcloud builds triggers run manut-gcp-prod-deploy \
  --branch=main \
  --project=affine-495114 \
  --region=global
```

Approve the pending production build in Cloud Build when the launch operator is
ready. The build must:

1. Build the Manut container image.
2. Push an immutable image tag to Artifact Registry.
3. Create or update the `manut-migrate` Cloud Run job.
4. Execute migrations and wait for success.
5. Deploy Cloud Run service `manut` with
   `MANUT_RUN_STARTUP_MIGRATIONS=false`.
6. Route 100% traffic to the latest ready revision.
7. Verify the serving revision digest matches the just-built image tag.
8. Smoke the generated Cloud Run URL before relying on public DNS.

For local emergency builds, follow the manual bundle and Docker guidance in
[GCP_CLOUD_RUN_RUNBOOK.md](./GCP_CLOUD_RUN_RUNBOOK.md#4-build-and-deploy-staging)
and [CICD.md](./CICD.md). Do not ship a local image unless the server bundle,
web bundle, and image startup smoke have all been verified.

## 4. Migration Gate

Cloud Run deploys run migrations through the `manut-migrate` job, not through
the web service startup path.

Manual migration-job execution:

```bash
scripts/gcp/run-cloud-run-migration-job.sh
```

The job must exit 0 before traffic moves to the new revision. If the job fails:

- Do not route traffic to the new revision.
- Inspect the Cloud Run job logs.
- Restore the previous service revision or leave current traffic untouched.
- Resolve the migration state before retrying.

## 5. Production Smoke

Smoke must prove the API is serving JSON, not an SPA fallback:

```bash
BASE_URL=https://manut.xyz TIMEOUT_SECONDS=120 \
  scripts/gcp/smoke-test-cloud-run.sh
```

Expected checks:

- `/info` returns the AFFiNE compatibility JSON payload.
- GraphQL `serverConfig.initialized` is `true`.
- Required server features include `Manut` and `Copilot`.
- No GraphQL `errors` payload is returned by the smoke query.
- Cloud Run traffic is 100% on the latest ready revision.
- The serving revision image digest matches the image tag from the current
  Cloud Build run.

Manual confirmations after automated smoke:

- [ ] Login works.
- [ ] Existing workspace opens.
- [ ] Ask AI opens, model selector lists Vertex-backed Gemini/Claude options,
      and one short response streams successfully.
- [ ] Mobile viewport can open Ask AI and send one message.
- [ ] Settings, Members, Integrations, and Analytics pages load without a 500
      error.
- [ ] Invitation email flow uses Resend and surfaces friendly errors if the
      provider is unavailable.

## 6. Monitoring During First Hour

Inspect Cloud Run after deploy:

```bash
gcloud run services describe manut \
  --project=affine-495114 \
  --region=asia-southeast1

gcloud run services logs read manut \
  --project=affine-495114 \
  --region=asia-southeast1 \
  --limit=200
```

Watch for:

- HTTP 5xx or request timeouts.
- `GraphQLService.gql` failures.
- Prisma or migration errors.
- Redis connection errors.
- Vertex 429/5xx spikes.
- repeated container starts.
- AI streaming disconnects.
- `UndefinedTypeError`, `UnknownDependenciesException`, or DI boot failures.

Required alert coverage before public launch:

- Cloud Run 5xx rate above 1 percent for 5 minutes.
- Cloud Run p95 latency above 3 seconds for 10 minutes.
- Cloud SQL CPU or connection pressure above agreed thresholds.
- Redis memory above agreed threshold.
- Vertex 429s above baseline.
- Cloud Run instance count pinned at max for 10 minutes.

## 7. Rollback

Rollback is revision-first when the database remains compatible:

```bash
gcloud run services update-traffic manut \
  --project=affine-495114 \
  --region=asia-southeast1 \
  --to-revisions=<previous-revision>=100
```

If DNS was just cut over and the Cloud Run stack is not safe to serve, use the
DNS rollback path from [GCP_CLOUD_RUN_RUNBOOK.md](./GCP_CLOUD_RUN_RUNBOOK.md#9-rollback).
Railway is only a rollback target when the launch operator has intentionally
kept it online and write-safe for the stability window.

Data warning: if Cloud Run accepted writes after cutover, rolling DNS back to
Railway loses those writes unless a replay or waiver plan exists.

## 8. Failure Modes

| Symptom                                                                        | Likely cause                                                               | Recovery                                                                                |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `UndefinedTypeError: ... explicit type for the "<field>" of "<class>"` on boot | Nullable GraphQL `@Field` without an explicit `() => Type`                 | Route traffic to the previous revision. Add the explicit type. Rebuild and redeploy.    |
| `UnknownDependenciesException: Nest can't resolve dependencies of X (?)`       | `import type` on a DI target or missing provider registration              | Route traffic to the previous revision. Fix DI import/provider wiring. Rebuild.         |
| Blank page after deploy, no console errors, `#app` empty                       | Bundle mismatch or stale generated source                                  | Rebuild server and web bundles from a clean source tree. Publish a fresh image.         |
| `redirect_uri_mismatch` on Google sign-in                                      | `SERVER_URL` or OAuth callback URL drift                                   | Update GCP OAuth client or Cloud Run env to match. Deploy a new revision.               |
| Invitation email never arrives                                                 | Resend secret/domain issue or provider reject                              | Check Secret Manager, Resend domain status, and backend mail logs.                      |
| AI chat returns provider errors                                                | Vertex config, quota, model routing, or regional Anthropic Vertex mismatch | Check `/api/server-config`, Cloud Run logs, and Vertex quota before changing code.      |
| `serverConfig.initialized: false` in smoke                                     | Wrong database or incomplete production restore                            | Do not launch. Point service at the verified Cloud SQL database and rerun migrations.   |
| `Migration failed: relation already exists`                                    | Partial migration apply                                                    | Inspect `_prisma_migrations`; use `prisma migrate resolve` only with operator approval. |
| `Migration failed: extension "vector" does not exist`                          | Cloud SQL target missing `pgvector`                                        | Enable `vector` as an approved superuser action, then rerun the migration job.          |

## 9. Post-Deploy Notes

Record in the release handover:

- Commit SHA.
- Cloud Build build id.
- Artifact Registry image tag and digest.
- Cloud Run revision receiving traffic.
- Migration job execution id and status.
- Smoke-test timestamp and result.
- Rollback target.
- Known waived checks, if any.

If the first-hour window shows no new error class and no critical funnel cliff,
mark the deploy green in the project progress docs.
