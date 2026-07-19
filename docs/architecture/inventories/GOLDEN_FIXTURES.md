# Golden fixtures list (Epic 0.3 scaffold)

> Capture checklist — **no fixtures captured in this PR**; scaffold only.
> Companion: [`golden-fixtures.json`](./golden-fixtures.json).

Links UI disposition: [`docs/ROUTE_DISPOSITION.json`](../../ROUTE_DISPOSITION.json).

## Categories

| ID | Task | Status |
| --- | --- | --- |
| `api-openapi` | OpenAPI fixtures + golden API responses for every critical route | `pending` |
| `db-type-patterns` | PII-safe representative rows per PostgreSQL type pattern | `pending` |
| `business-invariants` | Finance totals, approval state, payroll, attendance TZ, owner scope, soft delete | `pending` |
| `documents` | Golden documents, spreadsheets, PDFs | `pending` |
| `realtime-email-ai` | Realtime sequences, emails, AI evaluations | `pending` |
| `latency-baseline` | p50/p95/p99 latency, error rate, journey timing | `pending` |
| `provenance-secret-scan` | Provenance and secret scans on baseline artifact | `pending` |

## Critical API mounts (seed for OpenAPI/golden responses)

- `/api/auth`
- `/api/leave`
- `/api/expenses`
- `/api/cash-advance`
- `/api/payroll`
- `/api/travel`
- `/api/projects`
- `/api/investors`
- `/api/uploads`
- `/api/integrations`

Each critical write should cover: happy path, authorization denial, conflict, retry, unknown outcome.

## UI foundation routes (parity fixture candidates)

First 40 `foundation` target routes from `ROUTE_DISPOSITION` are listed in the JSON companion (`uiFoundationRoutesForParityFixtures`). Expand to full set when capturing.

## Acceptance pointer

Master plan Phase 0: golden fixtures cover happy / authz-deny / conflict / retry / unknown-outcome for critical writes; email template keys have parity fixtures once dispositions are signed.
