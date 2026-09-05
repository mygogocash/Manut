#!/usr/bin/env bash
# =============================================================================
# Long-line guard.
#
# On 2026-07-03 an obfuscated payload was appended to the LAST LINE of three
# config files (eslint.config.mjs, apps/api/eslint.config.mjs,
# apps/web/postcss.config.mjs), behind a long run of spaces so it was invisible
# in an editor and in review. It sat on dev and main for seven weeks, executing
# on every `pnpm lint` and every `next build` — including the builds that
# produce the production image.
#
# Line length is the structural tell, and it is cheap to check. Signature
# matching is not attempted: the next payload will not share a variable name,
# but it will still be one very long line, because that is what hiding
# generated code on an existing line looks like.
#
# Thresholds are set from measured maxima, not guessed:
#
#   config files   legitimate max 115 chars (packages/database/prisma.config.ts)
#                  -> limit 300   (2.6x headroom)
#   js/ts source   legitimate max 946 chars (packages/database/prisma/seed.ts,
#                  then 656 in ai-prompts.ts)
#                  -> limit 1200  (1.3x headroom)
#
# The infected files were 8181-8201 chars, so either limit catches that by two
# orders of magnitude — the headroom is for legitimate growth, not for payloads.
#
# Raising a limit is a deliberate, reviewable act. If a real file needs a longer
# line, change the number here in a PR and say why.
#
# Run locally with:  pnpm check:lines
# =============================================================================
set -euo pipefail

CONFIG_LIMIT=300
SOURCE_LIMIT=1200

failed=0

report() {
  local file="$1" limit="$2"
  awk -v F="$file" -v L="$limit" '
    length($0) > L {
      printf "  %s:%d  %d chars (limit %d)\n", F, NR, length($0), L
      found = 1
    }
    END { exit(found ? 1 : 0) }
  ' "$file" || failed=1
}

# --- Tier 1: files that tooling EXECUTES. These should always be short. ------
config_files=$(git ls-files \
  | grep -E '(^|/)[a-z0-9.-]*\.config\.(mjs|cjs|js|ts)$|(^|/)(postcss|tailwind|next|vitest|jest)\.config\.' \
  || true)

# --- Tier 2: application source. Generated output and type declarations are
#     excluded — the Prisma client is machine-written and legitimately dense.
source_files=$(git ls-files 'apps' 'packages' \
  | grep -E '\.(mjs|cjs|js|ts|tsx)$' \
  | grep -vE 'generated|\.d\.ts$' \
  || true)

# Normalise to a space-delimited set so the tier-2 dedup below can match.
# `git ls-files` emits newlines; a case-glob on " $f " never matches those.
config_set=" $(echo $config_files) "

echo "Checking config files (limit ${CONFIG_LIMIT})..."
for f in $config_files; do
  [ -f "$f" ] || continue
  report "$f" "$CONFIG_LIMIT"
done

echo "Checking application source (limit ${SOURCE_LIMIT})..."
for f in $source_files; do
  [ -f "$f" ] || continue
  # Config files already checked at the stricter limit; don't report twice.
  case "$config_set" in *" $f "*) continue ;; esac
  report "$f" "$SOURCE_LIMIT"
done

if [ "$failed" = "1" ]; then
  echo ""
  echo "::error::Over-long line(s) found. A very long line in a config or source file is how the 2026-07-03 payload hid — verify the content is legitimate before raising a limit in scripts/check-line-length.sh."
  exit 1
fi

echo "No over-long lines found."
