# ultrathink++

# Googol Vibe -- GRIP-Enhanced Project Instructions

> Electron Google Workspace dashboard with Swiss Nihilism design. ENTER Konsult internal productivity tool.

## PARAMOUNT Rules

1. **Never read dependency folders**: `node_modules`, `.next`, `dist`, `build`, `release`, `__pycache__`, `venv`
2. **Never commit credentials**: `credentials.json`, `token*.json`, `.env`, `*.pem`
3. **Confidence gate**: When confidence < 99.9999999% -- HALT and ask the user
4. **British English** throughout all code, docs, and commits
5. **No emoji** in commits, PRs, or documentation
6. **No AI attribution** in commits or PRs

## Project Identity

| Field | Value |
|-------|-------|
| Name | Googol Vibe |
| Tagline | Your Google Workspace, unified |
| Owner | ENTER Konsult (CodeTonight) |
| Repo | `CodeTonight-SA/google-vibe-os` |
| App ID | `com.enterkonsult.googol-vibe` |
| Design System | Swiss Nihilism (clean, minimal, monochrome) |
| Storage Path | `~/.googol-vibe/` |
| Lead Developer | A>> (Andre, `@AndreTheart`, Windows) |
| Licence | UNLICENSED (proprietary) |

## Architecture Overview

```text
Googol Vibe Architecture
========================

Electron Main Process (dashboard/electron/)
    |
    +-- main.js (1055 LOC) ............ App lifecycle, IPC handlers, Google API calls
    +-- config-manager.js (383 LOC) ... Unified config (~/.googol-vibe/), path resolution
    +-- sync-controller.js (526 LOC) .. Background polling: Gmail 30s, Calendar 1m, Tasks 1m, Drive 2m
    +-- notification-manager.js (411 LOC) Native notifications, quiet hours, scheduled reminders
    +-- recurrence-manager.js (233 LOC) RFC 5545 RRULE for task recurrence (client-side)
    +-- telemetry.js (173 LOC) ........ Opt-in Sentry error reporting
    +-- preload.js (113 LOC) .......... IPC bridge (contextBridge)
    |
React Renderer (dashboard/src/)
    |
    +-- App.jsx (965 LOC) ............. Dashboard UI, data fetching, tab navigation
    +-- main.jsx (10 LOC) ............. React entry point
    +-- index.css (2043 LOC) .......... Swiss Nihilism design system
    +-- components/
    |   +-- AgentPanel.jsx (304 LOC) .. Vibe Agent chat interface
    |   +-- TaskDetailModal.jsx (343 LOC) Task detail/edit modal with recurrence
    |   +-- RecurrencePicker.jsx (255 LOC) RRULE builder UI
    |   +-- WaitlistModal.jsx (177 LOC) Waitlist signup modal
    |   +-- OnboardingWizard.jsx (141 LOC) 5-step setup wizard orchestrator
    |   +-- onboarding/
    |       +-- WelcomeStep.jsx (74 LOC)
    |       +-- GCPSetupStep.jsx (164 LOC)
    |       +-- CredentialsStep.jsx (158 LOC)
    |       +-- ConnectStep.jsx (110 LOC)
    |       +-- ReadyStep.jsx (98 LOC)
    |
Flask Backend (server.py, 146 LOC)
    +-- /api/profile, /api/gmail, /api/calendar, /api/drive
    +-- Legacy web-only mode, same Google APIs
    |
Infrastructure (infrastructure/terraform/)
    +-- main.tf, apis.tf, oauth.tf, variables.tf, outputs.tf
    +-- Automated GCP project setup
    |
MCP Servers (google-mcp-servers/ -- git submodule)
    +-- gmail-mcp/ (send, draft, labels, search)
    +-- mcp-google-calendar/ (CRUD events)
    |
Marketing Site (site/)
    +-- index.html, privacy.html
    +-- Static assets for landing page
```

**Total source**: ~7,944 LOC across 24 source files (JS/JSX/PY/CSS)

## IPC Handler Reference

