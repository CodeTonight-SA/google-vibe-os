# Novel Feature Proposals: Googol Vibe

> Feature proposals with effort/impact ratings for the product roadmap.
> Each rated on a 1-5 scale: Effort (1 = days, 5 = months), Impact (1 = nice-to-have, 5 = transformative).

---

## 1. AI-Powered Email Triage

**Effort: 3 | Impact: 5**

Automatically categorise and prioritise inbox emails using an LLM, surfacing
the messages that actually need attention.

### Problem
Users open Gmail and see 10+ messages with no priority signal. Important emails
from clients sit alongside newsletters and automated receipts. The current UI
shows them in chronological order with no differentiation.

### Solution
On each Gmail sync cycle, run new emails through a lightweight classification prompt:

```text
Categories: ACTION_REQUIRED, FYI, NEWSLETTER, AUTOMATED, PERSONAL
Priority: HIGH, MEDIUM, LOW
```

Display in the Gmail widget with colour-coded priority badges and a "Needs Action"
section at the top. Users can correct classifications, feeding back into the system.

### Technical Approach
- New module: `dashboard/electron/email-triage.js`
- Uses the existing `ask-agent` pattern but with a structured system prompt
- Classifications cached in `~/.googol-vibe/cache/email-triage.json`
- Renderer displays priority badges via CSS classes
- Feedback loop: user corrections stored and included in future prompts as examples

### Dependencies
- LLM API key (Claude or compatible)
- Email body access (currently only fetches metadata -- need `format: 'full'`)

---

## 2. Meeting Prep Assistant

**Effort: 3 | Impact: 4**

Before each meeting, automatically compile a briefing with relevant emails,
documents, and previous meeting notes involving the same attendees.

### Problem
Users spend 5-10 minutes before each meeting gathering context: finding the last
email thread with the attendee, locating the shared document, remembering what was
discussed previously. This is especially painful with back-to-back meetings.

### Solution
For each upcoming meeting (detected via calendar sync), generate a prep card:
- Attendee list with recent email threads
- Shared Drive documents (search by attendee email)
- Previous meetings with overlapping attendees
- Suggested talking points (LLM-generated from context)

Display as an expandable card in the Meetings widget, auto-generated 30 minutes
before the meeting start time.

### Technical Approach
- New IPC handler: `get-meeting-prep`
- Cross-reference calendar attendees with Gmail (search `from:attendee@email.com`)
- Cross-reference with Drive (shared files with attendee)
- Cache prep cards in `~/.googol-vibe/cache/meeting-prep/`
- LLM summarisation optional (works without API key, just shows raw data)

### Dependencies
- Calendar events with attendee data (already fetched with `conferenceDataVersion: 1`)
- Gmail search capability (add `q` parameter to existing handler)

---

## 3. Cross-Workspace Search

**Effort: 4 | Impact: 5**

A single search bar that queries Gmail, Calendar, Drive, and Tasks simultaneously,
returning unified results with relevance ranking.

### Problem
Users currently switch between Gmail search, Drive search, and Calendar search
to find what they need. There is no unified search across all Google services
from within the app.

### Solution
A persistent search bar in the dashboard header. Typing triggers parallel queries
across all four services. Results are displayed in a unified dropdown with
service-specific icons and keyboard navigation.

### Technical Approach
- New component: `dashboard/src/components/SearchBar.jsx`
- New IPC handler: `search-all` that fires parallel API calls:
  - Gmail: `users.messages.list` with `q` parameter
  - Calendar: `events.list` with `q` parameter
  - Drive: `files.list` with `q` parameter
  - Tasks: client-side filter (API has no search)
- Results normalised into `{ type, title, subtitle, link, timestamp }` shape
- Debounced input (300ms) to avoid API spam
- Keyboard shortcuts: Cmd/Ctrl+K to focus, arrow keys to navigate, Enter to open

### Dependencies
- No new API scopes required (existing read-only scopes support search)
- Performance: 4 parallel API calls per keystroke (after debounce)

---

## 4. Smart Notification Grouping

**Effort: 2 | Impact: 3**

Group related notifications to prevent notification fatigue from high-volume
email threads or rapid calendar changes.

### Problem
A busy email thread can generate 5+ notifications in rapid succession. Each
calendar change (reschedule, attendee update) triggers a new notification.
Users disable notifications entirely because of the noise.

### Solution
Notifications within a 5-minute window from the same source get grouped:
- "3 new emails in thread: Q3 Budget Review"
- "Meeting updated 2x: Sprint Planning (new time: 14:00)"

### Technical Approach
- Extend `notification-manager.js` with a grouping buffer
- Buffer collects notifications for 5 seconds before displaying
- Group key: email thread ID or calendar event ID
- Grouped notification shows count and latest subject
- Configuration: grouping window (default 5s), max group size (default 10)

### Dependencies
- Email thread ID (available in Gmail API response, not currently extracted)
- Minor change to `sync-controller.js` to pass thread IDs

---

## 5. Quick Reply Templates

**Effort: 2 | Impact: 3**

Pre-defined email reply templates accessible from the Gmail widget for
rapid responses to common email types.

### Problem
Many emails require a quick acknowledgement ("Thanks, I'll review this",
"Let's discuss in our next meeting", "Approved"). Users must open Gmail
in a browser to send these responses.

### Solution
Right-click (or swipe) on an email in the Gmail widget to reveal quick reply
options. Templates are user-customisable and stored locally.

