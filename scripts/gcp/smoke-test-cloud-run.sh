#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://manut.xyz}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-120}"
SLEEP_SECONDS="${SLEEP_SECONDS:-5}"

deadline=$((SECONDS + TIMEOUT_SECONDS))

probe() {
  local path="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 10 "${BASE_URL}${path}" >/dev/null
  else
    ruby -rnet/http -ruri -e '
      uri = URI(ARGV.fetch(0))
      response = Net::HTTP.get_response(uri)
      unless response.is_a?(Net::HTTPSuccess)
        warn "#{uri} returned #{response.code}"
        exit 1
      end
    ' "${BASE_URL}${path}"
  fi
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
