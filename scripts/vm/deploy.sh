#!/usr/bin/env bash
#
# deploy.sh — Smoke-then-swap deploy with auto-rollback.
#
# Runs ON the production VM. Invoked by GitHub Actions over IAP-tunneled
# `gcloud compute ssh ... --command=...`.
#
# Flow:
#   1. Pull the new image to the VM's local docker daemon.
#   2. Spin up an `affine_canary` sidecar (port 3011) using the new image,
#      same DB / Redis / volumes as production. Exercises the real boot
#      path (env load, GraphQL schema build, Prisma client init, etc.)
#      WITHOUT touching the production container.
#   3. Poll http://localhost:3011/info until 200 (or timeout). If the
#      sidecar fails to come up, abort BEFORE touching production.
#   4. Stop the sidecar.
#   5. Atomically swap production: sed compose.yml, `docker compose up
#      -d --force-recreate affine`.
#   6. Poll https://affine.gogocash.co/info. If it stays down past
#      the post-swap timeout, auto-rollback to the previous image tag
#      (read from compose.yml.previous.bak), and re-poll for 60s.
#
# Final stdout: a single JSON object the calling workflow parses.
#
# Exit codes:
#   0  success
#   1  validation_failed (sidecar never came up, or pull failed, or
#      another deploy in progress, or argument error)
#   2  rolled_back (production failed post-swap; previous image is back)
#   3  rollback_failed (production failed post-swap AND the rollback
#      attempt also failed — manual intervention needed)
#   4  superseded (this deploy bowed out because a NEWER deploy with a
#      higher --supersede-run-id was already in progress; the newer one
#      will run instead — treat as a warning, not a failure)
#
# Concurrency model (Tier 2 update):
#   By default deploy.sh blocks on flock for single-flight per-VM
#   semantics — two deploys started seconds apart will queue up. When
#   GitHub Actions invokes deploy.sh it passes --supersede-run-id <id>
#   so the NEWER deploy preempts the older one instead of queueing
#   behind it. Logic:
#     - This deploy writes "<run_id> <pid>" atomically to
#       /tmp/affine-deploy.runid (mv from a temp file in the same dir).
#     - Before acquiring flock, if an existing runid file is found:
#         existing_run_id < our id  → kill the holder PID, take over
#         existing_run_id > our id  → exit 4 (we've been superseded)
#         existing_run_id == our id → exit 4 (race / re-entry)
#     - On exit, the runid file is cleared ONLY if it still matches our
#       <run_id, pid> pair (don't trample whoever superseded us).
#   Without --supersede-run-id, the script falls back to the original
#   "block on flock" behavior — manual operators don't need to be
#   superseded.
#
# All `docker` / `docker compose` calls go through `sudo` because the
# script is typically invoked by `affine-gha-deployer` (no docker group
# membership). For local testing as a docker-group user, set
# DEPLOY_SUDO=  in the environment.

set -euo pipefail

# ---- Defaults & constants -------------------------------------------------

REGISTRY="${REGISTRY:-asia-southeast1-docker.pkg.dev/affine-495114/affine}"
IMAGE_NAME="${IMAGE_NAME:-affine-gogocash}"
COMPOSE_DIR="${COMPOSE_DIR:-/srv/affine/compose}"
COMPOSE_FILE="${COMPOSE_DIR}/compose.yml"
# Canary overlay file installed by superflow-vm-init.yml. Used ONLY when
# starting/stopping the validation sidecar — production swap (lines 380+)
# uses compose.yml alone so we never accidentally couple the two paths.
CANARY_COMPOSE_FILE="${COMPOSE_DIR}/compose.canary.yml"
COMPOSE_BACKUP="${COMPOSE_DIR}/compose.yml.previous.bak"
COMPOSE_ENV_FILE="${COMPOSE_DIR}/.env"
LOCK_FILE="${LOCK_FILE:-/tmp/affine-deploy.lock}"
# Runid registry — read by NEW deploys to detect an in-flight OLDER deploy
# they should preempt. Format on disk: "<run_id> <pid>" on a single line.
# Same dir as LOCK_FILE so atomic-rename across mv works.
RUNID_FILE="${RUNID_FILE:-/tmp/affine-deploy.runid}"
PROD_HOST="${PROD_HOST:-affine.gogocash.co}"
SIDECAR_NAME="${SIDECAR_NAME:-affine_canary}"
SIDECAR_HOST_PORT="${SIDECAR_HOST_PORT:-3011}"
PROD_SERVICE="${PROD_SERVICE:-affine}"
PROD_CONTAINER="${PROD_CONTAINER:-affine_server}"
DOCKER_NETWORK="${DOCKER_NETWORK:-affine_affine_net}"
PSQL_IMAGE="${PSQL_IMAGE:-postgres:16-alpine}"
PSQL_QUERY_TIMEOUT_SECS="${PSQL_QUERY_TIMEOUT_SECS:-10}"
SUDO="${DEPLOY_SUDO-sudo}"
# The VM keeps only production/runtime Docker state. Before pulling a new
# image, prune disposable Docker data so a stale image layer cannot block
# deploys with ENOSPC. Volumes are intentionally preserved.
DEPLOY_PRUNE_BEFORE_PULL="${DEPLOY_PRUNE_BEFORE_PULL:-1}"

