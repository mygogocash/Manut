# Release process — `dev` → `main`

## The rule

**Release PRs (`dev` → `main`) and back-merges (`main` → `dev`) MUST use a merge
commit. Never squash.**

Feature PRs into `dev` should still be squashed — that is what squash is for.

## What actually gates a release into `main` (corrected 2026-08-27)

An earlier version of this section claimed `required_linear_history` prohibits
merge commits on `main`, and that this is why past releases were squashed. **That
was wrong**, or at least unproven — the correction matters because it changes what
has to be negotiated.

### The mechanics

`main` has **no classic branch protection** — `GET /repos/{r}/branches/main/protection`
returns **404**, which reads misleadingly as "unprotected". The rules live in an
**organization-level ruleset**, `Auth-users` (id `6687513`,
`enforcement: active`, `source_type: Organization`), covering `refs/heads/main`
plus `production`, `develop`, `preview` and `~DEFAULT_BRANCH`. Inspect it with:

```bash
gh api repos/The-Binary-Holdings/new-tbh-intranet/rules/branches/main
```

Its `pull_request` rule reads:

```json
{
  "allowed_merge_methods": ["squash", "rebase", "merge"],
  "required_approving_review_count": 0,
  "require_extra_approval_for_unattributed_changes": true,
  "dismiss_stale_reviews_on_push": true
}
```

Plus separate `required_signatures`, `required_linear_history`, and
deletion/creation/update/non-fast-forward rules.

### What was actually blocking

**`require_extra_approval_for_unattributed_changes: true`.** With
`required_approving_review_count: 0` and no review on the PR, a release PR
carrying an unattributed change is refused — and GitHub reports it with the
generic message *"the base branch policy prohibits the merge."*

The tell that it is **not** `required_linear_history`: on #1165, `--squash` drew
the **identical** message. A squash produces a single-parent commit, so linear
history cannot explain it. #1165 then merged by squash immediately once one
approving review existed, with nothing else changed.

`allowed_merge_methods` explicitly includes `merge`, so the ruleset does not
forbid the merge-commit method outright.

### What remains genuinely unknown

Whether `required_linear_history` **independently** rejects a two-parent merge
commit on `main` has **never been tested with an approval present** — every
merge-commit attempt so far was already being refused by the approval rule. The
two rules do look contradictory, and only an experiment settles it.

**So the next release should try this, in order:**

1. Get one approving review on the release PR.
2. Attempt `gh pr merge <n> --merge` (a real merge commit).
3. If it lands, **this document's rule is achievable** and squashing releases was
   never necessary — record that here.
4. If it is refused *with an approval present*, that is the proof that
   `required_linear_history` is the obstacle, and the ruleset needs amending
   (org-wide change, needs an owner) or this document needs to accept squashes.

### Meanwhile

Releases are being squashed, which compounds divergence exactly as described
below. Two mitigations that are available today and cost nothing:

- **Back-merge `main` → `dev` with a real merge commit.** The ruleset does **not**
  cover `dev`, so a two-parent commit is allowed there. This restores the
  ancestry a squashed release destroys, and it is where conflict resolutions
  should be recorded. Done at `6fe3629f`.
- The ruleset grants `bypass_mode: always` to `OrganizationAdmin` and the **Admin
  Team** (`10374765`), so `--admin --merge` can force a merge commit. It fixes one
  PR and leaves the question open, so it is not a substitute for the experiment
  above.

## Why this is not a style preference

A squash merge creates ONE NEW commit on the target with **no ancestral link** to
the source branch's commits. For a feature branch that is fine: the branch dies
immediately after.

For two long-lived branches it is corrosive. After a squashed release, `main`
holds dev's *content* but shares none of dev's *history*. Git still believes the
branches diverged at the last true merge, so the next release PR re-proposes
every dev commit since then against every main commit since then. The conflict
count only grows.

That is exactly what happened here:

| | |
| --- | --- |
| Last true merge (`merge-base`) | 2026-07-02 |
| Commits on `main` not on `dev` | 30 |
| Commits on `dev` not on `main` | 139 |
| Result | #991 (`dev`→`main`) and #986 (`main`→`dev`) both closed unmerged, 463 conflicting files |

While the two branches could not be merged, production ran without any of the
Fixed Asset work, and `dev` sat on a missing `sanitize-html` security patch
(GHSA-vccv-cmxp-4j9h) for ten days.

## Releasing

```bash
git checkout main && git pull
git merge --no-ff origin/dev          # merge commit, NOT squash
git push origin main
```

Or via a PR with **"Create a merge commit"** selected — not "Squash and merge".

## After any hotfix committed directly on `main`

Back-merge the same day:

```bash
git checkout dev && git pull
git merge --no-ff origin/main
git push origin dev
```

A hotfix cherry-picked to `dev` instead of merged leaves the branches diverged
again. Cherry-pick copies content; it does not restore ancestry.

## The trap that hides a broken merge

`git merge -X ours` resolves **textual** conflicts in favour of the current
branch, but it still merges every non-overlapping hunk. That can splice one
branch's call sites onto the other branch's function signatures and report
"0 conflicts" while the build is broken. Observed here: a controller calling a
service with the wrong arity, and a component referencing an export that did not
exist.

`-X ours` is not a safe way to reconcile diverged branches. Reconcile the content
deliberately (port what is missing, confirm what is superseded), then use
`-s ours` — which takes the other branch's *history* without any of its tree — to
restore the relationship.

## Checking for drift

```bash
git fetch origin main dev
git rev-list --count origin/dev..origin/main   # commits main has that dev lacks
comm -23 <(git ls-tree -r --name-only origin/main | sort) \
         <(git ls-tree -r --name-only origin/dev  | sort)   # files only on main
```

Run this after every prod hotfix. Automating it as a scheduled workflow is a
worthwhile follow-up; it does not exist yet.

**Comparing PR numbers does not work.** Work promoted `dev` → `main` carries the
main-side PR number, so `dev` holds the same code under a different number.
Always compare content.

## Environments

| Branch | Deploys to | Schema sync |
| --- | --- | --- |
| `dev` | staging | `pnpm db:push` — **data-migration SQL never runs** |
| `main` | production | `prisma migrate deploy` |

Because staging never executes a migration's data SQL, anything depending on a
backfill stays empty there until seeded by hand.

A migration applied on prod but **absent from the repo** — the situation the
certificate soft-delete was heading for — **fails the next `prisma migrate
deploy`**. That is a blocked production deploy, not cosmetic drift.
