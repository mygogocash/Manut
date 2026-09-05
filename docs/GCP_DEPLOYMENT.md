# GCP Deployment Guide

> **RETIRED (Phase 9 prep).** Production serving moves to Cloudflare Workers
> (`docs/CLOUDFLARE_DEPLOYMENT.md`, `docs/ops/CUTOVER_RUNBOOK.md`). Keep this
> guide only for rollback until T+14d post-cutover; do not provision new Cloud Run
> services from it.

---


> Complete guide for deploying Intranet (Next.js frontend + Express backend) to Google Cloud Platform using Docker and Cloud Run.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Docker Configuration](#docker-configuration)
4. [GCP Setup](#gcp-setup)
5. [Build and Push Images](#build-and-push-images)
6. [Deploy to Cloud Run](#deploy-to-cloud-run)
7. [Environment Variables](#environment-variables)
8. [CI/CD with Cloud Build](#cicd-with-cloud-build)
9. [Custom Domain Setup](#custom-domain-setup)
10. [Monitoring and Logging](#monitoring-and-logging)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

| Tool             | Version | Installation                                                |
| ---------------- | ------- | ----------------------------------------------------------- |
| Docker           | 24.x+   | [Install Docker](https://docs.docker.com/get-docker/)       |
| Google Cloud CLI | Latest  | [Install gcloud](https://cloud.google.com/sdk/docs/install) |
| Node.js          | 20.x+   | Required for local development                              |
| pnpm             | 10.x+   | `npm install -g pnpm`                                       |

### GCP Requirements

- Google Cloud account with billing enabled
- Project created (the live project is `tbh-nexora`)
- Required APIs enabled (see [GCP Setup](#gcp-setup))

### Verify Installations

```bash
# Check Docker
docker --version

# Check gcloud
gcloud --version

# Login to GCP
gcloud auth login
gcloud auth configure-docker asia-southeast1-docker.pkg.dev
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Google Cloud Platform                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌───────────────┐                                                     │
│   │ Cloud DNS /   │                                                     │
│   │ Load Balancer │                                                     │
│   └───────┬───────┘                                                     │
│           │                                                             │
│           ├─────────────────┬─────────────────┐                         │
│           │                 │                 │                         │
│           ▼                 ▼                 ▼                         │
│   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                │
│   │  Cloud Run    │ │  Cloud Run    │ │   Artifact    │                │
│   │  (nexora-web) │ │  (nexora-api) │ │   Registry    │                │
│   │  Next.js 16   │ │  Express 5    │ │               │                │
│   │  Port 3000    │ │  Port 3001    │ │  Docker       │                │
│   └───────┬───────┘ └───────┬───────┘ │  Images       │                │
│           │                 │         └───────────────┘                │
│           │                 │                                           │
│           │                 ├─────────────────┐                         │
│           │                 │                 │                         │
│           │                 ▼                 ▼                         │
│           │         ┌───────────────┐ ┌───────────────┐                │
│           │         │    Secret     │ │ Cloud Storage │                │
│           │         │    Manager    │ │  (uploads)    │                │
│           │         └───────────────┘ └───────────────┘                │
│           │                                                             │
└───────────┼─────────────────────────────────────────────────────────────┘
            │
            │ External Services
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐              │
│   │   Supabase    │  │   Supabase    │  │   Anthropic   │              │
│   │   PostgreSQL  │  │   Auth/Store  │  │   (ARIA AI)   │              │
│   └───────────────┘  └───────────────┘  └───────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Docker Configuration

### Project Structure

Create the following Docker-related files:

```
nexora/
├── docker/
│   ├── Dockerfile.web      # Next.js frontend
│   ├── Dockerfile.api      # Express backend
│   └── docker-compose.yml  # Local testing
├── .dockerignore           # Root level
└── ...
```

### .dockerignore (Root Level)

Create `.dockerignore` in the project root:

```dockerignore
# Dependencies
**/node_modules
**/.pnpm-store

# Build outputs
**/.next
**/dist
**/.turbo

# Development
**/.env
**/.env.local
**/.env.*.local

# IDE
**/.idea
**/.vscode
**/*.swp
**/*.swo

# Git
.git
.gitignore

# Documentation
**/docs
**/*.md
!README.md

# Tests
**/__tests__
**/*.test.ts
**/*.spec.ts
**/coverage
**/playwright-report

# Misc
**/.DS_Store
**/Thumbs.db
*.log
```

### Dockerfile.web (Next.js Frontend)

Create `docker/Dockerfile.web`:

```dockerfile
# ============================================
# Intranet Web - Next.js 16 Production Dockerfile
# ============================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY turbo.json ./

# Copy package.json files for all workspaces
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/utils/node_modules ./packages/utils/node_modules

# Copy source code
COPY . .

# Build shared packages first
RUN pnpm --filter @nexora/types build
RUN pnpm --filter @nexora/utils build
RUN pnpm --filter @nexora/ui build

# Build the web app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build arguments for public env vars (required at build time)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter @nexora/web build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
```

### Update next.config.ts for Standalone Output

**Important:** Update `apps/web/next.config.ts` to enable standalone output:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@nexora/ui", "@nexora/types", "@nexora/utils"],
};

export default nextConfig;
```

### Dockerfile.api (Express Backend)

Create `docker/Dockerfile.api`:

```dockerfile
# ============================================
# Intranet API - Express 5 Production Dockerfile
# ============================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY turbo.json ./

# Copy package.json files for all workspaces
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Copy Prisma schema for generation
COPY packages/database/prisma ./packages/database/prisma
COPY packages/database/prisma.config.ts ./packages/database/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @nexora/database db:generate

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/utils/node_modules ./packages/utils/node_modules

# Copy source code
COPY . .

# Build shared packages
RUN pnpm --filter @nexora/types build
RUN pnpm --filter @nexora/utils build
RUN pnpm --filter @nexora/database build

ENV NODE_ENV=production

# Stage 3: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Copy the entire monorepo structure needed for tsx runtime
COPY --from=builder --chown=expressjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app/apps/api ./apps/api
COPY --from=builder --chown=expressjs:nodejs /app/packages ./packages
COPY --from=builder --chown=expressjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=expressjs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=expressjs:nodejs /app/turbo.json ./turbo.json
COPY --from=builder --chown=expressjs:nodejs /app/tsconfig.json ./tsconfig.json

USER expressjs

EXPOSE 3001

ENV PORT=3001

# Use tsx to run TypeScript directly
CMD ["node_modules/.bin/tsx", "apps/api/src/main.ts"]
```

### docker-compose.yml (Local Testing)

Create `docker/docker-compose.yml`:

```yaml
version: "3.8"

services:
  web:
    build:
      context: ..
      dockerfile: docker/Dockerfile.web
      args:
        - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
        - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
        - NEXT_PUBLIC_API_URL=http://localhost:3001
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - api
    networks:
      - nexora-network

  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.api
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=${DATABASE_URL}
      - DIRECT_URL=${DIRECT_URL}
      - SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - ALLOWED_ORIGINS=http://localhost:3000
      - GCP_PROJECT_ID=${GCP_PROJECT_ID}
      - GCS_BUCKET=${GCS_BUCKET}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    networks:
      - nexora-network

networks:
  nexora-network:
    driver: bridge
```

---

## GCP Setup

### Step 1: Set Environment Variables

```bash
# Set your project details (these are the live values — see .github/workflows/deploy.yml)
export PROJECT_ID="tbh-nexora"
export REGION="asia-southeast1"
export REPOSITORY="nexora"

# Set these for convenience
export WEB_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/web"
export API_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/api"
```

### Step 2: Enable Required APIs

```bash
# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com
```

### Step 3: Create Artifact Registry Repository

```bash
# Create a Docker repository
gcloud artifacts repositories create $REPOSITORY \
  --repository-format=docker \
  --location=$REGION \
  --description="Intranet Docker images"

# Configure Docker authentication
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

### Step 4: Create Secrets in Secret Manager

```bash
# Create secrets for sensitive values
echo -n "your-database-url" | \
  gcloud secrets create DATABASE_URL --data-file=-

echo -n "your-direct-url" | \
  gcloud secrets create DIRECT_URL --data-file=-

echo -n "your-supabase-service-role-key" | \
  gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-

echo -n "your-anthropic-api-key" | \
  gcloud secrets create ANTHROPIC_API_KEY --data-file=-

# Grant Cloud Run access to secrets
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Build and Push Images

### Option 1: Build Locally and Push

```bash
# Navigate to project root
cd /path/to/nexora

# Build and push web image
docker build \
  -f docker/Dockerfile.web \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" \
  --build-arg NEXT_PUBLIC_API_URL="https://api.nexora.example.com" \
  -t ${WEB_IMAGE}:latest \
  -t ${WEB_IMAGE}:$(git rev-parse --short HEAD) \
  .

docker push ${WEB_IMAGE}:latest
docker push ${WEB_IMAGE}:$(git rev-parse --short HEAD)

# Build and push API image
docker build \
  -f docker/Dockerfile.api \
  -t ${API_IMAGE}:latest \
  -t ${API_IMAGE}:$(git rev-parse --short HEAD) \
  .

docker push ${API_IMAGE}:latest
docker push ${API_IMAGE}:$(git rev-parse --short HEAD)
```

### Option 2: Build with Cloud Build

```bash
# Build web image using Cloud Build
gcloud builds submit \
  --config=cloudbuild-web.yaml \
  --substitutions=_REGION=$REGION,_REPOSITORY=$REPOSITORY

# Build API image using Cloud Build
gcloud builds submit \
  --config=cloudbuild-api.yaml \
  --substitutions=_REGION=$REGION,_REPOSITORY=$REPOSITORY
```

---

## Deploy to Cloud Run

### Deploy API Service

```bash
gcloud run deploy nexora-api \
  --image ${API_IMAGE}:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 3001 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "PORT=3001" \
  --set-env-vars "ALLOWED_ORIGINS=https://nexora.example.com" \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co" \
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID}" \
  --set-env-vars "GCS_BUCKET=nexora-uploads" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest" \
  --set-secrets "DIRECT_URL=DIRECT_URL:latest" \
  --set-secrets "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
  --set-secrets "ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest"
```

### Get API Service URL

```bash
export API_URL=$(gcloud run services describe nexora-api \
  --region $REGION \
  --format 'value(status.url)')

echo "API URL: $API_URL"
```

### Deploy Web Service

```bash
gcloud run deploy nexora-web \
  --image ${WEB_IMAGE}:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "NEXT_PUBLIC_API_URL=${API_URL}"
```

### Verify Deployment

```bash
# Get service URLs
gcloud run services list --region $REGION

# Test API health endpoint
curl ${API_URL}/health

# Open web app
gcloud run services describe nexora-web \
  --region $REGION \
  --format 'value(status.url)' | xargs open
```

---

## Environment Variables

### API Service Environment Variables

| Variable                    | Source         | Description                       |
| --------------------------- | -------------- | --------------------------------- |
| `NODE_ENV`                  | Direct         | `production`                      |
| `PORT`                      | Direct         | `3001`                            |
| `DATABASE_URL`              | Secret Manager | Supabase pooled connection string |
| `DIRECT_URL`                | Secret Manager | Supabase direct connection string |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret Manager | Supabase service role key         |
| `NEXT_PUBLIC_SUPABASE_URL`  | Direct         | Supabase project URL              |
| `ALLOWED_ORIGINS`           | Direct         | CORS allowed origins              |
| `GCP_PROJECT_ID`            | Direct         | GCP project ID                    |
| `GCS_BUCKET`                | Direct         | Cloud Storage bucket name         |
| `ANTHROPIC_API_KEY`         | Secret Manager | Anthropic API key for ARIA        |

### Web Service Environment Variables

| Variable                        | Source              | Description                                              |
| ------------------------------- | ------------------- | -------------------------------------------------------- |
| `NODE_ENV`                      | Direct              | `production`                                             |
| `NEXT_PUBLIC_SUPABASE_URL`      | Build arg           | Supabase project URL                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build arg           | Supabase anonymous key                                   |
| `NEXT_PUBLIC_POSTHOG_KEY`       | Build arg           | PostHog project key                                      |
| `NEXT_PUBLIC_POSTHOG_HOST`      | Build arg           | Hard-coded to `/ingest` in the workflow (reverse-proxy)  |
| `API_URL`                       | Build arg + Direct  | Backend API URL — passed at build **and** as a runtime env var for the Next.js rewrite |

> **Note:** `NEXT_PUBLIC_*` variables are embedded at build time for Next.js and must be passed
> as build arguments. The backend URL is `API_URL` (not `NEXT_PUBLIC_API_URL`); the live
> workflow injects it both as a build-arg and as a runtime env var so the Next.js server-side
> rewrite can target the resolved Cloud Run API URL.

---

## CI/CD with Cloud Build

> **The live pipeline is GitHub Actions, not Cloud Build.** Production deploys run from
> `.github/workflows/deploy.yml` on every push to `main` (project `tbh-nexora`, services
> `nexora-api` / `nexora-web`), and staging from `.github/workflows/deploy-staging.yml` on
> push to `dev` (`nexora-api-staging` / `nexora-web-staging`). The real workflow authenticates
> via Workload Identity Federation, runs `prisma migrate deploy` **before** building the API
> image, builds + pushes to Artifact Registry, then `gcloud run deploy`s with a 3× retry to
> absorb Artifact Registry tag propagation. It also passes `API_URL` (not `NEXT_PUBLIC_API_URL`)
> as the web build-arg and runtime env var, and auto-provisions Cloud Scheduler jobs after the
> API deploy (see `docs/ops/cloud-scheduler-cron-jobs.md`). The Cloud Build config below is kept
> as a reference / alternative path and is not what runs today.

### cloudbuild.yaml (reference / alternative pipeline)

Create `cloudbuild.yaml` in the project root:

```yaml
# Full CI/CD pipeline for Intranet
steps:
  # ============================================
  # Step 1: Build and push API image
  # ============================================
  - name: "gcr.io/cloud-builders/docker"
    id: "build-api"
    args:
      - "build"
      - "-f"
      - "docker/Dockerfile.api"
      - "-t"
      - "${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}/api:${SHORT_SHA}"
      - "-t"
      - "${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}/api:latest"
      - "."

  - name: "gcr.io/cloud-builders/docker"
    id: "push-api"
    waitFor: ["build-api"]
    args:
      - "push"
      - "--all-tags"
      - "${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}/api"

  # ============================================
  # Step 2: Build and push Web image
  # ============================================
  - name: "gcr.io/cloud-builders/docker"
    id: "build-web"
    args:
      - "build"
      - "-f"
      - "docker/Dockerfile.web"
      - "--build-arg"
      - "NEXT_PUBLIC_SUPABASE_URL=${_SUPABASE_URL}"
      - "--build-arg"
      - "NEXT_PUBLIC_SUPABASE_ANON_KEY=${_SUPABASE_ANON_KEY}"
      - "--build-arg"
      - "NEXT_PUBLIC_API_URL=${_API_URL}"
      - "-t"
      - "${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}/web:${SHORT_SHA}"
      - "-t"
      - "${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}/web:latest"
      - "."

  - name: "gcr.io/cloud-builders/docker"
    id: "push-web"
    waitFor: ["build-web"]
    args:
      - "push"
      - "--all-tags"
      - "${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}/web"

  # ============================================
  # Step 3: Deploy API to Cloud Run
  # ============================================
  - name: "gcr.io/google.com/cloudsdktool/cloud-sdk"
    id: "deploy-api"
    waitFor: ["push-api"]
    entrypoint: gcloud
    args:
      - "run"
      - "deploy"
      - "nexora-api"
      - "--image"
      - "${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}/api:${SHORT_SHA}"
      - "--region"
      - "${_REGION}"
      - "--platform"
      - "managed"
      - "--allow-unauthenticated"
      - "--port"
      - "3001"
      - "--memory"
      - "512Mi"
      - "--cpu"
      - "1"
      - "--min-instances"
      - "0"
      - "--max-instances"
      - "10"
      - "--set-env-vars"
      - "NODE_ENV=production,PORT=3001,ALLOWED_ORIGINS=${_ALLOWED_ORIGINS},NEXT_PUBLIC_SUPABASE_URL=${_SUPABASE_URL},GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET=${_GCS_BUCKET}"
      - "--set-secrets"
      - "DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest"

  # ============================================
  # Step 4: Deploy Web to Cloud Run
  # ============================================
  - name: "gcr.io/google.com/cloudsdktool/cloud-sdk"
    id: "deploy-web"
    waitFor: ["push-web", "deploy-api"]
    entrypoint: gcloud
    args:
      - "run"
      - "deploy"
      - "nexora-web"
      - "--image"
      - "${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}/web:${SHORT_SHA}"
      - "--region"
      - "${_REGION}"
      - "--platform"
      - "managed"
      - "--allow-unauthenticated"
      - "--port"
      - "3000"
      - "--memory"
      - "512Mi"
      - "--cpu"
      - "1"
      - "--min-instances"
      - "0"
      - "--max-instances"
      - "10"
      - "--set-env-vars"
      - "NODE_ENV=production"

substitutions:
  _REGION: asia-southeast1
  _REPOSITORY: nexora
  _SUPABASE_URL: https://xcxuszvaqzlchupnjuyv.supabase.co
  _SUPABASE_ANON_KEY: your-anon-key
  _API_URL: https://nexora-api-xxxxxxxxxx-as.a.run.app
  _ALLOWED_ORIGINS: https://nexora-web-xxxxxxxxxx-as.a.run.app
  _GCS_BUCKET: nexora-uploads

options:
  logging: CLOUD_LOGGING_ONLY

images:
  - "${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}/api:${SHORT_SHA}"
  - "${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}/api:latest"
  - "${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}/web:${SHORT_SHA}"
  - "${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}/web:latest"
```

### Set Up Cloud Build Trigger

```bash
# Create a trigger for main branch
gcloud builds triggers create github \
  --name="nexora-deploy-main" \
  --repo-owner="your-org" \
  --repo-name="nexora" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --substitutions="_SUPABASE_ANON_KEY=your-anon-key,_API_URL=https://your-api-url"
```

### Manual Deployment

```bash
# Trigger a manual build
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions="_SUPABASE_ANON_KEY=your-key,_API_URL=https://api.example.com"
```

---

## Custom Domain Setup

### Step 1: Verify Domain Ownership

```bash
gcloud domains verify your-domain.com
```

### Step 2: Map Custom Domain to Cloud Run

```bash
# Map domain to web service
gcloud run domain-mappings create \
  --service nexora-web \
  --domain nexora.example.com \
  --region $REGION

# Map domain to API service
gcloud run domain-mappings create \
  --service nexora-api \
  --domain api.nexora.example.com \
  --region $REGION
```

### Step 3: Configure DNS

Add the following DNS records (values provided by Cloud Run):

| Type  | Name       | Value                |
| ----- | ---------- | -------------------- |
| CNAME | nexora     | ghs.googlehosted.com |
| CNAME | api.nexora | ghs.googlehosted.com |

### Step 4: Update CORS and Environment Variables

After domain setup, update the API deployment:

```bash
gcloud run services update nexora-api \
  --region $REGION \
  --update-env-vars "ALLOWED_ORIGINS=https://nexora.example.com"
```

---

## Monitoring and Logging

### View Logs

```bash
# View API logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=nexora-api" \
  --limit 50 \
  --format "table(timestamp,textPayload)"

# View Web logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=nexora-web" \
  --limit 50 \
  --format "table(timestamp,textPayload)"

# Stream logs in real-time
gcloud beta run services logs tail nexora-api --region $REGION
```

### Set Up Alerts

```bash
# Create an alert policy for high error rate
gcloud alpha monitoring policies create \
  --display-name="Intranet API Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="nexora-api" AND metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class="5xx"'
```

### Cloud Run Metrics Dashboard

Access metrics in the GCP Console:

1. Navigate to Cloud Run
2. Select your service
3. Click "Metrics" tab

Key metrics to monitor:

- Request count
- Request latency (p50, p95, p99)
- Container instance count
- Memory utilization
- CPU utilization

---

## Troubleshooting

### Common Issues

#### 1. Build Fails: "Cannot find module"

**Problem:** Workspace packages not properly linked.

**Solution:** Ensure all package.json files are copied and dependencies installed:

```dockerfile
# Copy ALL workspace package.json files
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
# ... etc
```

#### 2. Prisma Client Generation Fails

**Problem:** Prisma schema files not found during build.

**Solution:** Copy the entire prisma directory:

```dockerfile
COPY packages/database/prisma ./packages/database/prisma
COPY packages/database/prisma.config.ts ./packages/database/
```

#### 3. Next.js Standalone Output Missing

**Problem:** `server.js` not found in standalone output.

**Solution:** Ensure `next.config.ts` has `output: "standalone"`:

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  // ...
};
```

#### 4. Environment Variables Not Available

**Problem:** `NEXT_PUBLIC_*` variables are undefined at runtime.

**Solution:** These must be set at **build time** as build arguments:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="..." \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="..." \
  ...
```

#### 5. CORS Errors

**Problem:** Frontend cannot connect to API.

**Solution:** Update `ALLOWED_ORIGINS` in API service:

```bash
gcloud run services update nexora-api \
  --region $REGION \
  --update-env-vars "ALLOWED_ORIGINS=https://your-frontend-url.com"
```

#### 6. Database Connection Timeout

**Problem:** Prisma cannot connect to Supabase.

**Solution:**

- Use the pooled connection string (`DATABASE_URL`) for queries
- Use direct connection (`DIRECT_URL`) for migrations
- Ensure Cloud Run has outbound internet access

#### 7. Container Keeps Restarting

**Problem:** Health checks failing.

**Solution:** Add a health endpoint to your API:

```typescript
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});
```

### Debug Commands

```bash
# Check service status
gcloud run services describe nexora-api --region $REGION

# View recent revisions
gcloud run revisions list --service nexora-api --region $REGION

# Check container logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=nexora-api AND severity>=ERROR" --limit 20

# Test locally before deploying
docker-compose -f docker/docker-compose.yml up --build

# SSH into a running container (for debugging)
gcloud run services proxy nexora-api --region $REGION --port 8080
```

### Performance Optimization

1. **Reduce cold starts:**

   ```bash
   gcloud run services update nexora-api \
     --min-instances 1 \
     --region $REGION
   ```

2. **Increase memory for large builds:**

   ```bash
   gcloud run services update nexora-api \
     --memory 1Gi \
     --region $REGION
   ```

3. **Enable HTTP/2:**
   ```bash
   gcloud run services update nexora-api \
     --use-http2 \
     --region $REGION
   ```

---

## Quick Reference

### Deployment Commands Cheat Sheet

```bash
# Build images
docker build -f docker/Dockerfile.api -t nexora-api .
docker build -f docker/Dockerfile.web -t nexora-web .

# Push to Artifact Registry
docker tag nexora-api ${REGION}-docker.pkg.dev/${PROJECT_ID}/nexora/api:latest
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/nexora/api:latest

# Deploy to Cloud Run
gcloud run deploy nexora-api --image ${API_IMAGE}:latest --region $REGION

# View services
gcloud run services list --region $REGION

# View logs
gcloud beta run services logs tail nexora-api --region $REGION

# Update environment variables
gcloud run services update nexora-api --update-env-vars "KEY=value" --region $REGION

# Rollback to previous revision
gcloud run services update-traffic nexora-api --to-revisions REVISION=100 --region $REGION
```

---

## Related Documents

- [Project Overview](./PROJECT_OVERVIEW.md)
- [API Specification](./API_SPECIFICATION.md)
- [Database Schema](./DATABASE_SCHEMA.md)
