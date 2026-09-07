# Release process — `main` / `preview` / `production`

GitHub: [`mygogocash/Manut`](https://github.com/mygogocash/Manut).

CI runs on **Depot CI** (`.depot/workflows/`), not GitHub Actions — the repo's
GitHub Actions is disabled. Depot's GitHub App reports the same check names to
GitHub, so branch protection keeps working. Deploys go to **Cloudflare
Workers** only; the Cloud Run and Vercel pipelines were retired 2026-09
(deleted: `deploy.yml`, `deploy-staging.yml`, `deploy-vercel.yml`,
`cloudbuild.yaml`, `docker/`, Vercel configs).

| Branch | Role | Deploy |
| --- | --- | --- |
| `main` | Default trunk. Feature PRs land here. | None (CI only) |
| `preview` | Staging | Edge + edge-jobs → `staging.manut.xyz`. Drizzle: `db:migrate`; Prisma: `db push` |
| `production` | Prod | Edge + edge-jobs → `manut.xyz`. Schema: `prisma migrate deploy` |

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
# Staging (Depot CI: Deploy Edge Staging)
git checkout preview && git pull
git merge --no-ff origin/main
git push origin preview

# Production (Depot CI: Deploy Edge Production)
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

Depot CI reports its jobs as GitHub checks with the same names (the aggregate
gate is `Validate`), so protection keeps working — provided the Depot GitHub
App has repository access (organizations/mygogocash → GitHub installations).

`preview` and `production` are not the default branch. Treat them as
deploy targets, not feature branches.

## Staging vs production schema

| Branch | Schema sync |
| --- | --- |
| `preview` | Drizzle `db:migrate` (edge) + Prisma `db push` (ERP shape only — **data-migration SQL never runs**) |
| `production` | Drizzle `db:migrate` + `prisma migrate deploy` |

A backfill that lives only inside a migration file will be empty on
staging until you run a `packages/database/scripts/*.mjs` script through
the Depot `db-backfill.yml` workflow.

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
The GCP Cloud Run and Vercel pipelines were retired 2026-09 — see this
file's header and `docs/ops/CLOUDFLARE_PROVISIONING.md`.
