# GRIP Prompts for Googol Vibe

Copy-paste prompts for A>> (Andre) to use with Claude Code sessions on this project.

---

## Session Start Prompt

Use this at the beginning of every Claude Code session on Googol Vibe.

```
Read .claude/CLAUDE.md and familiarise yourself with the Googol Vibe architecture.
This is an Electron 39 + React 18 + Vite 6 app that unifies Google Workspace
(Gmail, Calendar, Drive, Tasks, Meet) into a single dashboard.

Key context:
- 44 IPC handlers in main.js bridged via preload.js
- Swiss Nihilism design system (monochrome, minimal)
- Storage: file-based in ~/.googol-vibe/ (no database)
- Background sync: Gmail 30s, Calendar 1m, Tasks 1m, Drive 2m
- Cross-platform: macOS ARM64 + Windows (I'm on Windows)
- Quality gaps: 0 tests, no TypeScript, no error boundaries

Start with ultrathink++ reasoning. Acknowledge the architecture before proceeding.
```

---

## Converge: Test Framework Setup

Sets up Vitest + React Testing Library for the project's first tests.

```
/converge

Task: Set up a test framework for Googol Vibe and write the first 10 tests.

Criterion: Vitest configured with jsdom, React Testing Library installed,
at least 10 tests passing across main process and renderer, npm test script
added, and CI build.yml updated with a test step.

Constraints:
- Use Vitest (not Jest) for Vite compatibility
- React Testing Library for component tests
- Mock electronAPI for renderer tests
- Test config-manager.js, notification-manager.js, recurrence-manager.js first
  (pure logic, no Electron dependencies needed for unit tests)
- For React components, test OnboardingWizard renders correctly
- Do NOT test against live Google APIs

Suggested test targets:
1. config-manager: _resolveConfigDir returns ~/.googol-vibe
2. config-manager: hasValidCredentials returns false when no file
3. config-manager: getOnboardingState returns correct shape
4. recurrence-manager: calculateNextDue with daily RRULE
5. recurrence-manager: buildRRule generates valid string
6. recurrence-manager: describe returns human-readable text
7. notification-manager: isQuietHours respects settings
8. notification-manager: show returns null when disabled
9. React: OnboardingWizard renders welcome step
10. React: App renders login button when not authenticated
```

---

## Converge: TypeScript Migration

Gradual TypeScript adoption starting with the main process.

```
/converge

Task: Begin TypeScript migration for Googol Vibe's Electron main process.

Criterion: tsconfig.json configured for gradual migration (allowJs: true),
at least 5 files converted to .ts with proper type annotations, no runtime
regressions, and electron-builder still produces working builds.

Constraints:
- Start with utility modules (config-manager, recurrence-manager, telemetry)
  as they have fewer Electron-specific types
- Use strict mode but with allowJs for unconverted files
- Add @types/node and electron type definitions
- Define interfaces for: ConfigState, OnboardingState, SyncStatus,
  RecurrenceRule, NotificationSettings
- Keep preload.js as JS (Electron preload has special requirements)
- Verify Vite builds still work after conversion

Migration order (by dependency depth, leaves first):
1. telemetry.js -> telemetry.ts
2. config-manager.js -> config-manager.ts
3. recurrence-manager.js -> recurrence-manager.ts
4. notification-manager.js -> notification-manager.ts
5. sync-controller.js -> sync-controller.ts
```

---

## Converge: Error Boundaries

Add React error boundaries to prevent single-widget crashes from taking down the entire dashboard.

```
/converge

Task: Add React error boundaries to Googol Vibe so individual widget
failures don't crash the entire dashboard.

Criterion: Each data section (Gmail, Calendar, Drive, Tasks, Documents,
Meetings, Agent) wrapped in its own error boundary with a recovery UI,
and a test for each boundary.

Constraints:
- Create a reusable ErrorBoundary component with Swiss Nihilism styling
- Each boundary shows: what failed, a retry button, and "last working" timestamp
- Add retry logic to data fetching (3 attempts with exponential backoff)
- Log errors to console (and Sentry if enabled)
- The error boundary should catch both render errors and async data fetch errors
- Do NOT use react-error-boundary package -- write a class component
  (it's educational and the project has no dependencies to add)

Widget boundaries needed:
1. Gmail inbox list
2. Calendar events list
3. Drive files grid
4. Documents grid
5. Meetings list
6. Tasks panel
7. Agent panel
```

