#!/usr/bin/env bash
# Phase 0 local validation for the Railway migration.
#
# Spins up a Postgres + Redis + Manut server triad on a local Docker
# network using the SAME image Railway will pull, and exercises the
# Vertex AI auth path from off-GCP. If this script passes, Railway
# will work — both rely on identical env-var seeding via the entrypoint
# shim at .docker/manut/entrypoint.railway.sh.
#
# Prerequisites:
#   1. Docker Desktop running on this machine.
#   2. `gcloud` authenticated (`gcloud auth login`) and configured to
#      pull from GAR (`gcloud auth configure-docker
#      asia-southeast1-docker.pkg.dev`).
#   3. A service-account JSON key at ~/manut-railway-sa.json (or path
#      passed as arg $1). Key must have roles/artifactregistry.reader +
#      roles/aiplatform.user on affine-495114. See the previous turn for
#      the gcloud commands that create it.
#
# Usage:
#   ./scripts/manut-railway-phase0-validate.sh [/path/to/sa-key.json]
#   IMAGE_TAG=main-abc123def-12345 ./scripts/manut-railway-phase0-validate.sh
#
# What you should see:
#   [phase0] Seeded SA key at /tmp/gcp-sa.json (from entrypoint shim)
#   [phase0] Seeded config.json at /root/.affine/config/config.json
#   [phase0] Bridged PORT=3010 to AFFINE_SERVER_PORT
#   ... Nest application successfully started
#   ... Listening on http://0.0.0.0:3010
#
# Then in another terminal:
#   curl http://localhost:3010/info
#   # Expect: {"version":"0.26.x","flavor":"selfhosted","compatibility":...}
#
# Verifying Vertex auth (the actual point of this test):
#   Open http://localhost:3010 in a browser, sign in, send a chat to
#   the AI assistant. If you get a real Gemini response, Vertex auth
#   from off-GCP works.
#
# Exit codes:
#   0 — server reached "Listening on" line within timeout
#   1 — Docker not running, missing tools, or SA key not found
#   2 — image pull failed (check gcloud auth)
#   3 — Postgres/Redis startup failed
#   4 — Migration step failed
#   5 — Server did not reach Listening state within boot timeout

set -euo pipefail

# The Manut image is built linux/amd64-only (see .github/workflows/manut-build.yml
# `platforms: linux/amd64`). On Apple Silicon Macs, Docker Desktop runs it under
# Rosetta emulation — slower than native but functional. Without this, `docker pull`
# fails with `no matching manifest for linux/arm64/v8`. Production (GCE, Railway)
# is amd64 so this only affects local validation on M-series Macs.
export DOCKER_DEFAULT_PLATFORM=linux/amd64

# -----------------------------------------------------------------------------
# Inputs
# -----------------------------------------------------------------------------

SA_KEY_PATH="${1:-${HOME}/manut-railway-sa.json}"
GAR_REPO="asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash"
GCP_PROJECT="affine-495114"

# Container + network names — prefixed so we don't collide with other dev work.
NET_NAME="manut-phase0"
PG_NAME="manut-phase0-pg"
REDIS_NAME="manut-phase0-redis"
MIGRATE_NAME="manut-phase0-migrate"
APP_NAME="manut-phase0-app"

# Boot timeout for the main server (Nest + Prisma client load + native binary
# init can take ~30-45s cold; the migration step is in its own container so
# this only covers the app boot).
BOOT_TIMEOUT_SECONDS=90

# -----------------------------------------------------------------------------
# Tool + input checks
# -----------------------------------------------------------------------------

for tool in docker openssl base64 curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "ERROR: required tool '$tool' is not installed."
    exit 1
  fi
done

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker is not running. Start Docker Desktop and retry."
  exit 1
fi

