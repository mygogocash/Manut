#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MODULE="$ROOT/infra/gcp/modules/monitoring"
STAGING="$ROOT/infra/gcp/envs/staging/monitoring.tf"
PROD="$ROOT/infra/gcp/envs/prod/monitoring.tf"

required_files=(
  "$MODULE/main.tf"
  "$MODULE/variables.tf"
  "$MODULE/outputs.tf"
  "$MODULE/README.md"
  "$STAGING"
  "$PROD"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "[monitoring] missing required file: $file" >&2
    exit 1
  fi
done

required_alerts=(
  "cloud_run_5xx_ratio"
  "cloud_run_p95_latency"
  "cloud_run_max_instances"
  "cloud_sql_cpu"
  "cloud_sql_connections"
  "redis_memory"
  "vertex_errors"
)

for alert in "${required_alerts[@]}"; do
  if ! grep -q "google_monitoring_alert_policy\" \"$alert" "$MODULE/main.tf"; then
    echo "[monitoring] missing alert policy resource: $alert" >&2
    exit 1
  fi
done

if grep -R "terraform apply" "$MODULE" "$STAGING" "$PROD" >/dev/null; then
  echo "[monitoring] templates must not instruct operators to apply directly" >&2
  exit 1
fi

if command -v terraform >/dev/null 2>&1; then
  terraform fmt -check -recursive "$ROOT/infra/gcp"
else
  echo "[monitoring] terraform not found; skipped terraform fmt -check" >&2
fi

echo "[monitoring] monitoring template validation passed"
