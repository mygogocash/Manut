locals {
  alert_prefix             = "Manut ${var.environment}"
  vertex_error_alert_count = var.vertex_error_metric_type == "" ? 0 : 1
  user_labels = {
    app         = "manut"
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_monitoring_alert_policy" "cloud_run_5xx_ratio" {
  project      = var.project_id
  display_name = "${local.alert_prefix} Cloud Run 5xx ratio"
  combiner     = "OR"
  enabled      = var.enabled
  user_labels  = local.user_labels

  notification_channels = var.notification_channel_ids

  documentation {
    mime_type = "text/markdown"
    content   = "Cloud Run 5xx ratio exceeded 1 percent for 5 minutes. Check service logs, recent deploys, GraphQL errors, and rollback target."
  }

  conditions {
    display_name = "5xx responses / total responses > ${var.cloud_run_5xx_ratio_threshold}"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type = \"cloud_run_revision\"",
        "resource.label.service_name = \"${var.cloud_run_service_name}\"",
        "resource.label.location = \"${var.cloud_run_region}\"",
        "metric.type = \"run.googleapis.com/request_count\"",
        "metric.label.response_code_class = \"5xx\"",
      ])
      denominator_filter = join(" AND ", [
        "resource.type = \"cloud_run_revision\"",
        "resource.label.service_name = \"${var.cloud_run_service_name}\"",
        "resource.label.location = \"${var.cloud_run_region}\"",
        "metric.type = \"run.googleapis.com/request_count\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = var.cloud_run_5xx_ratio_threshold
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.label.service_name"]
      }

      denominator_aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.label.service_name"]
      }

      trigger {
        count = 1
      }
    }
  }
}

resource "google_monitoring_alert_policy" "cloud_run_p95_latency" {
  project      = var.project_id
  display_name = "${local.alert_prefix} Cloud Run p95 latency"
  combiner     = "OR"
  enabled      = var.enabled
  user_labels  = local.user_labels

  notification_channels = var.notification_channel_ids

  documentation {
    mime_type = "text/markdown"
    content   = "Cloud Run p95 latency exceeded the launch threshold. Inspect request mix, AI streaming traffic, Cloud SQL latency, and instance saturation."
  }

  conditions {
    display_name = "p95 request latency > ${var.cloud_run_p95_latency_ms}ms"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type = \"cloud_run_revision\"",
        "resource.label.service_name = \"${var.cloud_run_service_name}\"",
        "resource.label.location = \"${var.cloud_run_region}\"",
        "metric.type = \"run.googleapis.com/request_latencies\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = var.cloud_run_p95_latency_ms
      duration        = "600s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["resource.label.service_name"]
      }

      trigger {
        count = 1
      }
    }
  }
}

resource "google_monitoring_alert_policy" "cloud_run_max_instances" {
  project      = var.project_id
  display_name = "${local.alert_prefix} Cloud Run max instances"
  combiner     = "OR"
  enabled      = var.enabled
  user_labels  = local.user_labels

  notification_channels = var.notification_channel_ids

  documentation {
    mime_type = "text/markdown"
    content   = "Cloud Run instance count is at the configured max for 10 minutes. Check queueing, concurrency, Cloud SQL connection budget, and Vertex latency before raising limits."
  }

  conditions {
    display_name = "instance count >= ${var.cloud_run_max_instances}"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type = \"cloud_run_revision\"",
        "resource.label.service_name = \"${var.cloud_run_service_name}\"",
        "resource.label.location = \"${var.cloud_run_region}\"",
        "metric.type = \"run.googleapis.com/container/instance_count\"",
      ])
      comparison      = "COMPARISON_GE"
      threshold_value = var.cloud_run_max_instances
      duration        = "600s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.label.service_name"]
      }

      trigger {
        count = 1
      }
    }
  }
}

resource "google_monitoring_alert_policy" "cloud_sql_cpu" {
  project      = var.project_id
  display_name = "${local.alert_prefix} Cloud SQL CPU"
  combiner     = "OR"
  enabled      = var.enabled
  user_labels  = local.user_labels

  notification_channels = var.notification_channel_ids

  documentation {
    mime_type = "text/markdown"
    content   = "Cloud SQL CPU exceeded 70 percent for 15 minutes. Inspect slow queries, connection count, and current deploy."
  }

  conditions {
    display_name = "Cloud SQL CPU > ${var.cloud_sql_cpu_threshold}"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type = \"cloudsql_database\"",
        "resource.label.database_id = \"${var.cloud_sql_database_id}\"",
        "metric.type = \"cloudsql.googleapis.com/database/cpu/utilization\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = var.cloud_sql_cpu_threshold
      duration        = "900s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger {
        count = 1
      }
    }
  }
}

resource "google_monitoring_alert_policy" "cloud_sql_connections" {
  project      = var.project_id
  display_name = "${local.alert_prefix} Cloud SQL connections"
  combiner     = "OR"
  enabled      = var.enabled
  user_labels  = local.user_labels

  notification_channels = var.notification_channel_ids

  documentation {
    mime_type = "text/markdown"
    content   = "PostgreSQL backend connections exceeded the configured launch threshold. Check Cloud Run concurrency, Prisma pooling, and connection leaks."
  }

  conditions {
    display_name = "PostgreSQL backends > ${var.cloud_sql_connection_threshold}"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type = \"cloudsql_database\"",
        "resource.label.database_id = \"${var.cloud_sql_database_id}\"",
        "metric.type = \"cloudsql.googleapis.com/database/postgresql/num_backends\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = var.cloud_sql_connection_threshold
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MAX"
      }

      trigger {
        count = 1
      }
    }
  }
}

resource "google_monitoring_alert_policy" "redis_memory" {
  project      = var.project_id
  display_name = "${local.alert_prefix} Redis memory"
  combiner     = "OR"
  enabled      = var.enabled
  user_labels  = local.user_labels

  notification_channels = var.notification_channel_ids

  documentation {
    mime_type = "text/markdown"
    content   = "Redis memory usage exceeded 70 percent. Inspect queue depth, cache churn, and eviction behavior."
  }

  conditions {
    display_name = "Redis memory ratio > ${var.redis_memory_ratio_threshold}"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type = \"redis_instance\"",
        "resource.label.instance_id = \"${var.redis_instance_id}\"",
        "metric.type = \"redis.googleapis.com/stats/memory/usage_ratio\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = var.redis_memory_ratio_threshold
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger {
        count = 1
      }
    }
  }
}

resource "google_monitoring_alert_policy" "vertex_errors" {
  count        = local.vertex_error_alert_count
  project      = var.project_id
  display_name = "${local.alert_prefix} Vertex AI errors"
  combiner     = "OR"
  enabled      = var.enabled
  user_labels  = local.user_labels

  notification_channels = var.notification_channel_ids

  documentation {
    mime_type = "text/markdown"
    content   = "Vertex AI 429/5xx errors exceeded the launch threshold. Check quota, model routing, region-specific Anthropic Vertex errors, and retry behavior."
  }

  conditions {
    display_name = "Vertex prediction errors > ${var.vertex_error_threshold}"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type = \"${var.vertex_error_metric_type}\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = var.vertex_error_threshold
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_SUM"
      }

      trigger {
        count = 1
      }
    }
  }
}
