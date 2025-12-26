# Googol Vibe - Terraform Main Configuration
# GCP Project Setup for OAuth Desktop Application

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Create GCP Project (optional - use existing project if already created)
resource "google_project" "googol_vibe" {
  count = var.billing_account != "" ? 1 : 0

  name            = var.project_name
  project_id      = var.project_id
  billing_account = var.billing_account
  org_id          = var.org_id != "" ? var.org_id : null

  lifecycle {
    prevent_destroy = true
  }
}

# Wait for project to be ready
resource "time_sleep" "wait_for_project" {
  count = var.billing_account != "" ? 1 : 0

  depends_on      = [google_project.googol_vibe]
  create_duration = "30s"
}

locals {
  project_id = var.billing_account != "" ? google_project.googol_vibe[0].project_id : var.project_id
}
