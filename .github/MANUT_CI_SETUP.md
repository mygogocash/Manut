# Superflow CI/CD Setup

The three workflows in this directory (`superflow-ci.yml`,
`superflow-release.yml`, `superflow-deploy.yml`) need one GitHub
repository secret to function.

## Required secret

### `GCP_SA_KEY`

The full JSON of a Google Cloud service account that has these roles on
the `affine-495114` project:

| Role                               | Used by                                          |
| ---------------------------------- | ------------------------------------------------ |
| `roles/artifactregistry.writer`    | release.yml — pushing to GAR                     |
| `roles/artifactregistry.reader`    | deploy.yml — `gcloud artifacts docker tags list` |
| `roles/iap.tunnelResourceAccessor` | deploy.yml — IAP-tunnelled SSH                   |
| `roles/compute.instanceAdmin.v1`   | deploy.yml — `gcloud compute ssh`                |

### Creating the service account

```bash
PROJECT=affine-495114
SA_NAME=superflow-ci

gcloud iam service-accounts create $SA_NAME \
  --display-name="Superflow CI/CD" \
  --project=$PROJECT

SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

for role in artifactregistry.writer artifactregistry.reader \
            iap.tunnelResourceAccessor compute.instanceAdmin.v1; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/${role}"
done

gcloud iam service-accounts keys create superflow-ci.json \
  --iam-account=$SA_EMAIL
```

Then add the contents of `superflow-ci.json` as the `GCP_SA_KEY` secret
under https://github.com/mygogocash/Superflow/settings/secrets/actions

**After adding the secret, delete the local `superflow-ci.json` file.**

## Workflow summary

| Workflow                | Trigger                    | Purpose                                                   |
| ----------------------- | -------------------------- | --------------------------------------------------------- |
| `superflow-ci.yml`      | push / PR to `main`        | Lint (oxlint + prettier), web bundle, server bundle       |
| `superflow-release.yml` | push tag `v*.*.*`          | Build all bundles, build + push image to GAR              |
| `superflow-deploy.yml`  | manual (workflow_dispatch) | SSH into `affine-vm`, update compose, restart, smoke-test |

## Tagging a release

```bash
git tag v1.9.0
git push origin v1.9.0
# release.yml fires; image lands in GAR within ~15 min
```

After it lands, go to **Actions → Superflow Deploy → Run workflow**,
fill in the tag, and click Run. The deploy takes ~2 min and ends with
a smoke test of `https://manut.xyz/info`.

## Rollback

The deploy workflow always backs up `compose.yml` to
`/srv/affine/compose/compose.yml.pre-<tag>.bak` on the VM before
flipping the image. Rollback is one ssh:

```bash
gcloud compute ssh affine-vm --zone=asia-southeast1-a \
  --project=affine-495114 --tunnel-through-iap \
  --command='cd /srv/affine/compose && \
             sudo cp compose.yml.pre-v1.9.0.bak compose.yml && \
             sudo docker compose up -d affine'
```

The exact rollback command is also printed in every deploy run's summary.

## Optional: enable Dependabot

`.github/dependabot.superflow.yml` is a config draft. To activate, copy
or rename it to `.github/dependabot.yml` (one-time):

```bash
mv .github/dependabot.superflow.yml .github/dependabot.yml
git add .github/dependabot.yml
git commit -m "chore(ci): enable dependabot"
git push
```

It opens up to 3 dep PRs per week (grouped by patch + minor) and 2
GitHub Actions PRs per week.
