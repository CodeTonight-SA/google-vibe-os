import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Terminal, ChevronRight, RotateCcw, Settings } from 'lucide-react';

// ============================================================
// Help text & Slash Command Infrastructure (unchanged)
// ============================================================

const HELP_TEXT = `VIBE TERMINAL
────────────────────────────────────────
/inbox [n]     List unread emails (default 5)
/cal [range]   Events: today, week (default today)
/drive [n]     Recent files (default 5)
/clear         Clear terminal
/help          This help message

Anything else is sent to the AI agent.`;

const parseCommand = (input) => {
    if (!input.startsWith('/')) return null;
    const parts = input.trim().slice(1).split(/\s+/);
    return { cmd: parts[0].toLowerCase(), args: parts.slice(1) };
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

const formatDrive = (files, limit = 5) => {
    const list = files.slice(0, limit);
    if (!list.length) return 'DRIVE\n────────────────────────────────────────\nNo recent files';

    const lines = list.map((f, i) => {
        const num = String(i + 1).padStart(2, '0');
        return `${num}  ${f.name.slice(0, 38)}`;
    });

    return `DRIVE (${files.length} recent)\n────────────────────────────────────────\n${lines.join('\n')}`;
};

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

// ============================================================
// Message Styling
// ============================================================

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
        return { ...base, background: 'var(--accent-brand)' };
    }
    if (role === 'system') {
        return {
            ...base,
            background: '#1f2937',
            fontFamily: 'ui-monospace, "SF Mono", monospace',
            borderLeft: '2px solid var(--accent-brand)',
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

// ============================================================
// AgentPanel Component
// ============================================================

const AgentPanel = ({ context, onOpenSettings }) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'system', text: 'VIBE TERMINAL v2.0\n────────────────────────────────────────\nType /help for commands, or ask anything.' }
    ]);

    // AI Streaming state
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [streamStatus, setStreamStatus] = useState('');
    const [apiKeyConfigured, setApiKeyConfigured] = useState(null); // null = loading
    const [sessionId, setSessionId] = useState(null);

    // Refs
    const chatAreaRef = useRef(null);
    const inputRef = useRef(null);
    const streamingTextRef = useRef(''); // Mutable ref to avoid stale closures in event handlers

    // ========================================
    // Initialisation
    // ========================================

    // Check API key status and create session on mount
    useEffect(() => {
        async function init() {
            try {
                const [keyStatus, session] = await Promise.all([
                    window.electronAPI.getAnthropicKeyStatus(),
                    window.electronAPI.startNewAiSession()
                ]);
                setApiKeyConfigured(keyStatus.configured);
                setSessionId(session.sessionId);
            } catch (e) {
                console.error('Agent init failed:', e);
                setApiKeyConfigured(false);
            }
        }
        init();
    }, []);

    // ========================================
    // Stream Event Listeners
    // ========================================

    useEffect(() => {
        const handleChunk = (data) => {
            if (data.status) {
                setStreamStatus(data.status);
            }
            if (data.text) {
                streamingTextRef.current += data.text;
                setStreamingText(streamingTextRef.current);
                setStreamStatus(''); // Clear status when text arrives
            }
        };

        const handleEnd = () => {
            // Finalise: move streaming text into messages array
            const finalText = streamingTextRef.current;
            if (finalText.trim()) {
                setMessages(prev => [...prev, { role: 'agent', text: finalText }]);
            }
            setStreamingText('');
            streamingTextRef.current = '';
            setStreamStatus('');
            setIsStreaming(false);
        };

        const handleError = (data) => {
            const errorText = streamingTextRef.current
                ? streamingTextRef.current + '\n\n[Error: ' + (data.error || 'Stream interrupted') + ']'
                : 'Error: ' + (data.error || 'Something went wrong');

            setMessages(prev => [...prev, { role: 'system', text: errorText }]);
            setStreamingText('');
            streamingTextRef.current = '';
            setStreamStatus('');
            setIsStreaming(false);
        };

        window.electronAPI.onAgentStreamChunk(handleChunk);
        window.electronAPI.onAgentStreamEnd(handleEnd);
        window.electronAPI.onAgentStreamError(handleError);

        return () => {
            window.electronAPI.removeAgentStreamListeners();
        };
    }, []);

    // ========================================
    // Auto-scroll on new content
    // ========================================

    useEffect(() => {
        if (chatAreaRef.current) {
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
    }, [messages, streamingText, streamStatus]);

    // ========================================
    // Send Handler
    // ========================================

    const handleSend = useCallback(async () => {
        if (!input.trim() || isStreaming) return;
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
            if (!apiKeyConfigured) {
                setMessages(prev => [...prev, {
                    role: 'system',
                    text: 'AI agent requires an Anthropic API key.\nGo to Settings > AI Configuration to add your key.'
                }]);
                return;
            }

            if (!sessionId) {
                setMessages(prev => [...prev, {
                    role: 'system',
                    text: 'Session not ready. Please wait a moment and try again.'
                }]);
                return;
            }

            // Start streaming
            setIsStreaming(true);
            setStreamingText('');
            streamingTextRef.current = '';
            setStreamStatus('');

            try {
                const result = await window.electronAPI.askAgentStream(query, sessionId);
                if (!result.success && result.error) {
                    // Handle non-stream errors (e.g., key not configured)
                    // The error handler above handles stream errors
                    if (!streamingTextRef.current) {
                        setMessages(prev => [...prev, { role: 'system', text: 'Error: ' + result.error }]);
                        setIsStreaming(false);
                    }
                }
            } catch (e) {
                if (!streamingTextRef.current) {
                    setMessages(prev => [...prev, { role: 'system', text: 'Error: ' + e.message }]);
                    setIsStreaming(false);
                }
            }
        }
    }, [input, isStreaming, apiKeyConfigured, sessionId]);

    // ========================================
    // New Chat
    // ========================================

    const handleNewChat = useCallback(async () => {
        if (isStreaming) return;
        try {
            const session = await window.electronAPI.startNewAiSession();
            setSessionId(session.sessionId);
            setMessages([{
                role: 'system',
                text: 'VIBE TERMINAL v2.0\n────────────────────────────────────────\nNew session started.\nType /help for commands, or ask anything.'
            }]);
            setStreamingText('');
            streamingTextRef.current = '';
            setStreamStatus('');
            inputRef.current?.focus();
        } catch (e) {
            console.error('Failed to start new session:', e);
        }
    }, [isStreaming]);

    // ========================================
    // Quick Actions
    // ========================================

    const handleQuickAction = (cmd) => {
        if (isStreaming) return;
        setInput(cmd);
        inputRef.current?.focus();
    };

    // ========================================
    // Render
    // ========================================

    return (
        <div className="card agent-panel" style={{ height: 'calc(100vh - 140px)' }}>
            <div className="card-header">
                <div className="card-title">
                    <Terminal size={18} />
                    <span>Vibe Terminal</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={handleNewChat}
                        disabled={isStreaming}
                        title="New Chat"
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '4px',
                            color: '#9ca3af',
                            cursor: isStreaming ? 'not-allowed' : 'pointer',
                            padding: '4px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            opacity: isStreaming ? 0.5 : 1,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { if (!isStreaming) e.currentTarget.style.borderColor = 'var(--accent-brand)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                    >
                        <RotateCcw size={12} />
                        New
                    </button>
                    <div className="badge">{isStreaming ? 'Streaming' : 'Active'}</div>
                </div>
            </div>

            <div className="agent-chat-area" ref={chatAreaRef}>
                {/* Rendered messages */}
                {messages.map((msg, i) => (
                    <div key={i} style={{ marginBottom: '12px', textAlign: 'left' }}>
                        <div style={getMessageStyle(msg.role)}>
                            {msg.role === 'system' && (
                                <span style={{ color: 'var(--accent-brand)', marginRight: 8 }}>&gt;</span>
                            )}
                            {msg.role === 'agent' && (
                                <span style={{ color: '#6b7280', marginRight: 8 }}>AI&gt;</span>
                            )}
                            {msg.text}
                        </div>
                    </div>
                ))}

                {/* Streaming in-progress message */}
                {isStreaming && (
                    <div style={{ marginBottom: '12px', textAlign: 'left' }}>
                        <div style={getMessageStyle('agent')}>
                            <span style={{ color: '#6b7280', marginRight: 8 }}>AI&gt;</span>
                            {streamStatus && !streamingText && (
                                <span style={{ color: '#f59e0b', fontStyle: 'italic' }}>
                                    {streamStatus}
                                </span>
                            )}
                            {streamingText || (!streamStatus && (
                                <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                                    Thinking...
                                </span>
                            ))}
                            {streamStatus && streamingText && (
                                <span style={{ color: '#f59e0b', fontStyle: 'italic', display: 'block', marginTop: '4px', fontSize: '0.8rem' }}>
                                    {streamStatus}
                                </span>
                            )}
                            <span className="agent-cursor">|</span>
                        </div>
                    </div>
                )}
            </div>

            {/* API key not configured banner */}
            {apiKeyConfigured === false && (
                <div style={{
                    padding: '10px 14px',
                    background: '#1f2937',
                    borderTop: '1px solid #374151',
                    fontSize: '0.8rem',
                    color: '#9ca3af',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>AI requires an API key to work.</span>
                    {onOpenSettings && (
                        <button
                            onClick={onOpenSettings}
                            style={{
                                background: 'var(--accent-brand)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <Settings size={12} /> Setup
                        </button>
                    )}
                </div>
            )}

            <div className="agent-input-container">
                <input
                    ref={inputRef}
                    type="text"
                    className="agent-input"
                    placeholder={isStreaming ? 'Waiting for response...' : '/help or ask anything...'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={isStreaming}
                />
                <button
                    onClick={handleSend}
                    disabled={isStreaming || !input.trim()}
                    style={{
                        background: (isStreaming || !input.trim()) ? '#4b5563' : 'var(--accent-brand)',
                        color: 'var(--text-on-accent)',
                        border: 'none',
                        borderRadius: 0,
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: (isStreaming || !input.trim()) ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => { if (!isStreaming && input.trim()) e.target.style.background = '#c2410c'; }}
                    onMouseLeave={(e) => { if (!isStreaming && input.trim()) e.target.style.background = 'var(--accent-brand)'; }}
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
                    style={{ padding: '10px 0', borderBottom: '1px solid #374151', background: 'transparent', cursor: isStreaming ? 'not-allowed' : 'pointer', opacity: isStreaming ? 0.5 : 1 }}
                    onClick={() => handleQuickAction('/inbox')}
                >
                    <ChevronRight size={14} color="var(--accent-brand)" style={{ marginRight: '8px' }} />
                    <span style={{ fontSize: '0.85rem', color: '#d1d5db', fontFamily: 'ui-monospace' }}>/inbox</span>
                </div>
                <div
                    className="list-item"
                    style={{ padding: '10px 0', borderBottom: '1px solid #374151', background: 'transparent', cursor: isStreaming ? 'not-allowed' : 'pointer', opacity: isStreaming ? 0.5 : 1 }}
                    onClick={() => handleQuickAction('/cal')}
                >
                    <ChevronRight size={14} color="var(--accent-brand)" style={{ marginRight: '8px' }} />
                    <span style={{ fontSize: '0.85rem', color: '#d1d5db', fontFamily: 'ui-monospace' }}>/cal</span>
                </div>
                <div
                    className="list-item"
                    style={{ padding: '10px 0', borderBottom: 'none', background: 'transparent', cursor: isStreaming ? 'not-allowed' : 'pointer', opacity: isStreaming ? 0.5 : 1 }}
                    onClick={() => handleQuickAction('/drive')}
                >
                    <ChevronRight size={14} color="var(--accent-brand)" style={{ marginRight: '8px' }} />
                    <span style={{ fontSize: '0.85rem', color: '#d1d5db', fontFamily: 'ui-monospace' }}>/drive</span>
                </div>
            </div>
        </div>
    );
};

export default AgentPanel;
