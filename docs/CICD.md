# Superflow CI/CD

How code gets from `main` to `https://affine.gogocash.co`. This doc is
the architecture reference for the deploy pipeline; for daily commands
see also `CLAUDE.md` §4 (testing checklist).

## Pipeline shape

```
push to main
   │
   ▼
[Superflow CI]                .github/workflows/superflow-ci.yml
   │  - oxlint --deny-warnings
   │  - codegen-drift guard
   │  - bundle web + admin + mobile
   ▼
[Superflow Auto Deploy]       .github/workflows/superflow-autodeploy.yml
   │  - WIF auth → GCP
   │  - napi build (server-native.x64.node — see CLAUDE.md §5 for the
   │    rename trap)
   │  - bundle @affine/server, web, admin, mobile
   │  - docker buildx build + push
   │      tag = main-<short-sha>-<github_run_id>   ← immutable per build
   │  - SSH to affine-vm, exec /srv/affine/scripts/deploy.sh
   ▼
[deploy.sh on VM]             scripts/vm/deploy.sh
   │  1. flock /tmp/affine-deploy.lock     ← single-flight per VM
   │  2. snapshot compose.yml → compose.yml.previous.bak
   │  3. docker pull <new image>
   │  4. spin up SIDECAR via overlay:
   │       docker compose
   │         -f compose.yml -f compose.canary.yml
   │         --profile validation up -d affine_canary
   │     Sidecar listens on host 3011, same DB + Redis as prod.
   │  5. poll http://localhost:3011/info for SMOKE_TIMEOUT (default 90s)
   │       FAIL → stop sidecar, exit 1 (PROD UNTOUCHED)
   │       OK   → continue
   │  6. stop sidecar
   │  7. ATOMIC SWAP: sed prod image tag in compose.yml,
   │       docker compose up -d --force-recreate affine
   │  8. poll https://affine.gogocash.co/info for POST_SWAP_TIMEOUT (60s)
   │       FAIL + --rollback-on-failure → restore compose.yml.previous.bak,
   │                                       recreate, re-poll → exit 2
   │       FAIL + --no-rollback → exit 1
   │       OK → exit 0
   ▼
exit 0 / 1 / 2 / 3 from deploy.sh
   │  Workflow maps each code to a job-summary message:
   │    0 = ✅ deployed
   │    1 = 🔴 sidecar validation failed (prod still on prior image)
   │    2 = 🔴 post-swap rolled back (prod still on prior image)
   │    3 = 🚨 rollback itself failed (manual intervention)
   ▼
done
```

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

## Failure modes Tier 1 catches

| Failure mode                                                        | What used to happen                                       | What happens now                                                     |
| ------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| New image bootloops (e.g., missing static asset manifest)           | Container swapped, prod 502 for ~90s, no recovery         | Sidecar fails to boot, deploy fails, prod untouched                  |
| Migration introduces a schema change the old image doesn't tolerate | After rollback, prod can't run on old image either        | Migration deferred to post-swap; sidecar runs against current schema |
| Layer cache poisoning produces a broken image at build time         | Same broken image deployed via swap-then-smoke, prod 502  | Sidecar exposes the problem in 90s, prod stays up                    |
| Image tag collision (laptop + CI both push `:main-<sha>`)           | One overwrites the other; prod runs whichever pushed last | `<run_id>` suffix makes every build immutable                        |

## What Tier 1 does NOT catch (Tier 2/3 territory)

- **Slow-degradation bugs.** A new image that boots clean but has a
  perf regression isn't detected; the sidecar smoke is binary
  (200 vs not). Tier 2 should add a few synthetic queries to the
  smoke check.
- **GHA runner cancel-in-progress vs VM-side flock.** If two pushes
  land within seconds, the second cancels the first runner but the
  first runner's deploy.sh keeps going. The second runner waits on
  flock. Result: the second deploy may overwrite the first one
  cleanly, but the GHA UI shows the first as "cancelled" (misleading).
  Tier 2 should pass run IDs through and have deploy.sh self-supersede.
- **Cross-region / multi-VM rollouts.** Tier 1 assumes a single
  VM. Blue-green or canary-percent rollouts are Tier 3.
