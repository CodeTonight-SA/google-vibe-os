# Googol Vibe - API Enablement
# Required Google APIs for the application

# Enable required APIs
resource "google_project_service" "gmail" {
  project            = local.project_id
  service            = "gmail.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "calendar" {
  project            = local.project_id
  service            = "calendar-json.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "drive" {
  project            = local.project_id
  service            = "drive.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "people" {
  project            = local.project_id
  service            = "people.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "tasks" {
  project            = local.project_id
  service            = "tasks.googleapis.com"
  disable_on_destroy = false
}

# IAM Credentials API (for service accounts if needed)
resource "google_project_service" "iam_credentials" {
  project            = local.project_id
  service            = "iamcredentials.googleapis.com"
  disable_on_destroy = false
}

# Wait for APIs to be enabled before creating OAuth resources
resource "time_sleep" "wait_for_apis" {
  depends_on = [
    google_project_service.gmail,
    google_project_service.calendar,
    google_project_service.drive,
    google_project_service.people,
    google_project_service.tasks,
    google_project_service.iam_credentials,
  ]

  create_duration = "30s"
}
