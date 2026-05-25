#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-affine-495114}"
REGION="${REGION:-asia-southeast1}"
JOB_NAME="${JOB_NAME:-manut-migrate}"

usage() {
  cat <<USAGE
Usage:
  PROJECT_ID=affine-495114 REGION=asia-southeast1 JOB_NAME=manut-migrate \\
    $0

Runs the existing Cloud Run migration job and waits for completion.
This script does not create resources; use cloudbuild.manut-cloud-run.yaml
or Terraform to create/update the job first.
USAGE
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

echo "[gcp] Executing Cloud Run job ${JOB_NAME} in ${PROJECT_ID}/${REGION}"
gcloud run jobs execute "$JOB_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --wait

echo "[gcp] Migration job completed"
