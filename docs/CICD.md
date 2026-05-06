# Superflow CI/CD

How code gets from `main` to `https://affine.gogocash.co`. This doc is
the architecture reference for the deploy pipeline; for daily commands
see also `CLAUDE.md` §4 (testing checklist).

## Pipeline shape

Tier 2 splits the previous monolithic autodeploy into **build** and
**deploy** workflows. Re-deploying an existing image no longer requires
a rebuild. The same VM-side deploy.sh is used by all three deploy
paths (autodeploy / manual deploy / vm-init smoke).

```
push to main
   │
   ▼
[Superflow CI]                .github/workflows/superflow-ci.yml
   │  - oxlint --deny-warnings
   │  - codegen-drift guard
   │  - bundle web + admin + mobile
   ▼ workflow_run on success
[Superflow Build]             .github/workflows/superflow-build.yml  (Tier 2 NEW)
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
[Superflow Auto Deploy]       .github/workflows/superflow-autodeploy.yml  (Tier 2 REWRITE)
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
   │  9. poll https://affine.gogocash.co/info for POST_SWAP_TIMEOUT (60s)
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
