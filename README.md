# Googol Vibe

**Your Google Workspace, unified.** A premium desktop dashboard that aggregates Gmail, Calendar, and Drive into a cohesive OS-like interface.

Built with Electron, React, and Python. Includes MCP (Model Context Protocol) servers for AI agent integration.

---

## Features

- **Unified Dashboard**: Gmail, Calendar, Drive, and Tasks in one interface
- **Swiss Nihilism Design**: Clean, minimal aesthetic with precise typography
- **In-App Onboarding**: Guided setup wizard for GCP configuration
- **MCP Integration**: AI agents can interact with your Google Workspace
- **Cross-Platform**: macOS, Windows (Linux post-MVP)

---

## Quick Start

### Prerequisites

- Node.js >= 18
- Python >= 3.10
- Google Cloud account (free tier works)

### Automated Setup

```bash
# Clone the repository
git clone https://github.com/CodeTonight-SA/googol-vibe.git
cd googol-vibe

# Run the setup script
./scripts/setup-gcp.sh
```

The script will:
1. Authenticate with Google Cloud
2. Enable required APIs (Gmail, Calendar, Drive, People, Tasks)
3. Guide you through OAuth consent screen setup
4. Generate configuration files

### Manual Setup

1. **Create GCP Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing
   - Enable APIs: Gmail, Calendar, Drive, People, Tasks

2. **Configure OAuth**
   - Create OAuth 2.0 credentials (Desktop application)
   - Download `credentials.json`
   - Save to `~/.googol-vibe/credentials.json`

3. **Install Dependencies**
   ```bash
   cd dashboard
   npm install
   ```

4. **Run the App**
   ```bash
   npm run electron:dev
   ```

---

## Development

### Running Locally

**Option A: Electron App (Recommended)**

```bash
cd dashboard
npm run dev          # Terminal 1: Vite dev server
npm run electron:dev # Terminal 2: Electron app
```

**Option B: Flask Backend (Web Mode)**

```bash
# Terminal 1: Backend
source google-mcp-servers/venv/bin/activate
python server.py

# Terminal 2: Frontend
cd dashboard
npm run dev
```

### Project Structure

```
googol-vibe/
├── dashboard/                  # Electron + React frontend
│   ├── electron/
│   │   ├── main.js            # Electron main process
│   │   ├── preload.js         # IPC bridge
│   │   └── config-manager.js  # Unified config
│   └── src/
│       ├── App.jsx            # Dashboard UI
│       └── components/        # React components
├── infrastructure/
│   └── terraform/             # GCP automation
├── scripts/
│   └── setup-gcp.sh           # Setup automation
├── server.py                  # Flask backend (optional)
├── google-mcp-servers/        # MCP servers
│   ├── gmail-mcp/
│   └── mcp-google-calendar/
└── .env.example               # Configuration template
```

### Credential Storage

All credentials are stored in `~/.googol-vibe/`:

```
~/.googol-vibe/
├── credentials.json           # OAuth client (from GCP)
├── config.json                # App settings
└── tokens/
    └── token.json             # OAuth refresh token
```

---

## Building for Distribution

### macOS

```bash
cd dashboard
npm run build:mac
# Output: release/Googol Vibe-*.dmg
```

### Windows

```bash
npm run build:win
# Output: release/Googol Vibe Setup *.exe
```

### All Platforms

```bash
npm run build:all
```

---

## MCP Server Configuration

For AI agent integration (Claude Code, Cursor, Antigravity):

```json
{
  "mcpServers": {
    "gmail": {
      "command": "/path/to/google-mcp-servers/venv/bin/python",
      "args": [
        "-m", "gmail",
        "--creds-file-path", "~/.googol-vibe/credentials.json",
        "--token-path", "~/.googol-vibe/tokens/token_gmail.json"
      ]
    },
    "google-calendar": {
      "command": "/path/to/google-mcp-servers/venv/bin/python",
      "args": ["-m", "mcp_server_google_calendar"],
      "env": {
        "GOOGLE_CLIENT_ID": "<your-client-id>",
        "GOOGLE_CLIENT_SECRET": "<your-client-secret>"
      }
    }
  }
}
```

---

## Terraform Setup (Advanced)

For automated GCP infrastructure:

```bash
cd infrastructure/terraform

# Create configuration
cat > terraform.tfvars <<EOF
project_id          = "googol-vibe-yourname"
oauth_support_email = "your-email@gmail.com"
test_users          = ["your-email@gmail.com"]
EOF

# Apply
terraform init
terraform apply
```

See `infrastructure/terraform/README.md` for details.

---

## Troubleshooting

### credentials.json not found

Place OAuth credentials at:
```bash
mkdir -p ~/.googol-vibe
mv ~/Downloads/client_secret_*.json ~/.googol-vibe/credentials.json
```

### Token Expired / API Error 500

Delete cached token and re-authenticate:
```bash
rm ~/.googol-vibe/tokens/token.json
# Restart app - will trigger new OAuth flow
```

### Port Conflicts

Default ports:
- Vite: 9000
- Flask: 5000
- Electron Auth: 3000

Check for conflicts:
```bash
lsof -i :5000 | grep LISTEN
```

### Electron DevTools Not Opening

Ensure development mode:
```bash
NODE_ENV=development npm run electron:dev
```

---

## Configuration Reference

### Environment Variables

```bash
# .env file (optional)
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Paths (defaults work for most users)
CREDENTIALS_PATH=~/.googol-vibe/credentials.json
TOKEN_PATH=~/.googol-vibe/tokens/
```

### Required OAuth Scopes

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/tasks.readonly`
- `https://www.googleapis.com/auth/userinfo.profile`
- `https://www.googleapis.com/auth/userinfo.email`

---

## Security Notes

- Never commit `credentials.json` or tokens
- OAuth tokens contain refresh capability - treat as secrets
- BrowserView inherits Electron session for persistent auth
- All data stays local - no external telemetry by default

---

## Contributing

Internal project for ENTER Konsult. Contact the team for access.

---

## Licence

Proprietary. ENTER Konsult (CodeTonight Pty Ltd).
