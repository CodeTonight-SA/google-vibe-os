# Googol Vibe - Terraform GCP Setup

Automated Google Cloud Platform infrastructure for Googol Vibe.

## Prerequisites

1. [Terraform](https://www.terraform.io/downloads) >= 1.0.0
2. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
3. A Google Cloud account with billing enabled

## Quick Start

### 1. Authenticate with Google Cloud

```bash
gcloud auth login
gcloud auth application-default login
```

### 2. Create terraform.tfvars

```hcl
project_id          = "googol-vibe-yourname"  # Must be globally unique
oauth_support_email = "your-email@gmail.com"
test_users          = ["your-email@gmail.com"]

# Optional: Create new project (requires billing account)
# billing_account = "XXXXXX-XXXXXX-XXXXXX"
```

### 3. Run Terraform

```bash
terraform init
terraform plan
terraform apply
```

### 4. Complete Manual Steps

Terraform automates most of the setup, but some steps require manual action:

#### Configure OAuth Consent Screen

1. Open the URL from `consent_screen_url` output
2. Set **User type** to "External"
3. Add the OAuth scopes listed in the output
4. Add your email to **Test users**
5. Save

#### Download Credentials

1. Open the URL from `credentials_download_url` output
2. Click on the OAuth 2.0 Client ID
3. Click **Download JSON**
4. Save as `~/.googol-vibe/credentials.json`

```bash
mkdir -p ~/.googol-vibe
mv ~/Downloads/client_secret_*.json ~/.googol-vibe/credentials.json
```

## Using Existing Project

If you already have a GCP project:

```hcl
# terraform.tfvars
project_id          = "your-existing-project-id"
oauth_support_email = "your-email@gmail.com"
test_users          = ["your-email@gmail.com"]

# Don't set billing_account - this prevents project creation
```

## Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `project_id` | Yes | GCP Project ID (globally unique) |
| `oauth_support_email` | Yes | Email for OAuth consent screen |
| `test_users` | No | List of test user emails |
| `billing_account` | No | Billing account ID (creates new project) |
| `org_id` | No | Organisation ID |
| `region` | No | Default region (default: europe-west2) |

## Outputs

After `terraform apply`:

- `project_id` - Your GCP project ID
- `credentials_download_url` - URL to download OAuth credentials
- `consent_screen_url` - URL to configure OAuth consent
- `env_file_content` - Template for .env file

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Note**: This will NOT delete the GCP project itself (protected by lifecycle rule).

## Troubleshooting

### "Permission denied" errors

Ensure you've authenticated:

```bash
gcloud auth application-default login
```

### "Billing account not found"

Either:
- Set up billing in Console first
- Or use an existing project (don't set `billing_account`)

### OAuth client not created

Try creating manually:

```bash
gcloud alpha iap oauth-clients create \
  projects/YOUR_PROJECT_ID/brands/YOUR_PROJECT_ID \
  --display_name="Googol Vibe Desktop"
```

## Security Notes

- `terraform.tfvars` contains sensitive data - add to `.gitignore`
- Never commit `credentials.json` or OAuth secrets
- Use "Testing" mode for development (no verification required)
