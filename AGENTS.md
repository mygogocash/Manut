# AGENTS.md — Manut development rules

`CLAUDE.md` is the binding repository guide. Keep this file and that guide in
sync when architecture or verification changes.

## Delivery boundary

- The product is Manut Intranet. Do not add inherited company names, domains,
  identifiers, sample people, credentials, assets, or provider resources.
- Web delivery comes first through `apps/app`, but every change must keep web,
  iOS, and Android compilation healthy from the same Expo Router project.
- `apps/web` is a temporary parity reference. Remove a legacy route or web-only
  dependency only after the universal route has browser E2E acceptance.
- Production (`main`) deploys through Cloudflare Workers Builds. GitHub Actions
  owns preview and staging deploys only; those workflows fail closed without
  their GitHub Environment secrets. Disable native non-production Workers
  Builds after preview validation so a branch has one deploy owner. No code
  change authorizes DNS cutover, database provisioning, mobile-store release,
  or inventing Hyperdrive ids. Keep Cloudflare Pages auto-deploy off; see
  `docs/CICD_CLOUDFLARE.md`.

## Architecture

- `apps/app`: universal Expo Router routes and platform adapters.
- `packages/app-core`: API, DTO, auth, RBAC, query, validation, and domain logic
  with no browser, Next.js, Node-only, or concrete storage dependency.
- `packages/ui`: universal components and tokens.
- `apps/edge`: Cloudflare Worker gateway, Static Assets, R2 intents, rate limits,
  Queues, Durable Objects, and fail-closed capability boundaries.
- `apps/api`: strict Express business API during progressive edge migration.
- `packages/database`: Prisma 7 and the clean PostgreSQL baseline.

PostgreSQL through Hyperdrive is authoritative. D1 is never the transactional
system of record. R2 objects are private unless explicitly public.

## Working loop

1. Map the existing route/module and its permission boundary.
2. Add or update a failing test for behavior changes.
3. Keep shared behavior in `app-core`; use `.web.tsx`/`.native.tsx` only for
   genuine platform differences.
4. Run the focused test, then the relevant gates below.
5. Do not claim deployment or provider revocation without live evidence.

## Required gates

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm type-check
pnpm lint
pnpm test
pnpm --filter @manut/app export:web
pnpm --filter @manut/app export:ios
pnpm --filter @manut/app export:android
pnpm --filter @manut/edge build
pnpm migration:check
pnpm security:credentials
git diff --check
```

Hosted authenticated E2E additionally requires the five approved `E2E_*`
secrets and the independent dedicated-project marker. Never bypass that guard.

## API and database conventions

- Validate inputs with Zod; controllers route, services authorize and apply
  business rules, repositories access Prisma.
- API authorization is authoritative. Client route guards improve navigation
  but never grant access.
- Register literal Express routes before `/:id`.
- Permanent deletion must load including-deleted state: missing `404`, active
  `409`, soft-deleted purge only.
- Authenticate webhook raw bytes before parsing or mutation.
- The clean baseline is immutable. Every new migration needs `setup.sql` and
  `assert.sql`, must apply through `prisma migrate deploy`, and replay safely.

## Security

- Never add secrets to Turbo global environment declarations or client bundles.
- Never commit Playwright storage state, Expo/EAS signing data, Wrangler local
  state, provider config, or environment files.
- Run the credential-boundary scanner after touching auth, fixtures, docs,
  imports, assets, generated output, or deployment configuration.
- GitHub Actions must be commit-SHA pinned, read-only by default, and must never
  use `pull_request_target`.

## Learned User Preferences

- Use Node `24.18.0` and pnpm `11.13.1` (`source ~/.nvm/nvm.sh && nvm use` /
  `.nvmrc`) before installs, gates, and package scripts in this repo.
- When a commit request supplies an authoritative staged-file list, commit only
  those staged portions — do not stage or include additional files.
- Never paste raw credential values; report paths or HMACs only.
- Do not run destructive git cleanup in this worktree (`git reset --hard`,
  `git checkout --`, `git clean -fd`) or broad publishes (`git push --all`,
  `git push --mirror`).
- For universal route migration, land foundation / read-only Expo + `app-core`
  slices before deepen work (approvals, attachments, R2 uploads). Deepen one
  vertical per slice (one write/board path or CRM hub); document the pattern in
  handoff rather than broadening every hub at once.
- Prefer extending existing app-core + Expo foundations; do not rewrite landed
  list/detail screens from scratch when deepening.
- When multiple agents work in parallel, touch only owned modules, re-read
  shared files before editing, and do not stage unrelated work from other agents.
  For handoff docs, append only a `### Parallel: <slug>` section at the END (or
  skip handoff); leave consolidation to a reconcile pass.
- Client DTOs and projections must strip sensitive fields (emails, budgets,
  storage paths); ownership and authz checks stay server-side.

## Learned Workspace Facts

- Work only in this clean-room checkout
  (`manut-intranet-full-hardening`); do not continue in the original
  audited-source worktree.
- This checkout is a linked worktree sharing a Git object store with the
  audited-source tree — unrelated local branches may belong to other worktrees;
  do not delete them. Scope history and secret scans to the replacement range,
  not every local ref.
- Continuation and phase guidance live in `docs/CURSOR_HANDOFF.md` (with
  `docs/ROUTE_DISPOSITION.md`, `docs/CREDENTIAL_BOUNDARY.md`,
  `docs/CLOUDFLARE_MIGRATION_CHECKLIST.md`, and related docs).
- The configured publish remote for this replacement work is `manut` (GitHub
  `mygogocash/Manut`); use `claude/<slug>` branches (for example
  `claude/intranet-full-hardening`).
- Keep the GitHub repo detached from the inherited `toeverything/AFFiNE` fork
  network; do not reintroduce inherited AFFiNE About branding on that repo.
- `/drive` is Google Drive via integrations APIs (not R2); keep it separate from
  `/files` (uploads/R2). Route disposition stays `foundation` until Expo browser
  E2E acceptance.
- Edge Hyperdrive dual-path: `ENABLE_HYPERDRIVE_BOUNDARY=true` plus
  `HYPERDRIVE_DATABASE` uses Worker Prisma; flag off proxies to Express; flag on
  without binding fails closed with `503 HYPERDRIVE_NOT_PROVISIONED` (never
  silent Express fallback). Port a route only when Express authz and business
  rules can be mirrored honestly; otherwise keep it proxied and document the gap.
- Ops env names for edge deepen (values stay out of git):
  `TRUSTED_STORAGE_ORIGINS` (empty means managed expense/CA receipt writes still
  proxy); `EDGE_REALTIME_ORIGIN` and `EDGE_REALTIME_BRIDGE_SECRET` (must match
  Worker `EDGE_SIGNING_KEY`) for Express `messageBus` → Durable Object fan-out.
