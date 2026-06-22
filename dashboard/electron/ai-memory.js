const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const log = require('./logger');

// In-memory store: sessionId -> { id, created, messages: [{role, content}] }
const sessions = new Map();
let loaded = false;

function getMemoryPath() {
    return path.join(app.getPath('userData'), 'ai-sessions.json');
}

function saveToDisk() {
    try {
        const data = {};
        for (const [id, session] of sessions) {
            // Only persist last 20 messages per session to bound file size
            data[id] = {
                ...session,
                messages: session.messages.slice(-20)
            };
        }
        fs.writeFileSync(getMemoryPath(), JSON.stringify(data, null, 2));
    } catch (e) {
        log.error('[AiMemory] Failed to persist sessions:', e.message);
    }
}

function loadFromDisk() {
    try {
        const p = getMemoryPath();
        if (!fs.existsSync(p)) return;
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        for (const [id, session] of Object.entries(raw)) {
            sessions.set(id, session);
        }
        log.info(`[AiMemory] Loaded ${sessions.size} session(s) from disk`);
    } catch (e) {
        log.warn('[AiMemory] Failed to load sessions:', e.message);
    }
}

function ensureLoaded() {
    if (!loaded) {
        loadFromDisk();
        loaded = true;
    }
}

function startNewSession() {
    ensureLoaded();
    const sessionId = crypto.randomUUID();
    const session = { id: sessionId, created: new Date().toISOString(), messages: [] };
    sessions.set(sessionId, session);
    saveToDisk();
    log.info(`[AiMemory] New session: ${sessionId}`);
    return { sessionId, created: session.created };
}

function getMessages(sessionId) {
    ensureLoaded();
    return (sessions.get(sessionId)?.messages || []).slice(); // return copy
}

function addMessage(sessionId, role, content) {
    ensureLoaded();
    if (!sessions.has(sessionId)) return;
    sessions.get(sessionId).messages.push({ role, content });
    saveToDisk();
}

function getSessions() {
    ensureLoaded();
    return Array.from(sessions.values())
        .map(s => ({ id: s.id, created: s.created, messageCount: s.messages.length }))
        .sort((a, b) => new Date(b.created) - new Date(a.created));
}

function clearAll() {
    ensureLoaded();
    sessions.clear();
    try {
        const p = getMemoryPath();
        if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (e) {
        log.error('[AiMemory] Failed to clear sessions file:', e.message);
    }
    log.info('[AiMemory] All sessions cleared');
}

module.exports = { startNewSession, getMessages, addMessage, getSessions, clearAll };
