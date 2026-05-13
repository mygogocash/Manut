# Manut CI/CD

How code gets from `main` to `https://manut.gogocash.co`. This doc is
the architecture reference for the deploy pipeline; for daily commands
see also `CLAUDE.md` §4 (testing checklist).

Workflow display names ("Manut CI", "Manut Build", "Manut Auto Deploy",
"Manut Deploy", "Manut Release", "Manut Rollback", "Manut VM Init")
match the new brand. The underlying `.github/workflows/superflow-*.yml`
filenames have not been renamed yet — see `CLAUDE.md` §9 for why and
the migration plan.

## Pipeline shape

Tier 2 splits the previous monolithic autodeploy into **build** and
**deploy** workflows. Re-deploying an existing image no longer requires
a rebuild. The same VM-side deploy.sh is used by all three deploy
paths (autodeploy / manual deploy / vm-init smoke).

```
push to main
   │
   ▼
[Manut CI]                    .github/workflows/superflow-ci.yml
   │  - oxlint --deny-warnings
   │  - codegen-drift guard
   │  - bundle web + admin + mobile
   ▼ workflow_run on success
[Manut Build]                 .github/workflows/superflow-build.yml  (Tier 2 NEW)
   │  - WIF auth → GCP
   │  - napi build (server-native.x64.node — see CLAUDE.md §5 for the
   │    rename trap)
   │  - bundle @affine/server, web, admin, mobile
   │  - docker buildx build + push
   │      tag = main-<short-sha>-<github_run_id>   ← immutable per build
   │  - upload `image-tag` artifact (cross-workflow handoff;
   │    workflow_run.outputs are NOT propagated by GHA — see "Tag
   │    handoff" section below)
   ▼ workflow_run on success
[Manut Auto Deploy]           .github/workflows/superflow-autodeploy.yml  (Tier 2 REWRITE)
   │  - download image-tag artifact via `gh run download`
   │  - verify tag exists in GAR
   │  - SSH affine-vm, exec /srv/affine/scripts/deploy.sh
   │      --image-tag <tag> --supersede-run-id <github_run_id>
   ▼
[deploy.sh on VM]             scripts/vm/deploy.sh
   │  1. supersede check (Tier 2): if /tmp/affine-deploy.runid names a
   │     newer run, exit 4; else if older run, kill its pid, take over.
   │     Manual invocations (no --supersede-run-id) keep the legacy
   │     "block-fast on flock" behavior.
   │  2. flock /tmp/affine-deploy.lock + write our <run_id, pid> to
   │     /tmp/affine-deploy.runid (atomic).
   │  3. snapshot compose.yml → compose.yml.previous.bak
   │  4. docker pull <new image>
   │  5. spin up SIDECAR via overlay:
   │       docker compose
   │         -f compose.yml -f compose.canary.yml
   │         --profile validation up -d affine_canary
   │     Sidecar listens on host 3011, same DB + Redis as prod.
   │  6. poll http://localhost:3011/info for SMOKE_TIMEOUT (default 90s)
   │       FAIL → stop sidecar, exit 1 (PROD UNTOUCHED)
   │       OK   → continue
   │  7. stop sidecar
   │  8. ATOMIC SWAP: sed prod image tag in compose.yml,
   │       docker compose up -d --force-recreate affine
   │  9. poll https://manut.gogocash.co/info for POST_SWAP_TIMEOUT (60s)
   │       FAIL + --rollback-on-failure → restore compose.yml.previous.bak,
   │                                       recreate, re-poll → exit 2
   │       FAIL + --no-rollback → exit 1
   │       OK → exit 0
   ▼
exit 0 / 1 / 2 / 3 / 4 from deploy.sh
   │  Workflow maps each code to a job-summary message:
   │    0 = ✅ deployed
   │    1 = 🔴 sidecar validation failed (prod still on prior image)
   │    2 = 🔴 post-swap rolled back (prod still on prior image)
   │    3 = 🚨 rollback itself failed (manual intervention)
   │    4 = ⚠️  superseded — preempted by a newer deploy (Tier 2);
   │           NOT a failure, the newer deploy is what runs
   ▼
done
```

## Tag handoff (build → deploy)

GitHub's `workflow_run` event payload does **not** propagate downstream
job outputs. `${{ github.event.workflow_run.outputs.* }}` is always
empty even when the upstream workflow declares `outputs:` on its
jobs. This is a documented and intentional limitation, not a bug.