# Canonical seed prompts that MUST be upserted by PromptService at boot.
# If any of these are missing post-swap, PromptService.onApplicationBootstrap
# silently failed (e.g. name > 32 chars, duplicate-key violation, schema
# drift, JSON-config syntax error) and AI features will break in subtle
# ways. Each name comes straight from packages/backend/server/src/plugins/
# copilot/prompt/prompts.ts. To add or remove a checked prompt, edit the
# array below — this is the single source of truth for the gate.
EXPECTED_PROMPTS=(
  'Chat With AFFiNE AI'
  'Auto Tag'
  'Summary as title'
)

IMAGE_TAG=""
SMOKE_TIMEOUT=90
POST_SWAP_TIMEOUT=60
ROLLBACK_ON_FAIL=1
# Numeric (e.g. GitHub Actions run id) — when set, enables the
# preempt-older / yield-to-newer semantics described in the header.
SUPERSEDE_RUN_ID=""
# Tracks the run_id we successfully wrote to RUNID_FILE — used by the
# EXIT trap so we only clean up our own entry, not someone who
# superseded us.
OUR_RUN_ID_WRITTEN=""
# When set to a non-empty string, the run_id of an existing in-flight
# deploy that THIS invocation has been superseded by. Stored so the
# emit_json contract can include it.
SUPERSEDED_BY_RUN_ID=""

START_TS=$(date +%s)

# ---- Logging --------------------------------------------------------------

log() {
  printf '[%s] %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2
}

usage() {
  cat <<EOF
Usage: $0 --image-tag <tag> [options]

Deploys a new image with smoke-then-swap and auto-rollback. Runs ON the
GCE VM via gcloud compute ssh.

Required:
  --image-tag <tag>            Image tag to deploy (e.g. main-839e398a-25346091234)

Options:
  --smoke-timeout-secs <n>     Sidecar validation timeout (default: 90)
  --post-swap-timeout-secs <n> Post-swap smoke timeout    (default: 60)
  --rollback-on-failure        Auto-rollback on post-swap failure (default)
  --no-rollback-on-failure     Disable auto-rollback (testing only)
  --supersede-run-id <id>      Numeric run id (e.g. GitHub Actions run id).
                               Enables newer-wins preemption: this deploy
                               kills any in-flight older deploy, or exits 4
                               if a newer deploy is already in flight.
                               Without this flag, deploy.sh blocks on flock.
  -h | --help                  Show this help and exit 0
EOF
}

# ---- Arg parsing (manual — getopts has no long-option support) ------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image-tag)
      IMAGE_TAG="${2:-}"
      shift 2
      ;;
    --smoke-timeout-secs)
      SMOKE_TIMEOUT="${2:-}"
      shift 2
      ;;
    --post-swap-timeout-secs)
      POST_SWAP_TIMEOUT="${2:-}"
      shift 2
      ;;
    --rollback-on-failure)
      ROLLBACK_ON_FAIL=1
      shift
      ;;
    --no-rollback-on-failure)
      ROLLBACK_ON_FAIL=0
      shift
      ;;
    --supersede-run-id)
      SUPERSEDE_RUN_ID="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

# ---- Helpers --------------------------------------------------------------

emit_json() {
  # emit_json <status> <error-or-empty>
  local status="$1"
  local err="${2:-}"
  local end_ts duration
  end_ts=$(date +%s)
  duration=$((end_ts - START_TS))

  local prev_tag="${PREVIOUS_TAG:-}"
  local superseded_by="${SUPERSEDED_BY_RUN_ID:-}"
  jq -nc \
    --arg status "$status" \
    --arg image_tag "$IMAGE_TAG" \
    --arg previous_image_tag "$prev_tag" \
    --argjson duration_secs "$duration" \
    --arg error "$err" \
    --arg superseded_by_run_id "$superseded_by" \
    '{
      status: $status,
      image_tag: $image_tag,
      previous_image_tag: $previous_image_tag,
      duration_secs: $duration_secs
    }
    + (if $error == "" then {} else {error: $error} end)
    + (if $superseded_by_run_id == "" then {} else {superseded_by_run_id: $superseded_by_run_id} end)'
}

extract_current_tag() {
  # Read the current image tag for the affine production service from
  # compose.yml. Falls back to empty string on any parse error.
  #
  # We deliberately SKIP lines whose tag begins with `$` (env interp,
  # e.g. canary's `${IMAGE_TAG_OVERRIDE:-${LIVE_IMAGE_TAG}}`). Otherwise
  # we'd return the literal `${...}` placeholder as the "tag" — which
  # would then be re-applied to compose.yml on rollback as if it were a
  # real tag. The first non-interpolated match wins.
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo ""
    return
  fi
  local tag
  tag=$(grep -E "${IMAGE_NAME}:[^[:space:]\$\"']" "$file" | head -1 \
    | sed -E "s/.*${IMAGE_NAME}:([^[:space:]\"']+).*/\1/" || true)
  echo "$tag"
}

