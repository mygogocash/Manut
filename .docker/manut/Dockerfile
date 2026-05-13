# Custom AFFiNE image for GoGoCash.
#
# Strategy: keep upstream's backend (which needs a Rust toolchain to build) and
# only swap in our locally-built frontend bundle, which contains the Calendar
# view and any other client-side fork changes.
#
# This avoids the entire Rust build on the developer machine.
#
# Build context expects:
#   packages/frontend/apps/web/dist/
#   packages/frontend/admin/dist/  (optional, will skip if missing)

ARG UPSTREAM_TAG=stable
FROM ghcr.io/toeverything/affine:${UPSTREAM_TAG}

# Replace the web bundle. AFFiNE serves /static via the express app (see
# .github/deployment/node/Dockerfile in upstream for layout).
COPY packages/frontend/apps/web/dist /app/static

# Replace admin if it was rebuilt; otherwise upstream copy stays.
# (Conditional COPY needs BuildKit + --chmod / --link tricks; simpler to always copy.
#  If the dir is missing during build, we'd fail — so we let the build script ensure it.)
COPY packages/frontend/admin/dist /app/static/admin

# Mobile is left as-is from upstream — we don't ship a mobile fork.