### Technical Approach
- New component: `dashboard/src/components/QuickReplyMenu.jsx`
- Templates stored in `~/.googol-vibe/config.json` under `quickReplies` key
- Default templates: "Thanks, received", "I'll look into this", "Approved",
  "Let's discuss", custom template editor
- New scope required: `gmail.send` (currently read-only)
- New IPC handler: `send-quick-reply` using Gmail API `users.messages.send`
- Confirmation modal before sending (prevent accidental replies)

### Dependencies
- **Breaking change**: requires `gmail.send` scope (user must re-authenticate)
- New Gmail MCP tool overlap (coordinate with MCP server)

---

## 6. Drive File Preview

**Effort: 2 | Impact: 3**

Inline preview of Drive files (PDF, images, Docs) without opening a browser
window, displayed in a slide-out panel.

### Problem
Clicking a Drive file currently opens it in a BrowserView, which takes over
the entire dashboard. Users lose context of their email/calendar while viewing
a document.

### Solution
A slide-out panel (right side, 40% width) that renders file previews:
- PDFs: embedded viewer
- Images: native display
- Google Docs/Sheets/Slides: embedded preview URL
- Other files: metadata + "Open in browser" link

### Technical Approach
- New component: `dashboard/src/components/FilePreview.jsx`
- Use Google Drive API `files.export` for Google Docs preview
- Use `thumbnailLink` (already fetched) for quick preview
- For full preview: embed Google's preview URL in an iframe
- Slide-out panel with framer-motion animation (consistent with Swiss Nihilism)
- Close on Escape or click outside

### Dependencies
- No new API scopes (Drive read-only supports thumbnails and export)
- May need to adjust CSP to allow Google Docs iframe embedding

---

## 7. Calendar Conflict Detection

**Effort: 2 | Impact: 4**

Proactively warn users about scheduling conflicts and suggest resolution
when new events overlap with existing commitments.

### Problem
The calendar widget shows upcoming events but does not highlight conflicts.
Users discover double-bookings only when they look closely at times.

### Solution
During each calendar sync, compare event time ranges for overlaps. Display
conflict indicators (red highlight) on overlapping events. Show a resolution
prompt: "You have 2 events at 14:00 -- which takes priority?"

### Technical Approach
- New utility: `dashboard/electron/conflict-detector.js`
- Run after each calendar sync in `sync-controller.js`
- O(n log n) interval overlap detection (sort by start time, scan for overlaps)
- Conflict data sent to renderer via IPC event: `calendar-conflicts-detected`
- Renderer highlights conflicting events with red border
- Optional: suggest declining one event (requires calendar write scope)

### Dependencies
- No new API scopes for detection (read-only sufficient)
- Write scope needed only for the "decline" suggestion feature

---

## 8. Offline Mode with Sync Queue

**Effort: 4 | Impact: 4**

Cache all data locally so the dashboard is usable offline, with a write queue
that syncs when connectivity restores.

### Problem
If the network drops or Google APIs are unavailable, the entire dashboard shows
empty widgets. Users cannot even view their last-known schedule or task list.

### Solution
Cache the last successful API response per service in local files. When a fetch
fails, fall back to cached data with a staleness indicator. Queue write operations
(task create/complete/update) for replay when online.

### Technical Approach
- New module: `dashboard/electron/cache-manager.js`
- Cache directory: `~/.googol-vibe/cache/`
- Per-service cache files: `gmail.json`, `calendar.json`, `tasks.json`, `drive.json`
- Cache TTL: Gmail 5m, Calendar 15m, Tasks 15m, Drive 30m
- Write queue: `~/.googol-vibe/cache/write-queue.json` (FIFO, max 50 operations)
- Online/offline detection: `electron.net.isOnline()` polled every 10s
- Visual indicator in dashboard header:
  - Green dot: online, data fresh
  - Amber dot: online, syncing queued writes
  - Grey dot: offline, showing cached data
  - Red dot: offline, write queue full

### Dependencies
- No new API scopes
- Requires careful conflict resolution for task operations (e.g., task deleted
  while offline, then complete operation replayed -- handle 404 gracefully)

---

## Priority Matrix

```text
         Impact
    5 |  [1]        [3]
      |
    4 |  [2] [7]    [8]
      |
    3 |  [4] [5][6]
      |
    2 |
      |
    1 |
      +--+----+----+----+----+--
         1    2    3    4    5
                  Effort
```

**Recommended implementation order** (highest value-to-effort ratio first):

1. **Calendar Conflict Detection** (#7) -- Effort 2, Impact 4, ratio 2.0
2. **Smart Notification Grouping** (#4) -- Effort 2, Impact 3, ratio 1.5
3. **AI-Powered Email Triage** (#1) -- Effort 3, Impact 5, ratio 1.67
4. **Meeting Prep Assistant** (#2) -- Effort 3, Impact 4, ratio 1.33
5. **Drive File Preview** (#6) -- Effort 2, Impact 3, ratio 1.5
6. **Quick Reply Templates** (#5) -- Effort 2, Impact 3, ratio 1.5
7. **Cross-Workspace Search** (#3) -- Effort 4, Impact 5, ratio 1.25
8. **Offline Mode** (#8) -- Effort 4, Impact 4, ratio 1.0

Note: Features 1 and 2 require an LLM API key. Features 5 and 7 (decline) require
additional Google API scopes. Features 3, 4, 6, and 7 (detection only) work with
existing scopes.
