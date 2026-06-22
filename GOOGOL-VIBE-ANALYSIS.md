# Googol Vibe OS - Comprehensive Analysis

> **Document Purpose**: Full technical and functional analysis of the Googol Vibe codebase, covering architecture, all current features, gaps, and a prioritised improvement roadmap.
>
> **Last Updated**: February 2026

---

## Table of Contents

- [What It Is](#what-it-is)
- [What It Is Not](#what-it-is-not)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [All Current Functions](#all-current-functions)
  - [1. Onboarding Wizard](#1-onboarding-wizard)
  - [2. Google OAuth Authentication](#2-google-oauth-authentication)
  - [3. Gmail Inbox Widget](#3-gmail-inbox-widget)
  - [4. Tasks Widget with Full CRUD](#4-tasks-widget-with-full-crud)
  - [5. Meetings Widget](#5-meetings-widget)
  - [6. Documents Widget](#6-documents-widget)
  - [7. Recent Files Widget](#7-recent-files-widget)
  - [8. Vibe Terminal (Agent Panel)](#8-vibe-terminal-agent-panel)
  - [9. Background Sync Controller](#9-background-sync-controller)
  - [10. Native Notifications](#10-native-notifications)
  - [11. Inline Content Viewer](#11-inline-content-viewer)
  - [12. Configuration Manager](#12-configuration-manager)
  - [13. Telemetry](#13-telemetry)
  - [14. MCP Server Integration](#14-mcp-server-integration)
  - [15. Cross-Platform Builds](#15-cross-platform-builds)
- [Google API Scopes](#google-api-scopes)
- [Credential and Token Storage](#credential-and-token-storage)
- [Current Gaps and Improvement Opportunities](#current-gaps-and-improvement-opportunities)
- [Prioritised Improvement Roadmap](#prioritised-improvement-roadmap)
  - [Phase 1 - UX Polish (Quick Wins)](#phase-1---ux-polish-quick-wins)
  - [Phase 2 - Feature Enrichment](#phase-2---feature-enrichment)
  - [Phase 3 - AI Integration](#phase-3---ai-integration)
  - [Phase 4 - Advanced](#phase-4---advanced)

---

## What It Is

Googol Vibe is a **desktop productivity dashboard** built with **Electron + React** that aggregates multiple Google Workspace services into a single, unified interface. It is an internal tool for ENTER Konsult (CodeTonight Pty Ltd).

Instead of bouncing between Gmail tabs, Google Calendar, Google Drive, and Google Tasks in a browser, users get **one native desktop app** that shows everything on a single dashboard with real-time background sync and native OS notifications.

### Core Value Proposition

- **Unified view**: Gmail, Calendar, Drive, Tasks, Meetings, and Documents in one window
- **Real-time sync**: Background polling keeps data fresh (Gmail every 30s, Calendar/Tasks every 1m, Drive every 2m)
- **Native notifications**: OS-level alerts for new emails, upcoming meetings, task due dates
- **Local-first**: All credentials and data stay on the user's machine -- no external telemetry by default
- **Inline viewing**: Open emails, documents, spreadsheets, presentations, and Google Meet calls directly inside the app via BrowserView overlay
- **Task management**: Full CRUD for Google Tasks with client-side recurring task support (Google Tasks API lacks native recurrence)

---

## What It Is Not

| Misconception | Reality |
|---|---|
| A web app | It is an **Electron desktop app**. There is a legacy Flask `server.py` for a web-only fallback, but the primary target is native desktop. |
| A Google replacement | It **surfaces Google data** in a read-heavy mode. Gmail, Calendar, and Drive use `readonly` scopes. Only Tasks has full CRUD. |
| A true AI assistant | The "Vibe Agent" sidebar is a **keyword-matching command terminal**, not an LLM. Natural language queries redirect to a waitlist signup form for a "coming soon" AI feature. |
| A multi-user/collaborative tool | It is a **single-user desktop app** with no shared state, no server-side storage, and no multi-tenant architecture. |
| A cloud service | **All credentials and tokens are stored locally** in `~/.googol-vibe/`. No data leaves the machine except API calls to Google. |
| A mobile app | Desktop only (macOS, Windows, Linux post-MVP). No responsive web or mobile targets. |

---

## Tech Stack

### Frontend (Renderer Process)

| Technology | Version | Purpose |
|---|---|---|
| React | 18.3 | UI framework -- functional components with hooks |
| Vite | 6.0 | Build tool and dev server (port 9000) |
| Framer Motion | 11.15 | Animations and transitions |
| Lucide React | 0.468 | Icon library |
| CSS (custom) | -- | "Swiss Nihilism" design system: clean, minimal, monochrome with orange (#ea580c) accent |

### Backend (Main Process)

| Technology | Version | Purpose |
|---|---|---|
| Electron | 39.2 | Desktop shell, BrowserView, IPC, native notifications |
| googleapis | 169.0 | Google API client (Gmail, Calendar, Drive, Tasks, OAuth2, People) |
| @google-cloud/local-auth | 3.0 | OAuth2 loopback authentication helper |
| rrule | 2.8 | RFC 5545 recurrence rule parsing and generation |
| electron-store | 10.0 | Persistent key-value storage (available but config-manager.js is primary) |
| @sentry/electron | 5.0 | Opt-in error reporting |
| server-destroy | 1.0 | Graceful HTTP server cleanup for OAuth flow |

### Build and Tooling

| Technology | Purpose |
|---|---|
| electron-builder 25.1 | Cross-platform packaging (DMG, NSIS, AppImage) |
| cross-env 10.1 | Cross-platform environment variable setting |
| ESLint 9.17 | Code linting |

### MCP Servers (Python)

| Server | Purpose |
|---|---|
| gmail-mcp | Full Gmail CRUD via MCP protocol (for AI agent tools) |
| mcp-google-calendar | Calendar CRUD via MCP protocol |

### Infrastructure

| Technology | Purpose |
|---|---|
| Terraform | Automated GCP project setup, API enablement, OAuth consent |
| Bash scripts | Interactive GCP setup (`setup-gcp.sh`) |

---

## Architecture

```text
+------------------------------------------------------------+
|                    Electron Application                      |
+------------------------------------------------------------+
|                                                              |
|  Main Process (Node.js)              Renderer Process (Web)  |
|  ========================            ======================= |
|                                                              |
|  +------------------+                +-------------------+   |
|  |    main.js        |<--- IPC ----->|    App.jsx        |   |
|  |  (Google APIs,    |   (preload.js |  (Dashboard UI,   |   |
|  |   OAuth, IPC      |    bridge     |   widgets, state) |   |
|  |   handlers)       |   ~50 APIs)   |                   |   |
|  +------------------+                +-------------------+   |
|         |                                    |               |
|  +------------------+                +-------------------+   |
|  | config-manager.js |                | AgentPanel.jsx    |   |
|  | (~/.googol-vibe/) |                | (Terminal UI)     |   |
|  +------------------+                +-------------------+   |
|         |                                    |               |
|  +------------------+                +-------------------+   |
|  | sync-controller.js|                | OnboardingWizard  |   |
|  | (Background sync) |                | (5-step setup)    |   |
|  +------------------+                +-------------------+   |
|         |                                    |               |
|  +------------------+                +-------------------+   |
|  | notification-mgr  |                | TaskDetailModal   |   |
|  | (Native OS alerts)|                | + RecurrencePicker|   |
|  +------------------+                +-------------------+   |
|         |                                    |               |
|  +------------------+                +-------------------+   |
|  | recurrence-mgr    |                | WaitlistModal     |   |
|  | (RRULE engine)    |                | (Formspree form)  |   |
|  +------------------+                +-------------------+   |
|         |                                                    |
|  +------------------+                                        |
|  | telemetry.js      |                                       |
|  | (Opt-in Sentry)   |                                       |
|  +------------------+                                        |
|                                                              |
+------------------------------------------------------------+
         |                        |
         v                        v
+------------------+     +---------------------+
| Google APIs      |     | BrowserView Overlay  |
| (googleapis lib) |     | (inline content:     |
|  - Gmail         |     |  email, docs, sheets,|
|  - Calendar      |     |  slides, Meet calls) |
|  - Drive         |     +---------------------+
|  - Tasks         |
|  - OAuth2        |
|  - People        |
+------------------+
```

### Data Flow

```text
1. App Launch
   main.js -> configManager.init() -> check onboarding state
                                   -> load saved OAuth token
                                   -> start SyncController
                                   -> start RecurrenceScheduler
                                   -> create BrowserWindow -> load React app

2. Authentication Flow
   User clicks "Connect" -> main.js creates OAuth2 client
                         -> opens auth URL in BrowserWindow
                         -> localhost:3000 HTTP server captures callback code
                         -> exchanges code for tokens
                         -> saves tokens to ~/.googol-vibe/tokens/

3. Data Fetching (Initial)
   App.jsx useEffect -> fetchData() -> parallel IPC calls:
     getProfile()   -> main.js -> google.oauth2.userinfo.get()
     getGmail()     -> main.js -> google.gmail.messages.list() + get()
     getCalendar()  -> main.js -> google.calendar.events.list()
     getDrive()     -> main.js -> google.drive.files.list()
     getDocuments() -> main.js -> google.drive.files.list() (filtered)
     getMeetings()  -> main.js -> google.calendar.events.list() (with Meet)
     getTasks()     -> main.js -> google.tasks.list()

4. Background Sync Loop
   SyncController.start() -> setInterval for each service
     Gmail (30s)    -> check for new message IDs -> notify if new
     Calendar (60s) -> check for new events -> schedule reminders
     Tasks (60s)    -> check for new tasks -> schedule reminders
     Drive (120s)   -> check for new files -> notify if recent

5. Recurring Task Generation (Hourly)
   RecurrenceManager checks RRULE rules -> if nextDue <= now:
     -> create new task via Google Tasks API
     -> show notification
     -> calculate next occurrence
     -> notify renderer to refresh
```

---

## Directory Structure

```text
googol-vibe/
|
+-- dashboard/                          # Electron + React frontend
|   +-- electron/
|   |   +-- main.js                     # Electron main process, Google API calls, all IPC handlers
|   |   +-- preload.js                  # Context bridge: ~50 IPC channels exposed to renderer
|   |   +-- config-manager.js           # Singleton: paths, config.json, onboarding state
|   |   +-- sync-controller.js          # Singleton: background polling orchestrator
|   |   +-- notification-manager.js     # Native OS notification scheduling and display
|   |   +-- recurrence-manager.js       # RRULE-based recurring task engine
|   |   +-- telemetry.js               # Opt-in Sentry error reporting
|   |
|   +-- src/
|   |   +-- App.jsx                     # Main dashboard: all widgets, layout, state management
|   |   +-- index.css                   # Swiss Nihilism design system
|   |   +-- assets/
|   |   |   +-- logo.webp              # App logo
|   |   +-- components/
|   |       +-- AgentPanel.jsx          # Terminal-style sidebar with slash commands
|   |       +-- OnboardingWizard.jsx    # 5-step setup wizard orchestrator
|   |       +-- TaskDetailModal.jsx     # Task detail/edit modal with markdown notes
|   |       +-- RecurrencePicker.jsx    # RRULE builder UI (daily/weekly/monthly/custom)
|   |       +-- WaitlistModal.jsx       # Formspree waitlist form for Vibe AI
|   |       +-- onboarding/
|   |           +-- WelcomeStep.jsx     # Step 1: Welcome screen
|   |           +-- GCPSetupStep.jsx    # Step 2: GCP project instructions
|   |           +-- CredentialsStep.jsx # Step 3: Import credentials.json
|   |           +-- ConnectStep.jsx     # Step 4: OAuth login
|   |           +-- ReadyStep.jsx       # Step 5: Confirmation
|   |
|   +-- build/                          # Build resources (icons)
|   +-- package.json                    # Dependencies, scripts, electron-builder config
|   +-- vite.config.js                  # Vite configuration
|
+-- infrastructure/
|   +-- terraform/
|       +-- main.tf                     # GCP provider configuration
|       +-- apis.tf                     # API enablement (Gmail, Calendar, Drive, etc.)
|       +-- oauth.tf                    # OAuth consent screen setup
|       +-- variables.tf                # Input variables
|       +-- outputs.tf                  # Terraform outputs
|
+-- scripts/
|   +-- setup-gcp.sh                    # Interactive GCP setup script
|
+-- google-mcp-servers/                 # MCP servers for AI agent integration
|   +-- gmail-mcp/                      # Gmail MCP server (Python)
|   +-- mcp-google-calendar/            # Calendar MCP server (Python)
|   +-- venv/                           # Python virtual environment
|
+-- server.py                           # Legacy Flask backend (web-only mode)
+-- .env.example                        # Environment variable template
+-- CLAUDE.md                           # AI assistant project context
+-- README.md                           # User documentation
+-- GOOGOL-VIBE-ANALYSIS.md             # This document
```

---

## All Current Functions

### 1. Onboarding Wizard

**Files**: `dashboard/src/components/OnboardingWizard.jsx`, `dashboard/src/components/onboarding/*.jsx`

A 5-step guided setup wizard that runs on first launch (or when credentials are missing):

| Step | Component | What It Does |
|---|---|---|
| 1. Welcome | `WelcomeStep.jsx` | Introduces the app and what the user needs |
| 2. GCP Setup | `GCPSetupStep.jsx` | Instructions for creating a Google Cloud project and enabling APIs |
| 3. Credentials | `CredentialsStep.jsx` | File picker to import `credentials.json` into `~/.googol-vibe/`; validates the file structure (checks for `installed.client_id` or `web.client_id`) |
| 4. Connect | `ConnectStep.jsx` | Triggers OAuth login flow |
| 5. Ready | `ReadyStep.jsx` | Confirmation screen, launches dashboard |

**Smart skip logic**: If credentials and/or tokens already exist, the wizard auto-advances to the appropriate step.

---

### 2. Google OAuth Authentication

**File**: `dashboard/electron/main.js` (lines 64-168)

**Flow**:
1. `createOAuthClient()` reads `credentials.json` from the config directory
2. `authenticateWithLoopback()` generates an auth URL with requested scopes
3. Opens a modal `BrowserWindow` pointing to Google's consent screen
4. Spins up a local HTTP server on port 3000 (configurable via `OAUTH_CALLBACK_PORT`)
5. Google redirects to `localhost:3000/oauth2callback` with an authorization code
6. Exchanges code for access + refresh tokens
7. Saves tokens to `~/.googol-vibe/tokens/token_electron.json`
8. Closes auth window, shows main window

**Token management**:
- Auto-loads saved tokens on startup (`loadSavedCredentialsIfExist`)
- Supports legacy token migration from Electron's `userData` directory
- Logout clears tokens, session storage, and resets onboarding state

---

### 3. Gmail Inbox Widget

**File**: `dashboard/src/App.jsx` (lines 634-678), `dashboard/electron/main.js` (lines 472-512)

- Fetches the last **10 inbox messages** via `gmail.users.messages.list`
- For each message, fetches metadata headers (Subject, From, Date)
- Detects unread status from Gmail label IDs
- Displays sender name, subject line, timestamp
- **Unread indicator**: blue dot + bold text
- **Click action**: opens the email in Gmail web UI via BrowserView overlay
- **Error handling**: returns empty array on failure, does not crash

---

### 4. Tasks Widget with Full CRUD

**Files**: `dashboard/src/App.jsx` (lines 680-787), `dashboard/src/components/TaskDetailModal.jsx`, `dashboard/src/components/RecurrencePicker.jsx`, `dashboard/electron/recurrence-manager.js`

The most feature-rich widget in the application:

**Create**:
- Inline text input at top of widget
- Enter key or "+" button to create
- After creation, automatically opens the detail modal for notes entry

**Read**:
- Lists up to 20 pending (non-completed) tasks from the first task list
- Shows title, due date, notes indicator (sticky note icon), recurring indicator (refresh icon)
- Click on any task opens the detail modal

**Update** (via TaskDetailModal):
- Edit title
- Set/change due date (date picker)
- Add/edit notes (textarea, max 8192 characters, supports basic markdown rendering)
- Set recurrence via RecurrencePicker (daily, weekly with day selection, monthly with day-of-month, custom intervals)
- Keyboard shortcut: Ctrl/Cmd+S to save

**Complete**:
- "Mark as Done" button (only enabled when task has saved notes -- a deliberate UX choice to encourage note-taking)
- Marks task as `completed` via Google Tasks API and removes from local list
- Recurring tasks cannot be individually completed via the button

**Delete**:
- Two-step confirmation (click Delete -> shows warning -> click Confirm Delete)
- Uncompleted tasks show a message "Mark as done first to delete"

**Recurrence Engine** (client-side):
- Google Tasks API has no native recurrence support
- RecurrenceManager stores RRULE rules in `~/.googol-vibe/recurrence.json`
- Hourly scheduler checks for due rules and auto-creates new task instances via the API
- Supports RFC 5545 RRULE strings (daily, weekly with BYDAY, monthly with BYMONTHDAY)
- Shows native notification when a recurring task is generated

---

### 5. Meetings Widget

**File**: `dashboard/src/App.jsx` (lines 789-832), `dashboard/electron/main.js` (lines 581-614)

- Queries calendar events for the next 7 days with `conferenceDataVersion: 1`
- Filters for events that have a video entry point (Google Meet)
- Displays meeting title, start time (weekday + time), attendee count
- Shows up to 5 meetings
- **Click action**: opens the Google Meet link in BrowserView (with camera/mic permission handler enabled)

---

### 6. Documents Widget

**File**: `dashboard/src/App.jsx` (lines 834-884), `dashboard/electron/main.js` (lines 560-578)

- Fetches the 12 most recently modified Google Workspace documents via Drive API
- Filters for three MIME types:
  - `application/vnd.google-apps.document` (Google Docs)
  - `application/vnd.google-apps.spreadsheet` (Google Sheets)
  - `application/vnd.google-apps.presentation` (Google Slides)
- Displays as **horizontally scrollable cards** with:
  - Type-specific icon (blue for Docs, green for Sheets, yellow for Slides)
  - Document name (truncated)
  - Last modified date
- **Click action**: opens preview URL in BrowserView
- **Edit button**: when content is open, a header bar shows an "Edit" button that switches the BrowserView URL from `/preview` to `/edit`

---

### 7. Recent Files Widget

**File**: `dashboard/src/App.jsx` (lines 886-932), `dashboard/electron/main.js` (lines 541-558)

- Fetches the 12 most recently modified non-trashed files from Google Drive
- Displays in a **grid layout** (6 visible) with:
  - File name (truncated, ellipsis overflow)
  - Thumbnail image (from Drive API's `thumbnailLink`) or fallback icon
- **Click action**: opens the file's `webViewLink` in BrowserView

---

### 8. Vibe Terminal (Agent Panel)

**File**: `dashboard/src/components/AgentPanel.jsx`

A terminal-styled sidebar panel on the right side of the dashboard (3 columns in the 12-column grid):

**Slash commands** (executed locally, no network for command parsing):

| Command | Description |
|---|---|
| `/inbox [n]` | List unread emails (default 5), formatted as monospaced table |
| `/cal [range]` | Show events for `today` or `week` (default today) |
| `/drive [n]` | List recent files (default 5) |
| `/help` | Display available commands |
| `/clear` | Clear terminal history |

**Natural language fallback**:
- Any non-slash input triggers the WaitlistModal (Formspree form at `https://formspree.io/f/maqywgvl`)
- Collects name, email, company, use case for "Vibe AI" waitlist
- Terminal shows "AI-powered automation is coming soon" message

**Backend agent** (`main.js` lines 910-999):
- A keyword-matching `ask-agent` IPC handler exists but is **not currently wired up** in the frontend
- Responds to keywords: email/inbox/unread, calendar/schedule/meet/today, file/drive/recent, task/todo
- Returns plain text summaries from Google APIs

**Quick command buttons**: `/inbox`, `/cal`, `/drive` at the bottom for one-click access.

---

### 9. Background Sync Controller

**File**: `dashboard/electron/sync-controller.js`

A singleton class that orchestrates periodic background syncing of all Google services:

| Service | Interval | What It Checks |
|---|---|---|
| Gmail | 30 seconds | New unread inbox messages (by comparing message ID sets) |
| Calendar | 60 seconds | New events in next 24 hours; schedules reminders |
| Tasks | 60 seconds | New pending tasks; schedules reminders for tasks with due dates |
| Drive | 2 minutes | New files (created in last 5 minutes only) |

**New item detection**: Maintains `Set` of previous item IDs per service. On each sync, compares current IDs to previous. New items trigger native notifications.

**Renderer communication**: Sends IPC events (`gmail-synced`, `calendar-synced`, `tasks-synced`, `drive-synced`, `sync-complete`) so the React UI can refresh data.

**UI indicator**: Header shows a green "Live" dot (or pulsing orange "Syncing..." during a sync). Click to force-sync all services.

**Initial delay**: 3 seconds after app ready before first sync (to avoid blocking startup).

---

### 10. Native Notifications

**File**: `dashboard/electron/notification-manager.js`

Uses Electron's `Notification` API for OS-level notifications:

**Notification types**:
- New email received (sender + subject)
- New calendar event added
- Meeting starting soon (configurable lead time)
- Task due soon (configurable lead time)
- Recurring task instance generated

**Configuration**:

| Setting | Default | Description |
|---|---|---|
| `enabled` | `true` | Master toggle |
| `taskReminders` | `true` | Enable task due date reminders |
| `calendarReminders` | `true` | Enable event reminders |
| `emailNotifications` | `true` | Enable new email alerts |
| `recurringTaskAlerts` | `true` | Enable recurring task generation alerts |
| `taskReminderLeadTime` | 30 min | How far before due date to remind |
| `calendarReminderLeadTime` | 15 min | How far before event to remind |
| `quietHoursEnabled` | `false` | Suppress notifications during quiet hours |
| `quietHoursStart` | 22 (10 PM) | Quiet hours start |
| `quietHoursEnd` | 8 (8 AM) | Quiet hours end |

**Scheduling**: Uses `setTimeout` with a 24-hour max cap (to avoid 32-bit integer overflow). Reminders beyond 24 hours are rescheduled on the next sync cycle.

**Safety**: Safe logging wrappers prevent EPIPE crashes when stdout is closed.

---

### 11. Inline Content Viewer

**File**: `dashboard/electron/main.js` (lines 870-907)

Uses Electron's `BrowserView` to render Google content inline within the app:

- **Opens**: Gmail messages, Google Docs (preview), Google Sheets (preview), Google Slides (preview), Google Meet sessions, Google Drive files, Google Tasks web UI
- **Layout**: Full-width overlay below an 80px header bar
- **Header bar**: Shows "Edit" button (for documents) and "Back to Dashboard" button
- **Edit mode**: Switches document URL from `/preview` to `/edit`
- **Session persistence**: BrowserView uses the `persist:googleos` partition, so Google auth carries over
- **Permissions**: Camera and microphone access granted for Meet calls via `setPermissionRequestHandler`
- **Auto-resize**: BrowserView bounds update on window resize

---

### 12. Configuration Manager

**File**: `dashboard/electron/config-manager.js`

A singleton class providing unified path management and configuration:

**Storage location**: `~/.googol-vibe/` (override via `GOOGOL_VIBE_CONFIG_DIR` env var)

**Directory structure created on init**:

```text
~/.googol-vibe/
+-- config.json           # App settings, onboarding state, notification prefs
+-- credentials.json      # Google OAuth client credentials
+-- recurrence.json       # Recurring task RRULE definitions
+-- tokens/
    +-- token_electron.json  # OAuth access + refresh tokens
```

**Credential resolution priority**:
1. `GOOGLE_CREDS_PATH` environment variable
2. `~/.googol-vibe/credentials.json`
3. Legacy locations (`.agent/secrets/`, `dashboard/credentials.json`, project root)

**Token resolution priority**:
1. `GOOGLE_TOKEN_DIR` environment variable
2. `~/.googol-vibe/tokens/token_{service}.json`
3. Legacy: Electron `userData/token.json` (auto-migrated)

**Config.json schema**:

```json
{
  "version": 1,
  "onboardingComplete": false,
  "onboardingStep": 0,
  "telemetryEnabled": false,
  "connectedEmail": null,
  "notifications": {
    "enabled": true,
    "taskReminders": true,
    "calendarReminders": true,
    "emailNotifications": true,
    "recurringTaskAlerts": true,
    "taskReminderLeadTime": 30,
    "calendarReminderLeadTime": 15,
    "quietHoursEnabled": false,
    "quietHoursStart": 22,
    "quietHoursEnd": 8
  }
}
```

---

### 13. Telemetry

**File**: `dashboard/electron/telemetry.js`

Opt-in error reporting via Sentry:

- **Disabled by default** -- user must explicitly enable in config
- **No DSN configured** by default (empty string prevents data transmission)
- **Privacy protections**:
  - Strips network breadcrumbs (may contain tokens)
  - Strips console logs (may contain sensitive data)
  - Removes user email and username
  - Replaces home directory paths with `~/` in stack traces
- **Disabled in development** mode
- **Traces sample rate**: 0 (errors only, no performance monitoring)

---

### 14. MCP Server Integration

**Directory**: `google-mcp-servers/`

Model Context Protocol servers for AI agent integration (Claude Code, Cursor, Antigravity):

**Gmail MCP Tools**:

| Tool | Description |
|---|---|
| `send-email` | Send email (requires confirmation) |
| `create-draft` | Create draft without sending |
| `get-unread-emails` | List unread inbox messages |
| `read-email` | Get full email content |
| `trash-email` | Move to trash |
| `search-emails` | Gmail search syntax queries |
| `archive-email` | Remove from inbox |

**Calendar MCP Tools**:

| Tool | Description |
|---|---|
| `get-events` | List events in date range |
| `create-event` | Create calendar event |
| `update-event` | Modify existing event |
| `delete-event` | Remove event |
| `check-availability` | Check free/busy slots |

**Configuration**: Add to MCP config JSON with paths to venv Python binary and credential files.

---

### 15. Cross-Platform Builds

**File**: `dashboard/package.json` (build section)

| Platform | Target Formats | Icon Format | Build Command |
|---|---|---|---|
| macOS | DMG, ZIP | `.icns` | `npm run build:mac` |
| Windows | NSIS installer, Portable | `.ico` | `npm run build:win` |
| Linux | AppImage, DEB | `.png` | `npm run build:linux` |
| All | All of the above | All | `npm run build:all` |

**Build pipeline**: `vite build` (bundles React app to `dist/`) -> `electron-builder` (packages Electron app to `release/`)

**App identity**:
- App ID: `com.enterkonsult.googol-vibe`
- Product Name: `Googol Vibe`
- Category: Productivity
- Windows NSIS: allows custom install directory, per-machine installation

---

## Google API Scopes

| Scope | Access Level | Used By |
|---|---|---|
| `gmail.readonly` | Read-only | Inbox widget, agent inbox command |
| `calendar.readonly` | Read-only | Calendar widget, meetings widget, agent cal command |
| `drive.readonly` | Read-only | Files widget, documents widget, agent drive command |
| `tasks` | Full access (read/write) | Tasks widget CRUD, recurrence engine |
| `userinfo.profile` | Read-only | Profile display (name, picture) |
| `userinfo.email` | Read-only | Connected email display |

**Note**: The README mentions `tasks.readonly` but the actual code uses `tasks` (full access) since the app creates, updates, completes, and deletes tasks.

---

## Credential and Token Storage

| File | Purpose | Location |
|---|---|---|
| `credentials.json` | Google Cloud OAuth client ID and secret | `~/.googol-vibe/credentials.json` |
| `token_electron.json` | OAuth access token + refresh token | `~/.googol-vibe/tokens/` |
| `config.json` | App settings, onboarding state, notification prefs | `~/.googol-vibe/` |
| `recurrence.json` | Recurring task RRULE definitions | `~/.googol-vibe/` |

**Security notes**:
- Never committed to version control (`.gitignore` should exclude these)
- OAuth tokens contain refresh capability -- treat as secrets
- BrowserView inherits Electron session, so Google auth persists across views
- All data stays local -- no external servers receive credentials

---

## Current Gaps and Improvement Opportunities

| Area | Current State | Gap / Opportunity |
|---|---|---|
| **AI Agent** | Keyword matching + waitlist modal | Real LLM integration (Claude API or similar) for natural language workspace commands |
| **Tasks scope** | Only reads first task list | Multi-list support with list selector |
| **Calendar** | Read-only event list | Event creation, editing, RSVP from dashboard |
| **Gmail** | Read-only inbox, 10 items max | Compose, reply, search, label filtering, pagination |
| **Drive** | Read-only grid, 12 items max | Upload, share, folder navigation, search |
| **Search** | No search functionality | Cross-service unified search bar |
| **Keyboard shortcuts** | Only Ctrl+S in task modal, Escape to close | Full keyboard navigation across all widgets |
| **Settings panel** | Backend config exists, no UI | Settings page for notifications, sync intervals, theme, account management |
| **Error handling** | Silent `console.error` | User-facing error toasts or banners |
| **Offline mode** | Fails silently when offline | Cached data display, action queue for sync when reconnected |
| **Theming** | Fixed light theme (Swiss Nihilism) | Dark mode toggle |
| **Contacts** | People API scope available but unused | Contacts/people directory widget |
| **Calendar view** | Simple event list | Day/week/month calendar grid view |
| **Drag and drop** | Not implemented | File upload to Drive, task reordering |
| **Widget layout** | Fixed 12-column CSS grid | Customisable, draggable, resizable dashboard layout |
| **Pagination** | None on any widget | Load more / infinite scroll for emails, files, tasks |
| **Badge counts** | Static counts only | Dynamic unread/pending counts in app title bar / dock icon |
| **Content Security Policy** | Production CSP exists | CSP is permissive for Google domains; no nonce-based script policy |
| **Tests** | None | Unit tests, integration tests, E2E tests |
| **CI/CD** | GitHub Actions for builds | No automated testing pipeline |
| **Accessibility** | Basic HTML semantics | ARIA labels, screen reader support, focus management |

---

## Prioritised Improvement Roadmap

### Phase 1 - UX Polish (Quick Wins)

These items improve the existing experience without adding new Google API integrations.

| # | Item | Description | Key Files |
|---|---|---|---|
| 1 | **Settings Panel UI** | Create a settings page for notification preferences, sync intervals, telemetry toggle, account management. All backend handlers already exist. | New component, `main.js` (existing IPC handlers) |
| 2 | **Error toasts/banners** | Replace silent `console.error` with user-facing error feedback (toast notifications or inline banners) | `App.jsx`, new Toast component |
| 3 | **Keyboard shortcuts** | Ctrl+R refresh, Escape close overlay, arrow key navigation between widgets, Tab focus management | `App.jsx`, widget components |
| 4 | **Loading and empty states** | Improve skeleton loaders and empty state messaging with actionable CTAs (e.g., "Create your first task") | `App.jsx`, widget components |
| 5 | **Dark mode toggle** | Add theme switching. The Swiss Nihilism design system already has a clean monochrome base that inverts well. | `index.css`, new ThemeContext |

### Phase 2 - Feature Enrichment

These items extend existing widgets with more Google API capabilities.

| # | Item | Description | Key Files |
|---|---|---|---|
| 6 | **Gmail enhancements** | Compose/reply, search (Gmail query syntax), label filtering, pagination beyond 10 items | `main.js` (new IPC handlers), `App.jsx` |
| 7 | **Calendar view upgrade** | Day/week grid view instead of event list; event creation from dashboard | New CalendarView component, `main.js` |
| 8 | **Multi-task-list support** | Support all Google Tasks lists with a list selector dropdown | `main.js`, `App.jsx`, `TaskDetailModal.jsx` |
| 9 | **Unified search bar** | Cross-service search (emails, files, events, tasks) from a single input | New SearchBar component, `main.js` |
| 10 | **Drive improvements** | Folder navigation breadcrumb, file upload, better thumbnail grid | `main.js`, `App.jsx` |

### Phase 3 - AI Integration

Replace the placeholder agent with real AI capabilities.

| # | Item | Description | Key Files |
|---|---|---|---|
| 11 | **Real AI agent** | Replace keyword matching with LLM integration (Claude API or similar) for natural language workspace commands | `AgentPanel.jsx`, `main.js` |
| 12 | **Smart suggestions** | Surface contextual recommendations: upcoming deadlines, priority unread emails, schedule conflicts | New SuggestionsWidget component |

### Phase 4 - Advanced

Larger architectural improvements for long-term quality.

| # | Item | Description | Key Files |
|---|---|---|---|
| 13 | **Offline mode** | Cache last-synced data to disk, display cached data when offline, queue actions for reconnection sync | `sync-controller.js`, `config-manager.js` |
| 14 | **Customisable dashboard layout** | Draggable, resizable widgets (e.g., using react-grid-layout) | `App.jsx`, new LayoutManager |
| 15 | **Contacts widget** | People API integration for directory lookup and contact search | New ContactsWidget, `main.js` |
| 16 | **Test suite** | Unit tests (Vitest), E2E tests (Playwright), CI pipeline | New test files, GitHub Actions |
| 17 | **Accessibility audit** | ARIA labels, focus management, screen reader testing, keyboard-only navigation | All components |

---

## Quick Reference Commands

| Task | Command |
|---|---|
| Start React dev server | `cd dashboard && npm run dev` |
| Start Electron (dev) | `cd dashboard && npm run electron:dev` |
| Build macOS | `cd dashboard && npm run build:mac` |
| Build Windows | `cd dashboard && npm run build:win` |
| Build all platforms | `cd dashboard && npm run build:all` |
| Setup GCP | `./scripts/setup-gcp.sh` |
| Terraform apply | `cd infrastructure/terraform && terraform apply` |
| Lint | `cd dashboard && npm run lint` |

---

## Ports

| Service | Port | Configurable Via |
|---|---|---|
| Vite dev server | 9000 | `VITE_PORT` env var |
| OAuth callback | 3000 | `OAUTH_CALLBACK_PORT` env var |
| Flask backend (legacy) | 5000 | `server.py` |

---

*Document generated from full codebase analysis of the Googol Vibe repository.*
