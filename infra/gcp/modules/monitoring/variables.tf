variable "project_id" {
  description = "GCP project id that owns the Manut runtime resources."
  type        = string
}

variable "environment" {
  description = "Environment label used in alert names."
  type        = string
}

variable "notification_channel_ids" {
  description = "Cloud Monitoring notification channel ids. Empty lists are allowed for plan-only previews."
  type        = list(string)
  default     = []
}

variable "enabled" {
  description = "Whether alert policies should be enabled after creation. Keep false for plan-only reviews."
  type        = bool
  default     = false
}

variable "cloud_run_service_name" {
  description = "Cloud Run service name to monitor."
  type        = string
}

variable "cloud_run_region" {
  description = "Cloud Run region to monitor."
  type        = string
  default     = "asia-southeast1"
}

variable "cloud_run_max_instances" {
  description = "Configured max instances for the Cloud Run service."
  type        = number
}

variable "cloud_sql_database_id" {
  description = "Cloud SQL monitored resource database_id, usually project:instance."
  type        = string
}

variable "cloud_sql_connection_threshold" {
  description = "Absolute PostgreSQL backend connection threshold representing 70 percent of capacity."
  type        = number
}

variable "redis_instance_id" {
  description = "Memorystore monitored resource instance id."
  type        = string
}

variable "cloud_run_5xx_ratio_threshold" {
  description = "Allowed ratio of 5xx responses over total Cloud Run requests."
  type        = number
  default     = 0.01
}

variable "cloud_run_p95_latency_ms" {
  description = "Cloud Run p95 request latency threshold in milliseconds."
  type        = number
  default     = 3000
}

variable "cloud_sql_cpu_threshold" {
  description = "Cloud SQL CPU utilization threshold."
  type        = number
  default     = 0.7
}

variable "redis_memory_ratio_threshold" {
  description = "Redis memory usage ratio threshold."
  type        = number
  default     = 0.7
}

variable "vertex_error_threshold" {
  description = "Vertex AI 429/5xx error count threshold over a five-minute window."
  type        = number
  default     = 5
}

variable "vertex_error_metric_type" {
  description = "Operator-confirmed metric type for Vertex/provider 429 and 5xx errors. Leave empty until a provider metric or log-based metric is approved."
  type        = string
  default     = ""
}