The supported handoff is via **artifacts**. `superflow-build.yml`
uploads an artifact named `image-tag` containing a single
`image-tag.txt` file with key=value lines (`image_tag=`,
`short_sha=`, `head_sha=`, `build_run_id=`). `superflow-autodeploy.yml`
downloads that artifact via `gh run download <build_run_id> --name
image-tag` (which uses the GH API under the hood) and parses the
file before SSHing the VM. Defensive checks at every step:

- Artifact missing → fail loudly with `::error::`, hint at running
  `gh run view <build_run_id>` to inspect the upstream run.
- `image_tag=` line missing → fail before SSH.
- Resolved tag fails charset (`[A-Za-z0-9._-]+`) → fail before SSH.
- Resolved tag not present in GAR → fail before SSH.

This keeps the deploy job small and makes the handoff debuggable from
the GHA UI without needing VM SSH.

## Control-plane handover artifacts

Manut now treats each image build as a small control-plane handover.
`superflow-build.yml` and `superflow-release.yml` run
`scripts/manut-release-handover.mjs` after the image push and upload a
`superflow-handover` artifact containing:

- `superflow-handover.md` for human operators.
- `superflow-handover.json` for future AFFiNE-native import or dashboards.

The artifact records the operating company goal, workflow mode, commit,
image tag, digest, run URL, current role board, verification gates, and
rollback pointer. The source model lives in
`docs/MANUT_CONTROL_PLANE.md`. (Artifact filenames retain the
`superflow-` prefix until the workflow-filename migration in
`CLAUDE.md` §9.)

This does not change deploy behavior. `image-tag` remains the deploy
handoff consumed by `superflow-autodeploy.yml`; `superflow-handover` is the
evidence layer around that handoff.

## Image tagging

Every CI build pushes a unique tag: `main-<short-sha>-<run_id>`. The
`<run_id>` suffix prevents collision when:

- The same SHA is rebuilt (e.g., `gh run rerun`).
- A laptop build and a CI build land at the same SHA.

There is no floating `:latest` or `:main-<sha>` tag. Manual operators
who want to know "what's running in prod right now" should
`gcloud compute ssh affine-vm --command='sudo docker ps --format "{{.Image}}"'`.

The previous compose.yml is always preserved at
`/srv/affine/compose/compose.yml.previous.bak` after every deploy, so
rollback can target whatever was running before the most recent
successful deploy without consulting GAR.

## Why smoke-then-swap (not swap-then-smoke)

The legacy autodeploy ran `docker compose up -d --force-recreate affine`
first, then polled `/info`. If the new image bootlooped (missing
`assets-manifest.json`, missing migration target, port-bind conflict,
etc.) the running container was already replaced by the broken one
before the smoke test detected the problem. **Production was 502 for
the entire smoke window** in those cases, and recovery required manual
SSH + cp + docker compose.

The new pipeline boots the new image as a SIDECAR first (`affine_canary`,
host port 3011) and validates `localhost:3011/info` before touching the
production container. If the sidecar fails to boot or never returns
200, the deploy fails and `affine_server` keeps serving the previous
image. Recovery is automatic.

The sidecar is defined in `scripts/vm/compose.canary.yml` as a compose
**overlay** — `docker compose -f compose.yml -f compose.canary.yml`
treats the canary as an addition, never modifying production
`compose.yml`. The overlay pattern preserves the operator-specific
config (env_file paths, AFFINE_DOMAIN, the
`postgresql://${DATABASE_USER}:...` env-driven DATABASE_URL) that lives
only in the live `compose.yml`.

## Rollback

```bash
gh workflow run superflow-rollback.yml
```

That fires `scripts/vm/rollback.sh` on the VM, which reads the previous
image tag from `compose.yml.previous.bak`, sed-replaces the current
tag, recreates the container, and polls `/info` to confirm. Pass
`-f tag=<explicit-tag>` to roll back to a specific tag from history
instead of "previous".

## Manual deploy of an existing image

```bash
gh workflow run superflow-deploy.yml -f tag=main-839e398a-25346091234
```

The deploy workflow validates the tag exists in GAR (via
`gcloud artifacts docker images describe`), then runs the same
`deploy.sh` smoke-then-swap path. Useful for:

