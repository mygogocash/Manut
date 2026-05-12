# Production Readiness Audit — `affine-gogocash:latest`

**Diff scope:** commit `648903b` → `HEAD` on `main`
**Target deployment:** GCE VM `affine-vm` (asia-southeast1-a) serving `https://manut.gogocash.co`
**Verdict:** **BLOCK — do not deploy until the MUST-FIX list below is resolved.**

---

## 1. Severity summary

| Severity | Count | Areas                                                                                                                                  |
| -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | 5     | OAuth (state replay, auth bypass, popup), DB FK, plaintext-named token columns                                                         |
| HIGH     | 11    | token refresh, dual migrations, error-swallowing, MCP timing+membership, raw GQL fetch, mutation rejections, stale toast, double `any` |
| MEDIUM   | 7     | encryption-key rotation, HubSpot URL-token, hook-at-module-parse, theming, etc.                                                        |
| LOW      | 4     | OAuth state TTL, error-message provider oracle, ava glob, dead code                                                                    |

Plus **4 feature deceptions** (advertised behaviour ≠ actual behaviour) that will erode user trust faster than any of the above.

---

## 2. MUST-FIX before deploy (the blockers)

### Security CRITICALs

1. **OAuth state token replay** — `connections.service.ts:63-87`
   State key is read but never deleted; 3-hour replay window. Fix: `await this.cache.del(stateKey)` immediately after read.

2. **`/oauth/:provider/start` bypasses auth guard** — `connections.controller.ts:32-33`
   Decorated only with `@UseNamedGuard('version')`. Manual `req.user` check is not framework-enforced. Fix: add `@UseNamedGuard('auth')` (or `@AuthenticationRequired()`) and use `@CurrentUser()`.

3. **Plaintext-named `access_token` / `refresh_token` columns** — `migration.sql:18-19`
   App layer encrypts, but column names give no signal. Risks accidental plaintext writes from future tooling/dumps. Fix: rename to `encrypted_access_token` / `encrypted_refresh_token` in migration + Prisma schema.

### Data-integrity CRITICAL

4. **Missing workspace FK on `integration_connections`** — `migration.sql:36`, `schema.prisma:1151-1171`
   Workspace deletion leaves orphaned encrypted-token rows. `mcp_api_keys` has the same gap. Fix: add `ON DELETE CASCADE` FK in migration + Prisma `@relation`.

### Frontend CRITICAL

5. **OAuth via full-page redirect** — `connections-setting-panel.tsx:90-118`
   Full-page navigation away from settings dialog; callback detection on mount fires double `fetchConnections`. Fix: open `window.open(startUrl, '_blank', 'popup,width=600,height=700')` and listen for `postMessage` with strict origin check.

### HIGH issues that should also be in the same fix-batch

6. **No OAuth token refresh** — `connections.service.ts:127-142`
   Returns expired tokens silently. Add expiry check + refresh with advisory lock to prevent double-refresh races.
7. **Two competing migration systems** — Prisma `migrate deploy` AND `1764000000000-verified-pages.ts` both `ALTER` `workspace_pages`. Remove the data-migration TypeORM-style file; let Prisma own DDL.
8. **`disconnectProvider` swallows all errors** — `connections.service.ts:110-125`. Catch-all returns `false`; client cannot distinguish "not found" from infra failure.
9. **`validateApiKey` fire-and-forget swallow** — `mcp/auth.ts:46-53`. `lastUsedAt` updates silently lost. Log at warn.
10. **MCP key non-constant-time compare** — `mcp/auth.ts:36-45`. Use `crypto.timingSafeEqual` after lookup.
11. **MCP workspace membership not checked for user-scoped keys** — `mcp/controller.ts:92-98`. Add explicit membership check before delegating to provider.
12. **Frontend mutations swallow errors** — `use-doc-verification.ts:56-67`. Wrap in try/catch, expose `error`.
13. **Raw GraphQL `fetch` bypasses typed client** — `connections-setting-panel.tsx:56-154`. No CSRF, no auth-refresh, no codegen, no cache. Use `useQuery`/`useMutation`.
14. **Admin `unverifySelected` toast always says 0** — `verified-pages/use-verified-docs.ts:68-77`. Capture count before clearing selection.
15. **`use-doc-verification.ts` double `any` cast + no loading/error state** — needs `TypedDocumentNode` and `Suspense` boundary in `detail-page-header.tsx:181`.
16. **`ConnectionsSettingPanel` calls `useService` at module-parse time** — `constants.tsx:62-65`. Wrap as factory `() => <ConnectionsSettingPanel />` or it crashes before any workspace mounts.

---

## 3. Feature truth-in-advertising (must address)

| Feature     | What's shipped                                                                                    | What's claimed                                                                        | Action                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Audio block | Recording works (MediaRecorder, blob upload)                                                      | "auto-transcription" in slash menu                                                    | **Hide transcription label** until pipeline exists                                                              |
| Chart block | Bar chart only; AI prompt → `/api/copilot/text`                                                   | "bar/line/pie + AI generation"; on any failure silently substitutes Jan–May demo data | **Show explicit error on AI failure**; remove demo fallback or label it "example"                               |
| List view   | Drag-reorder always drops at end-of-list; "inline edit" opens detail panel                        | "drag-reorder, inline edit"                                                           | **Either implement or rename UI labels**                                                                        |
| Map view    | Leaflet + markercluster loaded from unpkg.com at runtime; geocoding via Nominatim public endpoint | "production map view"                                                                 | **Self-host Leaflet bundle**, add Nominatim fallback or paid geocoder. CDN/rate-limit = single point of failure |

