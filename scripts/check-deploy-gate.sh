#!/usr/bin/env bash
#
# Guard the deploy gate that keeps staging and prod from shipping half a
# release.
#
# On 2026-08-26 staging served a NEW api against an OLD web for 22 minutes:
# every column of the Sales CRM board read 0, because the old bundle called
# seven endpoints the new api had removed. It took two independent failures:
#
#   1. A run for a superseded commit deployed anyway. `concurrency:
#      cancel-in-progress` did not stop it — that cancels runs already IN
#      PROGRESS, and both runs sat QUEUED for minutes, so the older commit
#      simply got a runner last and wrote the final revision.
#   2. That run deployed only ONE service, because the two deploy jobs were
#      gated independently on per-service path filters. The services share an
#      API contract, so one-of-two is skew, not a partial rollout.
#
# The fix is a single `deploy` output combining a freshness check with a
# both-or-neither rule. Reverting either half restores an outage that is
# invisible until somebody opens the board, so it is asserted here rather
# than left to the comment in the workflow.
#
# grep only — no install, no Node, like check-line-length.sh.

set -euo pipefail

WORKFLOWS=(
  ".github/workflows/deploy-staging.yml"
  ".github/workflows/deploy.yml"
)

fail=0

note() { printf '  %s\n' "$1"; }
bad() {
  printf '::error::%s\n' "$1"
  fail=1
}

for wf in "${WORKFLOWS[@]}"; do
  printf 'Checking %s...\n' "$wf"

  if [ ! -f "$wf" ]; then
    bad "$wf is missing."
    continue
  fi

  # 1. The gate step itself.
  if grep -q '^        id: gate$' "$wf"; then
    note "gate step present"
  else
    bad "$wf has no 'id: gate' step — the freshness/atomicity gate is gone."
  fi

  # 2. The freshness half. Without the tip comparison a superseded run
  #    deploys backwards, which is failure (1) above.
  if grep -q 'git ls-remote origin "refs/heads/\${BRANCH}"' "$wf"; then
    note "freshness check present"
  else
    bad "$wf no longer compares the commit against the branch tip."
  fi

  # 3. Both deploy jobs must gate on the SAME output. Two references: the api
  #    job and the web job.
  count=$(grep -c "needs.changes.outputs.deploy == 'true'" "$wf" || true)
  if [ "$count" -ge 2 ]; then
    note "both deploy jobs gate on outputs.deploy ($count refs)"
  else
    bad "$wf: expected >=2 'needs.changes.outputs.deploy' gates, found $count."
  fi

  # 4. The per-service gates must NOT come back. These are the exact strings
  #    that shipped the skew; the summary job still echoes outputs.api/web for
  #    reporting, which is why these patterns are anchored to `if:` context.
  if grep -q "if: needs.changes.outputs.api == 'true'" "$wf"; then
    bad "$wf: api deploy is gated on outputs.api again — that allows an api-only deploy (version skew)."
  fi
  if grep -q "^      needs.changes.outputs.web == 'true' &&$" "$wf"; then
    bad "$wf: web deploy is gated on outputs.web again — that allows a web-only deploy (version skew)."
  fi
done

if [ "$fail" -ne 0 ]; then
  printf '\n'
  printf 'Deploy gate check FAILED. See the "Deploy gate" step in the workflow\n'
  printf 'and scripts/check-deploy-gate.sh for why these rules exist.\n'
  exit 1
fi

printf '\nDeploy gate intact in all %s workflows.\n' "${#WORKFLOWS[@]}"