poll_url() {
  # poll_url <url> <timeout-secs> <expect-substring>
  # Returns 0 on first match, 1 on timeout.
  local url="$1"
  local timeout="$2"
  local expect="$3"
  local start now elapsed body code
  start=$(date +%s)
  while :; do
    now=$(date +%s)
    elapsed=$((now - start))
    if (( elapsed >= timeout )); then
      return 1
    fi
    body=$(curl -s --max-time 5 "$url" 2>/dev/null || true)
    code=$(curl -s -o /dev/null --max-time 5 -w '%{http_code}' "$url" 2>/dev/null || true)
    if [[ "$code" == "200" && "$body" == *"$expect"* ]]; then
      return 0
    fi
    sleep 3
  done
}

write_compose_env() {
  # Make sure compose.yml's env-file references resolve. We touch the
  # file (creating if missing) and update REGISTRY / LIVE_IMAGE_TAG /
  # IMAGE_TAG_OVERRIDE atomically. Other lines preserved.
  local registry="$1"
  local live_tag="$2"
  local override_tag="${3:-}"

  $SUDO touch "$COMPOSE_ENV_FILE"

  local tmp
  tmp=$(mktemp)
  # Strip any existing entries we own, then re-append at the bottom.
  $SUDO grep -vE '^(REGISTRY|LIVE_IMAGE_TAG|IMAGE_TAG_OVERRIDE)=' "$COMPOSE_ENV_FILE" > "$tmp" || true
  {
    echo "REGISTRY=${registry}"
    echo "LIVE_IMAGE_TAG=${live_tag}"
    echo "IMAGE_TAG_OVERRIDE=${override_tag}"
  } >> "$tmp"
  $SUDO cp "$tmp" "$COMPOSE_ENV_FILE"
  rm -f "$tmp"
}

cleanup_sidecar() {
  # Best-effort sidecar cleanup. Never throws — used in EXIT trap.
  log "cleanup: stopping sidecar (if any)"
  $SUDO docker compose --project-directory "$COMPOSE_DIR" \
    -f "$COMPOSE_FILE" -f "$CANARY_COMPOSE_FILE" \
    --profile validation rm -fsv "$SIDECAR_NAME" >/dev/null 2>&1 || true
  # Belt-and-braces — kill by container name in case the compose service
  # name diverged.
  $SUDO docker rm -f "$SIDECAR_NAME" >/dev/null 2>&1 || true
}

docker_disk_report() {
  # docker_disk_report <label>
  # Best-effort disk snapshot for deploy logs. Never throws.
  local label="${1:-snapshot}"
  log "docker disk report (${label})"
  df -h / /var/lib/docker /var/lib/containerd >&2 2>/dev/null || df -h >&2 || true
  $SUDO docker system df >&2 || true
}

pre_pull_cleanup() {
  # Free space before pulling the next image. This intentionally avoids
  # docker system prune --volumes because AFFiNE data must never be removed
  # by deploy automation. The running production image is still referenced
  # by affine_server, so docker image prune -a will not delete it.
  if [[ "$DEPLOY_PRUNE_BEFORE_PULL" != "1" ]]; then
    log "pre-pull docker cleanup disabled (DEPLOY_PRUNE_BEFORE_PULL=${DEPLOY_PRUNE_BEFORE_PULL})"
    return
  fi

  log "pre-pull docker cleanup: pruning stopped containers, unused images, and build cache (volumes preserved)"
  docker_disk_report "before pre-pull cleanup"
  $SUDO docker container prune -f >&2 || true
  $SUDO docker builder prune -af >&2 || true
  $SUDO docker image prune -af >&2 || true
  docker_disk_report "after pre-pull cleanup"
}

dump_logs() {
  # dump_logs <container-name> <tail-lines>
  # Redirect both stdout and stderr from `docker logs` to OUR stderr
  # so the dump never contaminates the JSON we emit on stdout. Order
  # matters: `>&2 2>&1` would send stderr to original stdout. We want
  # both streams on fd 2.
  local name="$1"
  local n="${2:-50}"
  log "----- last $n lines of $name -----"
  $SUDO docker logs --tail "$n" "$name" >&2 2>&1 || log "(no logs available for $name)"
  log "----- end logs -----"
}

