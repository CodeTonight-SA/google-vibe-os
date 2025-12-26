# Googol Vibe - Terraform Variables
# Input configuration for GCP project setup

variable "project_id" {
  description = "GCP Project ID (must be globally unique)"
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be 6-30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "project_name" {
  description = "Human-readable project name"
  type        = string
  default     = "Googol Vibe"
}

variable "billing_account" {
  description = "GCP Billing Account ID (format: XXXXXX-XXXXXX-XXXXXX)"
  type        = string
  default     = ""
}

variable "org_id" {
  description = "GCP Organisation ID (optional, for org-level projects)"
  type        = string
  default     = ""
}

variable "region" {
  description = "Default GCP region"
  type        = string
  default     = "europe-west2" # London
}

variable "oauth_support_email" {
  description = "Support email for OAuth consent screen (must be a Google account)"
  type        = string
}

variable "oauth_redirect_uri" {
  description = "OAuth redirect URI for desktop app"
  type        = string
  default     = "http://localhost:3000/oauth2callback"
}

variable "test_users" {
  description = "List of test user emails for OAuth (required in testing mode)"
  type        = list(string)
  default     = []
}
