const Anthropic = require('@anthropic-ai/sdk');
const secureStorage = require('./secure-storage');
const aiMemory = require('./ai-memory');
const log = require('./logger');

const CHAT_MODEL = 'claude-sonnet-4-6';
const TEST_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 2048;
const MAX_LOOP_ITERATIONS = 10;

let anthropicClient = null;
let googleTools = null;
let mainWindow = null;
let appVersion = '1.0.0';
let authClient = null;
let userProfile = null;

// ============================================================
// Initialisation
// ============================================================

function buildClient() {
    const key = secureStorage.getKey();
    if (!key) return null;
    return new Anthropic({ apiKey: key });
}

function init(tools, window) {
    googleTools = tools;
    mainWindow = window;
    anthropicClient = buildClient();
    log.info('[AIAgent] Initialised. Client ready:', !!anthropicClient);
}

function setAppVersion(version) { appVersion = version; }
function setAuthClient(client) { authClient = client; }
function setUserProfile(profile) { userProfile = profile; }

function refreshClient() {
    anthropicClient = buildClient();
    log.info('[AIAgent] Client refreshed. Ready:', !!anthropicClient);
}

// ============================================================
// IPC Event Helpers
// ============================================================

function sendChunk(data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent-stream-chunk', data);
    }
}

function sendEnd() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent-stream-end', {});
    }
}

function sendError(error) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent-stream-error', { error });
    }
}

// ============================================================
// System Prompt
// ============================================================

function buildSystemPrompt() {
    const name = userProfile?.name || 'User';
    const email = userProfile?.email || '';
    const now = new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
    return `You are Vibe, an AI assistant built into Googol Vibe — a Google Workspace dashboard for ENTER Konsult.

User: ${name}${email ? ` <${email}>` : ''}
App version: ${appVersion}
Current time: ${now}

You have access to the user's Google Workspace data via tools. Use them when relevant to answer questions about emails, calendar events, drive files, and tasks. Only call tools when needed — don't call them speculatively.

Style: concise, direct, terminal-style output. Plain text. Short lines. No markdown headers or bullet lists unless formatting is genuinely useful.`;
}

// ============================================================
// Tool Definitions
// ============================================================

const TOOL_DEFINITIONS = [
    {
        name: 'get_gmail',
        description: 'Fetch recent emails from the Gmail inbox.',
        input_schema: {
            type: 'object',
            properties: {
                count: { type: 'number', description: 'Emails to fetch (default 5, max 20)' }
            },
            required: []
        }
    },
    {
        name: 'get_calendar',
        description: 'Fetch upcoming calendar events.',
        input_schema: {
            type: 'object',
            properties: {
                days: { type: 'number', description: 'Days ahead to look (default 7)' }
            },
            required: []
        }
    },
    {
        name: 'get_drive',
        description: 'Fetch recent files from Google Drive.',
        input_schema: {
            type: 'object',
            properties: {
                count: { type: 'number', description: 'Files to return (default 5)' },
                type: {
                    type: 'string',
                    enum: ['all', 'documents', 'spreadsheets', 'presentations'],
                    description: 'File type filter (default all)'
                }
            },
            required: []
        }
    },
    {
        name: 'get_tasks',
        description: 'Fetch tasks from Google Tasks.',
        input_schema: {
            type: 'object',
            properties: {
                count: { type: 'number', description: 'Tasks to fetch (default 10)' }
            },
            required: []
        }
    },
    {
        name: 'create_task',
        description: 'Create a new task in Google Tasks.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Task title' },
                due: { type: 'string', description: 'Due date in ISO 8601 format (optional)' },
                notes: { type: 'string', description: 'Task notes (optional)' }
            },
            required: ['title']
        }
    }
];

// ============================================================
// Tool Execution
// ============================================================

async function executeTool(name, input) {
    if (!authClient) {
        return { error: 'Not authenticated with Google. Please log in first.' };
    }
    try {
        switch (name) {
            case 'get_gmail':
                return await googleTools.fetchGmail(authClient, Math.min(input.count || 5, 20));
            case 'get_calendar':
                return await googleTools.fetchCalendar(authClient, input.days || 7);
            case 'get_drive':
                return await googleTools.fetchDrive(authClient, input.count || 5, input.type || 'all');
            case 'get_tasks': {
                const result = await googleTools.fetchTasks(authClient, input.count || 10);
                return result.tasks || result;
            }
            case 'create_task':
                return await googleTools.createTask(authClient, input.title, input.due, input.notes);
            default:
                return { error: `Unknown tool: ${name}` };
        }
    } catch (e) {
        log.error(`[AIAgent] Tool ${name} failed:`, e.message);
        return { error: e.message };
    }
}

// ============================================================
// Agent Loop
// ============================================================

async function runAgentLoop(messages, sessionId) {
    const system = buildSystemPrompt();
    let iterations = 0;

    while (iterations < MAX_LOOP_ITERATIONS) {
        iterations++;

        if (iterations === 1) {
            sendChunk({ status: 'Thinking...' });
        }

        let fullText = '';
        const toolUseBlocks = [];

        const stream = anthropicClient.messages.stream({
            model: CHAT_MODEL,
            max_tokens: MAX_TOKENS,
            system,
            tools: TOOL_DEFINITIONS,
            messages
        });

        stream.on('text', (text) => {
            fullText += text;
            sendChunk({ text });
        });

        const response = await stream.finalMessage();

        // Collect tool_use blocks from response content
        for (const block of response.content) {
            if (block.type === 'tool_use') {
                toolUseBlocks.push(block);
            }
        }

        if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
            if (fullText) {
                aiMemory.addMessage(sessionId, 'assistant', fullText);
            }
            sendEnd();
            return;
        }

        // Tool calls: append assistant turn, execute tools, append results
        messages.push({ role: 'assistant', content: response.content });

        const toolResults = [];
        for (const block of toolUseBlocks) {
            const label = block.name.replace(/_/g, ' ');
            sendChunk({ status: `Using ${label}...` });
            log.info(`[AIAgent] Calling tool: ${block.name}`, block.input);
            const result = await executeTool(block.name, block.input);
            toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result)
            });
        }

        messages.push({ role: 'user', content: toolResults });
    }

    // Guard: exceeded max iterations
    sendError('Agent exceeded maximum tool call iterations. Please try again.');
}

// ============================================================
// Public API
// ============================================================

async function chat(message, sessionId) {
    if (!anthropicClient) {
        sendError('API key not configured. Go to Settings to add your Anthropic API key.');
        return;
    }

    aiMemory.addMessage(sessionId, 'user', message);

    const messages = aiMemory.getMessages(sessionId).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
    }));

    try {
        await runAgentLoop(messages, sessionId);
    } catch (e) {
        log.error('[AIAgent] Chat error:', e.message);
        sendError(e.message);
    }
}

async function testApiKey() {
    if (!anthropicClient) {
        return { valid: false, error: 'No API key configured' };
    }
    try {
        await anthropicClient.messages.create({
            model: TEST_MODEL,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
        });
        return { valid: true };
    } catch (e) {
        return { valid: false, error: e.message };
    }
}

module.exports = { init, setAppVersion, setAuthClient, setUserProfile, refreshClient, chat, testApiKey };
