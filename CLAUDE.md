# Googol Vibe

ENTER Konsult internal dashboard aggregating Google Workspace (Gmail, Calendar, Drive) into a unified OS-like interface with AI agent capabilities.

## Architecture

```text
Electron App (dashboard/electron/)
    |
    +-- React UI (dashboard/src/)
    |       |
    |       +-- App.jsx (main dashboard)
    |       +-- OnboardingWizard.jsx (setup wizard)
    |       +-- AgentPanel.jsx (Vibe Agent chat)
    |
    +-- ConfigManager (config-manager.js)
    |       |
    |       +-- ~/.googol-vibe/ (unified storage)
    |
    +-- IPC Bridge (preload.js)
            |
            +-- main.js (Google API calls via googleapis)

Infrastructure (infrastructure/terraform/)
    |
    +-- Automated GCP project setup
    +-- API enablement
    +-- OAuth consent configuration

MCP Servers (google-mcp-servers/)
    |
    +-- gmail-mcp/  (full Gmail CRUD)
    +-- mcp-google-calendar/ (calendar events)
```

## Quick Reference

| Task | Command |
|------|---------|
| Start frontend | `cd dashboard && npm run dev` |
| Start Electron | `cd dashboard && npm run electron:dev` |
| Build macOS | `cd dashboard && npm run build:mac` |
| Build Windows | `cd dashboard && npm run build:win` |
| Setup GCP | `./scripts/setup-gcp.sh` |
| Terraform | `cd infrastructure/terraform && terraform apply` |

## Directory Structure

```text
.
+-- dashboard/                    # Electron + React frontend
|   +-- electron/
|   |   +-- main.js              # Electron main process, Google API
|   |   +-- preload.js           # IPC bridge to renderer
|   |   +-- config-manager.js    # Unified config (~/.googol-vibe/)
|   +-- src/
|   |   +-- App.jsx              # Dashboard UI
|   |   +-- index.css            # Swiss Nihilism styles
|   |   +-- components/
|   |       +-- OnboardingWizard.jsx   # Setup wizard
|   |       +-- AgentPanel.jsx         # Vibe Agent chat
|   |       +-- onboarding/            # 5 onboarding steps
|   +-- package.json             # Build config, Electron setup
|
+-- infrastructure/
|   +-- terraform/               # GCP automation
|       +-- main.tf              # Provider config
|       +-- apis.tf              # API enablement
|       +-- oauth.tf             # OAuth setup
|       +-- variables.tf         # Input variables
|       +-- outputs.tf           # Outputs
|
+-- scripts/
|   +-- setup-gcp.sh             # Interactive GCP setup
|
+-- server.py                     # Flask backend (web-only mode)
|
+-- google-mcp-servers/           # MCP servers for AI agents
|   +-- gmail-mcp/               # Gmail MCP (send, draft, labels)
|   +-- mcp-google-calendar/     # Calendar MCP (CRUD events)
|   +-- venv/                    # Python virtual environment
|
+-- .env.example                  # Configuration template
+-- README.md                     # User documentation
```

## Credentials and Secrets

**Critical**: Never commit credentials.

| File | Purpose | Location |
|------|---------|----------|
| `credentials.json` | Google Cloud OAuth client | `~/.googol-vibe/` |
| `token.json` | Cached refresh token | `~/.googol-vibe/tokens/` |
| `config.json` | App settings, onboarding state | `~/.googol-vibe/` |

### Required Google APIs

Enable in Google Cloud Console:

- Gmail API
- Google Calendar API
- Google Drive API
- Google People API
- Tasks API

### OAuth Scopes

```text
gmail.readonly
calendar.readonly
drive.readonly
tasks.readonly
userinfo.profile
userinfo.email
```

## Development Workflow

### First Run

1. Run `./scripts/setup-gcp.sh` (or Terraform)
2. Start the app: `cd dashboard && npm run electron:dev`
3. Complete in-app onboarding wizard
4. Dashboard loads with Google data

