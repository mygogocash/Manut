# Release process — `main` / `preview` / `production`

GitHub: [`mygogocash/Manut`](https://github.com/mygogocash/Manut).

| Branch | Role | Deploy |
| --- | --- | --- |
| `main` | Default trunk. Feature PRs land here. | None (CI only) |
| `preview` | Staging | Cloud Run staging + edge staging. Schema: `pnpm db:push` |
| `production` | Prod | Cloud Run + Vercel. Schema: `prisma migrate deploy` |

## The rule

**Promotes between long-lived env branches MUST use a merge commit. Never
squash.**

Feature PRs into `main` should still be squashed — that is what squash is for.

Squashing one long-lived branch into another discards ancestry. The next
promote then re-proposes every commit since the last true merge and the
conflicts grow forever. That is what stranded the old `dev`/`main` pair
(#991 / #986, 463 conflicting files).

After a hotfix committed directly on `production`, back-merge `production` →
`main` the same day. Cherry-picking copies content; it does not restore
ancestry.

## How to promote

```bash
# Staging
git checkout preview && git pull
git merge --no-ff origin/main
git push origin preview

# Production (starts Cloud Run + Vercel)
git checkout production && git pull
git merge --no-ff origin/main
git push origin production
```

Or open a PR with **"Create a merge commit"** selected — not "Squash and merge".

## After a hotfix on `production`

```bash
git checkout main && git pull
git merge --no-ff origin/production
git push origin main
```

Then promote `main` → `preview` the same way if staging should match.

## Protection on this repo

`main` uses classic GitHub branch protection:

- 1 approving review
- required status check named `Validate`
- conversation resolution required
- `enforce_admins: true`

This tree's workflow is named **PR Checks**, not `Validate`. A required
`Validate` check that never reports will block merges until protection is
adjusted or a job is renamed.

`preview` and `production` are not the default branch. Treat them as
deploy targets, not feature branches.

## Staging vs production schema

| Branch | Schema sync |
| --- | --- |
| `preview` | `pnpm db:push` — **data-migration SQL never runs** |
| `production` | `prisma migrate deploy` |

A backfill that lives only inside a migration file will be empty on
staging until you run a `packages/database/scripts/*.mjs` script through
`db-backfill.yml`.

## Checking for drift

```bash
git fetch origin main preview production
git rev-list --count origin/main..origin/production   # commits production lacks
git rev-list --count origin/main..origin/preview      # commits preview lacks
```

Comparing PR numbers does not work. Always compare content.

## Historical note

Older docs and the previous TBH remote used `dev` → `main` as the release
line. That pairing is gone here. Do not recreate `dev` or `canary`.
