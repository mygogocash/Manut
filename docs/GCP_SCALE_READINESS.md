# Manut GCP Scale Readiness

**Planning window:** 1,000 users in 3 months, 10,000 users in 6 months  
**Assumption:** these are registered users, not simultaneous active users  
**Platform target:** Cloud Run, Cloud SQL PostgreSQL, Memorystore Redis,
Vertex AI, Secret Manager, Cloud Build

## Capacity Model

Track these numbers weekly:

| Metric                          | Why it matters                                       |
| ------------------------------- | ---------------------------------------------------- |
| Registered users                | Growth baseline.                                     |
| Daily active users              | Better sizing signal than registered users.          |
| Peak concurrent logged-in users | Drives Cloud Run and WebSocket pressure.             |
| Peak HTTP requests per second   | Drives Cloud Run max instances and concurrency.      |
| Peak AI requests per minute     | Drives Vertex quota and AI budget controls.          |
| Cloud SQL active connections    | Main autoscale bottleneck.                           |
| Cloud SQL CPU and lock wait     | Shows when queries or migrations are the bottleneck. |
| Redis memory and ops/sec        | Sessions, streams, queues, and cache pressure.       |
| p95 and p99 latency             | User experience and overload signal.                 |
| HTTP 5xx rate                   | Release and capacity signal.                         |
| Vertex 429/5xx count            | Quota and provider health signal.                    |

## 3-Month Target: 1,000 Users

Start conservative and measure.

| Component             | Starting point                                            |
| --------------------- | --------------------------------------------------------- |
| Cloud Run service     | min 1, max 10 to 20                                       |
| Container resources   | 2 vCPU, 2 to 4 GiB                                        |
| Concurrency           | 20 to 40 until load tested                                |
| Request timeout       | 15 minutes minimum for AI streaming; raise only if needed |
| Cloud SQL             | 2 vCPU, 8 GiB, automated backups, PITR                    |
| Cloud SQL connections | Keep app pool small; budget max instances times pool size |
| Redis                 | Memorystore Standard, 1 to 5 GiB                          |
| AI guardrail          | Per-user and per-workspace rate limits                    |
| Observability         | Cloud Logging, Cloud Monitoring alerts, uptime check      |

Required before reaching this tier:

- Cloud Run service max instances configured.
- Startup migrations disabled on service.
- Migration job required for every deploy.
- AI usage table or budget cap active.
- Vertex quota dashboard watched.
- One load test against staging.

## 6-Month Target: 10,000 Users

At this tier, uncontrolled autoscaling becomes risky because the database and
AI providers are shared bottlenecks.

| Component           | Target range                                                          |
| ------------------- | --------------------------------------------------------------------- |
| Cloud Run service   | min 2 to 4, max 50 to 100 after load testing                          |
| Container resources | 2 to 4 vCPU, 4 to 8 GiB                                               |
| Concurrency         | 20 to 80 based on CPU and latency curves                              |
| Cloud SQL           | 4 to 8 vCPU, 16 to 32 GiB, HA                                         |
| Connection pooling  | Required before max instances above 20                                |
| Read replica        | Add if docs list/search/reporting reads dominate                      |
| Redis               | Memorystore Standard, 5 to 10 GiB                                     |
| Background work     | Imports, indexing, embeddings, export, and sync jobs off request path |
| AI traffic          | Queue or throttle expensive models; request Vertex quota early        |
| CDN                 | Move static assets and public landing assets to Cloud CDN if needed   |

Required before this tier:

- Load test with target RPS and target AI concurrency.
- Cloud SQL slow-query review.
- Connection pool strategy chosen and tested.
- Queue-based background worker design in place.
- Alert playbook for max instance saturation.
- Vertex provisioned throughput or quota plan reviewed.
- Cost alerts for Cloud Run, Cloud SQL, Redis, and Vertex.

## Autoscaling Guardrail

Use this budget before increasing Cloud Run max instances:

```text
max_db_connections_needed =
  cloud_run_max_instances * app_pool_size_per_instance
  + migration_job_connections
  + admin/manual_connections
  + safety_buffer
```

If the result is near the Cloud SQL connection limit, do not raise max
instances. Lower app pool size, add pooling, or increase Cloud SQL first.

