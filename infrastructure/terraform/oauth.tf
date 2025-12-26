# Googol Vibe - OAuth Configuration
# OAuth consent screen and client credentials

# OAuth Consent Screen
resource "google_iap_brand" "googol_vibe" {
  support_email     = var.oauth_support_email
  application_title = "Googol Vibe"
  project           = local.project_id

  depends_on = [time_sleep.wait_for_apis]
}

# OAuth 2.0 Client (Desktop Application)
resource "google_iap_client" "googol_vibe_desktop" {
  display_name = "Googol Vibe Desktop"
  brand        = google_iap_brand.googol_vibe.name
}

# Note: Terraform cannot fully configure OAuth consent screen details
# The following must be configured manually in Google Cloud Console:
#
# 1. Go to: https://console.cloud.google.com/apis/credentials/consent
# 2. Set User Type to "External" (or Internal for Workspace)
# 3. Add OAuth scopes:
#    - https://www.googleapis.com/auth/gmail.readonly
#    - https://www.googleapis.com/auth/calendar.readonly
#    - https://www.googleapis.com/auth/drive.readonly
#    - https://www.googleapis.com/auth/tasks.readonly
#    - https://www.googleapis.com/auth/userinfo.profile
#    - https://www.googleapis.com/auth/userinfo.email
# 4. Add test users (required for "Testing" publishing status)
# 5. Save and continue

# Alternative: Create OAuth client via gcloud (more reliable)
# This creates a Desktop application OAuth client
resource "null_resource" "create_oauth_client" {
  depends_on = [time_sleep.wait_for_apis]

  provisioner "local-exec" {
    command = <<-EOT
      gcloud auth application-default set-quota-project ${local.project_id}

      # Check if client already exists
      EXISTING=$(gcloud alpha iap oauth-clients list \
        --project=${local.project_id} \
        --brand=projects/${local.project_id}/brands/${local.project_id} \
        --format="value(name)" 2>/dev/null || echo "")

      if [ -z "$EXISTING" ]; then
        echo "Creating OAuth client..."
        gcloud alpha iap oauth-clients create \
          projects/${local.project_id}/brands/${local.project_id} \
          --display_name="Googol Vibe Desktop"
      else
        echo "OAuth client already exists"
      fi
    EOT
  }

  triggers = {
    project_id = local.project_id
  }
}

# Output instructions for manual steps
output "manual_setup_instructions" {
  value = <<-EOT

    IMPORTANT: Complete these manual steps in Google Cloud Console:

    1. Configure OAuth Consent Screen:
       https://console.cloud.google.com/apis/credentials/consent?project=${local.project_id}

       - User type: External (or Internal for Workspace)
       - Add OAuth scopes (see below)
       - Add test users: ${join(", ", var.test_users)}
       - Publishing status: Testing (or Production after verification)

    2. Download OAuth Credentials:
       https://console.cloud.google.com/apis/credentials?project=${local.project_id}

       - Click on the OAuth 2.0 Client ID
       - Download JSON
       - Save as ~/.googol-vibe/credentials.json

    Required OAuth Scopes:
    - https://www.googleapis.com/auth/gmail.readonly
    - https://www.googleapis.com/auth/calendar.readonly
    - https://www.googleapis.com/auth/drive.readonly
    - https://www.googleapis.com/auth/tasks.readonly
    - https://www.googleapis.com/auth/userinfo.profile
    - https://www.googleapis.com/auth/userinfo.email

  EOT
}
