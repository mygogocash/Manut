#!/usr/bin/env bash
# Configure preview/staging GitHub Environment deploy credentials and the
# preview-only first-deploy secret inputs. Never prints secret values. Does not
# commit anything or mutate production Worker runtime secrets. Production
# deploy authentication is owned by Workers Builds in the Cloudflare dashboard.
#
# Prerequisites:
#   - `gh auth login` with repo admin for Environment secrets
#   - Optional R2 S3 keys: export R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY
#     (create under Cloudflare Dashboard → R2 → Manage R2 API Tokens).
#     Omit both to use Worker + UPLOADS binding-only uploads.
#
# Usage (from repo root):
#   export CLOUDFLARE_API_TOKEN=...           # required for preview/staging deploys
#   export PREVIEW_EDGE_SIGNING_KEY=...       # required for a green preview deploy
#   # optional SigV4 pair:
#   # export R2_ACCESS_KEY_ID=...
#   # export R2_SECRET_ACCESS_KEY=...
#   ./scripts/setup-cloudflare-deploy-secrets.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-187ab61ed9dbc6e616cb23e6b95aa8f1}"
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"
REPO="${GITHUB_REPOSITORY:-mygogocash/Manut}"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI required" >&2
  exit 1
fi

if [[ -n "${R2_ACCESS_KEY_ID:-}" && -z "${R2_SECRET_ACCESS_KEY:-}" ]] ||
  [[ -z "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" ]]; then
  echo "error: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be supplied together" >&2
  exit 1
fi

preview_signing_key="${PREVIEW_EDGE_SIGNING_KEY:-}"
if [[ -n "$preview_signing_key" && ${#preview_signing_key} -lt 32 ]]; then
  echo "error: PREVIEW_EDGE_SIGNING_KEY must be at least 32 characters" >&2
  exit 1
fi

ensure_env() {
  local env_name="$1"
  gh api --method PUT "repos/${REPO}/environments/${env_name}" --input - >/dev/null <<'EOF'
{}
EOF
  echo "GitHub Environment ensured: ${env_name}"
}

set_env_secret() {
  local env_name="$1"
  local name="$2"
  local value="$3"
  if [[ -z "$value" ]]; then
    echo "note: skip GitHub secret ${name} on ${env_name} (empty)"
    return 0
  fi
  printf '%s' "$value" | gh secret set "$name" --env "$env_name" --repo "$REPO"
  echo "GitHub Environment secret set: ${env_name}/${name}"
}

set_env_var() {
  local env_name="$1"
  local name="$2"
  local value="$3"
  gh variable set "$name" --env "$env_name" --repo "$REPO" --body "$value"
  echo "GitHub Environment var set: ${env_name}/${name}"
}

for env_name in preview staging; do
  ensure_env "$env_name"
  set_env_secret "$env_name" CLOUDFLARE_ACCOUNT_ID "$ACCOUNT_ID"
done

set_env_secret preview EDGE_SIGNING_KEY "$preview_signing_key"
if [[ -n "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" ]]; then
  set_env_secret preview R2_ACCESS_KEY_ID "$R2_ACCESS_KEY_ID"
  set_env_secret preview R2_SECRET_ACCESS_KEY "$R2_SECRET_ACCESS_KEY"
else
  echo "note: R2 S3 pair unset — preview will use Worker + UPLOADS binding-only uploads."
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "note: CLOUDFLARE_API_TOKEN unset — cannot set GitHub Actions deploy token."
  echo "      Create a Cloudflare API token (Workers Scripts Edit + Queues Edit"
  echo "      + Workers R2 Storage Edit + Account read),"
  echo "      export CLOUDFLARE_API_TOKEN, then re-run this script."
else
  for env_name in preview staging; do
    set_env_secret "$env_name" CLOUDFLARE_API_TOKEN "$CLOUDFLARE_API_TOKEN"
  done
fi

set_env_var preview EXPO_PUBLIC_API_URL "https://manut-preview.bettergogocash.workers.dev/api"
set_env_var staging EXPO_PUBLIC_API_URL "https://manut-staging.bettergogocash.workers.dev/api"

echo
echo "Done (names only). Still human:"
echo "  - Production build token is dashboard-owned: select it in Cloudflare Worker"
echo "    manut → Settings → Builds with Account → Queues → Edit; do not store it"
echo "    in GitHub (builds self-provision queues/R2 before deploy)"
echo "  - Preview GitHub Environment needs EDGE_SIGNING_KEY; R2 S3 pair is optional"
echo "    (binding-only uploads when omitted). deploy-preview.yml uploads present"
echo "    secrets atomically to manut-preview and deletes its temp file on exit"
echo "  - Cloudflare Access → set Worker vars AUTH_JWKS_URL / AUTH_ISSUER / AUTH_AUDIENCE"
echo "  - Hyperdrive bind + ENABLE_HYPERDRIVE_BOUNDARY=true when ready"
echo "  - Optional: export R2 S3 pair and re-run to enable SigV4 client→R2"
echo "See docs/CICD_CLOUDFLARE.md"
