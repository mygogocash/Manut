#!/usr/bin/env bash
set -euo pipefail

DRY_RUN="${DRY_RUN:-1}"
BASE_URL="${BASE_URL:-}"
PATHS="${PATHS:-/info /api/server-config}"
RPS="${RPS:-1}"
CONCURRENCY="${CONCURRENCY:-2}"
DURATION_SECONDS="${DURATION_SECONDS:-60}"
REQUEST_TIMEOUT_SECONDS="${REQUEST_TIMEOUT_SECONDS:-10}"
STOP_5XX_RATE_PERCENT="${STOP_5XX_RATE_PERCENT:-1}"
STOP_P95_SECONDS="${STOP_P95_SECONDS:-3}"
MAX_RPS="${MAX_RPS:-5}"
MAX_CONCURRENCY="${MAX_CONCURRENCY:-10}"
MAX_DURATION_SECONDS="${MAX_DURATION_SECONDS:-300}"
ALLOW_HIGHER_LOAD_TEST="${ALLOW_HIGHER_LOAD_TEST:-0}"
ALLOW_PROD_LOAD_TEST="${ALLOW_PROD_LOAD_TEST:-0}"
LOAD_TEST_TMPDIR=""

cleanup() {
  if [ -n "${LOAD_TEST_TMPDIR:-}" ]; then
    rm -rf "$LOAD_TEST_TMPDIR"
  fi
}

normalize_bool() {
  local name="$1"
  local value="$2"

  case "$value" in
    1 | true | TRUE | yes | YES) printf "1" ;;
    0 | false | FALSE | no | NO) printf "0" ;;
    *)
      echo "[load-test] ${name} must be 0 or 1; got '${value}'" >&2
      exit 2
      ;;
  esac
}

validate_positive_int() {
  local name="$1"
  local value="$2"

  case "$value" in
    '' | *[!0-9]*)
      echo "[load-test] ${name} must be a positive integer; got '${value}'" >&2
      exit 2
      ;;
  esac

  if [ "$value" -lt 1 ]; then
    echo "[load-test] ${name} must be greater than zero; got '${value}'" >&2
    exit 2
  fi
}

normalize_base_url() {
  local base="$1"

  while [ "${base%/}" != "$base" ]; do
    base="${base%/}"
  done

  printf "%s" "$base"
}

