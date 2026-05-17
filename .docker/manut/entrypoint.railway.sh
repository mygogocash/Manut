#!/bin/sh
# Manut entrypoint shim — Railway + legacy-VM compatible.
#
# Seeds three things from env vars before launching the app, and is a
# no-op when those env vars are unset (so the legacy GCE/compose deploy
# keeps working with no behavior change).
#
#   GCP_SA_KEY_B64         -> /tmp/gcp-sa.json (Vertex AI auth via
#                             GOOGLE_APPLICATION_CREDENTIALS)
#   AFFINE_CONFIG_JSON_B64 -> /root/.affine/config/config.json
#                             (Vertex provider project/location +
#                             storage config — these keys have NO
#                             env-var override in the config loader,
#                             see packages/backend/server/src/plugins/
#                             copilot/config.ts).
#   PORT (Railway-injected) -> bridged to AFFINE_SERVER_PORT so the
#                              Node process listens where Railway's
#                              router expects.
#
# Why base64: Railway's env-var UI doesn't handle newlines well, and
# both payloads (SA private key, JSON config) contain newlines.
#
# Why this isn't in the Dockerfile CMD: the existing GCE deploy uses
# the image's CMD directly and never sets these env vars. By making
# this script a pass-through (exec "$@") with all env-driven behavior
# guarded by [ -n ... ] checks, the same image runs unchanged on the
# VM and on Railway.

set -eu

# 1. Vertex AI service-account credentials (Railway only — the VM uses
#    Application Default Credentials from its attached SA, no key file).
if [ -n "${GCP_SA_KEY_B64:-}" ]; then
  SA_KEY_PATH="/tmp/gcp-sa.json"
  echo "$GCP_SA_KEY_B64" | base64 -d > "$SA_KEY_PATH"
  chmod 600 "$SA_KEY_PATH"
  export GOOGLE_APPLICATION_CREDENTIALS="$SA_KEY_PATH"
  echo "[entrypoint] Seeded SA key at $SA_KEY_PATH"
fi

# 2. AFFiNE config.json. The Vertex provider config (project/location)
#    has no env-var override per the config loader — it can ONLY come
#    from config.json. We write to ~/.affine/config/config.json which
#    is one of the two paths AFFiNE's config loader checks (the other
#    is <projectRoot>/config.json).
if [ -n "${AFFINE_CONFIG_JSON_B64:-}" ]; then
  CONFIG_DIR="/root/.affine/config"
  mkdir -p "$CONFIG_DIR"
  echo "$AFFINE_CONFIG_JSON_B64" | base64 -d > "$CONFIG_DIR/config.json"
  echo "[entrypoint] Seeded config.json at $CONFIG_DIR/config.json"
fi

# 3. Bridge Railway's PORT to AFFiNE's expected variable. Railway routes
#    traffic to whatever port it injects via $PORT (random per service);
#    AFFiNE listens on AFFINE_SERVER_PORT (default 3010). If we don't
#    bridge, Railway's healthcheck times out and the service never
#    promotes.
if [ -n "${PORT:-}" ]; then
  export AFFINE_SERVER_PORT="$PORT"
  echo "[entrypoint] Bridged PORT=$PORT to AFFINE_SERVER_PORT"
fi

# 4. Run DB migrations on Railway when preDeploy did not run or failed.
#    Idempotent; skipped on the legacy GCE deploy (PORT unset).
if [ -n "${PORT:-}" ] && [ -n "${DATABASE_URL:-}" ]; then
  PRISMA_BIN="./node_modules/.bin/prisma"
  if [ -x "$PRISMA_BIN" ] && [ -f "./schema.prisma" ]; then
    echo "[entrypoint] Running prisma migrate deploy..."
    "$PRISMA_BIN" migrate deploy --schema=./schema.prisma
  else
    echo "[entrypoint] WARN: prisma or schema.prisma missing; skipping migrate"
  fi
fi

exec "$@"
