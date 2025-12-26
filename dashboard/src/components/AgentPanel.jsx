import React, { useState } from 'react';
import { Send, Terminal, ChevronRight } from 'lucide-react';
import WaitlistModal from './WaitlistModal';

// Help text
const HELP_TEXT = `VIBE TERMINAL
────────────────────────────────────────
/inbox [n]     List unread emails (default 5)
/cal [range]   Events: today, week (default today)
/drive [n]     Recent files (default 5)
/clear         Clear terminal
/help          This help message

Anything else is sent to the AI agent.`;

// Command parser
const parseCommand = (input) => {
    if (!input.startsWith('/')) return null;
    const parts = input.trim().slice(1).split(/\s+/);
    return { cmd: parts[0].toLowerCase(), args: parts.slice(1) };
};

// Time formatter
const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Inbox formatter
const formatInbox = (emails, limit = 5) => {
    const list = emails.slice(0, limit);
    if (!list.length) return 'INBOX\n────────────────────────────────────────\nNo unread emails';

    const lines = list.map((e, i) => {
        const from = e.from.split('<')[0].replace(/"/g, '').trim();
        const date = new Date(e.date);
        const time = formatTime(date);
        const num = String(i + 1).padStart(2, '0');
        const fromPad = from.slice(0, 26).padEnd(26);
        return `${num}  ${fromPad}  ${time}\n    ${e.subject.slice(0, 38)}`;
    });

    return `INBOX (${emails.length} unread)\n────────────────────────────────────────\n${lines.join('\n\n')}`;
};

// Calendar formatter
const formatCalendar = (events, range = 'today') => {
    const now = new Date();
    const filtered = events.filter(e => {
        if (!e.start) return false;
        const start = new Date(e.start);
        if (range === 'today') {
            return start.toDateString() === now.toDateString();
        }
        if (range === 'week') {
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() + 7);
            return start >= now && start <= weekEnd;
        }
        return true;
    });

    if (!filtered.length) return `CALENDAR - ${range.toUpperCase()}\n────────────────────────────────────────\nNo events`;

    const lines = filtered.map(e => {
        const start = new Date(e.start);
        const time = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${time}  ${e.summary.slice(0, 32)}`;
    });

    return `CALENDAR - ${range.toUpperCase()}\n────────────────────────────────────────\n${lines.join('\n')}`;
};

// Drive formatter
const formatDrive = (files, limit = 5) => {
    const list = files.slice(0, limit);
    if (!list.length) return 'DRIVE\n────────────────────────────────────────\nNo recent files';

    const lines = list.map((f, i) => {
        const num = String(i + 1).padStart(2, '0');
        return `${num}  ${f.name.slice(0, 38)}`;
    });

    return `DRIVE (${files.length} recent)\n────────────────────────────────────────\n${lines.join('\n')}`;
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

const AgentPanel = ({ context }) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'system', text: 'VIBE TERMINAL v1.0\n────────────────────────────────────────\nType /help for commands, or ask anything.' }
    ]);
    const [showWaitlist, setShowWaitlist] = useState(false);
    const [pendingQuery, setPendingQuery] = useState('');

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
            // Natural language → Show waitlist for AI premium feature
            setPendingQuery(query);
            setShowWaitlist(true);
            setMessages(prev => [...prev, {
                role: 'system',
                text: 'VIBE AI\n────────────────────────────────────────\nAI-powered automation is coming soon.\nJoin the waitlist for early access.'
            }]);
        }
    };

    const handleQuickAction = (cmd) => {
        setInput(cmd);
    };

    // Message styling based on role
    const getMessageStyle = (role) => {
        const base = {
            display: 'block',
            padding: '10px 14px',
            borderRadius: 0,
            color: '#f3f4f6',
            maxWidth: '100%',
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5
        };

        if (role === 'user') {
            return { ...base, background: '#ea580c' };
        }
        if (role === 'system') {
            return {
                ...base,
                background: '#1f2937',
                fontFamily: 'ui-monospace, "SF Mono", monospace',
                borderLeft: '2px solid #ea580c',
                color: '#d1d5db'
            };
        }
        // agent
        return {
            ...base,
            background: '#374151',
            fontFamily: 'ui-monospace, "SF Mono", monospace',
            borderLeft: '2px solid #6b7280'
        };
    };

    return (
        <>
        <WaitlistModal
            isOpen={showWaitlist}
            onClose={() => setShowWaitlist(false)}
            userQuery={pendingQuery}
        />
        <div className="card agent-panel" style={{ height: 'calc(100vh - 140px)' }}>
            <div className="card-header">
                <div className="card-title">
                    <Terminal size={18} />
                    <span>Vibe Terminal</span>
                </div>
                <div className="badge">Active</div>
            </div>

            <div className="agent-chat-area">
                {messages.map((msg, i) => (
                    <div key={i} style={{ marginBottom: '12px', textAlign: 'left' }}>
                        <div style={getMessageStyle(msg.role)}>
                            {msg.role === 'system' && (
                                <span style={{ color: '#ea580c', marginRight: 8 }}>&gt;</span>
                            )}
                            {msg.role === 'agent' && (
                                <span style={{ color: '#6b7280', marginRight: 8 }}>AI&gt;</span>
                            )}
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>

            <div className="agent-input-container">
                <input
                    type="text"
                    className="agent-input"
                    placeholder="/help or ask anything..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button
                    onClick={handleSend}
                    style={{
                        background: '#ea580c',
                        color: 'white',
                        border: 'none',
                        borderRadius: 0,
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#c2410c'}
                    onMouseLeave={(e) => e.target.style.background = '#ea580c'}
                >
                    <Send size={18} />
                </button>
            </div>

            <div style={{ marginTop: '16px', borderTop: '1px solid #374151', paddingTop: '16px' }}>
                <div style={{
                    fontFamily: 'ui-monospace, "SF Mono", monospace',
                    fontSize: '0.625rem',
                    color: '#9ca3af',
                    marginBottom: '12px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                }}>Quick Commands</div>
                <div
                    className="list-item"
                    style={{ padding: '10px 0', borderBottom: '1px solid #374151', background: 'transparent', cursor: 'pointer' }}
                    onClick={() => handleQuickAction('/inbox')}
                >
                    <ChevronRight size={14} color="#ea580c" style={{ marginRight: '8px' }} />
                    <span style={{ fontSize: '0.85rem', color: '#d1d5db', fontFamily: 'ui-monospace' }}>/inbox</span>
                </div>
                <div
                    className="list-item"
                    style={{ padding: '10px 0', borderBottom: '1px solid #374151', background: 'transparent', cursor: 'pointer' }}
                    onClick={() => handleQuickAction('/cal')}
                >
                    <ChevronRight size={14} color="#ea580c" style={{ marginRight: '8px' }} />
                    <span style={{ fontSize: '0.85rem', color: '#d1d5db', fontFamily: 'ui-monospace' }}>/cal</span>
                </div>
                <div
                    className="list-item"
                    style={{ padding: '10px 0', borderBottom: 'none', background: 'transparent', cursor: 'pointer' }}
                    onClick={() => handleQuickAction('/drive')}
                >
                    <ChevronRight size={14} color="#ea580c" style={{ marginRight: '8px' }} />
                    <span style={{ fontSize: '0.85rem', color: '#d1d5db', fontFamily: 'ui-monospace' }}>/drive</span>
                </div>
            </div>
        </div>
        </>
    );
};

export default AgentPanel;
