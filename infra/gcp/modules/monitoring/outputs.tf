output "alert_policy_names" {
  description = "Alert policy display names created by this module."
  value = concat(
    [
      google_monitoring_alert_policy.cloud_run_5xx_ratio.display_name,
      google_monitoring_alert_policy.cloud_run_p95_latency.display_name,
      google_monitoring_alert_policy.cloud_run_max_instances.display_name,
      google_monitoring_alert_policy.cloud_sql_cpu.display_name,
      google_monitoring_alert_policy.cloud_sql_connections.display_name,
      google_monitoring_alert_policy.redis_memory.display_name,
    ],
    [for policy in google_monitoring_alert_policy.vertex_errors : policy.display_name]
  )
}