All handlers are registered in `main.js` via `ipcMain.handle()`. The preload bridge exposes them on `window.electronAPI`.

### Onboarding (5 handlers)

| Channel | Purpose | Returns |
|---------|---------|---------|
| `get-onboarding-state` | Check onboarding progress | `{ needsOnboarding, hasCredentials, hasToken, ... }` |
| `import-credentials` | Import credentials.json from path | `{ success, error? }` |
| `select-credentials-file` | Open file dialog for credentials | `{ success, path?, error? }` |
| `update-onboarding` | Update onboarding state | `{ success }` |
| `get-config-paths` | Debug path resolution | `{ configDir, credentialsPath, ... }` |

### Authentication (3 handlers)

| Channel | Purpose | Returns |
|---------|---------|---------|
| `google-login` | OAuth2 loopback flow | `{ success, error? }` |
| `get-profile` | Fetch Google userinfo | `{ name, email, picture, ... }` |
| `logout` | Clear tokens + session | `{ success }` |

### Data Fetching (6 handlers)

| Channel | Purpose | Returns |
|---------|---------|---------|
| `get-gmail` | Inbox messages (10 max) | `[{ id, subject, from, date, snippet, unread }]` |
| `get-calendar` | Upcoming events (10 max) | `[{ id, summary, start, htmlLink }]` |
| `get-drive` | Recent files (12 max) | `[{ id, name, mimeType, iconLink, webViewLink }]` |
| `get-documents` | Docs/Sheets/Slides (12 max) | `[{ id, name, mimeType, modifiedTime, ... }]` |
| `get-meetings` | Calendar events with Meet links | `[{ id, summary, start, end, meetLink, attendees }]` |
| `get-tasks` | Task list items (20 max) | `{ taskListId, tasks: [{ id, title, due, notes, status }] }` |

### Tasks CRUD (4 handlers)

| Channel | Purpose | Args |
|---------|---------|------|
| `create-task` | Create new task | `{ taskListId, title, due }` |
| `complete-task` | Mark task complete | `{ taskListId, taskId }` |
| `update-task` | Update task fields | `{ taskListId, taskId, updates }` |
| `delete-task` | Delete task | `{ taskListId, taskId }` |

### Recurrence (7 handlers)

| Channel | Purpose |
|---------|---------|
| `get-recurrence-rules` | List all RRULE rules |
| `get-recurrence-rule` | Get single rule by ID |
| `create-recurrence-rule` | Create new recurrence rule |
| `update-recurrence-rule` | Update existing rule |
| `delete-recurrence-rule` | Delete rule |
| `get-rule-for-task` | Find rule by task association |
| `set-task-recurrence` | Create/update/remove recurrence for a task |

### Content Viewing (3 handlers)

| Channel | Purpose |
|---------|---------|
| `view-content` | Open URL in BrowserView (Meet, Docs, etc.) |
| `switch-to-edit` | Switch document to edit mode URL |
| `close-content` | Remove BrowserView overlay |

### Notifications (9 handlers)

| Channel | Purpose |
|---------|---------|
| `get-notification-settings` | Get notification preferences |
| `update-notification-settings` | Update preferences |
| `show-notification` | Show immediate notification |
| `get-scheduled-notifications` | List scheduled reminders |
| `schedule-task-reminders` | Schedule reminders for tasks with due dates |
| `schedule-calendar-reminders` | Schedule reminders for upcoming events |
| `schedule-meeting-reminders` | Schedule reminders for meetings |
| `cancel-notification` | Cancel specific scheduled notification |
| `cancel-all-notifications` | Cancel all scheduled notifications |

### Sync Controller (4 handlers)

| Channel | Purpose |
|---------|---------|
| `get-sync-status` | Get sync status for all services |
| `force-sync` | Force immediate sync (service or 'all') |
| `reset-new-item-counts` | Reset new item badge counts |
| `sync-notification-reminders` | Trigger full sync + reschedule reminders |

### Telemetry (2 handlers)

| Channel | Purpose |
|---------|---------|
| `get-telemetry-status` | Check if telemetry is enabled |
| `set-telemetry` | Enable/disable Sentry |