- Rolling forward to a tag that didn't auto-deploy (e.g., concurrency
  caused autodeploy to skip).
- Re-running the same deploy if the VM ran into a transient issue
  (the sidecar lock + idempotent compose state mean re-running is
  safe).

## VM bootstrap

The deploy/rollback scripts and the canary overlay are installed on
the VM by:

```bash
gh workflow run superflow-vm-init.yml
```

Idempotent. Run once after Tier 1 ships, and again if you ever need
to re-install the scripts (e.g., after a VM rebuild). Production
`compose.yml` is **never** modified by `vm-init` — only
`compose.canary.yml` is added alongside.

## Failure modes the pipeline catches

| Failure mode                                                        | What used to happen                                                                                                                                                  | What happens now                                                                                                                                                                     | First introduced |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| New image bootloops (e.g., missing static asset manifest)           | Container swapped, prod 502 for ~90s, no recovery                                                                                                                    | Sidecar fails to boot, deploy fails, prod untouched (exit 1)                                                                                                                         | Tier 1           |
| Migration introduces a schema change the old image doesn't tolerate | After rollback, prod can't run on old image either                                                                                                                   | Migration deferred to post-swap; sidecar runs against current schema                                                                                                                 | Tier 1           |
| Layer cache poisoning produces a broken image at build time         | Same broken image deployed via swap-then-smoke, prod 502                                                                                                             | Sidecar exposes the problem in 90s, prod stays up (exit 1)                                                                                                                           | Tier 1           |
| Image tag collision (laptop + CI both push `:main-<sha>`)           | One overwrites the other; prod runs whichever pushed last                                                                                                            | `<run_id>` suffix makes every build immutable                                                                                                                                        | Tier 1           |
| Two pushes within seconds: deploys queue on flock                   | GHA cancels the older runner; older deploy.sh keeps going on the VM (no signalling); newer waits on flock; prod ends up on whichever lost the race. UI is misleading | The newer deploy.sh kills the older one's pid + takes the lock. Older deploy.sh exits 4 (status=superseded). UI marks it as a warning, not a failure. The newer one runs end-to-end. | Tier 2 (exit 4)  |

## What the pipeline does NOT catch (Tier 3 territory)

- **Slow-degradation bugs.** A new image that boots clean but has a
  perf regression isn't detected; the sidecar smoke is binary
  (200 vs not). Future tier should add a few synthetic queries to the
  smoke check.
- **Cross-region / multi-VM rollouts.** Single-VM only. Blue-green or
  canary-percent rollouts across VMs are Tier 3.
- **Build-time secret rotation.** A leaked GAR push cred or
  compromised WIF would silently push poisoned images. Add image
  signing (cosign / sigstore) and require deploy.sh to verify the
  signature before the swap.

## Buildx cache (registry-backed)

Both `superflow-build.yml` and `superflow-release.yml` push docker
images to GAR. To avoid rebuilding every layer from scratch on every
CI run, buildx exports its layer cache. The cache used to be GitHub
Actions cache (`type=gha`); Tier 2 switches it to a dedicated
registry image (`type=registry`). The cache image lives at:

```
asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash-cache:buildx
```

It's a sibling of the deploy image, in the same GAR repo, so a single
`roles/artifactregistry.writer` grant covers both. Single tag
`:buildx` accumulates all layers across the multi-stage build
(`mode=max`).

### Why registry, not GHA cache

The mobile/dist incident is the motivating story: an empty
`packages/frontend/apps/mobile/dist` directory got cached as a
buildx COPY layer. Subsequent builds reused the empty layer,
producing broken images that crashed on boot (missing
`assets-manifest.json`). Two production outages.

GHA cache is opaque — you can't see what's in it, and you can't
selectively invalidate a single bad layer without nuking the entire
cache (which then wipes out unrelated good layers from other
workflows). Registry cache fixes all three properties:

1. **Visible.** `docker manifest inspect <cache-image>:buildx`
   shows what's there.
2. **Selectively invalidable.** Delete the cache image to force a
   cold rebuild. Subsequent builds repopulate from clean.
3. **Cross-runner reuse.** Every CI run hits the same registry
   cache regardless of which hosted runner picks up the job. GHA
   cache was partitioned per ref/branch.

### Defense-in-depth: `no-cache-filters: assets`

