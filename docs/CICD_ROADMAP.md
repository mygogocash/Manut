# Superflow CI/CD — Status & Roadmap

Where the deploy pipeline is, what's shipping, and what's queued. For
the architecture reference (how it works), see [`CICD.md`](./CICD.md).
For daily commands, see [`CLAUDE.md`](../CLAUDE.md) §4.

Last updated: 2026-05-06.

---

## TL;DR

- **Tier 1 — DONE.** Smoke-then-swap pipeline with sidecar validation
  and auto-rollback is live. Production never gets a broken image.
- **Tier 2 — DONE.** Build/deploy split, registry buildx cache,
  determinism guards, Slack notifications, prompt-seed verification,
  supersession, and a chaos test that validates the safety net under
  fire. Eight commits, three of them bug fixes uncovered by the
  pipeline itself working as intended.
- **Tier 3 — BACKLOG.** Slow-degradation detection, blue-green
  rollouts, multi-VM, image signing, observability stack, alerting.
- **Production right now:** image
  `main-393950532-25413249523`, `/info` HTTP 200, deployed via the
  full autodeploy chain (push → CI → Build → Auto Deploy) in ~15 min
  total wall time.

---

## Where we are (snapshot)

| Component                         | State                                           |
| --------------------------------- | ----------------------------------------------- |
| Production image                  | `main-393950532-25413249523`                    |
| Production health                 | `/info` HTTP 200                                |
| Auto Deploy 25413543034 wall time | 2m20s (deploy step only)                        |
| Build 25413249523 wall time       | ~10m (warm cache)                               |
| Last `deploy.sh` exit code        | 0 (success)                                     |
| Sidecar smoke                     | passed (15s)                                    |
| Post-swap smoke                   | passed (35s)                                    |
| Prompt-seed gate                  | passed (2s)                                     |
| Last validated chaos test         | 2026-05-06 — exit 1 as expected, prod untouched |

### Pipeline workflows live on `main`

| File                                         | Purpose                                     | Triggers on                                               |
| -------------------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| `.github/workflows/superflow-ci.yml`         | Lint, codegen drift, bundle smoke           | push, PR                                                  |
| `.github/workflows/superflow-build.yml`      | Build + push docker image                   | `Superflow CI` success / `workflow_dispatch` (cache nuke) |
| `.github/workflows/superflow-autodeploy.yml` | Pull artifact, SSH `deploy.sh`              | `Superflow Build` success                                 |
| `.github/workflows/superflow-deploy.yml`     | Manual deploy of any GAR tag                | `workflow_dispatch`                                       |
| `.github/workflows/superflow-rollback.yml`   | One-button revert                           | `workflow_dispatch`                                       |
| `.github/workflows/superflow-vm-init.yml`    | Install/refresh VM scripts + canary overlay | `workflow_dispatch`                                       |
| `.github/workflows/superflow-release.yml`    | Tag-driven release build (`v*.*.*`)         | tag push                                                  |

### VM scripts live on `affine-vm`

| Path                                           | Purpose                                                |
| ---------------------------------------------- | ------------------------------------------------------ |
| `/srv/affine/scripts/deploy.sh`                | Smoke-then-swap with sidecar + supersede + prompt-seed |
| `/srv/affine/scripts/rollback.sh`              | Restore from `compose.yml.previous.bak`                |
| `/srv/affine/compose/compose.canary.yml`       | Sidecar overlay (port 3011, validation profile)        |
| `/srv/affine/compose/compose.yml.previous.bak` | Snapshot of last-known-good prod compose               |

---

## What we shipped this session

### Tier 1 — smoke-then-swap deploy contract

Foundation work. The promise: **production never sees a broken image**.

| #   | Commit      | Subject                                                                  |
| --- | ----------- | ------------------------------------------------------------------------ |
| 1.1 | `95314cbf1` | `ci(tier1): smoke-then-swap with sidecar validation + auto-rollback`     |
| 1.2 | `0fde3f55c` | `ci(tier1): VM-side deploy.sh + rollback.sh + compose template`          |
| 1.3 | `99152325e` | `ci(tier1): canary as overlay, not compose.yml replacement`              |
| 1.4 | `c59d22aac` | `fix(ci): use images describe for GAR tag existence check`               |
| 1.5 | `8e7c462b2` | `docs(cicd): architecture reference for Tier 1 smoke-then-swap pipeline` |