rollback() {
  # Restore the previous image tag and recreate production. Best-effort:
  # never throws (caller decides whether to exit). Re-poll happens in the
  # caller, not here.
  if [[ -z "${PREVIOUS_TAG:-}" ]]; then
    log "no PREVIOUS_TAG known — restoring compose.yml from backup wholesale"
    $SUDO cp "$COMPOSE_BACKUP" "$COMPOSE_FILE"
  else
    log "rolling back to ${PREVIOUS_TAG}"
    # Skip env-interpolated lines (canary), same as the swap step.
    $SUDO sed -i -E "/${IMAGE_NAME}:\\\$\\{/!s|(${IMAGE_NAME}:)[^[:space:]\"']+|\1${PREVIOUS_TAG}|g" "$COMPOSE_FILE"
    write_compose_env "$REGISTRY" "$PREVIOUS_TAG" ""
  fi
  $SUDO docker compose --project-directory "$COMPOSE_DIR" pull "$PROD_SERVICE" >&2 || true
  $SUDO docker compose --project-directory "$COMPOSE_DIR" \
    up -d --force-recreate "$PROD_SERVICE" >&2 || true
}

read_db_env_from_container() {
  # Pull DATABASE_USER / DATABASE_PASSWORD / DATABASE_HOST / DATABASE_PORT
  # / DATABASE_NAME from the live affine_server container's environment.
  # We do NOT read /srv/affine/compose/.env directly — the container is
  # the source of truth for what's actually running, and `.env` may carry
  # overrides that compose did not pick up.
  #
  # All variables are exported into the calling shell. Returns 0 on full
  # success, 1 if any required var is missing/empty.
  local kv user pass host port db
  if ! kv=$($SUDO docker exec "$PROD_CONTAINER" env 2>/dev/null); then
    log "could not exec env in $PROD_CONTAINER (container down or no permission)"
    return 1
  fi
  user=$(printf '%s\n' "$kv" | awk -F= '$1=="DATABASE_USER"{print substr($0, index($0,"=")+1); exit}')
  pass=$(printf '%s\n' "$kv" | awk -F= '$1=="DATABASE_PASSWORD"{print substr($0, index($0,"=")+1); exit}')
  host=$(printf '%s\n' "$kv" | awk -F= '$1=="DATABASE_HOST"{print substr($0, index($0,"=")+1); exit}')
  port=$(printf '%s\n' "$kv" | awk -F= '$1=="DATABASE_PORT"{print substr($0, index($0,"=")+1); exit}')
  db=$(printf '%s\n'   "$kv" | awk -F= '$1=="DATABASE_NAME"{print substr($0, index($0,"=")+1); exit}')

  if [[ -z "$user" || -z "$host" || -z "$port" || -z "$db" ]]; then
    log "missing required DATABASE_* env vars in $PROD_CONTAINER (user=${user:+set}, host=${host:+set}, port=${port:+set}, db=${db:+set})"
    return 1
  fi
  # Empty password is technically valid for a localhost trust auth setup
  # — don't reject it, but warn so the operator notices in CI logs.
  if [[ -z "$pass" ]]; then
    log "warning: DATABASE_PASSWORD is empty in $PROD_CONTAINER env (assuming trust auth)"
  fi
  export DB_USER="$user" DB_PASS="$pass" DB_HOST="$host" DB_PORT="$port" DB_NAME="$db"
  return 0
}

