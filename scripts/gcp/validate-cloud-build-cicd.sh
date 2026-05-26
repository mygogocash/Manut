#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

require_file() {
  local path="$1"
  if [ ! -f "$ROOT/$path" ]; then
    echo "[cicd] missing required file: $path" >&2
    return 1
  fi
}

require_contains() {
  local path="$1"
  local pattern="$2"
  if ! grep -Eq -- "$pattern" "$ROOT/$path"; then
    echo "[cicd] expected $path to contain pattern: $pattern" >&2
    return 1
  fi
}

parse_yaml() {
  local path="$1"
  ruby -ryaml -e 'YAML.safe_load(File.read(ARGV.fetch(0)), aliases: true)' "$ROOT/$path"
}

require_file "cloudbuild.manut-ci.yaml"
require_file "cloudbuild.manut-cloud-run.yaml"
require_file "scripts/gcp/upsert-cloud-build-triggers.sh"

parse_yaml "cloudbuild.manut-ci.yaml"
parse_yaml "cloudbuild.manut-cloud-run.yaml"

require_contains "cloudbuild.manut-ci.yaml" "yarn oxlint --deny-warnings"
require_contains "cloudbuild.manut-ci.yaml" "yarn workspace @affine/graphql build"
require_contains "cloudbuild.manut-ci.yaml" "yarn affine bundle -p web"
require_contains "cloudbuild.manut-ci.yaml" "yarn affine bundle -p admin"
require_contains "cloudbuild.manut-ci.yaml" "yarn affine bundle -p mobile"

require_contains "cloudbuild.manut-cloud-run.yaml" "_SMOKE_BASE_URL"
require_contains "cloudbuild.manut-cloud-run.yaml" "scripts/gcp/smoke-test-cloud-run.sh"
require_contains "cloudbuild.manut-cloud-run.yaml" "MANUT_RUN_STARTUP_MIGRATIONS=false"

require_contains "scripts/gcp/upsert-cloud-build-triggers.sh" "manut-gcp-pr-ci"
require_contains "scripts/gcp/upsert-cloud-build-triggers.sh" "manut-gcp-main-staging"
require_contains "scripts/gcp/upsert-cloud-build-triggers.sh" "manut-gcp-prod-deploy"
require_contains "scripts/gcp/upsert-cloud-build-triggers.sh" "--require-approval"

echo "[cicd] Cloud Build CI/CD config checks passed"