if [ ! -f "$SA_KEY_PATH" ]; then
  echo "ERROR: SA key not found at: $SA_KEY_PATH"
  echo ""
  echo "If you haven't created one yet, run (one-time, R1):"
  echo "  gcloud iam service-accounts create manut-railway \\"
  echo "    --project=${GCP_PROJECT} \\"
  echo "    --display-name='Manut Railway runtime'"
  echo "  gcloud projects add-iam-policy-binding ${GCP_PROJECT} \\"
  echo "    --member='serviceAccount:manut-railway@${GCP_PROJECT}.iam.gserviceaccount.com' \\"
  echo "    --role='roles/artifactregistry.reader'"
  echo "  gcloud projects add-iam-policy-binding ${GCP_PROJECT} \\"
  echo "    --member='serviceAccount:manut-railway@${GCP_PROJECT}.iam.gserviceaccount.com' \\"
  echo "    --role='roles/aiplatform.user'"
  echo "  gcloud iam service-accounts keys create ${SA_KEY_PATH} \\"
  echo "    --iam-account=manut-railway@${GCP_PROJECT}.iam.gserviceaccount.com"
  exit 1
fi

# Restrictive permission check on the SA key — fail loud if it's world-readable.
KEY_MODE=$(stat -f '%Mp%Lp' "$SA_KEY_PATH" 2>/dev/null || stat -c '%a' "$SA_KEY_PATH" 2>/dev/null || echo "")
case "$KEY_MODE" in
  600|400|0600|0400|"") ;;  # acceptable or unknown (skip warn)
  *) echo "WARN: SA key at $SA_KEY_PATH is mode $KEY_MODE (recommend chmod 600)" ;;
esac

# -----------------------------------------------------------------------------
# Resolve image tag
# -----------------------------------------------------------------------------

if [ -n "${IMAGE_TAG:-}" ]; then
  echo "Using IMAGE_TAG from env: $IMAGE_TAG"
else
  echo "Auto-detecting latest image tag from GAR..."
  IMAGE_TAG=$(gcloud artifacts docker images list "$GAR_REPO" \
    --include-tags --sort-by="~UPDATE_TIME" --limit=1 \
    --format="value(tags)" 2>/dev/null | head -1 || true)

  if [ -z "$IMAGE_TAG" ]; then
    echo "ERROR: Could not auto-detect image tag."
    echo "Pass it manually:"
    echo "  IMAGE_TAG=main-abc123def-12345 $0"
    exit 2
  fi
  echo "Auto-detected: $IMAGE_TAG"
fi

FULL_IMAGE="${GAR_REPO}:${IMAGE_TAG}"

# -----------------------------------------------------------------------------
# Generate ephemeral secrets in a tmpfs-style scratch dir
# -----------------------------------------------------------------------------

WORKDIR=$(mktemp -d)
echo "Scratch dir: $WORKDIR"

# Portable base64-encode-without-newlines helper.
b64() {
  if base64 --help 2>&1 | grep -q -- '-w'; then
    # GNU coreutils (Linux)
    base64 -w0 < "$1"
  else
    # BSD (macOS) — no -w flag, but doesn't wrap by default for stdin;
    # explicit tr is belt-and-suspenders.
    base64 < "$1" | tr -d '\n'
  fi
}

# 1. AFFINE_PRIVATE_KEY — RSA-2048 PEM, used for JWT signing.
openssl genrsa -out "$WORKDIR/private.pem" 2048 2>/dev/null
AFFINE_PRIVATE_KEY=$(cat "$WORKDIR/private.pem")

# 2. GCP_SA_KEY_B64 — base64 of the SA JSON.
GCP_SA_KEY_B64=$(b64 "$SA_KEY_PATH")