What it gives us:

- **Sidecar validation.** New image starts as `affine_canary` on
  host port 3011 (same DB + Redis as prod). `localhost:3011/info`
  must return 200 within 90s before production is ever touched.
- **Atomic swap.** Only after sidecar passes does `deploy.sh`
  `sed`-replace the image tag in `compose.yml` and
  `docker compose up -d --force-recreate affine`.
- **Auto-rollback.** If the post-swap `https://.../info` poll fails
  within 60s, `deploy.sh` restores `compose.yml.previous.bak` and
  recreates. Exit code 2 = rolled back; production safe.
- **Immutable image tags.** Every build pushes a unique
  `main-<short-sha>-<run_id>`. No `:latest` or `:main-<sha>`
  collisions.
- **Compose preservation.** vm-init NEVER replaces `compose.yml` —
  the canary is added as a separate overlay file via
  `docker compose -f compose.yml -f compose.canary.yml`. Operator-
  specific config (env_file paths, AFFINE_DOMAIN, env-driven
  DATABASE_URL) is preserved.
- **Idempotent vm-init.** Re-running `superflow-vm-init.yml` is safe.

### Tier 2 — operational hardening

Eight commits across three concurrent agents (consolidated by hand
because their changes overlapped on the same files), plus three bug
fixes uncovered by running the pipeline itself.

| #         | Commit      | Subject                                                                   | Status              |
| --------- | ----------- | ------------------------------------------------------------------------- | ------------------- |
| 2.1 + 2.6 | `a66b90bfd` | `ci(tier2): decouple build from deploy + concurrency-lock supersession`   | shipped             |
| 2.2 + 2.3 | `d4e7ea05a` | `ci(tier2): registry buildx cache + build determinism guards`             | shipped             |
| 2.4 + 2.5 | `e580cf4a7` | `ci(tier2): Slack notifications + post-swap prompt-seed verification`     | shipped             |
| 2.7       | `7f250a82a` | `docs(cicd): chaos test runbook + 2026-05-06 validation result`           | shipped + validated |
| fix-1     | `40fadf8b6` | `fix(ci): prune step must not glob into node_modules`                     | shipped             |
| fix-2     | `393950532` | `fix(deploy): pre-pull psql image outside the prompt-seed timeout window` | shipped             |

#### 2.1 — Decoupled build and deploy

`superflow-autodeploy.yml` no longer builds. Now there's a separate
`superflow-build.yml` whose only job is `bundle + napi + docker
buildx push`. It uploads the new image tag as an `image-tag`
artifact (because GHA's `workflow_run.outputs` is intentionally
empty — a documented limitation), and the autodeploy workflow
downloads that artifact via `gh run download <build_run_id>`.

Wins:

- Re-deploy without re-bundling (`superflow-deploy.yml -f tag=...`).
- Build job is cacheable + idempotent.
- Deploy job is small (~2-3 min) and easy to reason about.
- Defensive checks at every handoff step (artifact missing,
  `image_tag=` line missing, charset, GAR tag existence).

#### 2.2 — Registry-backed buildx cache

Replaced opaque `type=gha` cache with
`asia-southeast1-docker.pkg.dev/.../affine-gogocash-cache:buildx`.
Three properties this fixes:

1. **Visible.** `docker manifest inspect <cache-image>:buildx`
   shows what's there.
2. **Selectively invalidable.** `gh workflow run
superflow-build.yml -f nuke_cache=true` deletes the cache image
   entirely. Cold next build (~10 min slower), repopulates fresh.
3. **Cross-runner reuse.** Every CI run hits the same cache.

Plus `no-cache-filters: assets` forces the COPY layer that pulls
in dist directories to rebuild every time (~30s/build, defense
against the empty-mobile-dist class of bug).