### Agent (1 handler)

| Channel | Purpose |
|---------|---------|
| `ask-agent` | Keyword-based agent queries (email/calendar/drive/tasks) |

**Total: 44 IPC handlers** across 9 categories.

## Renderer Events (main -> renderer)

| Event | Trigger |
|-------|---------|
| `content-view-opened` | BrowserView overlay activated |
| `content-view-closed` | BrowserView overlay removed |
| `recurring-task-generated` | Recurrence scheduler created a task |
| `sync-complete` | All services synced |
| `gmail-synced` | Gmail background sync complete |
| `calendar-synced` | Calendar background sync complete |
| `tasks-synced` | Tasks background sync complete |
| `drive-synced` | Drive background sync complete |

## Storage Model

All data is file-based. No database.

| File | Location | Purpose |
|------|----------|---------|
| `credentials.json` | `~/.googol-vibe/` | Google Cloud OAuth client |
| `token_electron.json` | `~/.googol-vibe/tokens/` | Electron OAuth refresh token |
| `config.json` | `~/.googol-vibe/` | App settings, onboarding state, notifications |
| `recurrence.json` | `~/.googol-vibe/` | RRULE definitions for recurring tasks |

Environment variable overrides:
- `GOOGOL_VIBE_CONFIG_DIR` -- override `~/.googol-vibe`
- `GOOGLE_CREDS_PATH` -- override credentials location
- `GOOGLE_TOKEN_DIR` -- override token directory
- `OAUTH_CALLBACK_PORT` -- override port 3000
- `VITE_PORT` -- override port 9000
- `SENTRY_DSN` -- Sentry error reporting endpoint

## Google API Scopes

```text
gmail.readonly
calendar.readonly
drive.readonly
userinfo.profile
tasks (full CRUD)
```

Note: Tasks scope is read-write (create, complete, update, delete). All other scopes are read-only.

## Quick Reference

| Task | Command |
|------|---------|
| Start frontend | `cd dashboard && npm run dev` |
| Start Electron | `cd dashboard && npm run electron:dev` |
| Build macOS | `cd dashboard && npm run build:mac` |
| Build Windows | `cd dashboard && npm run build:win` |
| Build all platforms | `cd dashboard && npm run build:all` |
| Setup GCP | `./scripts/setup-gcp.sh` |
| Terraform | `cd infrastructure/terraform && terraform apply` |

## Dependencies (Key)

### Production
- `electron` 39.x -- app shell
- `react` 18.x + `react-dom` 18.x -- UI
- `googleapis` 169.x -- Google API client
- `framer-motion` 11.x -- animations
- `lucide-react` 0.468.x -- icons
- `rrule` 2.x -- RFC 5545 recurrence
- `electron-store` 10.x -- (available but config-manager.js used instead)
- `@sentry/electron` 5.x -- opt-in error reporting

### Dev
- `vite` 6.x -- bundler
- `@vitejs/plugin-react` -- React HMR
- `electron-builder` 25.x -- packaging
- `cross-env` -- cross-platform env vars
- `eslint` 9.x -- linting

## CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build.yml` | push/PR to main | Build macOS ARM64 + Windows |
| `nightly.yml` | cron 2am UTC / manual | Nightly pre-release to GitHub Releases |
| `release.yml` | tag `v*` | Stable release to GitHub Releases |
| `deploy-site.yml` | push to main | Deploy marketing site |

**Gap**: No test step in any workflow (0 tests exist).

## Known Quality Gaps

| Gap | Severity | Effort | Notes |
|-----|----------|--------|-------|
| Zero tests | Critical | Medium | No test framework configured |
| No TypeScript | High | High | All JS, type errors at runtime only |
| No error boundaries | High | Low | Single React error crashes entire app |
| No retry logic | High | Low | Google API 429/5xx = silent failure |
| No file logging | Medium | Low | Console only, lost on restart |
| Agent is keyword-matching | Medium | Medium | Not wired to any LLM |
| No rate limit awareness | Medium | Medium | Could hit Google API quotas |
| Monolithic App.jsx | Medium | Medium | 965 LOC, single component |
| No offline support | Low | High | Requires data on every load |
| BrowserView deprecated | Low | Medium | Electron recommends WebContentsView |

