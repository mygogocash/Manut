terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = "affine-495114"
  region  = "asia-southeast1"
}

module "monitoring" {
  source = "../../modules/monitoring"

  project_id               = "affine-495114"
  environment              = "staging"
  enabled                  = false
  notification_channel_ids = []

  cloud_run_service_name  = "manut-staging"
  cloud_run_region        = "asia-southeast1"
  cloud_run_max_instances = 5

  cloud_sql_database_id          = "affine-495114:manut-staging-postgres"
  cloud_sql_connection_threshold = 70
  redis_instance_id              = "manut-staging-redis"
  vertex_error_threshold         = 5
}
