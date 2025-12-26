#!/bin/bash
# Googol Vibe - GCP Setup Script
# Automates Google Cloud Platform configuration for the application

set -e

# Colours
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Colour

# Configuration
GOOGOL_VIBE_DIR="${HOME}/.googol-vibe"
CREDENTIALS_FILE="${GOOGOL_VIBE_DIR}/credentials.json"
TERRAFORM_DIR="$(dirname "$0")/../infrastructure/terraform"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                     Googol Vibe Setup                        ║"
echo "║              Google Cloud Platform Configuration             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"

    # Check gcloud
    if ! command -v gcloud &> /dev/null; then
        echo -e "${RED}Error: gcloud CLI not found${NC}"
        echo "Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} gcloud CLI installed"

    # Check Terraform (optional)
    if command -v terraform &> /dev/null; then
        echo -e "${GREEN}✓${NC} Terraform installed"
        TERRAFORM_AVAILABLE=true
    else
        echo -e "${YELLOW}!${NC} Terraform not installed (optional for automated setup)"
        TERRAFORM_AVAILABLE=false
    fi

    # Check gcloud authentication
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -n1; then
        echo -e "${YELLOW}Not authenticated with gcloud. Starting authentication...${NC}"
        gcloud auth login
    fi
    echo -e "${GREEN}✓${NC} Authenticated with Google Cloud"
}

# Create Googol Vibe directory
create_directories() {
    echo -e "\n${BLUE}Creating directories...${NC}"
    mkdir -p "${GOOGOL_VIBE_DIR}"
    mkdir -p "${GOOGOL_VIBE_DIR}/tokens"
    echo -e "${GREEN}✓${NC} Created ${GOOGOL_VIBE_DIR}"
}

# Get or create project
setup_project() {
    echo -e "\n${BLUE}Project Setup${NC}"

    echo "Do you have an existing GCP project?"
    echo "  1) Yes, use existing project"
    echo "  2) No, create a new project"
    read -p "Choice [1]: " project_choice
    project_choice=${project_choice:-1}

    if [ "$project_choice" == "1" ]; then
        # List existing projects
        echo -e "\n${BLUE}Your GCP projects:${NC}"
        gcloud projects list --format="table(projectId,name)" 2>/dev/null | head -20

        read -p "Enter project ID: " PROJECT_ID
    else
        # Create new project
        read -p "Enter new project ID (globally unique, lowercase): " PROJECT_ID
        read -p "Enter project name [Googol Vibe]: " PROJECT_NAME
        PROJECT_NAME=${PROJECT_NAME:-"Googol Vibe"}

        echo -e "\n${YELLOW}Creating project ${PROJECT_ID}...${NC}"
        gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME" || {
            echo -e "${RED}Failed to create project. It may already exist or ID is taken.${NC}"
            exit 1
        }
        echo -e "${GREEN}✓${NC} Project created"

        # Link billing (optional)
        echo -e "\n${YELLOW}Note: APIs require billing to be enabled.${NC}"
        read -p "Link billing account? [y/N]: " link_billing
        if [[ "$link_billing" =~ ^[Yy]$ ]]; then
            echo "Available billing accounts:"
            gcloud billing accounts list --format="table(name,displayName)"
            read -p "Enter billing account ID: " BILLING_ID
            gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ID"
            echo -e "${GREEN}✓${NC} Billing linked"
        fi
    fi

    # Set as current project
    gcloud config set project "$PROJECT_ID"
    echo -e "${GREEN}✓${NC} Using project: ${PROJECT_ID}"
}

# Enable APIs
enable_apis() {
    echo -e "\n${BLUE}Enabling required APIs...${NC}"

    APIS=(
        "gmail.googleapis.com"
        "calendar-json.googleapis.com"
        "drive.googleapis.com"
        "people.googleapis.com"
        "tasks.googleapis.com"
    )

    for api in "${APIS[@]}"; do
        echo -n "  Enabling ${api}... "
        gcloud services enable "$api" --quiet 2>/dev/null && echo -e "${GREEN}✓${NC}" || echo -e "${YELLOW}(already enabled)${NC}"
    done
}

