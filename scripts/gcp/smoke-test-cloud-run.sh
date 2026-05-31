#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://manut.xyz}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-120}"
SLEEP_SECONDS="${SLEEP_SECONDS:-5}"
REQUIRE_INITIALIZED="${REQUIRE_INITIALIZED:-true}"
REQUIRED_SERVER_FEATURES="${REQUIRED_SERVER_FEATURES-Manut,Copilot}"

if ! command -v curl >/dev/null 2>&1; then
  echo "[smoke] curl is required for Cloud Run smoke checks" >&2
  exit 1
fi

deadline=$((SECONDS + TIMEOUT_SECONDS))

request() {
  local path="$1"
  local method="${2:-GET}"
  local data="${3:-}"
  local status
  local args=(-sS -D "$SMOKE_HEADERS" -o "$SMOKE_BODY" -w "%{http_code}" --max-time 10)

  if [ "$method" = "POST" ]; then
    args+=(-X POST -H "content-type: application/json" -H "accept: application/json" --data "$data")
  fi

  status="$(curl "${args[@]}" "${BASE_URL}${path}")"
  case "$status" in
    2*) return 0 ;;
    *)
      echo "[smoke] ${BASE_URL}${path} returned HTTP ${status}" >&2
      return 1
      ;;
  esac
}

require_json_response() {
  local path="$1"
  if ! grep -Eiq '^content-type:[[:space:]]*application/json' "$SMOKE_HEADERS"; then
    echo "[smoke] ${BASE_URL}${path} did not return JSON" >&2
    sed -n '1,12p' "$SMOKE_HEADERS" >&2
    return 1
  fi
}

probe_info() {
  request "/info"
  require_json_response "/info"
  if ! grep -Eq '"compatibility"[[:space:]]*:' "$SMOKE_BODY"; then
    echo "[smoke] ${BASE_URL}/info JSON is missing compatibility" >&2
    return 1
  fi
}

probe_server_config() {
  local query='{"query":"query SmokeServerConfig { serverConfig { version type initialized features } }"}'

  request "/graphql" "POST" "$query"
  require_json_response "/graphql"

  if ! grep -Eq '"serverConfig"[[:space:]]*:' "$SMOKE_BODY"; then
    echo "[smoke] ${BASE_URL}/graphql response is missing serverConfig" >&2
    return 1
  fi

  if grep -Eq '"errors"[[:space:]]*:' "$SMOKE_BODY"; then
    echo "[smoke] ${BASE_URL}/graphql returned errors" >&2
    sed -n '1,20p' "$SMOKE_BODY" >&2
    return 1
  fi

  if [ "$REQUIRE_INITIALIZED" = "true" ] &&
    ! grep -Eq '"initialized"[[:space:]]*:[[:space:]]*true' "$SMOKE_BODY"; then
    echo "[smoke] ${BASE_URL}/graphql reports serverConfig.initialized != true" >&2
    sed -n '1,20p' "$SMOKE_BODY" >&2
    return 1
  fi

  if [ -n "$REQUIRED_SERVER_FEATURES" ]; then
    local feature
    local raw_features="$REQUIRED_SERVER_FEATURES"
    local old_ifs="$IFS"
    IFS=','
    for feature in $raw_features; do
      feature="${feature#"${feature%%[![:space:]]*}"}"
      feature="${feature%"${feature##*[![:space:]]}"}"
      [ -z "$feature" ] && continue

      if ! grep -Fq "\"${feature}\"" "$SMOKE_BODY"; then
        echo "[smoke] ${BASE_URL}/graphql is missing required server feature: ${feature}" >&2
        sed -n '1,20p' "$SMOKE_BODY" >&2
        IFS="$old_ifs"
        return 1
      fi
    done
    IFS="$old_ifs"
  fi
}

SMOKE_TMPDIR="$(mktemp -d)"
SMOKE_HEADERS="$SMOKE_TMPDIR/headers"
SMOKE_BODY="$SMOKE_TMPDIR/body"
trap 'rm -rf "$SMOKE_TMPDIR"' EXIT

echo "[smoke] Waiting for ${BASE_URL}/info"
until probe_info; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "[smoke] timed out waiting for ${BASE_URL}/info" >&2
    exit 1
  fi
  sleep "$SLEEP_SECONDS"
done

echo "[smoke] Checking GraphQL server config"
until probe_server_config; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "[smoke] timed out waiting for ${BASE_URL}/graphql serverConfig" >&2
    exit 1
  fi
  sleep "$SLEEP_SECONDS"
done

echo "[smoke] Cloud Run HTTP smoke passed for ${BASE_URL}"