join_url() {
  local base="$1"
  local path="$2"

  case "$path" in
    /*) printf "%s%s" "$base" "$path" ;;
    *) printf "%s/%s" "$base" "$path" ;;
  esac
}

is_production_base_url() {
  local base
  base="$(normalize_base_url "$1")"

  case "$base" in
    https://manut.xyz | https://www.manut.xyz) return 0 ;;
    *) return 1 ;;
  esac
}

compare_gt() {
  awk -v actual="$1" -v limit="$2" 'BEGIN { exit !(actual > limit) }'
}

print_prerequisites() {
  cat <<EOF
[load-test] Prerequisites:
[load-test]   curl fallback: curl must be on PATH for real runs. This script uses:
[load-test]     curl -sS -o /dev/null -w '%{http_code} %{time_total}\\n' --max-time ${REQUEST_TIMEOUT_SECONDS} <url>
[load-test]   optional autocannon follow-up: autocannon must be on PATH and support --overallRate. Equivalent low-impact command:
[load-test]     autocannon --connections ${CONCURRENCY} --duration ${DURATION_SECONDS} --overallRate ${RPS} --timeout ${REQUEST_TIMEOUT_SECONDS} --renderStatusCodes <url>
[load-test]   optional k6 follow-up: k6 must be on PATH. Use a constant-arrival-rate scenario:
[load-test]     rate=${RPS}/second duration=${DURATION_SECONDS}s preAllocatedVUs=${CONCURRENCY} maxVUs=${CONCURRENCY}
EOF
}

print_stop_conditions() {
  cat <<EOF
[load-test] Stop conditions from docs/GCP_SCALE_READINESS.md:
[load-test]   - 5xx rate exceeds 1 percent. The curl loop enforces STOP_5XX_RATE_PERCENT=${STOP_5XX_RATE_PERCENT}.
[load-test]   - Cloud SQL connections exceed 70 percent of cap. Check Cloud Monitoring during the run.
[load-test]   - p95 stays above 3 seconds for 10 minutes. The curl loop enforces sample STOP_P95_SECONDS=${STOP_P95_SECONDS}.
[load-test]   - Cloud Run reaches max instances and queueing begins. Check Cloud Run metrics during the run.
[load-test]   - Vertex 429s persist after backoff. Check Vertex/provider metrics for AI-path tests.
EOF
}

print_config() {
  local base="$1"

  cat <<EOF
[load-test] Configuration:
[load-test]   DRY_RUN=${DRY_RUN}
[load-test]   BASE_URL=${base:-"(unset; required when DRY_RUN=0)"}
[load-test]   PATHS=${PATHS}
[load-test]   RPS=${RPS}
[load-test]   CONCURRENCY=${CONCURRENCY}
[load-test]   DURATION_SECONDS=${DURATION_SECONDS}
[load-test]   REQUEST_TIMEOUT_SECONDS=${REQUEST_TIMEOUT_SECONDS}
EOF
}

validate_config() {
  DRY_RUN="$(normalize_bool DRY_RUN "$DRY_RUN")"
  ALLOW_HIGHER_LOAD_TEST="$(normalize_bool ALLOW_HIGHER_LOAD_TEST "$ALLOW_HIGHER_LOAD_TEST")"
  ALLOW_PROD_LOAD_TEST="$(normalize_bool ALLOW_PROD_LOAD_TEST "$ALLOW_PROD_LOAD_TEST")"

  validate_positive_int RPS "$RPS"
  validate_positive_int CONCURRENCY "$CONCURRENCY"
  validate_positive_int DURATION_SECONDS "$DURATION_SECONDS"
  validate_positive_int REQUEST_TIMEOUT_SECONDS "$REQUEST_TIMEOUT_SECONDS"
  validate_positive_int MAX_RPS "$MAX_RPS"
  validate_positive_int MAX_CONCURRENCY "$MAX_CONCURRENCY"
  validate_positive_int MAX_DURATION_SECONDS "$MAX_DURATION_SECONDS"

  if [ "$DRY_RUN" = "0" ] && [ -z "$BASE_URL" ]; then
    echo "[load-test] BASE_URL is required for real runs. Example:" >&2
    echo "[load-test]   DRY_RUN=0 BASE_URL=https://staging.manut.xyz scripts/gcp/load-test-staging.sh" >&2
    exit 2
  fi

  if [ -z "$PATHS" ]; then
    echo "[load-test] PATHS must contain at least one path" >&2
    exit 2
  fi

  if [ "$ALLOW_HIGHER_LOAD_TEST" != "1" ]; then
    if [ "$RPS" -gt "$MAX_RPS" ] ||
      [ "$CONCURRENCY" -gt "$MAX_CONCURRENCY" ] ||
      [ "$DURATION_SECONDS" -gt "$MAX_DURATION_SECONDS" ]; then
      echo "[load-test] Requested load exceeds template caps:" >&2
      echo "[load-test]   MAX_RPS=${MAX_RPS} MAX_CONCURRENCY=${MAX_CONCURRENCY} MAX_DURATION_SECONDS=${MAX_DURATION_SECONDS}" >&2
      echo "[load-test] Set ALLOW_HIGHER_LOAD_TEST=1 only after an operator reviews the staging capacity plan." >&2
      exit 2
    fi
  fi

  if [ -n "$BASE_URL" ] &&
    is_production_base_url "$BASE_URL" &&
    [ "$ALLOW_PROD_LOAD_TEST" != "1" ]; then
    if [ "$DRY_RUN" = "0" ]; then
      echo "[load-test] refusing to load-test production BASE_URL=${BASE_URL}" >&2
      echo "[load-test] set ALLOW_PROD_LOAD_TEST=1 only for an explicitly approved production test window" >&2
      exit 2
    fi

    echo "[load-test] production BASE_URL detected; a real run will be refused unless ALLOW_PROD_LOAD_TEST=1"
  fi
}

print_dry_run() {
  local base="$1"
  local path
  local preview_base="${base:-https://staging.manut.xyz}"

  echo "[load-test] DRY_RUN=1; no traffic will be sent."
  echo "[load-test] Real staging run example:"
  echo "[load-test]   DRY_RUN=0 BASE_URL=https://staging.manut.xyz scripts/gcp/load-test-staging.sh"

  for path in $PATHS; do
    local url
    url="$(join_url "$preview_base" "$path")"
    echo "[load-test] curl preview for ${path}:"
    echo "[load-test]   curl -sS -o /dev/null -w '%{http_code} %{time_total}\\n' --max-time ${REQUEST_TIMEOUT_SECONDS} ${url}"
    echo "[load-test] optional autocannon preview for ${path}:"
    echo "[load-test]   autocannon --connections ${CONCURRENCY} --duration ${DURATION_SECONDS} --overallRate ${RPS} --timeout ${REQUEST_TIMEOUT_SECONDS} --renderStatusCodes ${url}"
  done
}

compute_p95() {
  local file="$1"

  awk '{ print $2 }' "$file" | sort -n | awk '
    { values[NR] = $1 }
    END {
      if (NR == 0) {
        print "0.000";
        exit;
      }

      rank = int((NR * 95 + 99) / 100);
      if (rank < 1) rank = 1;
      if (rank > NR) rank = NR;
      printf "%.3f", values[rank];
    }
  '
}

summarize_results() {
  local path="$1"
  local results="$2"
  local errors="$3"
  local total
  local http_5xx
  local network_failures
  local failure_count
  local failure_rate
  local p95

  total="$(wc -l <"$results" | tr -d ' ')"
  http_5xx="$(awk '$1 ~ /^5/ { count++ } END { print count + 0 }' "$results")"
  network_failures="$(awk '$1 == "000" { count++ } END { print count + 0 }' "$results")"
  failure_count=$((http_5xx + network_failures))
  failure_rate="$(
    awk -v failures="$failure_count" -v total="$total" 'BEGIN {
      if (total == 0) {
        print "100.00";
      } else {
        printf "%.2f", failures * 100 / total;
      }
    }'
  )"
  p95="$(compute_p95 "$results")"

  echo "[load-test] ${path} summary: requests=${total} 5xx=${http_5xx} network_failures=${network_failures} failure_rate=${failure_rate}% p95=${p95}s"

  if [ -s "$errors" ]; then
    echo "[load-test] curl stderr for ${path}:"
    sed -n '1,20p' "$errors" >&2
  fi

  if compare_gt "$failure_rate" "$STOP_5XX_RATE_PERCENT"; then
    echo "[load-test] stop: failure rate ${failure_rate}% exceeds ${STOP_5XX_RATE_PERCENT}%" >&2
    return 1
  fi

  if compare_gt "$p95" "$STOP_P95_SECONDS"; then
    echo "[load-test] stop: sample p95 ${p95}s exceeds ${STOP_P95_SECONDS}s" >&2
    return 1
  fi
}

run_curl_path() {
  local base="$1"
  local path="$2"
  local tmpdir="$3"
  local url
  local results
  local errors
  local total_requests
  local sleep_interval
  local deadline
  local sent=0

  url="$(join_url "$base" "$path")"
  results="${tmpdir}/$(echo "$path" | tr '/:' '__').results"
  errors="${tmpdir}/$(echo "$path" | tr '/:' '__').errors"
  : >"$results"
  : >"$errors"

  total_requests=$((DURATION_SECONDS * RPS))
  sleep_interval="$(awk -v concurrency="$CONCURRENCY" -v rps="$RPS" 'BEGIN { printf "%.3f", concurrency / rps }')"
  deadline=$((SECONDS + DURATION_SECONDS))

  echo "[load-test] Running curl loop for ${url}"
  echo "[load-test] Target: up to ${total_requests} requests over ${DURATION_SECONDS}s at ${RPS} RPS, concurrency ${CONCURRENCY}"

  while [ "$SECONDS" -lt "$deadline" ] && [ "$sent" -lt "$total_requests" ]; do
    local batch=0
    local pids=()
    local pid

    while [ "$batch" -lt "$CONCURRENCY" ] &&
      [ "$sent" -lt "$total_requests" ] &&
      [ "$SECONDS" -lt "$deadline" ]; do
      curl -sS -o /dev/null -w "%{http_code} %{time_total}\\n" --max-time "$REQUEST_TIMEOUT_SECONDS" "$url" >>"$results" 2>>"$errors" &
      pids+=("$!")
      batch=$((batch + 1))
      sent=$((sent + 1))
    done

    for pid in "${pids[@]}"; do
      wait "$pid" || true
    done

    if [ "$sent" -lt "$total_requests" ] && [ "$SECONDS" -lt "$deadline" ]; then
      sleep "$sleep_interval"
    fi
  done

  summarize_results "$path" "$results" "$errors"
}

run_curl_load() {
  local base="$1"
  local path

  if ! command -v curl >/dev/null 2>&1; then
    echo "[load-test] curl is required for the implemented low-impact loop" >&2
    exit 127
  fi

  LOAD_TEST_TMPDIR="$(mktemp -d)"
  trap cleanup EXIT

  for path in $PATHS; do
    run_curl_path "$base" "$path" "$LOAD_TEST_TMPDIR"
  done

  echo "[load-test] Staging curl load check completed within local stop conditions."
  echo "[load-test] Confirm Cloud SQL, Cloud Run, Redis, and Vertex stop conditions in Cloud Monitoring before raising load."
}

main() {
  local normalized_base=""

  validate_config

  if [ -n "$BASE_URL" ]; then
    normalized_base="$(normalize_base_url "$BASE_URL")"
  fi

  print_config "$normalized_base"
  print_prerequisites
  print_stop_conditions

  if [ "$DRY_RUN" = "1" ]; then
    print_dry_run "$normalized_base"
    exit 0
  fi

  if is_production_base_url "$normalized_base"; then
    echo "[load-test] production load-test override accepted for ${normalized_base}"
  fi

  run_curl_load "$normalized_base"
}

main "$@"