## AI Guardrail

Default routing should remain cost-aware:

- Gemini Flash for short text and general chat.
- Gemini Pro for long-context work.
- Claude Sonnet for higher-quality reasoning and code/doc work.
- Opus only for explicit high-complexity tasks.
- Haiku-class models for high-volume low-latency work when direct provider
  support exists.

Operational controls:

- Per-user requests per minute.
- Per-workspace daily spend cap.
- Expensive-model allowlist for beta users.
- Retry with backoff for 429.
- Friendly fallback when a provider is over quota.
- Separate metrics for Gemini, Anthropic Vertex, and Model Garden MaaS.

## Background Jobs

Move these off the web request path before 10,000 users:

- document import and export
- large file processing
- embeddings and memory indexing
- scheduled reminders
- analytics rollups
- third-party sync
- long-running AI workflows

Preferred GCP primitives:

- Cloud Tasks for user-triggered jobs that need retry and ordering.
- Pub/Sub for fanout and event streams.
- Cloud Run worker services for queue consumers.
- Cloud Run Jobs for one-off migrations and batch maintenance.

## Load Test Plan

Run this in staging first:

1. Warm one revision with min instances 1.
2. Test `/info`, `/api/server-config`, workspace load, and AI send paths.
3. Increase RPS in small steps.
4. Record p95, p99, CPU, memory, instance count, Cloud SQL connections, Redis
   ops/sec, and Vertex errors.
5. Repeat with AI streaming traffic because long requests consume concurrency
   differently from short HTTP requests.

Stop the test if:

- 5xx rate exceeds 1 percent.
- Cloud SQL connections exceed 70 percent of cap.
- p95 stays above 3 seconds for 10 minutes.
- Cloud Run reaches max instances and queueing begins.
- Vertex 429s persist after backoff.

Repo template:

```bash
DRY_RUN=1 BASE_URL=https://staging.manut.xyz scripts/gcp/load-test-staging.sh
```

The template is dry-run-first and requires `BASE_URL` for real runs:

```bash
DRY_RUN=0 BASE_URL=https://staging.manut.xyz scripts/gcp/load-test-staging.sh
```

Defaults are intentionally low impact: `RPS=1`, `CONCURRENCY=2`,
`DURATION_SECONDS=60`, and `PATHS="/info /api/server-config"`. The implemented
execution path uses `curl` only, prints the exact optional `autocannon` and
`k6` follow-up expectations, and enforces local stop conditions for request
failure rate and sample p95 latency. Operator-only stop conditions still need
Cloud Monitoring during the run: Cloud SQL connection cap, Cloud Run max
instance queueing, Redis health, and Vertex 429s.

The script refuses a real run against `https://manut.xyz` unless
`ALLOW_PROD_LOAD_TEST=1` is set for an approved production test window. Keep the
first real run on staging. Add authenticated workspace or AI paths only after a
staging test account, provider quota, and rollback window are confirmed.

## Operational Checklist

Weekly:

- Review Cloud Run instance count and max saturation.
- Review Cloud SQL slow queries and connection usage.
- Review Redis memory.
- Review top AI users and workspaces.
- Review Vertex 429 and spend.

Before every launch push:

- Confirm `manut-migrate` passed.
- Confirm service has `MANUT_RUN_STARTUP_MIGRATIONS=false`.
- Confirm smoke script passed.
- Confirm rollback target still exists.

Before increasing max instances:

- Calculate DB connection budget.
- Check Cloud SQL CPU.
- Run a staging load test.
- Confirm alerts are active.

## Primary References

- Cloud Run max instances: https://cloud.google.com/run/docs/configuring/max-instances
- Cloud Run min instances: https://cloud.google.com/run/docs/configuring/min-instances
- Cloud Run concurrency: https://cloud.google.com/run/docs/about-concurrency
- Cloud Run WebSockets and streaming: https://docs.cloud.google.com/run/docs/triggering/websockets
- Cloud Run load testing: https://docs.cloud.google.com/run/docs/about-load-testing
- Cloud SQL connection pooling: https://docs.cloud.google.com/sql/docs/postgres/managed-connection-pooling
- Vertex AI quotas and throughput: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/resources/throughput-quota