---

## Converge: Vibe Agent Backend

Wire the AgentPanel component to an actual LLM instead of keyword matching.

```
/converge

Task: Wire the Vibe Agent to Claude API (or compatible LLM) so it can
intelligently respond to workspace queries.

Criterion: AgentPanel sends queries to an LLM with Google Workspace context,
receives streaming responses, and displays them with proper formatting.
The agent can summarise emails, suggest meeting prep, and find files.

Constraints:
- Use Anthropic API (Claude) via the official SDK
- API key stored in ~/.googol-vibe/config.json (never hardcoded)
- System prompt includes: user's recent emails, next 3 calendar events,
  recent files -- fetched fresh per query via existing IPC handlers
- Streaming response display in AgentPanel
- Token usage display (cost awareness)
- Fallback to keyword matching if no API key configured
- Add a settings UI for API key entry
- Rate limit: max 10 queries per minute client-side

Architecture:
- New IPC handler: ask-agent-llm (separate from existing ask-agent)
- New module: dashboard/electron/agent-backend.js
- AgentPanel checks for API key, routes to LLM or keyword fallback
```

---

## Converge: CI Enhancement

Add proper CI with testing, linting, and security scanning.

```
/converge

Task: Enhance the CI pipeline with test execution, linting, and
dependency security scanning.

Criterion: build.yml runs lint + tests before build, npm audit runs
on schedule, and PR checks block merge on test failure.

Constraints:
- Add test step to build.yml (depends on test framework being set up first)
- Add ESLint step (already configured in devDependencies)
- Add npm audit step for known vulnerabilities
- Add Dependabot configuration for automated dependency updates
- Keep build matrix (macOS + Windows)
- Do NOT modify workflow triggers or permissions
- Cache node_modules properly (npm ci with lockfile)

New workflow: security.yml
- Runs on: schedule (weekly) + pull_request
- Steps: npm audit, licence check
```

---

## Converge: Offline Cache

Add offline support with a sync queue for when network is unavailable.

```
/converge

Task: Add offline caching so the dashboard shows last-known data when
the network is unavailable, and queues write operations for sync.

Criterion: Dashboard renders cached data when offline, shows a clear
offline indicator, and queued task operations sync when back online.

Constraints:
- Cache last successful API response per service in ~/.googol-vibe/cache/
- Use file-based cache (consistent with existing storage model)
- Cache TTL: Gmail 5m, Calendar 15m, Tasks 15m, Drive 30m
- Write queue: task create/complete/update operations saved to disk
- Online/offline detection via Electron's net module
- Visual indicator in header (green dot = online, amber = syncing queue, red = offline)
- Sync queue processes FIFO when connection restores
- Max queue size: 50 operations (prevent unbounded disk usage)
```

---

## Quick Task Prompts

### Add file logging

```
Install electron-log and replace all console.log calls in the Electron main
process with a structured logger. Log to ~/.googol-vibe/logs/ with daily
rotation (keep 7 days). Keep console output in development mode.
```

### Extract App.jsx widgets

```
App.jsx is 965 lines. Extract each dashboard section into its own component:
GmailWidget, CalendarWidget, DriveWidget, TasksWidget, DocumentsWidget,
MeetingsWidget. Keep state management in App.jsx, pass data as props.
Each widget gets its own file in dashboard/src/components/widgets/.
```

### Add Google API retry logic

```
Create a utility function withRetry(fn, maxAttempts=3) that wraps Google API
calls with exponential backoff. Handle: 429 (rate limit -- respect Retry-After
header), 500/503 (server error -- retry after 1s/2s/4s), network errors.
Apply to all ipcMain.handle data fetching handlers in main.js.
```

### Migrate BrowserView to WebContentsView

```
BrowserView is deprecated in Electron 39. Migrate the view-content and
close-content handlers to use WebContentsView instead. The API surface is
similar but mounting differs. Test with Google Docs, Meet, and Drive previews.
```