# 3. AFFINE_CONFIG_JSON_B64 — minimal Vertex provider config. The
#    `googleAuthOptions.credentials` block is intentionally absent;
#    the entrypoint shim sets GOOGLE_APPLICATION_CREDENTIALS so the
#    google-auth-library falls back to that key file.
cat > "$WORKDIR/affine-config.json" <<EOF
{
  "copilot": {
    "enabled": true,
    "providers": {
      "geminiVertex": { "project": "${GCP_PROJECT}", "location": "us-central1" },
      "anthropicVertex": { "project": "${GCP_PROJECT}", "location": "us-east5" },
      "llamaVertex": { "project": "${GCP_PROJECT}", "location": "us-central1" },
      "mistralVertex": { "project": "${GCP_PROJECT}", "location": "us-central1" },
      "deepseekVertex": { "project": "${GCP_PROJECT}", "location": "us-central1" }
    }
  }
}
EOF
AFFINE_CONFIG_JSON_B64=$(b64 "$WORKDIR/affine-config.json")

# -----------------------------------------------------------------------------
# Cleanup trap — runs on success, failure, and SIGINT alike
# -----------------------------------------------------------------------------

cleanup() {
  echo ""
  echo "Cleaning up..."
  docker stop "$APP_NAME" "$PG_NAME" "$REDIS_NAME" 2>/dev/null || true
  docker rm -f "$APP_NAME" "$PG_NAME" "$REDIS_NAME" "$MIGRATE_NAME" 2>/dev/null || true
  docker network rm "$NET_NAME" 2>/dev/null || true
  rm -rf "$WORKDIR"
  echo "Done."
}
trap cleanup EXIT INT TERM

# -----------------------------------------------------------------------------
# Pull image (early — fails fast if auth or tag is wrong)
# -----------------------------------------------------------------------------

echo ""
echo "Pulling image: $FULL_IMAGE"
if ! docker pull "$FULL_IMAGE"; then
  echo "ERROR: docker pull failed. Likely causes:"
  echo "  - gcloud not authenticated:        gcloud auth login"
  echo "  - Docker not configured for GAR:   gcloud auth configure-docker asia-southeast1-docker.pkg.dev"
  echo "  - Wrong tag:                       check GAR for valid tags"
  exit 2
fi

# -----------------------------------------------------------------------------
# Start Postgres + Redis on a shared network
# -----------------------------------------------------------------------------

echo ""
echo "Starting Postgres + Redis on docker network '$NET_NAME'..."
docker network create "$NET_NAME" 2>/dev/null || true

# pgvector/pgvector:pg16 is what production uses (matches .docker/selfhost/compose.yml).
# AFFiNE's embeddings feature needs the pgvector extension.
docker run -d --rm \
  --name "$PG_NAME" \
  --network "$NET_NAME" \
  -e POSTGRES_USER=affine \
  -e POSTGRES_PASSWORD=affine \
  -e POSTGRES_DB=affine \
  pgvector/pgvector:pg16 >/dev/null

docker run -d --rm \
  --name "$REDIS_NAME" \
  --network "$NET_NAME" \
  redis:7-alpine >/dev/null

# Wait for Postgres to be ready (max 30s).
echo "Waiting for Postgres to accept connections..."
for i in $(seq 1 30); do
  if docker exec "$PG_NAME" pg_isready -U affine -d affine >/dev/null 2>&1; then
    echo "Postgres ready."
    break
  fi
  if [ "$i" = "30" ]; then
    echo "ERROR: Postgres did not start within 30s."
    docker logs "$PG_NAME" | tail -20
    exit 3
  fi
  sleep 1
done

# -----------------------------------------------------------------------------
# Run migrations (one-shot container, must complete before server starts)
# -----------------------------------------------------------------------------

echo ""
echo "Running migrations + data seed (predeploy)..."
# The image's predeploy is `node ./scripts/self-host-predeploy.js`, matching
# .docker/selfhost/compose.yml. We override the entrypoint to skip the shim
# (it would re-decode the SA key uselessly for a one-shot migration that
# doesn't talk to Vertex), and run the script directly.
if ! docker run --rm \
  --name "$MIGRATE_NAME" \
  --network "$NET_NAME" \
  -e DATABASE_URL="postgresql://affine:affine@${PG_NAME}:5432/affine" \
  -e REDIS_SERVER_HOST="$REDIS_NAME" \
  -e REDIS_SERVER_PORT=6379 \
  -e NODE_ENV=production \
  -e DEPLOYMENT_TYPE=selfhosted \
  -e AFFINE_INDEXER_ENABLED=false \
  "$FULL_IMAGE" \
  node ./scripts/self-host-predeploy.js; then
  echo "ERROR: Migration step failed. See logs above."
  exit 4
