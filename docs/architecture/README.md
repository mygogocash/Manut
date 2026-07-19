# Architecture artifacts (Phase 1+)

Forward-looking design and gate evidence for the Expo → Cloudflare retirement.
Authoritative product/commercial narrative remains
[`docs/EXPO_CLOUDFLARE_MASTER_PLAN.md`](../EXPO_CLOUDFLARE_MASTER_PLAN.md).

| Artifact | Purpose | Master-plan anchor |
| -------- | ------- | ------------------ |
| [`cost-model/`](./cost-model/) | Versioned rates, scenarios, generated reports for the 3,000–6,000 THB/org/year envelope | §3.3–3.5, Epic 1.5 load-test input |
| [`d1-money-approval-concurrency-spike.md`](./d1-money-approval-concurrency-spike.md) | Epic 1.3 money/approval concurrency spike design | §8.3, Epic 1.3, Phase 1 AC |
| [`wfp-two-tenant-isolation-checklist.md`](./wfp-two-tenant-isolation-checklist.md) | Epic 1.5 Workers for Platforms two-tenant isolation | Epic 1.5, Phase 1 AC |

## Related GitHub tracking (P0/P1 ops after PR #229)

These issues are the live ops/product backlog on `mygogocash/Manut`. Architecture
spikes above do **not** close them; link them when topology, auth, or product
freeze blocks measured cost/isolation evidence.

| Issue | Title | Relevance here |
| ----- | ----- | -------------- |
| [#230](https://github.com/mygogocash/Manut/issues/230) | Distinct Express `API_ORIGIN` per environment | Topology before honest preview load signals |
| [#231](https://github.com/mygogocash/Manut/issues/231) | Application-session `AUTH_JWKS_*` | Auth plane before tenant Worker evidence |
| [#232](https://github.com/mygogocash/Manut/issues/232) | Pause production Workers Builds on Worker `manut` | Deploy ownership before WfP rollout experiments |
| [#233](https://github.com/mygogocash/Manut/issues/233) | Isolate `manut-preview` from production Worker | Precursor isolation posture before WfP two-tenant proof |
| [#234](https://github.com/mygogocash/Manut/issues/234) | First-admin bootstrap with live secrets | Pilot tenant bootstrap (ops-owned) |
| [#235](https://github.com/mygogocash/Manut/issues/235) | Bind Hyperdrive before dual-path flag | Transitional data plane until D1 cutover |
| [#236](https://github.com/mygogocash/Manut/issues/236) | Freeze `/expenses-v1` disposition + ingest ADR-009 | P1 product scope that affects commercial/cost assumptions |
| [#237](https://github.com/mygogocash/Manut/issues/237) | Harden CI protection truth | Process gate for architecture evidence PRs |
| [#238](https://github.com/mygogocash/Manut/issues/238) | Provision `E2E_*` + hosted Playwright project | Optional e2e surface for later isolation journeys |
| [#239](https://github.com/mygogocash/Manut/issues/239) | P0 Expo retirement ops backlog (umbrella) | Parent tracker for #230–#238 |

Umbrella: [#239](https://github.com/mygogocash/Manut/issues/239).