## Quality Roadmap

### Phase 1: Foundation (Sprint 1-3)
- Test framework: Vitest + React Testing Library + Playwright
- TypeScript migration (gradual, file-by-file starting with main process)
- Error boundaries per widget
- Retry logic for Google API calls with exponential backoff
- File logging via electron-log

### Phase 2: Features (Sprint 4-7)
- Vibe Agent backend (wire AgentPanel to Claude API or similar)
- Email composition UI (write-scope required)
- Calendar event creation
- Drive file upload
- Offline cache with sync queue
- Smart notification grouping

### Phase 3: Distribution (Sprint 8-10)
- App Store submission (macOS notarisation)
- Microsoft Store submission
- Auto-update polish (electron-updater)
- Telemetry dashboard (Sentry DSN)
- Performance profiling and optimisation

## Cross-Platform Notes

A>> develops on **Windows** with Git Bash. L>> develops on **macOS ARM64**.

- All scripts must use `#!/usr/bin/env bash`
- Use `$HOME` not hardcoded paths
- Python: use `python3 || python` pattern (Windows installs as `python`)
- Forward slashes in paths (Git Bash compatible)
- electron-builder targets: DMG+ZIP (macOS), NSIS+Portable (Windows)
- CI matrix: `macos-latest` (ARM64), `windows-latest`

## MCP Server Configuration

### Gmail MCP

```json
{
  "command": "/path/to/google-mcp-servers/venv/bin/python",
  "args": [
    "-m", "gmail",
    "--creds-file-path", "~/.googol-vibe/credentials.json",
    "--token-path", "~/.googol-vibe/tokens/token_gmail.json"
  ]
}
```

### Calendar MCP

```json
{
  "command": "/path/to/google-mcp-servers/venv/bin/python",
  "args": ["-m", "mcp_server_google_calendar"],
  "env": {
    "GOOGLE_CLIENT_ID": "your-client-id",
    "GOOGLE_CLIENT_SECRET": "your-client-secret"
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
- Swiss Nihilism CSS (clean, minimal, monochrome with #1a1a1a base)
- Error boundaries per data source (TODO)

### Backend (Electron Main Process)
- Context isolation enabled (`contextIsolation: true`)
- Preload script for IPC bridge
- ConfigManager singleton for unified paths
- Persistent session partition (`persist:googolvibe`)

### Backend (Python/Flask)
- Flask with CORS enabled
- Google API Python Client
- OAuth2 with refresh token handling
- Legacy web-only mode

## Credentials and Secrets

**Critical**: Never commit credentials. The following are gitignored:
- `credentials.json` (any location)
- `token*.json` (any location)
- `.env` files
- `~/.googol-vibe/` contents

### Required Google APIs

Enable in Google Cloud Console:
- Gmail API
- Google Calendar API
- Google Drive API
- Google People API (OAuth2 userinfo)
- Tasks API

## Troubleshooting

### "credentials.json not found"
```bash
mkdir -p ~/.googol-vibe
mv ~/Downloads/client_secret_*.json ~/.googol-vibe/credentials.json
```

### Token Expired / API Error 500
```bash
rm ~/.googol-vibe/tokens/token_electron.json
# Restart app -- triggers new auth flow
```

### Port conflict
```bash
# Check what's on port 3000 (OAuth) or 9000 (Vite)
lsof -i :3000 | grep LISTEN
lsof -i :9000 | grep LISTEN
```

## GRIP Commands Cheat Sheet

| Command | Purpose |
|---------|---------|
| `/converge` | Multi-depth problem solving with criterion |
| `/preplan` | Plan before implementing |
| `/create-pr` | Create PR with GRIP format |
| `/learn` | Capture a reusable insight |
| `/mode <name>` | Switch reasoning mode |
| `/extend-context` | Switch to 1M context window |
| `/save` | Serialize session state |