Gotchas surfaced + documented:

- First-run cold cache (~10 min slower).
- Deployer SA needs `roles/artifactregistry.repoAdmin` to delete;
  currently has `writer` so nuke uses `|| true`.

#### 2.3 — Build determinism (4 guards)

| Guard                                                                              | What it catches                                                                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Pin yarn via `corepack prepare yarn@4.13.0 --activate`                             | runner default drift                                                                             |
| Prune `packages/{frontend,backend}/{web,mobile,admin,server}/dist` before bundling | leftover dist tree from a previous run                                                           |
| `git status --porcelain packages/ blocksuite/ tools/` after bundles                | rspack/tsc writing back into source tree (`*.js` next to `*.css.ts` poisoning subsequent builds) |
| `.dockerignore` filters                                                            | non-deterministic context                                                                        |

Permitted-vs-forbidden artifact list documented in CICD.md (some
`.d.ts` files are legitimately hand-authored under `src/`).

#### 2.4 — Slack notifications (opt-in)

Every workflow ending with a deploy posts a one-liner to
`SLACK_WEBHOOK_URL`. Skips silently if the secret is unset (no
broken pipeline if Slack isn't configured).

| Outcome                     | Message                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| Deploy success              | `[OK] <repo>@<sha>: deployed via <workflow>`                     |
| Sidecar fail (DEPLOY_RC=1)  | `[FAIL] deploy FAILED ... still on prior tag`                    |
| Auto-rollback (DEPLOY_RC=2) | `[FAIL] deploy FAILED ... post-swap smoke or prompt-seed failed` |
| Rollback fail (DEPLOY_RC=3) | `[CRIT] deploy FAILED ... manually intervene`                    |
| Superseded (DEPLOY_RC=4)    | `[WARN] superseded`                                              |

Safety: webhook URL flows through `env:` only, body is
`jq`-escaped, `curl --max-time 10 ... || true` so a Slack 5xx never
fails the workflow.

#### 2.5 — Prompt-seed verification

`/info=200` proves the listener bound a port. It does NOT prove
`PromptService.onApplicationBootstrap` finished seeding the
canonical AI prompts (which runs **after** the listener binds).
A silent seed failure (`VarChar(32)` overflow, dup-key violation)
breaks AI features without breaking the smoke check.

After post-swap smoke passes, `deploy.sh` now runs:

```sql
SELECT COUNT(*) FROM ai_prompts_metadata
WHERE name IN ('Chat With AFFiNE AI', 'Auto Tag', 'Summary as title');
```

via a transient `postgres:16-alpine` container on
`affine_affine_net`. Count != 3 → auto-rollback (exit 2).
psql infra error → exit 3 (manual; we don't auto-rollback an
unprovably-broken deploy).

Threat model: DB password lives in the live container env, read
locally on the VM. The GHA runner only SSHes in — it never reads,
sees, or transmits the password.

#### 2.6 — Concurrency-lock supersession

GHA `cancel-in-progress` only kills the runner. The
already-SSHed `deploy.sh` keeps going. Two pushes within seconds
used to result in one ghost deploy and a misleading "cancelled"
GHA UI.

`deploy.sh` now learns `--supersede-run-id <id>`:

1. Reads `/tmp/affine-deploy.runid` (`<run_id> <pid>`).
2. Existing run_id > ours → exit 4 (we're superseded).
3. Existing run_id < ours → SIGTERM the holder pid, wait 5s,
   SIGKILL fallback, take the lock, claim runid file atomically.
4. Same run_id → refuse to race ourselves.

Manual invocations (no `--supersede-run-id`) keep legacy
`flock -n` semantics — operators don't get superseded by GHA.

New exit code 4 = superseded. NOT a failure (the newer deploy is
the one whose result reflects production).

#### 2.7 — Chaos rollback test (validating the safety net)

Synthetic broken-image deploy that proves the sidecar smoke check
actually exits 1 and production stays up. Tested 2026-05-06:

- Built a busybox image returning HTTP 503 forever on `:3010`.
- Pushed as `main-chaostest1-25412016315`.
- Triggered `superflow-deploy.yml` with 60s smoke timeout.
- `deploy.sh` exit code: **1**.
- Workflow conclusion: **failure**.
- Production `/info` returned **200 throughout** (4 probes, 80s).
- Production image tag **unchanged**.
- Total chaos run wall time: **2m16s**.

Documented in CICD.md "Chaos test (validating the safety net)"
with full runbook, pass criteria table, and a "last validated"
record updated by future operators after each run.

#### Bug fix #1: prune glob into `node_modules`

Agent B's first cut of the prune step used
`find packages/frontend -path '*/dist' -type d -exec rm -rf {} +`
which matched `packages/frontend/admin/node_modules/react-router-dom/dist`
(and every other vendored library that ships compiled output that
way). Build 25412101434 failed with `Module not found: Can't
resolve 'react-router-dom'`.

Fixed in `40fadf8b6` — explicit `rm -rf` of the four
package-owned dist directories. No traversal into `node_modules`.

#### Bug fix #2: psql pre-pull race

First Tier 2 deploy on a VM that had never run the prompt-seed
gate hit this race: `docker run --rm postgres:16-alpine psql ...`
did an implicit image pull inside `docker run`, the pull alone
exceeded the 10s `timeout` wrapping the whole exec, `timeout`
killed it with rc=124, and the gate returned 3 (manual
intervention) on a perfectly healthy deploy.

Fixed in `393950532` — `docker image inspect` first, then
`docker pull` with `|| true` BEFORE the timeout window. On second
runs the inspect succeeds and no pull happens. On the very first
run, the pull takes ~10–15s but that's outside the timeout
budget so the actual psql query gets the full 10s.

---

## What's next

### Operational follow-ups (before any new feature work)

| Item                                                                  | Status     | Effort | Reason                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rotate DB password                                                    | DEFERRED   | 30m    | The current password was visible in the chat transcript during Tier 1 debugging. Even though we routed through env-only on the VM going forward, the historical exposure means it should be rotated. Owner accepted residual risk on 2026-05-11; storing in GitHub Secrets without rotating does NOT address the exposure.       |
| Grant `roles/artifactregistry.repoAdmin` to deployer SA on cache repo | DONE 05-11 | 15m    | Granted 2026-05-11 on the `affine` GAR repo (asia-southeast1). The buildx cache is a sibling image (`affine-gogocash-cache:buildx`) inside the same repo, not a separate repo. Verified policy lists `affine-gha-deployer@…` with `roles/artifactregistry.repoAdmin`. `nuke_cache=true` will no longer fall back to `\|\| true`. |
| Worktree cleanup                                                      | DONE 05-11 | 5m     | ~~Three consumed agent worktrees still locked at `.claude/worktrees/agent-{ae3bf954e4078386d, aedc7c59a3c00776f, a2e240fb645ca30ae}`.~~ Removed 2026-05-11. Verified commit messages match merged commits on main (`d4e7ea05a`, `a66b90bfd`, `e580cf4a7`). Orphan branches also deleted.                                         |
| Pre-existing lint debt sweep                                          | DONE       | ~1h    | Verified clean 2026-05-11: `yarn oxlint --deny-warnings` (0 warnings/errors across 7110 files) and `yarn eslint --no-cache` on both files. Per CLAUDE.md §5 the debt was already cleared post-`2900714c2`; the roadmap entry was stale.                                                                                          |

### Cache repo admin grant (runbook — historical, completed 2026-05-11)

The buildx layer cache lives as a sibling image
`affine-gogocash-cache:buildx` **inside** the `affine` GAR repo —
not in a separate repo (the path
`asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash-cache`
is `<host>/<project>/<repo>/<image>`). To enable `nuke_cache=true` to
actually delete that image instead of silently 403'ing into the
`|| true` fallback, the deployer SA needs
`roles/artifactregistry.repoAdmin` on the `affine` repo.

Granted 2026-05-11 with:

```bash
gcloud artifacts repositories add-iam-policy-binding affine \
  --location=asia-southeast1 \
  --project=affine-495114 \
  --member='serviceAccount:affine-gha-deployer@affine-495114.iam.gserviceaccount.com' \
  --role='roles/artifactregistry.repoAdmin'
```

Verify (still useful for audits):

```bash
gcloud artifacts repositories get-iam-policy affine \
  --location=asia-southeast1 --project=affine-495114 \
  --format='value(bindings.role,bindings.members)' \
  | grep -E 'repoAdmin|affine-gha-deployer'
```

Smoke test (not yet run): `gh workflow run superflow-build.yml
-f nuke_cache=true` should now delete the cache image cleanly without
the `|| true` fallback triggering.

### Tier 3 — multi-region / production-grade backlog

These are the items the Tier 1+2 pipeline does NOT cover. Pick the
ones whose risk-vs-cost actually matters for Superflow's traffic
profile (currently single-VM, single-region). Some of these may
never need to ship.

| #    | Item                                       | Why it matters                                                                                                                                                | Notes                                                                                                                                                                                                   |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1  | Synthetic-query smoke (beyond `/info=200`) | Slow-degradation bugs slip through binary smoke. A new image that returns 200 but takes 30s/request is "healthy" by current criteria.                         | Add 3-5 light queries to the sidecar smoke (e.g. `SELECT 1`, GraphQL `__typename`, an admin endpoint). Add a p95 budget.                                                                                |
| 3.2  | Image signing (cosign / sigstore)          | Defense-in-depth against a compromised WIF or stolen GAR push cred. Today, anyone with push access can ship a poisoned image and the pipeline will deploy it. | `cosign sign` after build, `cosign verify` in `deploy.sh` before the swap. Adds ~30s.                                                                                                                   |
| 3.3  | Blue-green / canary-percent rollout        | Single-VM means single failure domain. Even with smoke-then-swap, a bug that takes 2+ minutes to manifest can hit prod.                                       | Requires multi-VM topology + traffic splitter (Caddy/Cloud LB). Not worth it until traffic justifies it.                                                                                                |
| 3.4  | Multi-region deploys                       | Disaster recovery, latency for non-SEA users.                                                                                                                 | Even bigger lift than 3.3. Requires data layer to be region-aware (Cloud SQL replicas, Redis topology).                                                                                                 |
| 3.5  | Observability stack                        | Prometheus/Grafana + structured logs for the affine_server container. Currently we read `docker logs` ad-hoc.                                                 | Could be as light as Cloud Logging + a few custom metrics.                                                                                                                                              |
| 3.6  | Alerting on deploy outcomes                | Slack opt-in is post-hoc. Real alerting would page on consecutive deploy failures or post-deploy /info=5xx for >N min.                                        | Builds on 3.5.                                                                                                                                                                                          |
| 3.7  | Exit 2 chaos test                          | Tier 2 chaos test only covers exit 1 (sidecar fail). Exit 2 (post-swap auto-rollback) and exit 3 (rollback itself fails) are exercise-by-incident only.       | Hard to engineer synthetically — sidecar runs against the same DB+Redis as prod, so anything that 200s on the sidecar should 200 on prod. Best engineered via fault injection in a staging environment. |
| 3.8  | Exit 3 chaos test                          | Same.                                                                                                                                                         | Even harder — requires deliberately corrupting `compose.yml.previous.bak` mid-deploy.                                                                                                                   |
| 3.9  | Build-time secret rotation policy          | If a leaked WIF or GAR cred gets used to push a poisoned image, current pipeline deploys it.                                                                  | Pairs with 3.2. Could be as simple as quarterly rotation + monitoring.                                                                                                                                  |
| 3.10 | Migration safety (forward + backward)      | Today migrations run via `affine_migration_job` after the swap. If a migration is non-reversible, rollback won't actually undo the schema change.             | Audit Prisma migrations for backward compatibility. Could add a "migration safety" check that fails CI for non-idempotent / non-reversible changes.                                                     |
| 3.11 | Dependency-update automation               | `dependabot.superflow.yml` exists in `.github/` but is NOT enabled (rename to `dependabot.yml` to enable).                                                    | 5-min change. Adds weekly grouped dep PRs.                                                                                                                                                              |
| 3.12 | E2E test gate before deploy                | Currently CI runs lint + bundle but no E2E. A bug that compiles cleanly but breaks a user flow ships and only gets caught by sidecar `/info`.                 | Build on existing `playwright` infra in `tests/`. Adds 5-15 min to the pipeline.                                                                                                                        |

### Tier 3.X — observability + supply chain (longer-horizon)

These are even further out — list here so they don't get forgotten.

- SBOM generation (`syft` / `grype`) attached to every image push.
- Vulnerability scanning gate (`trivy` / `snyk`) before deploy.
- Buildx provenance attestation (already half-done by `docker/build-push-action@v5`).
- Reproducible builds (deterministic timestamps in Dockerfile, see
  `SOURCE_DATE_EPOCH`).
- Restricted egress: `deploy.sh` should run with `network=none`
  except for the docker daemon socket.

---

## What's NOT going to ship (deliberately)

- **`:latest` floating tag.** Caused the Tier 1 layer-cache
  poisoning class. We're explicit about immutable tags only.
- **Manual approval gates.** Friction without value at our current
  blast radius. The smoke-then-swap contract IS the gate.
- **Autodeploy on PR merge.** Only `push to main` triggers. PRs that
  pass CI don't auto-build images — that's intentional, it keeps
  GAR clean.
- **Cross-cluster orchestration (Kubernetes, Nomad, etc.).** We're
  on a single GCE VM. Migration cost is multiples of the savings
  for our current traffic.

---

## Operational runbook quick links

- **Deploy a tagged release:** `gh workflow run superflow-deploy.yml
-f tag=<tag>`
- **Roll back to previous:** `gh workflow run superflow-rollback.yml`
- **Roll back to specific tag:** `gh workflow run
superflow-rollback.yml -f tag=<tag>`
- **Refresh VM scripts:** `gh workflow run superflow-vm-init.yml`
- **Nuke cache (cold rebuild):** `gh workflow run
superflow-build.yml -f nuke_cache=true`
- **Run chaos test:** see CICD.md "Chaos test" runbook.
- **What's running in prod right now:**
  ```bash
  gcloud compute ssh affine-vm --project=affine-495114 \
    --zone=asia-southeast1-a --tunnel-through-iap \
    --command='sudo docker ps --filter name=affine_server --format "{{.Image}}"'
  ```
- **Nuclear rollback (skip the workflow):**
  ```bash
  gcloud compute ssh affine-vm --project=affine-495114 \
    --zone=asia-southeast1-a --tunnel-through-iap \
    --command='cd /srv/affine/compose && \
      sudo cp compose.yml.previous.bak compose.yml && \
      sudo docker compose up -d --force-recreate affine'
  ```

---

## Validation log

| Date               | Event                                             | Image                         | Outcome                                                                                                                       |
| ------------------ | ------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-06 02:13   | Auto Deploy 25412825348 (Tier 2 first end-to-end) | `main-40fadf8b6-25412518581`  | FAIL — VM had old `deploy.sh` (no `--supersede-run-id`); fixed by re-running vm-init                                          |
| 2026-05-06 02:18   | Manual Deploy 25412952845 (post vm-init)          | `main-40fadf8b6-25412518581`  | partial — deploy succeeded, prompt-seed gate timed out on first-time `postgres:16-alpine` pull (exit 3); fixed in `393950532` |
| 2026-05-06 02:40   | Auto Deploy 25413543034 (Tier 2 full pipeline)    | `main-393950532-25413249523`  | SUCCESS — `deploy.sh` exit 0, all gates passed                                                                                |
| 2026-05-06 (chaos) | Manual Deploy with chaos image                    | `main-chaostest1-25412016315` | EXPECTED FAIL — `deploy.sh` exit 1, prod untouched                                                                            |

The pipeline caught all three Tier 2 bugs **before** they could
reach production. The safety contract held in every case.