Even with a clean cache, a buildx run can hit a poisoned layer
through a stale local working tree. The `assets` stage in
`Dockerfile.fullstack` is the COPY layer that pulls in the dist
directories — the EXACT layer that got poisoned in the mobile/dist
incident. Both build workflows now pass `no-cache-filters: assets`,
which forces THAT stage to rebuild every time even if cached.
Costs ~30s per build. Eliminates the entire poisoning class.

### Operator: nuke buildx cache

If a layer goes bad and you suspect the registry cache is shipping
stale content, the escape hatch lives in `superflow-build.yml`:

```bash
gh workflow run superflow-build.yml -f nuke_cache=true
```

That:

1. Deletes
   `asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash-cache:buildx`
   from GAR (idempotent — `|| true` on missing).
2. Builds with a cold cache (~5–10 min slower than a warm-cache
   run; this is the expected one-time cost). Auto Deploy fires
   downstream as usual.
3. Repopulates the cache image at the end of the build.

The release workflow (`superflow-release.yml`) does NOT have a
nuke input — releases are tag-driven and the build is the artifact.
If you need to nuke the cache before a release, run the build-
workflow nuke first; the release workflow shares the cache and will
pick up the cold state.

### Permission caveat: cache delete needs repoAdmin

The deployer service account `affine-gha-deployer@affine-495114`
currently has `roles/artifactregistry.writer` (push images, write
tags) and `roles/artifactregistry.reader`. Image **deletion**
requires `roles/artifactregistry.repoAdmin`. The nuke step uses
`|| true` so a 403 doesn't fail the build, but if you need
reliable nuking, grant the role scoped to the cache repo path:

```bash
gcloud artifacts repositories add-iam-policy-binding affine \
  --location=asia-southeast1 \
  --project=affine-495114 \
  --member='serviceAccount:affine-gha-deployer@affine-495114.iam.gserviceaccount.com' \
  --role='roles/artifactregistry.repoAdmin'
```

(Repo-level binding instead of project-level: the SA can only
delete in this one GAR repo, not anywhere else in the project.)

### First-run behavior

The first build after this change lands has nothing at
`<cache-image>:buildx` to pull from. `cache-from` will silently miss
and the build runs fully cold (~5–10 min slower). `cache-to`
creates the cache image at the end. The next build is fast. The
job summary mentions this so an operator who sees the slow first
run doesn't panic.

## Build determinism

CI builds and laptop builds have produced different bundles in the
past, contributing to the cache-poisoning saga (a stale local
artifact slipping into the docker context, then being cached as a
broken layer). Tier 2 pins everything that can be pinned and adds
guards for the rest:

1. **Pinned corepack yarn version.** Both build workflows now run
   `corepack prepare yarn@4.13.0 --activate` immediately after
   `corepack enable`. The version matches `package.json:packageManager`.
   Prevents drift between hosted runners and laptop.
2. **Dist prune before bundle.** Both workflows wipe
   `packages/frontend/**/dist` and `packages/backend/**/dist` before
   running `yarn affine bundle`. CI runners are usually ephemeral
   (no-op), but yarn install can leave generated dist trees from
   workspace postinstalls — the exact failure mode that produced
   the empty mobile/dist that got cached.
