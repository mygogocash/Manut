# Railway Build Electron Skip Spec

## Goal

Keep the Railway production Docker build from failing during `yarn install` when Electron's install script cannot download or build the desktop binary.

## Requirements

- Scope the change to the Railway Docker image path, `.docker/manut/Dockerfile.railway`.
- Keep Electron, Playwright, and Sentry CLI binary downloads disabled in the Railway install stage because the production Railway image does not ship the desktop app, browser test runners, or Sentry upload tooling.
- Preserve the existing monorepo install and bundle flow for `@affine/server`, web, admin, mobile, and `manut-landing`.
- Do not change Railway service variables or production data.

## Failure Evidence

- Railway deployment `bfbbd022-db11-40c3-95a5-f23cfaadf17a` failed on commit `4af179d4018be2b5424659b2bc4537c8edf14df0`.
- The build failed in `[app-builder 11/16] RUN corepack enable ... yarn install`.
- Yarn reported `electron@npm:39.8.6 couldn't be built successfully`, then exited with code 1.

## Edge Cases

- The Railway Dockerfile still needs normal package lifecycle scripts for required native dependencies, so this should not globally disable all Yarn scripts.
- The production dependency `prep` stage already uses `yarn workspaces focus @affine/server --production`; the observed failure is in the full `app-builder` install.
- If Railway build still fails after this patch, inspect the next package-specific install error instead of assuming the app code failed.

## Tasks

### Task 1: Add Dockerfile guard

- Intended behavior: a repository check fails if the Railway Dockerfile lacks install-skip env vars before `yarn install`.
- Test name: `node scripts/check-railway-dockerfile.mjs`.
- Affected files: `scripts/check-railway-dockerfile.mjs`.
- Risk tier: R2.
- Rollback: remove the guard script.

### Task 2: Patch Railway Dockerfile

- Intended behavior: `app-builder` runs `yarn install` with `ELECTRON_SKIP_BINARY_DOWNLOAD=1`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, and `SENTRYCLI_SKIP_DOWNLOAD=1`.
- Test name: `node scripts/check-railway-dockerfile.mjs`.
- Affected files: `.docker/manut/Dockerfile.railway`.
- Risk tier: R1 because this changes production deployment build behavior.
- Rollback: revert the hotfix commit or PR.

## Verification Strategy

- Confirm the guard fails before the Dockerfile patch.
- Confirm the guard passes after the Dockerfile patch.
- Run Prettier/ESLint on the changed files.
- Rerun `yarn affine bundle -p web` as a fast local bundle sanity check.
- Push the hotfix PR, merge it, and monitor the Railway redeploy.
