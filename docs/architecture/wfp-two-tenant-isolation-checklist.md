# Epic 1.5 — Workers for Platforms two-tenant isolation checklist

**Status:** Checklist scaffold (no production WfP commitment)  
**Master plan:** Epic 1.5, Phase 1 AC (“Two preview tenants have zero cross-tenant access”)  
**Cost link:** [`cost-model/`](./cost-model/) (confirm $25/month WfP fixed fee; load-test feeds scenarios)

## Goal

Provision a **preview** dispatch namespace and **two** User Workers from the same
template, each bound to a **different** tenant D1, and prove neither can
name/query the other’s data or invoke the other’s privileged bindings.

## Preconditions (ops / topology)

Do not claim WfP isolation while preview still shares the production Worker.

| Check | Issue | Done |
| ----- | ----- | ---- |
| Distinct Express `API_ORIGIN` per environment (not Worker self) | [#230](https://github.com/mygogocash/Manut/issues/230) | [ ] |
| `manut-preview` isolated from production Worker `manut` | [#233](https://github.com/mygogocash/Manut/issues/233) | [ ] |
| Application-session JWKS fail-closed where required | [#231](https://github.com/mygogocash/Manut/issues/231) | [ ] |
| Production Workers Builds pause understood (deploy ownership) | [#232](https://github.com/mygogocash/Manut/issues/232) | [ ] |
| Umbrella awareness | [#239](https://github.com/mygogocash/Manut/issues/239) | [ ] |

Hyperdrive [#235](https://github.com/mygogocash/Manut/issues/235) and first-admin
[#234](https://github.com/mygogocash/Manut/issues/234) remain coexistence concerns;
WfP tenant Workers must not inherit “shared DB” habits from the Express era.

## Provisioning checklist (preview only)

- [ ] Preview dispatch namespace created (name recorded in private ops notes — not secrets in git)
- [ ] Tenant User Worker template pinned (same script/bindings shape for both tenants)
- [ ] User Worker `tenant-a-preview` deployed from template
- [ ] User Worker `tenant-b-preview` deployed from template
- [ ] D1 `tenant_a_preview` created and bound **only** to `tenant-a-preview`
- [ ] D1 `tenant_b_preview` created and bound **only** to `tenant-b-preview`
- [ ] Gateway / dispatch maps opaque tenant runtime name → correct User Worker
- [ ] Neither User Worker binding list includes the other tenant’s D1
- [ ] Control-plane preview D1 holds membership/routing only (no CRM rows)

## Isolation proof matrix

| # | Test | Pass criteria | Evidence link |
| - | ---- | ------------- | ------------- |
| I1 | Authenticated tenant-A session hits tenant-A Worker | 2xx on A-owned resource | |
| I2 | Same credentials/session cannot read tenant-B resource by id | 403/404; zero B rows returned | |
| I3 | Forged `X-Tenant` / body `organizationId` cannot switch D1 | Ignored or rejected; server uses control-plane mapping only | |
| I4 | Tenant-A Worker script attempts to open B’s D1 binding name | Binding absent; hard fail | |
| I5 | SQL/query with B’s ids executed on A’s D1 | Empty/not found; no cross-DB attach | |
| I6 | R2 object key from B requested via A Worker | Denied (metadata + object ACL) | |
| I7 | Observability/logs redaction | No foreign tenant payloads in A’s log export | |
| I8 | Custom limits / CPU ceiling per User Worker | Documented; abuse on A does not exhaust B’s quota class | |
| I9 | Version rollout + rollback of A template | B unchanged; A rollback restores prior | |

## Cost-model hooks

- [ ] Confirm WfP **$25/month** fixed fee still current; update
      `cost-model/rates.yaml` source URL + `effective_as_of` (not a fake sign-off)
- [ ] After load-test, populate Low/Base/High measured signals into
      `cost-model/scenarios.yaml` and regenerate placeholders via
      `node scripts/generate-cost-model-report.mjs`
- [ ] Preserve reviewed commit SHA for Phase 2 gate **only after**
      [`cost-model/SIGN-OFF.md`](./cost-model/SIGN-OFF.md) is completed by humans

Related commercial/product trackers:
[#236](https://github.com/mygogocash/Manut/issues/236),
[#239](https://github.com/mygogocash/Manut/issues/239).
Optional e2e later: [#238](https://github.com/mygogocash/Manut/issues/238).
CI process: [#237](https://github.com/mygogocash/Manut/issues/237).

## Anti-patterns

- One shared D1 “with `tenant_id` column” for WfP User Workers
- Client-supplied tenant Worker name trusted at the edge
- Calling isolation “done” because preview hostname differs while both map to production Worker ([#233](https://github.com/mygogocash/Manut/issues/233))
- Writing production WfP resources from an agent session without ops approval

## Rollback

Delete preview dispatch namespace, User Workers, and preview tenant D1s only.
Production remains unchanged.
