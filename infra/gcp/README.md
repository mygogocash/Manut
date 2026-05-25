# Manut GCP Infrastructure

This directory is the home for the long-term Terraform layout. The first
Cloud Run migration slice keeps executable deployment logic in
`cloudbuild.manut-cloud-run.yaml`; Terraform should become the source of truth
before production DNS cutover.

Recommended layout:

```text
infra/gcp/
  modules/
    artifact-registry/
    cloud-run-service/
    cloud-run-job/
    cloud-sql-postgres/
    memorystore-redis/
    secret-manager/
    monitoring/
  envs/
    staging/
    prod/
```

State backend:

- Use a GCS bucket in `affine-495114`.
- Enable object versioning.
- Use one state prefix per environment.
- Require reviewed `terraform plan` output before `terraform apply`.

Operational rule:

- Console changes are allowed only for emergency recovery. Record them in the
  next Terraform change immediately afterward.