validate_prompts_seeded() {
  # Run a transient psql container on the same docker network as the
  # production server, count how many of the canonical seed prompts
  # (EXPECTED_PROMPTS) are present in ai_prompts_metadata.
  #
  # Returns:
  #   0  all expected prompts found
  #   1  count mismatch (some prompts missing — seeding silently failed)
  #   3  infrastructure error (couldn't read DB env, couldn't connect,
  #      psql query timed out / errored — unable to determine state)
  #
  # The caller maps these to deploy outcomes. We deliberately DO NOT
  # silently skip on infra error — that would let real seed failures slip
  # through if the check itself ever broke.
  if ! read_db_env_from_container; then
    return 3
  fi

  # Build the IN-clause from the bash array safely. Each element is
  # SQL-quoted (single quotes doubled). The list is bounded by our own
  # array so there is no untrusted input here.
  local in_list="" first=1
  local p quoted
  for p in "${EXPECTED_PROMPTS[@]}"; do
    quoted=${p//\'/\'\'}
    if (( first )); then
      in_list="'$quoted'"
      first=0
    else
      in_list="${in_list}, '$quoted'"
    fi
  done
  local expected_count="${#EXPECTED_PROMPTS[@]}"
  local query="SELECT COUNT(*) FROM ai_prompts_metadata WHERE name IN (${in_list})"

  log "validating seeded prompts (expected=${expected_count}: ${EXPECTED_PROMPTS[*]})"

  # Pre-pull the psql container OUTSIDE the timeout window. On a VM that
  # has never run this gate before, the postgres:16-alpine image is not
  # locally cached and an implicit pull happens inside `docker run`. That
  # pull alone can exceed PSQL_QUERY_TIMEOUT_SECS (10s default) on a cold
  # VM, which makes the wrapped `timeout` kill the run with rc=124 and
  # the gate exits 3 (manual intervention) on a perfectly healthy deploy.
  # That's exactly what happened on the first Tier 2 deploy after the
  # prompt-seed gate landed (run 25412952845 / image
  # main-40fadf8b6-25412518581 — prod was healthy on the new image, but
  # the gate timed out on the postgres:16-alpine pull).
  #
  # `|| true` because:
  #   - on subsequent runs the image is cached, pull is a quick no-op.
  #   - if the registry is briefly unreachable, the run-step that
  #     follows will surface the error with proper context.
  log "ensuring ${PSQL_IMAGE} is locally cached"
  $SUDO docker image inspect "$PSQL_IMAGE" >/dev/null 2>&1 \
    || $SUDO docker pull "$PSQL_IMAGE" >/dev/null 2>&1 \
    || true

  # Run psql inside a transient container on the same docker network so
  # we don't need psql installed on the VM AND credentials never leave
  # this host. The container is auto-removed via --rm. We feed the SQL
  # via stdin so the password and the query never share a process arg
  # list (no `ps`-visible secrets either way, but stdin is cleaner).
  #
  # The 10s `timeout` wraps the whole exec — any hang (DNS, network,
  # query) trips it and we fall through to the infra-error branch.
  local out rc
  set +e
  out=$(
    printf '%s' "$query" | timeout "${PSQL_QUERY_TIMEOUT_SECS}s" \
      $SUDO docker run --rm -i \
        --network "$DOCKER_NETWORK" \
        -e PGHOST="$DB_HOST" \
        -e PGPORT="$DB_PORT" \
        -e PGUSER="$DB_USER" \
        -e PGPASSWORD="$DB_PASS" \
        -e PGDATABASE="$DB_NAME" \
        "$PSQL_IMAGE" \
        psql --no-psqlrc --quiet --tuples-only --no-align \
             --set ON_ERROR_STOP=1 \
             --command="$query" \
        2>&1
  )
  rc=$?
  set -e
  unset DB_PASS

  if (( rc != 0 )); then
    log "psql check failed (rc=${rc}): ${out}"
    return 3
  fi

  # psql -tA emits one count on its own line. Strip whitespace and
  # validate it's an integer.
  local actual
  actual=$(printf '%s' "$out" | tr -d '[:space:]')
  if ! [[ "$actual" =~ ^[0-9]+$ ]]; then
    log "psql returned non-numeric output: ${out}"
    return 3
  fi

  if (( actual == expected_count )); then
    log "PROMPT-SEED OK — ${actual}/${expected_count} canonical prompts present"
    return 0
  fi

  log "PROMPT-SEED MISMATCH — found ${actual}/${expected_count} canonical prompts"
  return 1
}

# ---- Validate args --------------------------------------------------------

if [[ -z "$IMAGE_TAG" ]]; then
  printf 'error: --image-tag is required\n' >&2
  usage >&2
  emit_json validation_failed "missing --image-tag"
  exit 1
fi

# Sanity-check timeouts are integers.
if ! [[ "$SMOKE_TIMEOUT" =~ ^[0-9]+$ ]] || ! [[ "$POST_SWAP_TIMEOUT" =~ ^[0-9]+$ ]]; then
  printf 'error: timeouts must be integers\n' >&2
  emit_json validation_failed "invalid timeout argument"
  exit 1
fi

# Validate --supersede-run-id if provided. Empty is valid (= disabled).
if [[ -n "$SUPERSEDE_RUN_ID" ]] && ! [[ "$SUPERSEDE_RUN_ID" =~ ^[0-9]+$ ]]; then
  printf 'error: --supersede-run-id must be a positive integer\n' >&2
  emit_json validation_failed "invalid --supersede-run-id"
  exit 1
fi

# ---- Concurrent-deploy lock ----------------------------------------------

# Helper: read the runid file. Outputs `<run_id> <pid>` on stdout if the
# file exists and parses; nothing otherwise. Quiet on missing file.
read_runid_file() {
  if [[ ! -f "$RUNID_FILE" ]]; then
    return 0
  fi
  # Defensive: only treat the line as valid if it matches "<digits> <digits>"
  local line
  line=$(head -1 "$RUNID_FILE" 2>/dev/null || true)
  if [[ "$line" =~ ^[0-9]+[[:space:]]+[0-9]+$ ]]; then
    printf '%s\n' "$line"
  fi
}

# Helper: atomically claim the runid file with our run_id + pid. We write
# to a sibling temp path then `mv` (rename(2) is atomic on the same fs).
# Caller MUST already hold flock so concurrent claimants are serialized.
write_runid_file() {
  local run_id="$1"
  local pid="$2"
  local tmp
  tmp=$(mktemp -p "$(dirname "$RUNID_FILE")" .deploy-runid.XXXXXX)
  printf '%s %s\n' "$run_id" "$pid" > "$tmp"
  mv -f "$tmp" "$RUNID_FILE"
  OUR_RUN_ID_WRITTEN="$run_id"
}

# Helper: clear the runid file iff it still names us. Don't trample
# whoever superseded us. Best-effort — used in EXIT trap.
clear_our_runid_file() {
  if [[ -z "$OUR_RUN_ID_WRITTEN" ]]; then
    return 0
  fi
  if [[ ! -f "$RUNID_FILE" ]]; then
    return 0
  fi
  local existing
  existing=$(read_runid_file)
  # Only clear if the run_id (first field) still equals ours.
  local existing_run_id="${existing%% *}"
  if [[ "$existing_run_id" == "$OUR_RUN_ID_WRITTEN" ]]; then
    rm -f "$RUNID_FILE" 2>/dev/null || true
  fi
}

# `flock -n` returns 1 immediately if the lock is held. We wrap the rest
# of the script body inside a flocked subshell so the lock is released
# automatically on exit. If we can't acquire it, surface an immediate
# validation_failed (legacy behavior, when --supersede-run-id is unset).
exec 9>"$LOCK_FILE"

if [[ -z "$SUPERSEDE_RUN_ID" ]]; then
  # Legacy path: just block-fast on flock and bail if held.
  if ! flock -n 9; then
    log "another deploy is in progress (lock $LOCK_FILE held); --supersede-run-id was not provided"
    emit_json validation_failed "another deploy in progress"
    exit 1
  fi
  log "lock acquired (no supersede semantics — manual invocation)"
else
  # Supersession path. Order of operations matters:
  #   1) Inspect runid file (no lock held — best-effort read).
  #   2) If we're newer, signal the holder PID; loop until lock yields.
  #   3) If we're older or same, exit 4 immediately.
  #   4) Once we hold the lock, atomically write our runid+pid.
  log "supersede mode: our run_id=${SUPERSEDE_RUN_ID}, pid=$$"

  EXISTING_LINE=$(read_runid_file)
  if [[ -n "$EXISTING_LINE" ]]; then
    EXISTING_RUN_ID="${EXISTING_LINE%% *}"
    EXISTING_PID="${EXISTING_LINE##* }"
    log "found in-flight deploy: run_id=${EXISTING_RUN_ID}, pid=${EXISTING_PID}"

    if (( EXISTING_RUN_ID > SUPERSEDE_RUN_ID )); then
      log "we are OLDER than ${EXISTING_RUN_ID}; bowing out"
      SUPERSEDED_BY_RUN_ID="$EXISTING_RUN_ID"
      emit_json superseded "preempted by newer deploy run_id=${EXISTING_RUN_ID}"
      exit 4
    fi

    if (( EXISTING_RUN_ID == SUPERSEDE_RUN_ID )); then
      # Same run id. Either a re-entry of ourselves, or a freak collision.
      # Either way, refusing is safer than racing.
      log "existing deploy has the SAME run_id (${EXISTING_RUN_ID}); refusing to race"
      SUPERSEDED_BY_RUN_ID="$EXISTING_RUN_ID"
      emit_json superseded "another instance with same run_id is already deploying"
      exit 4
    fi

    # We're newer — preempt the older deploy by signalling its PID.
    # Don't `pkill -f deploy.sh` — that could match a deploy script in
    # another tree (or this shell's own argv). Target the specific PID.
    log "we are NEWER than ${EXISTING_RUN_ID}; signalling pid=${EXISTING_PID} to bow out"
    if [[ "$EXISTING_PID" =~ ^[0-9]+$ ]] && [[ "$EXISTING_PID" != "$$" ]]; then
      # Only send if the pid still exists; otherwise it's a stale runid file.
      if kill -0 "$EXISTING_PID" 2>/dev/null; then
        kill -TERM "$EXISTING_PID" 2>/dev/null || true
        # Give the older deploy ~5s to exit cleanly (its EXIT trap runs
        # cleanup_sidecar). flock auto-releases on process death.
        for _ in 1 2 3 4 5; do
          if ! kill -0 "$EXISTING_PID" 2>/dev/null; then break; fi
          sleep 1
        done
        if kill -0 "$EXISTING_PID" 2>/dev/null; then
          log "pid=${EXISTING_PID} still alive after SIGTERM; sending SIGKILL"
          kill -KILL "$EXISTING_PID" 2>/dev/null || true
          sleep 1
        fi
      else
        log "pid=${EXISTING_PID} already gone (stale runid file)"
      fi
    fi
  fi

  # Acquire flock. If the older holder is dying we may need to wait a
  # moment for fcntl to release the lock; bound that wait at 30s before
  # giving up.
  if ! flock -w 30 9; then
    log "could not acquire flock within 30s after supersede attempt"
    emit_json validation_failed "flock acquisition timed out after supersede"
    exit 1
  fi
  log "lock acquired (after supersede)"

  # Now that we hold the lock, claim the runid file. (Re-check that we
  # haven't been superseded by a runner that beat us to it.)
  POST_LOCK_LINE=$(read_runid_file)
  if [[ -n "$POST_LOCK_LINE" ]]; then
    POST_LOCK_RUN_ID="${POST_LOCK_LINE%% *}"
    if (( POST_LOCK_RUN_ID > SUPERSEDE_RUN_ID )); then
      log "raced: a NEWER deploy (run_id=${POST_LOCK_RUN_ID}) claimed the lock between our checks"
      SUPERSEDED_BY_RUN_ID="$POST_LOCK_RUN_ID"
      emit_json superseded "preempted by newer deploy run_id=${POST_LOCK_RUN_ID}"
      exit 4
    fi
  fi
  write_runid_file "$SUPERSEDE_RUN_ID" "$$"
fi

# ---- Plan --------------------------------------------------------------

if (( ROLLBACK_ON_FAIL )); then ROLLBACK_DESC="enabled"; else ROLLBACK_DESC="disabled"; fi
log "Deploying ${IMAGE_TAG} (smoke timeout: ${SMOKE_TIMEOUT}s, post-swap timeout: ${POST_SWAP_TIMEOUT}s, auto-rollback: ${ROLLBACK_DESC})"

# ---- Snapshot current state ----------------------------------------------

if [[ ! -f "$COMPOSE_FILE" ]]; then
  log "compose file missing: $COMPOSE_FILE"
  emit_json validation_failed "compose.yml not found at $COMPOSE_FILE"
  exit 1
fi

PREVIOUS_TAG=$(extract_current_tag "$COMPOSE_FILE")
log "current image tag: ${PREVIOUS_TAG:-<unknown>}"

log "snapshotting compose.yml -> $(basename "$COMPOSE_BACKUP")"
$SUDO cp "$COMPOSE_FILE" "$COMPOSE_BACKUP"

# Trap EXIT for sidecar cleanup AND runid-file release. Re-set after each
# major phase if needed, but this single trap covers all early-exit paths.
# clear_our_runid_file is no-op if we never wrote a runid (legacy mode).
trap 'cleanup_sidecar; clear_our_runid_file' EXIT

# ---- Step 1: pull image ---------------------------------------------------

NEW_IMAGE="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
pre_pull_cleanup
log "pulling ${NEW_IMAGE}"
if ! $SUDO docker pull "$NEW_IMAGE" >&2; then
  log "docker pull failed"
  emit_json validation_failed "docker pull failed for ${NEW_IMAGE}"
  exit 1
fi

# ---- Step 2: spin up sidecar ---------------------------------------------

# Compose looks up `${IMAGE_TAG_OVERRIDE:-${LIVE_IMAGE_TAG}}` for the
# canary service. We set both via the env file so the sidecar uses the
# new tag while production stays on the old one.
log "writing compose env (live=${PREVIOUS_TAG:-?}, override=${IMAGE_TAG})"
write_compose_env "$REGISTRY" "${PREVIOUS_TAG:-${IMAGE_TAG}}" "$IMAGE_TAG"

log "starting sidecar ${SIDECAR_NAME} on host port ${SIDECAR_HOST_PORT}"
# Canary is defined in the OVERLAY file (compose.canary.yml). Both -f
# files together: compose.yml carries production (and the affine_net
# network); compose.canary.yml adds the affine_canary service.
# Production compose.yml is never modified by this command.
if ! $SUDO docker compose --project-directory "$COMPOSE_DIR" \
       -f "$COMPOSE_FILE" -f "$CANARY_COMPOSE_FILE" \
       --profile validation up -d "$SIDECAR_NAME" >&2; then
  log "sidecar failed to start"
  dump_logs "$SIDECAR_NAME" 50
  emit_json validation_failed "sidecar container failed to start"
  exit 1
fi

# ---- Step 3: validate sidecar via /info -----------------------------------

log "polling http://localhost:${SIDECAR_HOST_PORT}/info (timeout ${SMOKE_TIMEOUT}s)"
if ! poll_url "http://localhost:${SIDECAR_HOST_PORT}/info" "$SMOKE_TIMEOUT" '"compatibility":"'; then
  log "SIDECAR FAILED: /info never returned 200 with compatibility header"
  dump_logs "$SIDECAR_NAME" 50
  emit_json validation_failed "sidecar boot timed out after ${SMOKE_TIMEOUT}s"
  exit 1
fi
log "sidecar VALIDATED — /info OK"

# ---- Step 4: stop sidecar -------------------------------------------------

log "stopping sidecar before production swap"
cleanup_sidecar
# Reset the env-file override so a future un-coordinated `docker compose
# up` doesn't accidentally bring the canary back on the new tag.
write_compose_env "$REGISTRY" "${PREVIOUS_TAG:-${IMAGE_TAG}}" ""

# ---- Step 5: atomic swap of production image ------------------------------

log "swapping production compose.yml -> ${IMAGE_TAG}"
# sed pattern: match `affine-gogocash:<TAG>` and rewrite TAG, but ONLY
# on lines where the tag is a literal (not `${...}` env-interpolated).
# The leading address `/affine-gogocash:\${/!` means "skip lines where
# the image is env-interpolated" — that preserves the canary's
# `image: ${...}/affine-gogocash:${IMAGE_TAG_OVERRIDE:-${LIVE_IMAGE_TAG}}`
# entry so it can keep tracking LIVE_IMAGE_TAG via the .env file.
$SUDO sed -i -E "/${IMAGE_NAME}:\\\$\\{/!s|(${IMAGE_NAME}:)[^[:space:]\"']+|\1${IMAGE_TAG}|g" "$COMPOSE_FILE"
# Also keep LIVE_IMAGE_TAG in sync so any compose env-interpolation
# (canary, future sidecars) sees the right baseline.
write_compose_env "$REGISTRY" "$IMAGE_TAG" ""

log "docker compose pull ${PROD_SERVICE}"
if ! $SUDO docker compose --project-directory "$COMPOSE_DIR" pull "$PROD_SERVICE" >&2; then
  log "docker compose pull failed (this is suspicious — pull succeeded earlier)"
  # Don't auto-rollback yet — the compose file change is in place but
  # the running container hasn't been recreated. Roll the file back so
  # subsequent `up -d` doesn't accidentally pick up the new image.
  $SUDO cp "$COMPOSE_BACKUP" "$COMPOSE_FILE"
  write_compose_env "$REGISTRY" "${PREVIOUS_TAG:-${IMAGE_TAG}}" ""
  emit_json validation_failed "compose pull of new tag failed during swap"
  exit 1
fi

log "docker compose up -d --force-recreate ${PROD_SERVICE}"
if ! $SUDO docker compose --project-directory "$COMPOSE_DIR" \
       up -d --force-recreate "$PROD_SERVICE" >&2; then
  log "compose up failed; attempting rollback"
  if (( ROLLBACK_ON_FAIL )); then
    rollback || true
    emit_json rollback_failed "compose up of new tag failed during swap"
    exit 3
  fi
  emit_json validation_failed "compose up of new tag failed during swap"
  exit 1
fi

# ---- Step 6: post-swap smoke test ----------------------------------------

log "polling https://${PROD_HOST}/info (timeout ${POST_SWAP_TIMEOUT}s)"
if poll_url "https://${PROD_HOST}/info" "$POST_SWAP_TIMEOUT" '"compatibility":"'; then
  log "PRODUCTION HEALTHY on ${IMAGE_TAG}"

  # ---- Step 6b: Tier 2 prompt-seed gate ---------------------------------
  # /info is binary: did the server bind a port. PromptService runs in
  # onApplicationBootstrap AFTER the listener is up, so /info=200 does
  # NOT mean prompts upserted successfully. Verify the canonical seed
  # set is in the DB before declaring success. If it isn't, the new
  # image is broken even though /info passed → auto-rollback.
  set +e
  validate_prompts_seeded
  PROMPT_RC=$?
  set -e

  case "$PROMPT_RC" in
    0)
      emit_json success ""
      exit 0
      ;;
    1)
      log "POST-SWAP PROMPT-SEED FAILED — initiating rollback"
      dump_logs "$PROD_CONTAINER" 80
      if (( ROLLBACK_ON_FAIL == 0 )); then
        log "auto-rollback disabled; leaving the broken image in place"
        emit_json validation_failed "post-swap prompts not seeded (auto-rollback disabled)"
        exit 1
      fi
      rollback
      log "polling https://${PROD_HOST}/info post-rollback (timeout 60s)"
      if poll_url "https://${PROD_HOST}/info" 60 '"compatibility":"'; then
        log "ROLLBACK SUCCEEDED — production is back on ${PREVIOUS_TAG:-previous tag}"
        emit_json rolled_back "prompts not seeded post-swap; rolled back successfully"
        exit 2
      fi
      log "ROLLBACK FAILED — manual intervention required"
      emit_json rollback_failed "prompts not seeded post-swap; rollback also failed"
      exit 3
      ;;
    *)
      # Could not determine prompt-seed state. Don't auto-rollback
      # blindly — we don't actually know if the deploy is broken. Surface
      # this as a critical condition so a human looks at it.
      log "PROMPT-SEED CHECK FAILED — could not run psql; manual intervention required"
      emit_json rollback_failed "post-swap prompt-seed check itself failed (rc=${PROMPT_RC})"
      exit 3
      ;;
  esac
fi

log "POST-SWAP SMOKE FAILED — production /info did not return 200"
dump_logs "affine_server" 50

if (( ROLLBACK_ON_FAIL == 0 )); then
  log "auto-rollback disabled; leaving the broken image in place"
  emit_json validation_failed "post-swap smoke timed out and rollback disabled"
  exit 1
fi

# ---- Step 7: auto-rollback ------------------------------------------------

log "initiating rollback"
rollback

log "polling https://${PROD_HOST}/info post-rollback (timeout 60s)"
if poll_url "https://${PROD_HOST}/info" 60 '"compatibility":"'; then
  log "ROLLBACK SUCCEEDED — production is back on ${PREVIOUS_TAG:-previous tag}"
  emit_json rolled_back "post-swap smoke failed; rolled back successfully"
  exit 2
fi

log "ROLLBACK FAILED — manual intervention required"
emit_json rollback_failed "post-swap smoke failed; rollback also failed"
exit 3