fi
echo "Migrations complete."

# -----------------------------------------------------------------------------
# Boot the server (the actual Phase 0 test)
# -----------------------------------------------------------------------------

echo ""
echo "Booting Manut server with Railway-shaped env vars..."
echo "Streaming logs — watch for 'Listening on http://0.0.0.0:3010'."
echo ""

# Background the app container so we can probe it; tail logs in foreground.
docker run -d \
  --name "$APP_NAME" \
  --network "$NET_NAME" \
  -p 3010:3010 \
  -e GCP_SA_KEY_B64="$GCP_SA_KEY_B64" \
  -e AFFINE_CONFIG_JSON_B64="$AFFINE_CONFIG_JSON_B64" \
  -e AFFINE_PRIVATE_KEY="$AFFINE_PRIVATE_KEY" \
  -e DATABASE_URL="postgresql://affine:affine@${PG_NAME}:5432/affine" \
  -e REDIS_SERVER_HOST="$REDIS_NAME" \
  -e REDIS_SERVER_PORT=6379 \
  -e NODE_ENV=production \
  -e DEPLOYMENT_TYPE=selfhosted \
  -e AFFINE_SERVER_EXTERNAL_URL=http://localhost:3010 \
  -e AFFINE_SERVER_HTTPS=false \
  -e AFFINE_INDEXER_ENABLED=false \
  -e ENABLE_MANUT_MODULE=true \
  -e PORT=3010 \
  "$FULL_IMAGE" >/dev/null

# Wait for "Listening on" line. We poll with HTTP rather than parsing logs
# because the latter is brittle to log-format changes.
echo "Waiting up to ${BOOT_TIMEOUT_SECONDS}s for /info to return 200..."
BOOTED=0
for i in $(seq 1 "$BOOT_TIMEOUT_SECONDS"); do
  if curl --silent --fail --max-time 2 http://localhost:3010/info >/dev/null 2>&1; then
    BOOTED=1
    break
  fi
  sleep 1
  # Every 10s, surface the latest log line so you can see progress.
  if [ $((i % 10)) -eq 0 ]; then
    echo "  ...still booting (${i}s elapsed). Latest log:"
    docker logs --tail 1 "$APP_NAME" 2>&1 | sed 's/^/    /'
  fi
done

if [ "$BOOTED" -ne 1 ]; then
  echo ""
  echo "ERROR: Server did not respond on /info within ${BOOT_TIMEOUT_SECONDS}s."
  echo "Last 60 lines of server logs:"
  echo "-----"
  docker logs --tail 60 "$APP_NAME"
  echo "-----"
  exit 5
fi

# -----------------------------------------------------------------------------
# Success — print verification probes + leave it running for manual testing
# -----------------------------------------------------------------------------

echo ""
echo "================================================================"
echo "Server is UP. Probes:"
echo ""
echo "  /info:"
curl --silent http://localhost:3010/info | sed 's/^/    /'
echo ""
echo "================================================================"
echo "Vertex auth verification (do this manually):"
echo "  1. Open http://localhost:3010 in a browser"
echo "  2. Sign in (create an admin user via the seed flow if first run)"
echo "  3. Open the AI sidebar, send a chat message"
echo "  4. If you get a Gemini response → Vertex auth from off-GCP WORKS"
echo ""
echo "If chat returns 500 or 'RESOURCE_PROJECT_INVALID', check logs:"
echo "  docker logs $APP_NAME | grep -iE 'vertex|google|auth'"
echo ""
echo "================================================================"
echo "Press Ctrl+C to stop + clean up (network, containers, scratch dir)."
echo "================================================================"
docker logs -f "$APP_NAME"
