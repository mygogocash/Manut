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
PROD_HOST="${PROD_HOST:-affine.gogocash.co}"
SIDECAR_NAME="${SIDECAR_NAME:-affine_canary}"
SIDECAR_HOST_PORT="${SIDECAR_HOST_PORT:-3011}"
PROD_SERVICE="${PROD_SERVICE:-affine}"
SUDO="${DEPLOY_SUDO-sudo}"

IMAGE_TAG=""
SMOKE_TIMEOUT=90
POST_SWAP_TIMEOUT=60
ROLLBACK_ON_FAIL=1

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
  jq -nc \
    --arg status "$status" \
    --arg image_tag "$IMAGE_TAG" \
    --arg previous_image_tag "$prev_tag" \
    --argjson duration_secs "$duration" \
    --arg error "$err" \
    '{
      status: $status,
      image_tag: $image_tag,
      previous_image_tag: $previous_image_tag,
      duration_secs: $duration_secs
    } + (if $error == "" then {} else {error: $error} end)'
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

# ---- Concurrent-deploy lock ----------------------------------------------

# `flock -n` returns 1 immediately if the lock is held. We wrap the rest
# of the script body inside a flocked subshell so the lock is released
# automatically on exit. If we can't acquire it, surface an immediate
# validation_failed.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "another deploy is in progress (lock $LOCK_FILE held)"
  emit_json validation_failed "another deploy in progress"
  exit 1
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

# Trap EXIT for sidecar cleanup. Re-set after each major phase if needed,
# but this single trap covers all early-exit paths.
trap 'cleanup_sidecar' EXIT

# ---- Step 1: pull image ---------------------------------------------------

NEW_IMAGE="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
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
  emit_json success ""
  exit 0
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
