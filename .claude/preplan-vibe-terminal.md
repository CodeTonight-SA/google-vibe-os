# Preplan: Vibe Terminal - Slash Commands

**Status:** EXECUTED 2025-12-26
**Estimated:** ~800 tokens
**Mode:** ut++

---

## Design

Bash-style slash commands for Google Vibe OS terminal.
Reuses existing Electron IPC - zero backend changes.

---

## Commands

| Command | Action | Args |
|---------|--------|------|
| `/inbox [n]` | List unread emails | n = count (default 5) |
| `/cal [range]` | Show events | today, week (default today) |
| `/drive [n]` | Recent files | n = count (default 5) |
| `/help` | Command reference | - |
| `/clear` | Clear terminal | - |

---

## Output Format

```
> /inbox 3

INBOX (3 unread)
────────────────────────────────────────
01  Google Security              3:19 AM
    Security alert

02  GitHub                       Yesterday
    [GitHub] Pull request merged

03  Slack                        Dec 24
    New message in #general
```

```
> /cal

CALENDAR - Today
────────────────────────────────────────
09:00  Team Standup              30m
       Google Meet

14:00  Client Call               1h
       Zoom
```

---

## Implementation

### File: AgentPanel.jsx

```jsx
// Constants
const HELP_TEXT = `
VIBE TERMINAL
────────────────────────────────────────
/inbox [n]     List unread emails (default 5)
/cal [range]   Events: today, week (default today)
/drive [n]     Recent files (default 5)
/clear         Clear terminal
/help          This help message

Anything else is sent to the AI agent.
`;

// Parser
const parseCommand = (input) => {
    if (!input.startsWith('/')) return null;
    const parts = input.trim().slice(1).split(/\s+/);
    return { cmd: parts[0].toLowerCase(), args: parts.slice(1) };
};

// Formatters
const formatInbox = (emails, limit = 5) => {
    const list = emails.slice(0, limit);
    if (!list.length) return 'INBOX\n────────────────────────────────────────\nNo unread emails';

    const lines = list.map((e, i) => {
        const from = e.from.split('<')[0].replace(/"/g, '').trim();
        const date = new Date(e.date);
        const time = formatTime(date);
        return `${String(i + 1).padStart(2, '0')}  ${from.slice(0, 28).padEnd(28)}  ${time}\n    ${e.subject.slice(0, 40)}`;
    });

    return `INBOX (${emails.length} unread)\n────────────────────────────────────────\n${lines.join('\n\n')}`;
};

const formatCalendar = (events, range = 'today') => {
    // Filter by range
    const now = new Date();
    const filtered = events.filter(e => {
        const start = new Date(e.start);
        if (range === 'today') {
            return start.toDateString() === now.toDateString();
        }
        if (range === 'week') {
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() + 7);
            return start <= weekEnd;
        }
        return true;
    });

    if (!filtered.length) return `CALENDAR - ${range.toUpperCase()}\n────────────────────────────────────────\nNo events`;

    const lines = filtered.map(e => {
        const start = new Date(e.start);
        const time = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${time}  ${e.summary.slice(0, 35)}`;
    });

    return `CALENDAR - ${range.toUpperCase()}\n────────────────────────────────────────\n${lines.join('\n')}`;
};

const formatDrive = (files, limit = 5) => {
    const list = files.slice(0, limit);
    if (!list.length) return 'DRIVE\n────────────────────────────────────────\nNo recent files';

    const lines = list.map((f, i) => {
        return `${String(i + 1).padStart(2, '0')}  ${f.name.slice(0, 40)}`;
    });

    return `DRIVE (${files.length} recent)\n────────────────────────────────────────\n${lines.join('\n')}`;
};

const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Execute command
const executeCommand = async (cmd, args) => {
    try {
        switch (cmd) {
            case 'inbox': {
                const n = parseInt(args[0]) || 5;
                const emails = await window.electronAPI.getGmail();
                return formatInbox(emails, n);
            }
            case 'cal':
            case 'calendar': {
                const range = args[0] || 'today';
                const events = await window.electronAPI.getCalendar();
                return formatCalendar(events, range);
            }
            case 'drive': {
                const n = parseInt(args[0]) || 5;
                const files = await window.electronAPI.getDrive();
                return formatDrive(files, n);
            }
            case 'help':
                return HELP_TEXT;
            case 'clear':
                return '__CLEAR__';
            default:
                return `Unknown command: /${cmd}\nType /help for available commands`;
        }
    } catch (err) {
        return `Error: ${err.message}`;
    }
};
```

### Modified handleSend

```jsx
const handleSend = async () => {
    if (!input.trim()) return;
    const query = input;
    setInput('');

    // Add user message
    setMessages(prev => [...prev, { role: 'user', text: query }]);

    // Check for slash command
    const command = parseCommand(query);

    if (command) {
        const output = await executeCommand(command.cmd, command.args);

        if (output === '__CLEAR__') {
            setMessages([{ role: 'system', text: 'Terminal cleared.' }]);
        } else {
            setMessages(prev => [...prev, { role: 'system', text: output }]);
        }
    } else {
        // Natural language → AI agent
        try {
            const response = await window.electronAPI.askAgent(query);
            setMessages(prev => [...prev, { role: 'agent', text: response }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'agent', text: `Error: ${e.message}` }]);
        }
    }
};
```

### System message styling (in render)

```jsx
// Different styling for system (command output) vs agent
{msg.role === 'system' && (
    <div style={{
        padding: '12px 16px',
        background: '#1f2937',
        color: '#9ca3af',
        fontFamily: 'ui-monospace, "SF Mono", monospace',
        fontSize: '0.8rem',
        whiteSpace: 'pre-wrap',
        borderLeft: '2px solid #ea580c',
        lineHeight: 1.6
    }}>
        {msg.text}
    </div>
)}
```

---

## Execution Checklist

- [ ] Add constants (HELP_TEXT)
- [ ] Add parseCommand()
- [ ] Add formatInbox(), formatCalendar(), formatDrive(), formatTime()
- [ ] Add executeCommand()
- [ ] Update handleSend() with command detection
- [ ] Add system message styling in render
- [ ] Update initial message to mention /help

---

## KISS Validation

1. Zero Electron/backend changes
2. Reuses existing getGmail/getCalendar/getDrive
3. ~100 lines of new code
4. No external dependencies
5. Familiar slash command pattern
