#!/usr/bin/env bash
# Configure remaining Cloudflare Worker secrets + GitHub Environment deploy
# credentials. Never prints secret values. Does not commit anything.
#
# Prerequisites:
#   - Node from .nvmrc (`source ~/.nvm/nvm.sh && nvm use`)
#   - `wrangler login` OR export CLOUDFLARE_API_TOKEN
#   - `gh auth login` with repo admin for Environment secrets
#   - For R2 S3 keys: export R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY
#     (create under Cloudflare Dashboard → R2 → Manage R2 API Tokens)
#
# Usage (from repo root):
#   export CLOUDFLARE_API_TOKEN=...          # required for GitHub Actions deploys
#   export R2_ACCESS_KEY_ID=...             # optional; skips with note if unset
#   export R2_SECRET_ACCESS_KEY=...
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

if ! command -v pnpm >/dev/null 2>&1; then
  echo "error: pnpm required (nvm use / corepack)" >&2
  exit 1
fi

echo "Checking Cloudflare auth (wrangler whoami)…"
if ! pnpm --filter @manut/edge exec wrangler whoami >/tmp/manut-wrangler-whoami.log 2>&1; then
  echo "error: Cloudflare auth missing. Run: pnpm --filter @manut/edge exec wrangler login" >&2
  echo "       Or export CLOUDFLARE_API_TOKEN with Workers deploy permission." >&2
  exit 1
fi
echo "Cloudflare auth OK (details not printed)."

put_worker_secret() {
  local name="$1"
  local value="$2"
  local env_name="$3"
  if [[ -z "$value" ]]; then
    return 0
  fi
  printf '%s' "$value" | pnpm --filter @manut/edge exec wrangler secret put "$name" --env "$env_name" >/dev/null
  echo "Worker secret set: ${name} (--env ${env_name})"
}

if [[ -n "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" ]]; then
  for env_name in production preview; do
    put_worker_secret R2_ACCOUNT_ID "$ACCOUNT_ID" "$env_name"
    put_worker_secret R2_ACCESS_KEY_ID "$R2_ACCESS_KEY_ID" "$env_name"
    put_worker_secret R2_SECRET_ACCESS_KEY "$R2_SECRET_ACCESS_KEY" "$env_name"
  done
else
  echo "note: R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY unset — skipped Worker R2 S3 secrets."
  echo "      Create an R2 API token in the dashboard, export both, re-run this script."
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

for env_name in production preview staging; do
  ensure_env "$env_name"
  set_env_secret "$env_name" CLOUDFLARE_ACCOUNT_ID "$ACCOUNT_ID"
done

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "note: CLOUDFLARE_API_TOKEN unset — cannot set GitHub Actions deploy token."
  echo "      Create a Cloudflare API token (Workers Scripts Edit + Queues Edit"
  echo "      + Workers R2 Storage Edit + Account read),"
  echo "      export CLOUDFLARE_API_TOKEN, then re-run this script."
else
  for env_name in production preview staging; do
    set_env_secret "$env_name" CLOUDFLARE_API_TOKEN "$CLOUDFLARE_API_TOKEN"
  done
fi

set_env_var production EXPO_PUBLIC_API_URL "https://manu.xyz"
set_env_var preview EXPO_PUBLIC_API_URL "https://preview.manu.xyz"
set_env_var staging EXPO_PUBLIC_API_URL "https://manut-staging.bettergogocash.workers.dev"

echo
echo "Done (names only). Still human:"
echo "  - Workers Builds token: add Account → Queues → Edit (deploys self-provision"
echo "    queues/R2 via apps/edge/scripts/ensure-cloudflare-resources.mjs)"
echo "  - Cloudflare Access → set Worker vars AUTH_JWKS_URL / AUTH_ISSUER / AUTH_AUDIENCE"
echo "  - Hyperdrive bind + ENABLE_HYPERDRIVE_BOUNDARY=true when ready"
echo "  - R2 API token secrets if skipped above"
echo "  - Production GitHub Environment required reviewers"
echo "See docs/CICD_CLOUDFLARE.md"
