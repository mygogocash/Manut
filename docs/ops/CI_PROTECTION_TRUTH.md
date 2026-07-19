# CI / branch-protection truth (P0-E3)

Evidence snapshot for `mygogocash/Manut`. **Documentation only** — this
document does not change GitHub settings. Every claim below was verified with
`gh` on **2026-07-19** (UTC). Re-run the commands before acting; do not treat a
green local gate as remote protection.

## Verified facts

| Fact | Value | Evidence |
| ---- | ----- | -------- |
| Visibility | **Public** (`private: false`) | `gh api repos/mygogocash/Manut` → `visibility=public` |
| Fork network | Detached (`fork: false`) | Same API response |
| Org plan | **GitHub Free** | `gh api orgs/mygogocash` → `plan.name=free` |
| Classic branch protection on `main` | **None** | `GET …/branches/main/protection` → HTTP **404** `Branch not protected` |
| Repository rulesets | **None** | `GET …/rulesets` → `[]` |
| CodeQL workflow | GitHub-managed code scanning (not a repo YAML file) | `actions/workflows` → path `dynamic/github-code-scanning/codeql`, `state=active` |
| CodeQL `Analyze (javascript-typescript)` | Passes on `main` | Run [`29668738507`](https://github.com/mygogocash/Manut/actions/runs/29668738507) |
| CodeQL `Analyze (ruby)` | **Fails** on `main` and recent PRs | Same run; job [`88143809169`](https://github.com/mygogocash/Manut/actions/runs/29668738507/job/88143809169) |
| Ruby sources in tree | **None** | `find` → `0` `*.rb`; no `Gemfile` |
| Default-setup API | `state=not-configured` (languages list omits Ruby) | `GET …/code-scanning/default-setup` — **does not mean** Ruby analysis stopped; managed CodeQL still schedules `Analyze (ruby)` |

### CodeQL Ruby failure (verbatim annotation)

From check-run annotations on job `88143809169` (commit `8de9f889d3`):

> CodeQL detected code written in JavaScript/TypeScript and GitHub Actions, but
> not any written in Ruby. Confirm that there is some source code for Ruby in
> the project.

This is **not fixable in application code**. It requires a Code scanning
language-list change (drop Ruby).

## Red-merge risk (proven)

`main` has **no** required checks and **no** rulesets. Pull requests that fail
`Validate` and CodeQL Ruby have already merged:

| PR | Merged (UTC) | Failed checks at merge (non-exhaustive) |
| -- | ------------ | --------------------------------------- |
| [#219](https://github.com/mygogocash/Manut/pull/219) | 2026-07-19T01:32:14Z | `Analyze (ruby)`, Dependency review, Static and unit, Authenticated E2E, **Validate** |
| [#218](https://github.com/mygogocash/Manut/pull/218) | 2026-07-19T01:21:13Z | Same pattern |
| [#217](https://github.com/mygogocash/Manut/pull/217) | 2026-07-18T23:39:52Z | Same pattern |

Implication: CI noise on CodeQL Ruby and empty E2E secrets does **not** block
`main`. Production Workers Builds can still fire from a red merge.

## Plan vs protection capability

GitHub Free org reality for this repo **as observed**:

| Goal | Public Free (current) | Private Free |
| ---- | --------------------- | ------------ |
| Classic branch protection / rulesets | Available in product terms; **currently not configured** (404 / empty) | Historically returns **403** on this org — needs Pro / Team |
| Require `Validate` on `main` | Possible once protection/rulesets are set | Blocked until plan upgrade **or** repo stays public |
| Prefer private + required checks | — | Upgrade `mygogocash` to Pro (or Team), then private + protect |

Older handoff text that said the repo is private and protection is “403-blocked”
is **stale**. Current truth: **public + unprotected + Free**.

## Ops checklist (actionable — not done by this PR)

Do these in the GitHub UI / org billing. Check a box only after a follow-up
`gh` proof command succeeds.

### A. Stop CodeQL Ruby failures

- [ ] Repo → **Settings → Code security → Code scanning** (default or advanced
      setup that drives `dynamic/github-code-scanning/codeql`).
- [ ] Remove **Ruby** from analyzed languages. Keep
      `javascript-typescript` (and Actions if desired). Do not invent a repo
      workflow bypass that disables scanning.
- [ ] Proof: next push/PR CodeQL run has no `Analyze (ruby)` job, or Ruby job
      is absent; `Analyze (javascript-typescript)` stays green.
      Example: `gh run list --repo mygogocash/Manut --workflow=codeql --limit 3`.

### B. Choose privacy posture, then protect `main`

Pick one path; do not claim both without evidence.

**Path B1 — stay public (fastest protection on Free)**

- [ ] Confirm intentional public visibility (intranet source exposure risk is
      accepted by owners, or follow with B2 later).
- [ ] Enable classic branch protection **or** a ruleset on `main`:
  - Require a pull request before merging
  - Require at least one approval
  - Require conversation resolution
  - Require status check **`Validate`** (strict)
  - Block force-pushes and branch deletion
- [ ] Proof: `gh api repos/mygogocash/Manut/branches/main/protection` is **not**
      404, **or** `gh api repos/mygogocash/Manut/rulesets` is non-empty with
      `main` targeting rules that require `Validate`.

**Path B2 — private + Pro (preferred long-term for intranet)**

- [ ] Upgrade `mygogocash` org to GitHub Pro or Team.
      Proof: `gh api orgs/mygogocash --jq .plan.name` ≠ `free`.
- [ ] Set repository private.
      Proof: `gh api repos/mygogocash/Manut --jq .private` → `true`.
- [ ] Apply the same protection / ruleset requirements as B1.
      Proof: protection or rulesets as above (not 403 / not 404).

### C. Stop merging red PRs (process + settings)

- [ ] After A + B: confirm a PR with failing `Validate` cannot merge (merge
      button blocked for non-admins, or admin bypass disabled if policy
      requires).
- [ ] Keep Authenticated E2E fail-closed until five `E2E_*` secrets + dedicated
      project exist (separate ops track — do not soft-skip).
- [ ] Do not disable OSV / dependency-review to greenwash merges.

## Re-verify commands

```bash
gh api repos/mygogocash/Manut --jq '{private,visibility,fork}'
gh api orgs/mygogocash --jq '.plan.name'
gh api repos/mygogocash/Manut/branches/main/protection
gh api repos/mygogocash/Manut/rulesets
gh api repos/mygogocash/Manut/actions/workflows --jq '.workflows[]|{name,path,state}'
gh run list --repo mygogocash/Manut --limit 10
gh pr view <N> --repo mygogocash/Manut --json mergedAt,state,statusCheckRollup
```

## What this PR does / does not do

| Does | Does not |
| ---- | -------- |
| Record evidence and an ops checklist | Change org plan, visibility, CodeQL languages, or branch protection |
| Correct stale “private + 403” narrative against current `gh` truth | Claim red merges are blocked |
| Point owners at UI + proof commands | Weaken CI gates in workflow YAML |