### Running Locally

**Terminal 1: React Dev Server**

```bash
cd dashboard
npm run dev
# Vite runs on http://localhost:9000
```

**Terminal 2: Electron App**

```bash
cd dashboard
npm run electron:dev
# Opens native window, DevTools enabled
```

### Building for Distribution

```bash
cd dashboard
npm run build:mac    # macOS DMG
npm run build:win    # Windows NSIS
npm run build:all    # All platforms
```

## MCP Server Configuration

### For Claude Code / Antigravity

Add to your MCP config:

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
        "GOOGLE_CLIENT_ID": "your-client-id",
        "GOOGLE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

### Gmail MCP Tools

| Tool | Description |
|------|-------------|
| `send-email` | Send email (requires confirmation) |
| `create-draft` | Create draft without sending |
| `get-unread-emails` | List unread inbox messages |
| `read-email` | Get full email content |
| `trash-email` | Move to trash |
| `search-emails` | Gmail search syntax queries |
| `archive-email` | Remove from inbox |

### Calendar MCP Tools

| Tool | Description |
|------|-------------|
| `get-events` | List events in date range |
| `create-event` | Create calendar event |
| `update-event` | Modify existing event |
| `delete-event` | Remove event |
| `check-availability` | Check free/busy slots |

## Code Standards

### Frontend (React)

- Functional components with hooks
- Framer Motion for animations
- Lucide React for icons
- Swiss Nihilism CSS (clean, minimal, monochrome)
- Error boundaries per data source

### Backend (Python)

- Flask with CORS enabled
- Google API Python Client
- OAuth2 with refresh token handling
- MCP protocol for AI agent tools

### Electron

- Context isolation enabled
- Preload script for IPC
- ConfigManager for unified paths
- Persistent session for Google auth

## Key Files

| File | Purpose |
|------|---------|
| `dashboard/electron/main.js` | Electron main, Google API, IPC handlers |
| `dashboard/electron/config-manager.js` | Unified config (~/.googol-vibe/) |
| `dashboard/src/App.jsx` | React dashboard, data fetching |
| `dashboard/src/components/OnboardingWizard.jsx` | 5-step setup wizard |
| `dashboard/src/index.css` | Swiss Nihilism design system |
| `infrastructure/terraform/*.tf` | GCP automation |
| `scripts/setup-gcp.sh` | Interactive setup |

## Troubleshooting

### "credentials.json not found"

```bash
mkdir -p ~/.googol-vibe
mv ~/Downloads/client_secret_*.json ~/.googol-vibe/credentials.json
```

### Token Expired / API Error 500

```bash
rm ~/.googol-vibe/tokens/token.json
# Restart app - triggers new auth flow
```

### Port 5000 Occupied

```bash
lsof -i :5000 | grep LISTEN
kill -9 <PID>
```

### Electron DevTools Not Opening

```bash
NODE_ENV=development npm run electron:dev
```

## Build and Distribution

### Package Targets

- macOS: DMG, ZIP
- Windows: NSIS installer, Portable
- Linux: AppImage, DEB (post-MVP)

### electron-builder Config

Configured in `package.json` under `"build"` key:

- appId: `com.enterkonsult.googol-vibe`
- productName: `Googol Vibe`
- Output: `dashboard/release/`

## Security Notes

- OAuth tokens contain refresh capability - treat as secrets
- Never log full token contents
- BrowserView inherits session - Google auth persists
- MCP servers run with user's Google permissions
- All data stays local - no external telemetry by default

## Team Context

- **Owner**: ENTER Konsult (CodeTonight)
- **Purpose**: Internal productivity dashboard
- **Users**: ENTER Konsult team members
- **AI Integration**: Vibe Agent + MCP servers

## Branding

- **App Name**: Googol Vibe (mathematical term, avoids trademark)
- **Tagline**: Your Google Workspace, unified
- **Design System**: Swiss Nihilism (clean, minimal, monochrome)
- **Storage Path**: `~/.googol-vibe/`
