#!/usr/bin/env bash
#
# rollback.sh — One-button emergency rollback.
#
# Reverts production to a previous image tag and re-polls /info. Used
# when deploy.sh's auto-rollback didn't fire (e.g. --no-rollback-on-failure
# was set, or a deploy "succeeded" but later turned out broken).
#
# Behavior:
#   1. Determine TARGET_TAG:
#        --target-tag <tag> if provided, else
#        read it from compose.yml.previous.bak (the deploy-time backup),
#        else error out (status=no_target).
#   2. Snapshot the current compose.yml to compose.yml.before-rollback-<ts>.bak
#      (so we don't trample compose.yml.previous.bak — that file is the
#      ROLLBACK TARGET, we want to keep it untouched).
#   3. Update compose.yml's affine service image tag.
#   4. docker compose pull + up -d --force-recreate affine.
#   5. Poll /info for 60s.
#
# Exit codes:
#   0  rolled_back
#   1  no_target / argument error
#   2  rollback_failed (compose updated, container restarted, but /info
#      never came back)

set -euo pipefail

REGISTRY="${REGISTRY:-asia-southeast1-docker.pkg.dev/affine-495114/affine}"
IMAGE_NAME="${IMAGE_NAME:-affine-gogocash}"
COMPOSE_DIR="${COMPOSE_DIR:-/srv/affine/compose}"
COMPOSE_FILE="${COMPOSE_DIR}/compose.yml"
COMPOSE_BACKUP="${COMPOSE_DIR}/compose.yml.previous.bak"
COMPOSE_ENV_FILE="${COMPOSE_DIR}/.env"
PROD_HOST="${PROD_HOST:-manut.gogocash.co}"
PROD_SERVICE="${PROD_SERVICE:-affine}"
SUDO="${DEPLOY_SUDO-sudo}"

TARGET_TAG=""
START_TS=$(date +%s)

log() {
  printf '[%s] %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2
}

usage() {
  cat <<EOF
Usage: $0 [--target-tag <tag>]

Emergency rollback for the production affine service. If --target-tag
is omitted, the previous tag is read from ${COMPOSE_BACKUP}.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-tag)
      TARGET_TAG="${2:-}"
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

extract_tag_from_file() {
  # Skip lines where the tag is env-interpolated (`${...}` placeholder).
  # See the same helper in deploy.sh for rationale.
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo ""
    return
  fi
  grep -E "${IMAGE_NAME}:[^[:space:]\$\"']" "$file" | head -1 \
    | sed -E "s/.*${IMAGE_NAME}:([^[:space:]\"']+).*/\1/" || true
}

write_compose_env() {
  local registry="$1"
  local live_tag="$2"
  local override_tag="${3:-}"
  $SUDO touch "$COMPOSE_ENV_FILE"
  local tmp
  tmp=$(mktemp)
  $SUDO grep -vE '^(REGISTRY|LIVE_IMAGE_TAG|IMAGE_TAG_OVERRIDE)=' "$COMPOSE_ENV_FILE" > "$tmp" || true
  {
    echo "REGISTRY=${registry}"
    echo "LIVE_IMAGE_TAG=${live_tag}"
    echo "IMAGE_TAG_OVERRIDE=${override_tag}"
  } >> "$tmp"
  $SUDO cp "$tmp" "$COMPOSE_ENV_FILE"
  rm -f "$tmp"
}

poll_url() {
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

emit_json() {
  local status="$1"
  local end_ts duration
  end_ts=$(date +%s)
  duration=$((end_ts - START_TS))
  jq -nc \
    --arg status "$status" \
    --arg target_tag "${TARGET_TAG:-}" \
    --arg previous_running_tag "${PREVIOUS_RUNNING_TAG:-}" \
    --argjson duration_secs "$duration" \
    '{
      status: $status,
      target_tag: $target_tag,
      previous_running_tag: $previous_running_tag,
      duration_secs: $duration_secs
    }'
}

# ---- 1. Determine target ------------------------------------------------

PREVIOUS_RUNNING_TAG=$(extract_tag_from_file "$COMPOSE_FILE")
log "currently running tag: ${PREVIOUS_RUNNING_TAG:-<unknown>}"

if [[ -z "$TARGET_TAG" ]]; then
  if [[ -f "$COMPOSE_BACKUP" ]]; then
    TARGET_TAG=$(extract_tag_from_file "$COMPOSE_BACKUP")
    log "target tag (from $COMPOSE_BACKUP): ${TARGET_TAG:-<empty>}"
  fi
fi

if [[ -z "$TARGET_TAG" ]]; then
  log "no target tag provided and no usable backup at $COMPOSE_BACKUP"
  emit_json no_target
  exit 1
fi

if [[ "$TARGET_TAG" == "$PREVIOUS_RUNNING_TAG" ]]; then
  log "warning: target tag ($TARGET_TAG) is the same as the running tag — no-op rollback"
fi

# ---- 2. Snapshot current compose.yml ------------------------------------

TS=$(date -u +%Y%m%dT%H%M%SZ)
NEW_BACKUP="${COMPOSE_DIR}/compose.yml.before-rollback-${TS}.bak"
log "snapshotting current compose.yml -> $(basename "$NEW_BACKUP")"
$SUDO cp "$COMPOSE_FILE" "$NEW_BACKUP"

# ---- 3. Rewrite compose.yml ---------------------------------------------

log "updating compose.yml -> ${TARGET_TAG}"
# Skip lines where the image tag is env-interpolated (canary). Same
# rationale as in deploy.sh — preserve the placeholder so it can keep
# tracking LIVE_IMAGE_TAG.
$SUDO sed -i -E "/${IMAGE_NAME}:\\\$\\{/!s|(${IMAGE_NAME}:)[^[:space:]\"']+|\1${TARGET_TAG}|g" "$COMPOSE_FILE"
write_compose_env "$REGISTRY" "$TARGET_TAG" ""

# ---- 4. Pull + recreate -------------------------------------------------

log "docker compose pull ${PROD_SERVICE}"
if ! $SUDO docker compose --project-directory "$COMPOSE_DIR" pull "$PROD_SERVICE" >&2; then
  log "docker compose pull failed"
  emit_json rollback_failed
  exit 2
fi

log "docker compose up -d --force-recreate ${PROD_SERVICE}"
if ! $SUDO docker compose --project-directory "$COMPOSE_DIR" \
       up -d --force-recreate "$PROD_SERVICE" >&2; then
  log "docker compose up failed"
  emit_json rollback_failed
  exit 2
fi

# ---- 5. Smoke ------------------------------------------------------------

log "polling https://${PROD_HOST}/info (timeout 60s)"
if poll_url "https://${PROD_HOST}/info" 60 '"compatibility":"'; then
  log "ROLLBACK SUCCEEDED on ${TARGET_TAG}"
  emit_json rolled_back
  exit 0
fi

log "ROLLBACK FAILED — production /info did not return 200 on ${TARGET_TAG}"
$SUDO docker logs --tail 50 affine_server >&2 || true
emit_json rollback_failed
exit 2