3. **Source-drift check after bundle.** After all bundles complete,
   the workflow runs
   `git status --porcelain packages/ blocksuite/ tools/`; non-empty
   output fails the build. Catches the class of bugs where the
   build process writes files BACK into the source tree (see
   CLAUDE.md §5 "Stale .js / .d.ts in packages/\*\*/src/" — those
   stale `.js` files next to `.css.ts`/`.tsx` poison subsequent
   builds because rspack's `resolve.extensions` picks `.js` first).
   The check uses `git status --porcelain`, which respects
   `.gitignore` — legitimate gitignored artifacts (the `dist/`
   trees themselves, `.yarn/cache`) don't trigger false positives.
4. **Pinned Dockerfile build context.** `.dockerignore` filters
   out `.yarn/cache`, `node_modules`, every `*.js` next to `*.ts`
   in `packages/**/src` (matches `.gitignore`), and other
   non-deterministic inputs. Don't widen this to include
   hand-authored declaration files (`*.d.ts`) — see CLAUDE.md §5
   for the list of paths that legitimately ship `.d.ts` in `src/`.

### Permitted vs forbidden artifacts in source dirs

These paths are LEGITIMATELY hand-authored under `src/` and must NOT
be flagged by the drift check or wiped by the prune step:

- `packages/frontend/core/src/types/types.d.ts` — global types
  referenced from `bootstrap/env.ts` via
  `import '../types/types.d.ts'`.
- `packages/frontend/component/src/type.d.ts`.
- `blocksuite/playground/apps/{env,vite-env}.d.ts`.
- `blocksuite/affine/shared/src/commands/index.d.ts`.

These paths are FORBIDDEN under `src/` and are gitignored
specifically to prevent the bundler from picking them up:

- `packages/**/src/**/*.js` — tsc-emit shadows of `.ts`/`.tsx`.
- `packages/**/src/**/*.js.map` — ditto.
- `blocksuite/**/src/**/*.js` and `*.js.map` — ditto.

The drift check uses plain `git status --porcelain`, which honors
`.gitignore`, so the forbidden patterns trigger the failure ONLY
if someone has unignored them or staged them — exactly the
scenario the check exists to catch.

## Slack notifications

Every deploy / rollback workflow ends with a "Notify Slack" step that
posts a single-message summary to an incoming webhook. The step is
**opt-in** — when no `SLACK_WEBHOOK_URL` repo secret is configured the
step prints `SLACK_WEBHOOK_URL not configured — skipping notification`
and exits 0 without failing the workflow.

### What you get

| Outcome                   | Message shape                                                                  |
| ------------------------- | ------------------------------------------------------------------------------ |
| Auto / manual deploy OK   | `✅ <repo>@<sha>: deployed via <workflow>` + image tag + run URL               |
| Sidecar validation failed | `🔴 <repo>@<sha>: deploy FAILED ...` + `Production: still on prior tag`        |
| Auto-rolled back          | `🔴 <repo>@<sha>: deploy FAILED ...` + `post-swap smoke or prompt-seed failed` |
| Rollback itself failed    | `🚨 <repo>@<sha>: deploy FAILED ...` + `Production: manually intervene`        |
| Manual rollback succeeded | `↩️ <repo>: rolled back to <tag>` + triggered-by + run URL                     |
| Manual rollback failed    | `🔴`/`🚨 ...` with the specific failure reason                                 |

The workflow status (success / failure) reflects the underlying
operation; the Slack message reflects the same plus a one-line reason
so the channel readers do not have to click through to the run page
every time.

### Setup

1. In your Slack workspace, create an incoming webhook
   (`https://slackbot.example.com/services/...`). Slack docs:
   <https://api.slack.com/messaging/webhooks>.
2. Add it as a repo secret:

   ```bash
   gh secret set SLACK_WEBHOOK_URL --body 'https://hooks.slack.com/services/T.../B.../...'
   ```

3. The next deploy will post to the channel the webhook is bound to.
   No code or workflow changes needed — the secret takes effect on the
   next workflow run.

### Disabling

```bash
gh secret remove SLACK_WEBHOOK_URL
```

The workflows then skip the notification silently. There is no kill-
switch env var or `if:` toggle besides the secret itself.

### Safety properties

- The webhook URL is routed through `env:` only — never inlined into
  shell command strings, never echoed, never `printf`-ed. Job logs
  cannot leak it via `set -x` or accidental output redirection.
- The message body is built with `jq -nc --arg t ...` so any quotes,
  backslashes, newlines, or Unicode in `${IMAGE_TAG}`, `${ACTOR}`,
  etc. are JSON-escaped safely.
- `curl --silent --show-error --max-time 10 ... || true` ensures a
  Slack 5xx, network blip, or 10-second hang never fails the
  workflow. The deploy outcome is the source of truth; Slack is best-
  effort notification, not a gate.

## Prompt-seed verification

The `/info` smoke check is binary: did the server bind a port. AFFiNE's
`PromptService.onApplicationBootstrap` runs **after** the listener is
up, so a green `/info=200` does NOT prove that the canonical AI
prompts upserted successfully. If the seed silently fails (e.g. a new
prompt name exceeds the `VarChar(32)` limit, a duplicate-key violation
on the unique index, a JSON-config syntax error in `prompts.ts`), AI
features break in subtle ways: chat returns 5xx, auto-tag returns
empty, `Summary as title` produces `New chat` forever.

Tier 2's prompt-seed gate runs INSIDE `scripts/vm/deploy.sh` after the
post-swap smoke succeeds, before the script declares `success`. It:

1. Reads `DATABASE_USER` / `DATABASE_PASSWORD` / `DATABASE_HOST` /
   `DATABASE_PORT` / `DATABASE_NAME` from the live `affine_server`
   container's environment via `docker exec ... env`. The DB password
   never leaves the VM — `deploy.sh` runs locally on the GCE VM, the
   GHA runner only SSHes in to invoke it.
2. Spins up a transient `postgres:16-alpine` container on the
   `affine_affine_net` docker network and runs:

   ```sql
   SELECT COUNT(*) FROM ai_prompts_metadata
   WHERE name IN ('Chat With AFFiNE AI', 'Auto Tag', 'Summary as title');
   ```

3. Wraps the whole psql exec in `timeout 10s` so a hung connection,
   DNS resolution issue, or runaway query trips the gate quickly.

### Outcomes

| Result                          | deploy.sh exit | Workflow outcome | Slack message                                       |
| ------------------------------- | -------------- | ---------------- | --------------------------------------------------- |
| Count = 3 (all seeded)          | 0              | success          | `✅ deployed`                                       |
| Count < 3 (silent seed failure) | 2              | rolled back      | `🔴 deploy FAILED ... post-swap prompt-seed failed` |
| Count < 3 + rollback fails      | 3              | manual           | `🚨 rollback itself failed`                         |
| psql infra error / timeout      | 3              | manual           | `🚨 post-swap prompt-seed check itself failed`      |

The infra-error branch deliberately does NOT auto-rollback. We don't
actually know whether the new image is broken — the check just
couldn't run. Surfacing it as "manual intervention" lets a human
inspect the VM rather than rolling back a healthy deploy.

### Adding new prompts to the gate

The list of canonical names lives at the top of
`scripts/vm/deploy.sh`:

```bash
EXPECTED_PROMPTS=(
  'Chat With AFFiNE AI'
  'Auto Tag'
  'Summary as title'
)
```

This is the single source of truth. To add a prompt, add the exact
name (must match the `name:` field in
`packages/backend/server/src/plugins/copilot/prompt/prompts.ts`) and
re-deploy `deploy.sh` to the VM via
`gh workflow run superflow-vm-init.yml`. Pick names that should
ALWAYS be seeded (don't add experimental prompts that may be removed
later — that would auto-rollback any PR removing them).

### Why v1.10.2 motivated this

In v1.10.2 a new `DriveFileType.size` GraphQL `@Field` declaration
crashed `PromptService.onApplicationBootstrap` indirectly via a
different upstream guard. The smoke check passed because the listener
was up briefly before the crash propagated, but the prompt-seed never
ran. AI features broke for ~10 minutes until manually rolled back.
With the prompt-seed gate that incident would have auto-rolled back
inside the same deploy run, no manual intervention.

For the threat model around routing the DB password: the password
lives in the VM's docker container environment and is read locally
on the VM by `deploy.sh`. The GHA runner's SSH session never reads,
sees, or transmits the password — only the deploy script's exit code
and stdout JSON come back across the IAP tunnel. This is strictly
safer than any approach that sets `DATABASE_PASSWORD` as a GitHub
secret on the runner.

## Chaos test (validating the safety net)

The whole point of the smoke-then-swap pipeline is to catch a broken
image BEFORE it reaches production. That promise needs periodic
validation — a synthetic "broken image" deploy that proves the
sidecar smoke check actually exits 1 and production stays up.

### How to run it

1. Build a minimal "broken AFFiNE" image. It must bind port 3010 (so
   the sidecar container itself starts), but must NOT serve a 200 on
   `/info`. The simplest version is:

   ```dockerfile
   FROM busybox:1.36
   EXPOSE 3010
   CMD ["sh", "-c", "while true; do printf 'HTTP/1.1 503 Service Unavailable\\r\\nContent-Length: 18\\r\\n\\r\\nchaos test image\\n' | nc -l -p 3010; done"]
   ```

2. Tag and push it to GAR with a name that's clearly identifiable as
   chaos so an operator never confuses it with a real release. The
   tag must match `^[A-Za-z0-9._-]+$` (the deploy workflow's charset
   guard) AND it must look enough like a normal tag that
   `superflow-deploy.yml`'s validation passes:

   ```bash
   CHAOS_TAG="main-chaostest$(date +%s)"
   docker buildx build --platform linux/amd64 \
     -t "asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:${CHAOS_TAG}" \
     --push /tmp/chaos-image/
   ```

3. Capture pre-deploy production state (so you can verify "untouched"):

   ```bash
   curl -fsS https://manut.gogocash.co/info
   gcloud compute ssh affine-vm --project=affine-495114 \
     --zone=asia-southeast1-a --tunnel-through-iap \
     --command='sudo docker ps --filter name=affine_server --format "{{.Image}}"'
   ```

4. Trigger the deploy with a SHORT smoke timeout (60s is plenty —
   the chaos image will never return 200 anyway):

   ```bash
   gh workflow run superflow-deploy.yml \
     -f tag="${CHAOS_TAG}" -f smoke_timeout_secs=60
   ```

5. While the deploy runs, probe production every ~20s in another
   shell. It MUST return 200 the entire time:

   ```bash
   while true; do
     printf '%s  /info → HTTP %s\n' "$(date '+%H:%M:%S')" \
       "$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 5 https://manut.gogocash.co/info)"
     sleep 20
   done
   ```

6. After ~80s the deploy run will complete. Verify each pass
   condition:

   ```bash
   RUN_ID=$(gh run list --workflow=superflow-deploy.yml --limit=1 \
     --json databaseId --jq '.[0].databaseId')
   gh run view "$RUN_ID" --log | grep "deploy.sh exit code"
   # Expected: deploy.sh exit code: 1
   ```

7. Verify production tag is the SAME as before:

   ```bash
   gcloud compute ssh affine-vm --project=affine-495114 \
     --zone=asia-southeast1-a --tunnel-through-iap \
     --command='sudo docker ps --filter name=affine_server --format "{{.Image}}"'
   # Must match what you captured in step 3.
   ```

8. Clean up the chaos image from GAR (don't leave it sitting there
   tempting an accidental redeploy):

   ```bash
   gcloud artifacts docker images delete \
     "asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:${CHAOS_TAG}" \
     --quiet --delete-tags
   ```

### Pass criteria

| Check                             | Required           |
| --------------------------------- | ------------------ |
| `deploy.sh` exit code             | `1` (sidecar fail) |
| Workflow conclusion               | `failure`          |
| Production `/info` during deploy  | `200` throughout   |
| Production image tag after deploy | Unchanged          |
| Slack message (if webhook is set) | `🔴 deploy FAILED` |

If any of these don't hold, the safety net is broken. File a P1
issue and roll Tier 2 changes back via `git revert` until the
contract holds again.

### What this test does NOT cover

The chaos test exercises the **exit 1** path (sidecar smoke fails).
It does NOT exercise:

- **Exit 2** (post-swap auto-rollback). Hard to engineer
  synthetically — the sidecar runs against the same DB+Redis as
  prod, so anything that 200s on the sidecar should 200 on prod.
  Triggered organically by transient infrastructure issues.
- **Exit 3** (rollback itself fails). Even harder. Triggered by
  bugs in `compose.yml.previous.bak` or the rollback recreate step
  failing. Test by manually corrupting the backup mid-deploy in a
  staging environment, NOT in prod.
- **Exit 4** (supersession). Tested by triggering two
  `superflow-build.yml` runs back-to-back (push two commits within
  ~30s of each other). The older deploy.sh should exit 4 when the
  newer one's run_id arrives at the lock file.
- **Prompt-seed verification** (added by Tier 2 Item 5). Engineer
  by removing `Auto Tag` from `prompts.ts` in a feature branch,
  bundle, push, deploy. The post-swap prompt-seed gate should fire,
  return count=2 (instead of 3), and auto-rollback (exit 2).

Running the exit-1 chaos test quarterly is sufficient regression
coverage. It exercises the full pipeline (artifact handoff, GAR
tag validation, sidecar boot, smoke poll, exit-code mapping, Slack
notify, summary writer) end-to-end.

### Last validated

The exit-1 chaos test was run on 2026-05-06 against a busybox-based
chaos image (`main-chaostest1-25412016315`). Result: deploy.sh exit
1, workflow conclusion failure, production `/info` returned 200
throughout (4 probes over 80s), production image tag unchanged at
`main-8e7c462b2-25410849595`. The Tier 2 pipeline preserved the
production safety contract under a fully synthetic broken-image
attack.