All view presets are **desktop-only** (every `effect.ts` has `TODO: mobile`). Confirm rollout audience or hide on mobile.

---

## 4. SHOULD-FIX next release (not blocking)

- Token encryption key derived from signing key — rotation = data loss. Add key versioning.
- HubSpot `getUserInfo` puts access token in URL path — visible in proxy logs. Use Authorization header.
- OAuth state TTL 3h → 10min.
- `listConnections` GraphQL: confirm workspace membership check (security agent says it's user-scoped only; backend agent flagged the workspaceId arg as unchecked). Pin down which is correct.
- `cmdk.tsx` payload `as { isVerified?: boolean }` cast — type `QuickSearchItem.payload` properly.
- `doc-verified-badge` hardcoded `#1565c0` — switch to `cssVarV2()` for dark mode.
- Memoize `connectedProviders` set in render.
- Admin `(data?.adminVerifiedDocs ?? []) as VerifiedDoc[]` — narrow with codegen type.
- `routes.ts` `RouteParamsTypes` interface — dead code.
- ava config: add `'!node_modules/**'` exclusion.
- Test coverage gaps: token refresh, expiry, callback failures, concurrent `validateApiKey`, FK violations.

---

## 5. E2E test plan

Targeting Playwright (matches the codebase's existing E2E approach). Files under `tests/affine-cloud/e2e/` or equivalent.

### Critical-path smoke (must pass before any deploy)

1. **Auth + workspace boot** — sign in via existing OAuth, create + open a workspace, basic doc edit.
2. **OAuth connection happy path (GitHub)**
   - Open Settings → Integrations → Connections.
   - Click Connect on GitHub. (After fix #5: popup opens.)
   - Complete GitHub OAuth.
   - Verify connection appears in list with correct username.
   - Verify `state` cache key is consumed (regression test for #1).
3. **OAuth connection — state replay rejected** — replay the same `?state=` after success; expect 4xx.
4. **OAuth connection — start endpoint requires auth** — anonymous `GET /api/connections/oauth/github/start` returns 401 (regression for #2).
5. **Disconnect provider** — disconnect, verify token row deleted, GraphQL list reflects.
6. **Workspace deletion cascades** — create workspace, connect provider, delete workspace, assert no orphaned `integration_connections` row (regression for #4).

### Feature smoke (per feature, gated behind feature-flag where possible)

7. **Verified pages**
   - Admin verifies a doc; non-admin sees badge in detail header AND in cmdk results.
   - Admin unverifies; badge disappears.
   - Toast shows correct count after bulk unverify (regression for #14).
8. **MCP API key**
   - Create key, hit MCP endpoint with `Authorization: Bearer <key>` — succeeds.
   - Hit with wrong key — 401, response time within ±5ms of correct length (constant-time, regression for #10).
   - Revoke key, retry — 401.
   - User-scoped key against a workspace the user isn't a member of — 403 (regression for #11).
9. **Calendar view** — drag event to new date, verify `setRowDate` write reflected in DB; multi-day spans render correctly across week boundary.
10. **Form view** — required fields block submit; success path writes a row.
11. **Audio block** — record 5s clip, save, reload, audio plays back (do NOT assert transcription).
12. **Chart block** — `/chart` slash command opens prompt; on AI 500, expect error UI not silent demo data (regression for chart-block deception).
13. **Map view** — pin a row, refresh, pin renders. (Add network-blocked test: with `unpkg.com` blocked, view should degrade gracefully not crash — regression for CDN risk.)

### Migration smoke

14. **Fresh DB → migrate → schema correct** — run `prisma migrate deploy` against an empty Postgres, verify both `integration_connections` and `mcp_api_keys` exist with FKs and indexes; `workspace_pages.verified_at` exists.
15. **Migrate then rollback then re-apply** — reverse migration if possible, re-apply, schema converges. (Confirms #7 pre-fix risk.)

### Load / soak (post-deploy)

16. **OAuth callback under load** — 50 concurrent OAuth flows for the same user; no duplicate `IntegrationConnection` rows (uniqueness on `(workspaceId, provider, providerUserId)` enforced).
17. **MCP key — concurrent validate** — 20 concurrent calls with same key; `lastUsedAt` updated, no DB deadlock.

### Out of scope (separate PR)

- Mobile view smoke (deferred — TODOs everywhere)
- AI image generation (Fal API key required server-side; needs separate config audit)

---

## 6. Recommended deployment plan

1. Land MUST-FIX commits (5 CRITICALs + 11 HIGHs) on a `release/gogocash-v1` branch.
2. Land feature truth-in-advertising changes (hide audio transcription, fix chart fallback, rename list labels, self-host Leaflet).
3. Run E2E smoke (items 1–8, 14) locally + against staging.
4. Push `release/gogocash-v1` → tag → rebuild image → push to Artifact Registry as `affine-gogocash:v1.0.0` (not `:latest`).
5. SSH to VM, update compose to pin the version tag, `docker compose pull && docker compose up -d`.
6. Watch logs for 1h. Have rollback command ready: `sed` compose back to upstream `ghcr.io/toeverything/affine:stable` + `docker compose up -d`.
7. After 24h soak, run E2E items 9–13, 16–17 against production with a test workspace.

Image tag should NOT be `:latest` in production — pin to a digest or semver so rollback is one command.

---

## 7. What stays as-is (low-risk to ship after the must-fix list)

- Form view (most polished new view; production-grade input + validation).
- Verified pages (after frontend fixes #12, #14, #15).
- analyze-with-AI button (clean dynamic-import pattern, fails open).
- Calendar drag-reschedule (real controller, not a stub).
- Connections panel (after CRITICAL #5 + HIGH #13).
