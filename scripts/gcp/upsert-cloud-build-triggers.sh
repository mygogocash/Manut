#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-affine-495114}"
TRIGGER_REGION="${TRIGGER_REGION:-global}"
RUNTIME_REGION="${RUNTIME_REGION:-asia-southeast1}"
REPO_OWNER="${REPO_OWNER:-mygogocash}"
REPO_NAME="${REPO_NAME:-Manut}"
MAIN_BRANCH_PATTERN="${MAIN_BRANCH_PATTERN:-^main$}"
MAIN_BRANCH="${MAIN_BRANCH:-main}"
# This project rejects trigger creation without an explicit build service
# account. Default to the dedicated Manut Cloud Build deployer.
SERVICE_ACCOUNT="${CLOUD_BUILD_SERVICE_ACCOUNT:-manut-cloud-build@affine-495114.iam.gserviceaccount.com}"
GENERATED_STAGING_URL="${GENERATED_STAGING_URL:-https://manut-staging-idid7yszzq-as.a.run.app}"

service_account_flag=()
if [[ "$SERVICE_ACCOUNT" != projects/*/serviceAccounts/* ]]; then
  SERVICE_ACCOUNT="projects/${PROJECT_ID}/serviceAccounts/${SERVICE_ACCOUNT}"
fi
service_account_flag=(--service-account="$SERVICE_ACCOUNT")

trigger_id_for_name() {
  local name="$1"
  gcloud builds triggers list \
    --project="$PROJECT_ID" \
    --region="$TRIGGER_REGION" \
    --filter="name=${name}" \
    --format='value(id)' | head -1
}

upsert_github_trigger() {
  local name="$1"
  shift
  local id
  id="$(trigger_id_for_name "$name")"
  if [ -n "$id" ]; then
    echo "[gcp] Updating Cloud Build trigger ${name} (${id})"
    gcloud builds triggers update github "$id" \
      --project="$PROJECT_ID" \
      --region="$TRIGGER_REGION" \
      "$@"
  else
    echo "[gcp] Creating Cloud Build trigger ${name}"
    gcloud builds triggers create github \
      --project="$PROJECT_ID" \
      --region="$TRIGGER_REGION" \
      --name="$name" \
      "$@"
  fi
}

upsert_manual_trigger() {
  local name="$1"
  local substitutions="$2"
  local id
  id="$(trigger_id_for_name "$name")"
  if [ -n "$id" ]; then
    echo "[gcp] Updating Cloud Build manual trigger ${name} (${id})"
    gcloud builds triggers update manual "$id" \
      --project="$PROJECT_ID" \
      --region="$TRIGGER_REGION" \
      --description="Approval-gated production Cloud Run deploy for Manut" \
      --require-approval \
      ${service_account_flag[@]+"${service_account_flag[@]}"} \
      --git-file-source-uri="https://github.com/${REPO_OWNER}/${REPO_NAME}" \
      --git-file-source-repo-type=GITHUB \
      --git-file-source-branch="$MAIN_BRANCH" \
      --git-file-source-path=cloudbuild.manut-cloud-run.yaml \
      --source-to-build-uri="https://github.com/${REPO_OWNER}/${REPO_NAME}" \
      --source-to-build-repo-type=GITHUB \
      --source-to-build-branch="$MAIN_BRANCH" \
      --update-substitutions="$substitutions"
  else
    echo "[gcp] Creating Cloud Build manual trigger ${name}"
    gcloud builds triggers create manual \
      --project="$PROJECT_ID" \
      --region="$TRIGGER_REGION" \
      --name="$name" \
      --description="Approval-gated production Cloud Run deploy for Manut" \
      --repo="https://github.com/${REPO_OWNER}/${REPO_NAME}" \
      --repo-type=GITHUB \
      --branch="$MAIN_BRANCH" \
      --build-config=cloudbuild.manut-cloud-run.yaml \
      --require-approval \
      ${service_account_flag[@]+"${service_account_flag[@]}"} \
      --substitutions="$substitutions"
  fi
}

staging_substitutions="_SERVICE_NAME=manut-staging,_MIGRATION_JOB_NAME=manut-staging-migrate,_IMAGE_TAG=\$SHORT_SHA,_DATABASE_URL_SECRET=manut-staging-database-url,_AFFINE_CONFIG_JSON_B64_SECRET=manut-staging-affine-config-json-b64,_AFFINE_PRIVATE_KEY_SECRET=manut-staging-affine-private-key,_GOOGLE_OAUTH_CLIENT_ID_SECRET=manut-staging-google-oauth-client-id,_GOOGLE_OAUTH_CLIENT_SECRET=manut-staging-google-oauth-client-secret,_RESEND_API_KEY_SECRET=manut-staging-resend-api-key,_EXTERNAL_URL=https://staging.manut.xyz,_REDIS_SERVER_HOST=10.47.0.3,_MIN_INSTANCES=0,_MAX_INSTANCES=5,_SMOKE_BASE_URL=${GENERATED_STAGING_URL}"
prod_substitutions="_SERVICE_NAME=manut,_MIGRATION_JOB_NAME=manut-migrate,_IMAGE_TAG=\$SHORT_SHA,_EXTERNAL_URL=https://manut.xyz,_SMOKE_BASE_URL=https://manut.xyz"

echo "[gcp] Project: ${PROJECT_ID}"
echo "[gcp] Trigger region: ${TRIGGER_REGION}"
echo "[gcp] Repository: ${REPO_OWNER}/${REPO_NAME}"
echo "[gcp] Trigger service account: ${SERVICE_ACCOUNT}"

upsert_github_trigger "manut-gcp-pr-ci" \
  --description="Cloud Build PR CI for Manut" \
  --repo-owner="$REPO_OWNER" \
  --repo-name="$REPO_NAME" \
  --pull-request-pattern="$MAIN_BRANCH_PATTERN" \
  --comment-control=COMMENTS_ENABLED_FOR_EXTERNAL_CONTRIBUTORS_ONLY \
  --build-config=cloudbuild.manut-ci.yaml \
  --include-logs-with-status \
  --no-require-approval \
  ${service_account_flag[@]+"${service_account_flag[@]}"}

upsert_github_trigger "manut-gcp-main-staging" \
  --description="Cloud Build main-to-staging Cloud Run deploy for Manut" \
  --repo-owner="$REPO_OWNER" \
  --repo-name="$REPO_NAME" \
  --branch-pattern="$MAIN_BRANCH_PATTERN" \
  --build-config=cloudbuild.manut-cloud-run.yaml \
  --include-logs-with-status \
  --no-require-approval \
  ${service_account_flag[@]+"${service_account_flag[@]}"} \
  --substitutions="$staging_substitutions"

upsert_manual_trigger "manut-gcp-prod-deploy" "$prod_substitutions"

echo "[gcp] Cloud Build triggers are installed. Current trigger list:"
gcloud builds triggers list \
  --project="$PROJECT_ID" \
  --region="$TRIGGER_REGION" \
  --format='table(name,id,disabled,github.push.branch,github.pullRequest.branch,filename,approvalConfig.approvalRequired)'