# Create OAuth credentials
setup_oauth() {
    echo -e "\n${BLUE}OAuth Setup${NC}"

    # Check if OAuth consent screen exists
    echo -e "${YELLOW}Note: OAuth consent screen must be configured manually.${NC}"
    echo ""
    echo "1. Open: https://console.cloud.google.com/apis/credentials/consent?project=${PROJECT_ID}"
    echo "2. Select 'External' user type"
    echo "3. Fill in app name: 'Googol Vibe'"
    echo "4. Add your email as support email"
    echo "5. Add OAuth scopes:"
    echo "   - .../auth/gmail.readonly"
    echo "   - .../auth/calendar.readonly"
    echo "   - .../auth/drive.readonly"
    echo "   - .../auth/tasks.readonly"
    echo "   - .../auth/userinfo.profile"
    echo "   - .../auth/userinfo.email"
    echo "6. Add your email to test users"
    echo "7. Save and continue"
    echo ""
    read -p "Press Enter when done..."

    # Create OAuth client
    echo -e "\n${BLUE}Creating OAuth client...${NC}"
    echo ""
    echo "1. Open: https://console.cloud.google.com/apis/credentials?project=${PROJECT_ID}"
    echo "2. Click '+ CREATE CREDENTIALS' → 'OAuth client ID'"
    echo "3. Application type: 'Desktop app'"
    echo "4. Name: 'Googol Vibe Desktop'"
    echo "5. Click 'Create'"
    echo "6. Click 'DOWNLOAD JSON'"
    echo "7. Save the file"
    echo ""
    read -p "Enter the path to downloaded credentials file: " CREDS_PATH

    if [ -f "$CREDS_PATH" ]; then
        cp "$CREDS_PATH" "$CREDENTIALS_FILE"
        echo -e "${GREEN}✓${NC} Credentials saved to ${CREDENTIALS_FILE}"
    else
        echo -e "${RED}File not found. Please copy manually to ${CREDENTIALS_FILE}${NC}"
    fi
}

# Run Terraform (if available)
run_terraform() {
    if [ "$TERRAFORM_AVAILABLE" == "true" ] && [ -d "$TERRAFORM_DIR" ]; then
        echo -e "\n${BLUE}Running Terraform setup...${NC}"

        read -p "Run Terraform for automated setup? [y/N]: " run_tf
        if [[ "$run_tf" =~ ^[Yy]$ ]]; then
            read -p "Enter your email (for OAuth support): " SUPPORT_EMAIL

            # Create tfvars
            cat > "${TERRAFORM_DIR}/terraform.tfvars" <<EOF
project_id          = "${PROJECT_ID}"
oauth_support_email = "${SUPPORT_EMAIL}"
test_users          = ["${SUPPORT_EMAIL}"]
EOF

            cd "$TERRAFORM_DIR"
            terraform init
            terraform apply

            echo -e "${GREEN}✓${NC} Terraform applied"
        fi
    fi
}

# Generate .env file
generate_env() {
    echo -e "\n${BLUE}Generating .env file...${NC}"

    if [ -f "$CREDENTIALS_FILE" ]; then
        # Extract client ID and secret from credentials.json
        CLIENT_ID=$(cat "$CREDENTIALS_FILE" | grep -o '"client_id":"[^"]*"' | cut -d'"' -f4)
        CLIENT_SECRET=$(cat "$CREDENTIALS_FILE" | grep -o '"client_secret":"[^"]*"' | cut -d'"' -f4)

        ENV_FILE="$(dirname "$0")/../.env"
        cat > "$ENV_FILE" <<EOF
# Googol Vibe Configuration
# Generated by setup-gcp.sh

GOOGLE_PROJECT_ID=${PROJECT_ID}
GOOGLE_CLIENT_ID=${CLIENT_ID}
GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}

# Paths
CREDENTIALS_PATH=${CREDENTIALS_FILE}
TOKEN_PATH=${GOOGOL_VIBE_DIR}/tokens/

# Server ports
FLASK_PORT=5000
ELECTRON_AUTH_PORT=3000
VITE_DEV_PORT=9000
EOF

        echo -e "${GREEN}✓${NC} Generated .env file"
    else
        echo -e "${YELLOW}Skipping .env generation (credentials not found)${NC}"
    fi
}

# Summary
print_summary() {
    echo -e "\n${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Setup Complete!                           ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    echo "Project ID:      ${PROJECT_ID}"
    echo "Credentials:     ${CREDENTIALS_FILE}"
    echo ""
    echo "Next steps:"
    echo "  1. cd dashboard"
    echo "  2. npm install"
    echo "  3. npm run electron:dev"
    echo ""
    echo "The app will guide you through connecting your Google account."
}

# Main
main() {
    check_prerequisites
    create_directories
    setup_project
    enable_apis
    setup_oauth
    run_terraform
    generate_env
    print_summary
}

main "$@"
