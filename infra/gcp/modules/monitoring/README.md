# Manut Monitoring Module

Terraform-ready Cloud Monitoring alert templates for the Manut Cloud Run stack.
These files are intentionally repo-only until a launch operator supplies real
notification channel ids, confirms monitored resource names, and reviews a
`terraform plan`.

## Alerts

- Cloud Run 5xx ratio above 1 percent for 5 minutes.
- Cloud Run p95 request latency above 3 seconds for 10 minutes.
- Cloud Run instance count at max for 10 minutes.
- Cloud SQL CPU above 70 percent for 15 minutes.
- Cloud SQL PostgreSQL connection count above the configured threshold.
- Redis memory ratio above 70 percent.
- Vertex AI prediction/provider 429 and 5xx errors above the configured
  threshold, once `vertex_error_metric_type` is set to an operator-approved
  metric or log-based metric.

## Operator Inputs

Required before applying:

- `notification_channel_ids`
- confirmed Cloud Run service and region
- confirmed Cloud SQL monitored resource id
- confirmed Redis instance id
- Vertex/provider error metric type for the project and region actually used in
  prod

Do not apply this module directly. Use the environment wrapper under
`infra/gcp/envs/<env>` after reviewing the plan output.
