#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://manut.xyz}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-120}"
SLEEP_SECONDS="${SLEEP_SECONDS:-5}"

deadline=$((SECONDS + TIMEOUT_SECONDS))

probe() {
  local path="$1"
  curl -fsS --max-time 10 "${BASE_URL}${path}" >/dev/null
}

echo "[smoke] Waiting for ${BASE_URL}/info"
until probe "/info"; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "[smoke] timed out waiting for ${BASE_URL}/info" >&2
    exit 1
  fi
  sleep "$SLEEP_SECONDS"
done

echo "[smoke] Checking server config"
probe "/api/server-config"

echo "[smoke] Checking version endpoint"
probe "/api/version"

echo "[smoke] Cloud Run HTTP smoke passed for ${BASE_URL}"
