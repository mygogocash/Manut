# Disposition register scaffold

> Links **UI** [`ROUTE_DISPOSITION`](../../ROUTE_DISPOSITION.json) to **API** mounts for migration waves.
> Companion: [`disposition-register.json`](./disposition-register.json).

## UI disposition snapshot

| | |
| --- | --- |
| Source snapshot | `371349fd43fd7c7c7717054beec97bfb023885ca` |
| UI inventory rows | 104 |
| Dispositions | `{'migrate': 79, 'remove-as-provenance': 16, 'replace': 8}` |
| Statuses | `{'foundation': 88, 'pending': 0, 'removed': 16}` |

## How to use

1. Keep UI row outcomes in `docs/ROUTE_DISPOSITION.json` (`migrate` / `replace` / `remove-as-provenance` + status).
2. For each `/api/*` mount in [`express-routes.json`](./express-routes.json), fill `migrationWave`, `runtimeTarget` (`worker` | `container` | `edge` | `retire`), and `d1SchemaOwner` in the JSON register.
3. `uiRoutes` are heuristic links by path segment — review before treating as authoritative.

## Pending rules

- Map each ROUTE_DISPOSITION.targetRoute to one or more /api mounts by product area (e.g. /leave → /api/leave).
- UI disposition migrate/replace/remove-as-provenance does not auto-set API wave; API mounts can outlive removed UI routes (cron, public webhooks).
- Fill migrationWave + runtimeTarget before Phase 1 spikes exit.

## API mounts (scaffold)

Full mount list with heuristic `uiRoutes` is in the JSON companion (`apiMounts[]`). Wave columns start as `null` / `pending` by design.
