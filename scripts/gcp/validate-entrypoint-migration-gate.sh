#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENTRYPOINT="$ROOT/.docker/manut/entrypoint.railway.sh"

test_name() {
  printf '\n%s\n' "$1"
}

make_fake_runtime() {
  local dir="$1"
  mkdir -p "$dir/node_modules/.bin"
  touch "$dir/schema.prisma"
  cat > "$dir/node_modules/.bin/prisma" <<'SCRIPT'
#!/usr/bin/env sh
echo "$*" > "$PRISMA_MARKER"
SCRIPT
  chmod +x "$dir/node_modules/.bin/prisma"
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
make_fake_runtime "$tmp"

test_name "entrypoint migration gate > given startup migration disabled > then prisma is not invoked"
disabled_marker="$tmp/disabled-marker"
(
  cd "$tmp"
  PRISMA_MARKER="$disabled_marker" \
  MANUT_RUN_STARTUP_MIGRATIONS=false \
  PORT=8080 \
  DATABASE_URL=postgresql://example \
  sh "$ENTRYPOINT" /usr/bin/true
)
if [ -e "$disabled_marker" ]; then
  echo "Expected prisma to be skipped, but marker exists at $disabled_marker" >&2
  exit 1
fi

test_name "entrypoint migration gate > given default Railway-compatible env > then prisma is invoked"
default_marker="$tmp/default-marker"
(
  cd "$tmp"
  PRISMA_MARKER="$default_marker" \
  PORT=8080 \
  DATABASE_URL=postgresql://example \
  sh "$ENTRYPOINT" /usr/bin/true
)
if [ ! -s "$default_marker" ]; then
  echo "Expected prisma to run, but marker is missing at $default_marker" >&2
  exit 1
fi
grep -q "migrate deploy --schema=./schema.prisma" "$default_marker"

echo
echo "entrypoint migration gate checks passed"
