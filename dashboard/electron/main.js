const { app, BrowserWindow, ipcMain, shell, BrowserView, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');
const { google } = require('googleapis');
const configManager = require('./config-manager');
const telemetry = require('./telemetry');
const recurrenceManager = require('./recurrence-manager');
const notificationManager = require('./notification-manager');
const syncController = require('./sync-controller');
const secureStorage = require('./secure-storage');
const aiAgent = require('./ai-agent');
const aiMemory = require('./ai-memory');
const log = require('./logger');
const { safeHandle } = require('./ipc-safety');

log.info('[Googol Vibe] App starting — log transport active');

// Handle EPIPE errors gracefully - occurs when stdout/stderr pipe closes
process.stdout?.on?.('error', (err) => {
    if (err.code === 'EPIPE') return; // Ignore broken pipe
    throw err;
});
process.stderr?.on?.('error', (err) => {
    if (err.code === 'EPIPE') return;
    throw err;
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Only needed for Windows Squirrel installer - optional dependency
try {
    if (require('electron-squirrel-startup')) {
        app.quit();
    }
} catch {
    // Module not available (macOS/Linux builds) - ignore
}

let mainWindow;
let authWindow;
let authClient;
let contentView = null; // Track the active BrowserView

// Security: Trusted domains for navigation and content loading
const TRUSTED_DOMAINS = [
    'accounts.google.com',
    'docs.google.com',
    'drive.google.com',
    'meet.google.com',
    'sheets.google.com',
    'slides.google.com',
    'calendar.google.com',
    'mail.google.com',
    'myaccount.google.com',
    'tasks.google.com'
];

/**
 * Check if a URL is a trusted destination.
 * Allows Google domains, localhost (dev server), and file:// (production).
 */
function isTrustedURL(urlString) {
    try {
        const parsed = new URL(urlString);
        if (parsed.protocol === 'file:') return true;
        if (parsed.hostname === 'localhost') return true;
        if (parsed.protocol !== 'https:') return false;
        return TRUSTED_DOMAINS.some(domain =>
            parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
        );
    } catch {
        return false;
    }
}

// ConfigManager provides all paths - see config-manager.js for details
// Legacy paths kept for reference during migration:
// TOKEN_PATH was: path.join(app.getPath('userData'), 'token.json')
// CREDENTIALS_PATH was: path.join(__dirname, '../credentials.json')

// Scopes
const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/tasks',
];

async function loadCredentials() {
    try {
        const credentialsPath = configManager.getCredentialsPath();
        const content = await fs.promises.readFile(credentialsPath);
        const keys = JSON.parse(content);
        return keys.installed || keys.web;
    } catch (e) {
        log.error("Error loading credentials from:", configManager.getCredentialsPath(), e);
        return null; // Handle missing credentials gracefully
    }
}

async function createOAuthClient() {
    const keys = await loadCredentials();
    if (!keys) throw new Error("Credentials not found. Please add credentials.json to " + configManager.getCredentialsPath());

    const port = configManager.getOAuthPort();
    return new google.auth.OAuth2(
        keys.client_id,
        keys.client_secret,
        `http://localhost:${port}/oauth2callback` // Must match GCP Console redirect URI
    );
}

// Custom Loopback Flow
function authenticateWithLoopback(oAuth2Client) {
    return new Promise((resolve, reject) => {
        const port = configManager.getOAuthPort();
        const authorizeUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });

        const server = http.createServer(async (req, res) => {
            try {
                if (req.url.indexOf('/oauth2callback') > -1) {
                    const qs = new url.URL(req.url, `http://localhost:${port}`).searchParams;
                    res.end('<h1>Authentication successful!</h1><script>setTimeout(() => window.close(), 1000);</script>');
                    server.destroy();
                    const { tokens } = await oAuth2Client.getToken(qs.get('code'));
                    oAuth2Client.setCredentials(tokens);
                    resolve(oAuth2Client);

                    if (authWindow) {
                        authWindow.close();
                    }
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            } catch (e) {
                res.end('Error fetching token');
                reject(e);
            }
        }).listen(port, () => {
            authWindow = new BrowserWindow({
                width: 600,
                height: 700,
                parent: mainWindow,
                modal: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    partition: 'persist:googleos'
                },
                autoHideMenuBar: true,
            });
            authWindow.loadURL(authorizeUrl);

            authWindow.on('closed', () => {
                authWindow = null;
            });
        });

        server.on('error', (e) => reject(e));
        const destroy = require('server-destroy');
        destroy(server);
    });
}

async function loadSavedCredentialsIfExist() {
    try {
        // Try new unified token location first
        const tokenPath = configManager.getTokenPath();
        let content;

        if (fs.existsSync(tokenPath)) {
            content = await fs.promises.readFile(tokenPath);
        } else {
            // Fall back to legacy location for backwards compatibility
            const legacyPath = configManager.getLegacyTokenPath();
            if (fs.existsSync(legacyPath)) {
                content = await fs.promises.readFile(legacyPath);
                // Migrate to new location
                await configManager.migrateTokenIfNeeded();
            } else {
                return null;
            }
        }

        const tokens = JSON.parse(content);
        const client = await createOAuthClient();
        client.setCredentials(tokens);
        return client;
    } catch (err) {
        log.error('Error loading saved credentials:', err);
        return null;
    }
}

async function saveCredentials(client) {
    const tokenPath = configManager.getTokenPath();
    const payload = JSON.stringify(client.credentials);
    await fs.promises.writeFile(tokenPath, payload);
    log.info('Token saved to:', tokenPath);
}

// ========================================
// Recurrence Scheduler
// ========================================

let recurrenceInterval = null;

async function checkAndGenerateRecurringTasks() {
    try {
        if (!authClient) authClient = await loadSavedCredentialsIfExist();
        if (!authClient) {
            log.info('[Recurrence] No auth client, skipping check');
            return;
        }

        const dueRules = recurrenceManager.getDueRules();
        if (dueRules.length === 0) {
            log.info('[Recurrence] No tasks due');
            return;
        }

        log.info(`[Recurrence] ${dueRules.length} task(s) due for generation`);
        const tasks = google.tasks({ version: 'v1', auth: authClient });

        for (const rule of dueRules) {
            try {
                // Create the task in Google Tasks
                const newTask = await tasks.tasks.insert({
                    tasklist: rule.taskListId,
                    requestBody: {
                        title: rule.title,
                        notes: rule.notes,
                        due: rule.nextDue
                    }
                });

                log.info(`[Recurrence] Generated task: ${rule.title}`);

                // Mark as generated and calculate next occurrence
                recurrenceManager.markGenerated(rule.id);

                // Show native notification for recurring task
                notificationManager.showRecurringTaskGenerated(rule, newTask.data.id);

                // Notify renderer if window exists
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('recurring-task-generated', {
                        ruleId: rule.id,
                        taskId: newTask.data.id,
                        title: rule.title
                    });
                }
            } catch (e) {
                log.error(`[Recurrence] Failed to generate task "${rule.title}":`, e.message);
            }
        }
    } catch (e) {
        log.error('[Recurrence] Scheduler error:', e);
    }
}

function startRecurrenceScheduler() {
    // Check immediately on startup
    setTimeout(() => checkAndGenerateRecurringTasks(), 5000);

    // Then check every hour
    recurrenceInterval = setInterval(() => {
        checkAndGenerateRecurringTasks();
    }, 60 * 60 * 1000);

    log.info('[Recurrence] Scheduler started (hourly checks)');
}

function stopRecurrenceScheduler() {
    if (recurrenceInterval) {
        clearInterval(recurrenceInterval);
        recurrenceInterval = null;
    }
}

// ========================================
// Background Sync Controller
// ========================================

async function startSyncController() {
    // Load auth if available
    if (!authClient) authClient = await loadSavedCredentialsIfExist();

    if (authClient) {
        syncController.init(authClient, mainWindow);
        syncController.start();
        log.info('[SyncController] Started background sync');
    } else {
        log.info('[SyncController] No auth client, will start after login');
    }
}

function stopSyncController() {
    syncController.stop();
    notificationManager.cancelAll();
}

// ========================================
// Extracted Google API Helpers
// Shared by IPC handlers and AI agent tools
// ========================================

async function fetchGmail(client, maxResults = 5) {
    const gmail = google.gmail({ version: 'v1', auth: client });
    const res = await gmail.users.messages.list({ userId: 'me', maxResults, labelIds: ['INBOX'] });
    const messages = res.data.messages || [];

    const emailList = [];
    await Promise.all(messages.map(async (msg) => {
        try {
            const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata' });
            const headers = detail.data.payload.headers;
            emailList.push({
                id: msg.id,
                subject: headers.find(h => h.name === 'Subject')?.value || 'No Subject',
                from: headers.find(h => h.name === 'From')?.value || 'Unknown',
                date: headers.find(h => h.name === 'Date')?.value || '',
                snippet: detail.data.snippet,
                unread: detail.data.labelIds?.includes('UNREAD') || false
            });
        } catch (e) {
            log.error('Error fetching email details', e);
        }
    }));
    return emailList;
}

async function fetchCalendar(client, days = 1) {
    const calendar = google.calendar({ version: 'v3', auth: client });
    const now = new Date();
    const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

    const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax,
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
    });

    return (res.data.items || []).map(event => ({
        id: event.id,
        summary: event.summary || 'No Title',
        start: event.start.dateTime || event.start.date,
        htmlLink: event.htmlLink
    }));
}

async function fetchDrive(client, count = 5, type = 'all') {
    const drive = google.drive({ version: 'v3', auth: client });

    let query = 'trashed = false';
    if (type === 'documents') {
        query += " and mimeType='application/vnd.google-apps.document'";
    } else if (type === 'spreadsheets') {
        query += " and mimeType='application/vnd.google-apps.spreadsheet'";
    } else if (type === 'presentations') {
        query += " and mimeType='application/vnd.google-apps.presentation'";
    }

    const res = await drive.files.list({
        pageSize: count,
        q: query,
        orderBy: 'modifiedTime desc',
        fields: 'files(id, name, mimeType, modifiedTime, iconLink, webViewLink, thumbnailLink)'
    });
    return res.data.files || [];
}

async function fetchTasks(client, count = 10) {
    const tasks = google.tasks({ version: 'v1', auth: client });
    const lists = await tasks.tasklists.list({ maxResults: 1 });
    if (!lists.data.items?.length) return { taskListId: null, tasks: [] };

    const taskListId = lists.data.items[0].id;
    const res = await tasks.tasks.list({
        tasklist: taskListId,
        maxResults: count,
        showCompleted: false
    });

    return {
        taskListId,
        tasks: (res.data.items || []).map(task => ({
            id: task.id,
            title: task.title,
            due: task.due,
            notes: task.notes,
            status: task.status
        }))
    };
}

async function createTaskHelper(client, title, due, notes) {
    const tasks = google.tasks({ version: 'v1', auth: client });
    const lists = await tasks.tasklists.list({ maxResults: 1 });
    if (!lists.data.items?.length) throw new Error('No task list found');

    const taskListId = lists.data.items[0].id;
    const requestBody = { title };
    if (due) requestBody.due = new Date(due).toISOString();
    if (notes) requestBody.notes = notes;

    const res = await tasks.tasks.insert({ tasklist: taskListId, requestBody });
    return res.data;
}

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            partition: 'persist:googolvibe'
        },
        titleBarStyle: 'hiddenInset',
        vibrancy: 'under-window',
        visualEffectState: 'active',
        backgroundColor: '#f8f9fc',
        title: 'Googol Vibe'
    });

    // Set Content Security Policy (production only - Vite HMR needs inline scripts in dev)
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
        mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [
                        "default-src 'self';" +
                        "script-src 'self';" +
                        "style-src 'self' 'unsafe-inline';" +
                        "img-src 'self' data: https: blob:;" +
                        "font-src 'self' data:;" +
                        "connect-src 'self' https://accounts.google.com https://*.googleapis.com https://*.google.com;" +
                        "frame-src https://*.google.com https://accounts.google.com;"
                    ]
                }
            });
        });
    }

    const vitePort = configManager.getVitePort();
    const startUrl = isDev ? `http://localhost:${vitePort}` : `file://${path.join(__dirname, '../dist/index.html')}`;

    mainWindow.loadURL(startUrl);

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // Permission handler for Meet camera/mic access
    const ses = mainWindow.webContents.session;
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['media', 'mediaKeySystem', 'notifications'];
        callback(allowedPermissions.includes(permission));
    });

    // Handle window resize to adjust BrowserView if active
    mainWindow.on('resize', () => {
        if (contentView) {
            const bounds = mainWindow.getBounds();
            contentView.setBounds({ x: 0, y: 80, width: bounds.width, height: bounds.height - 80 });
        }
    });

    // Security: Block navigation to untrusted domains
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        if (!isTrustedURL(navigationUrl)) {
            log.warn('[Security] Blocked navigation to:', navigationUrl);
            event.preventDefault();
        }
    });

    // Security: Block new window creation to untrusted domains
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (isTrustedURL(url)) {
            // Open Google links in system browser
            shell.openExternal(url);
        } else {
            log.warn('[Security] Blocked window open to:', url);
        }
        return { action: 'deny' };
    });
};

app.on('ready', () => {
    // Initialize configuration manager
    configManager.init();
    log.info('[Googol Vibe] Config paths:', configManager.debugPaths());

    // Initialize recurrence manager
    recurrenceManager.init();
    log.info('[Googol Vibe] Recurrence manager initialized');

    // Initialize notification manager with saved settings
    const notificationSettings = configManager.getNotificationSettings();
    notificationManager.init(notificationSettings);
    log.info('[Googol Vibe] Notification manager initialized');

    // Initialize telemetry (opt-in only)
    telemetry.initTelemetry();

    createWindow();

    // Start recurrence scheduler (checks every hour)
    startRecurrenceScheduler();

    // Start background sync controller (Gmail 5m, Calendar 15m, Tasks 15m, Drive 30m)
    startSyncController();

    // Initialise AI agent with extracted Google API helpers
    const pkgVersion = require('../package.json').version;
    aiAgent.init(
        { fetchGmail, fetchCalendar, fetchDrive, fetchTasks, createTask: createTaskHelper },
        mainWindow
    );
    aiAgent.setAppVersion(pkgVersion);

    // If Google auth is already available, pass it to the agent
    (async () => {
        try {
            if (!authClient) authClient = await loadSavedCredentialsIfExist();
            if (authClient) {
                aiAgent.setAuthClient(authClient);
                // Cache user profile for system prompt
                try {
                    const service = google.oauth2({ version: 'v2', auth: authClient });
                    const res = await service.userinfo.get();
                    aiAgent.setUserProfile(res.data);
                } catch { /* profile will be null in system prompt - acceptable */ }
            }
        } catch (e) {
            log.error('[AI Agent] Failed to init auth:', e.message);
        }
    })();

    // ========================================
    // Onboarding IPC Handlers
    // ========================================

    safeHandle('get-onboarding-state', async () => {
        return configManager.getOnboardingState();
    });

    safeHandle('import-credentials', async (event, filePath) => {
        await configManager.importCredentials(filePath);
        return { success: true };
    });

    safeHandle('select-credentials-file', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Select credentials.json',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile']
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, canceled: true };
        }

        await configManager.importCredentials(result.filePaths[0]);
        return { success: true, path: result.filePaths[0] };
    });

    safeHandle('update-onboarding', async (event, updates) => {
        configManager.updateOnboarding(updates);
        return { success: true };
    });

    safeHandle('get-config-paths', async () => {
        return configManager.debugPaths();
    });

    // ========================================
    // Telemetry IPC Handlers
    // ========================================

    safeHandle('get-telemetry-status', async () => {
        return {
            enabled: telemetry.isEnabled()
        };
    });

    safeHandle('set-telemetry', async (event, enabled) => {
        if (enabled) {
            telemetry.enableTelemetry();
        } else {
            telemetry.disableTelemetry();
        }
        return { success: true, enabled };
    });

    // ========================================
    // Auth IPC Handlers
    // ========================================

    safeHandle('google-login', async () => {
        const client = await createOAuthClient();
        authClient = await authenticateWithLoopback(client);
        await saveCredentials(authClient);

        // Update onboarding state with connected email
        try {
            const service = google.oauth2({ version: 'v2', auth: authClient });
            const res = await service.userinfo.get();
            configManager.updateOnboarding({
                onboardingComplete: true,
                connectedEmail: res.data.email
            });
        } catch (e) {
            // Still mark as complete even if we can't get email
            configManager.updateOnboarding({ onboardingComplete: true });
        }

        // Start sync controller after login
        syncController.setAuthClient(authClient);
        syncController.setMainWindow(mainWindow);
        syncController.start();

        // Update AI agent with new auth client and profile
        aiAgent.setAuthClient(authClient);
        try {
            const svc = google.oauth2({ version: 'v2', auth: authClient });
            const profileRes = await svc.userinfo.get();
            aiAgent.setUserProfile(profileRes.data);
        } catch { /* non-critical */ }

        return { success: true };
    });

    safeHandle('get-profile', async () => {
        if (!authClient) authClient = await loadSavedCredentialsIfExist();
        if (!authClient) throw new Error('Not authenticated');

        const service = google.oauth2({ version: 'v2', auth: authClient });
        const res = await service.userinfo.get();
        return res.data;
    });

    safeHandle('get-gmail', async () => {
        if (!authClient) authClient = await loadSavedCredentialsIfExist();
        if (!authClient) throw new Error('Not authenticated');
        return await fetchGmail(authClient, 10);
    }, { fallback: [] });

    safeHandle('get-calendar', async () => {
        if (!authClient) authClient = await loadSavedCredentialsIfExist();
        if (!authClient) throw new Error('Not authenticated');
        return await fetchCalendar(authClient, 14);
    }, { fallback: [] });

    safeHandle('get-drive', async () => {
        if (!authClient) authClient = await loadSavedCredentialsIfExist();
        if (!authClient) throw new Error('Not authenticated');
        return await fetchDrive(authClient, 12, 'all');
    }, { fallback: [] });

    // Documents (Docs/Sheets/Slides) - uses type filter via shared helper
    safeHandle('get-documents', async () => {
        if (!authClient) authClient = await loadSavedCredentialsIfExist();
        if (!authClient) throw new Error('Not authenticated');
        const drive = google.drive({ version: 'v3', auth: authClient });
        const res = await drive.files.list({
            pageSize: 12,
            q: "(mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.presentation') and trashed = false",
            orderBy: "modifiedTime desc",
            fields: "files(id, name, mimeType, modifiedTime, iconLink, webViewLink, thumbnailLink)"
        });
        return res.data.files;
    }, { fallback: [] });

    // Meetings (Calendar events with Meet links)
    safeHandle('get-meetings', async () => {
        if (!authClient) authClient = await loadSavedCredentialsIfExist();
        if (!authClient) throw new Error('Not authenticated');

        const calendar = google.calendar({ version: 'v3', auth: authClient });
        const now = new Date().toISOString();
        const endOfWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: now,
            timeMax: endOfWeek,
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
            conferenceDataVersion: 1
        });

        return (res.data.items || [])
            .filter(e => e.conferenceData?.entryPoints?.some(ep => ep.entryPointType === 'video'))
            .map(event => ({
                id: event.id,
                summary: event.summary || 'No Title',
                start: event.start.dateTime || event.start.date,
                end: event.end.dateTime || event.end.date,
                meetLink: event.conferenceData.entryPoints.find(ep => ep.entryPointType === 'video')?.uri,
                attendees: event.attendees?.length || 0
            }));
    }, { fallback: [] });

    // Tasks - GET
    safeHandle('get-tasks', async () => {
        if (!authClient) authClient = await loadSavedCredentialsIfExist();
        if (!authClient) throw new Error('Not authenticated');
        return await fetchTasks(authClient, 20);
    }, { fallback: { taskListId: null, tasks: [] } });

    // Tasks - CREATE
    safeHandle('create-task', async (event, { taskListId, title, due }) => {
        if (!authClient) authClient = await loadSavedCredentialsIfExist();
        if (!authClient) throw new Error('Not authenticated');

        const tasks = google.tasks({ version: 'v1', auth: authClient });
        const res = await tasks.tasks.insert({
            tasklist: taskListId,
            requestBody: { title, due }
        });
        return res.data;
    });

    // Tasks - COMPLETE
    safeHandle('complete-task', async (event, { taskListId, taskId }) => {
        if (!authClient) authClient = await loadSavedCredentialsIfExist();
        if (!authClient) throw new Error('Not authenticated');

        const tasks = google.tasks({ version: 'v1', auth: authClient });
        await tasks.tasks.patch({
            tasklist: taskListId,
            task: taskId,
            requestBody: { status: 'completed' }
        });
        return { success: true };
    });

    // Tasks - UPDATE (for notes, title, due date)
    safeHandle('update-task', async (event, { taskListId, taskId, updates }) => {
        if (!authClient) authClient = await loadSavedCredentialsIfExist();
        if (!authClient) throw new Error('Not authenticated');

        const tasks = google.tasks({ version: 'v1', auth: authClient });
        const res = await tasks.tasks.patch({
            tasklist: taskListId,
            task: taskId,
            requestBody: updates
        });
        return res.data;
    });

    // Tasks - DELETE
    safeHandle('delete-task', async (event, { taskListId, taskId }) => {
        if (!authClient) authClient = await loadSavedCredentialsIfExist();
        if (!authClient) throw new Error('Not authenticated');

        const tasks = google.tasks({ version: 'v1', auth: authClient });
        await tasks.tasks.delete({ tasklist: taskListId, task: taskId });
        return { success: true };
    });

    // ========================================
    // Notification IPC Handlers
    // ========================================

    safeHandle('get-notification-settings', async () => {
        return notificationManager.getSettings();
    });

    safeHandle('update-notification-settings', async (event, updates) => {
        notificationManager.updateSettings(updates);
        configManager.updateNotificationSettings(updates);
        return notificationManager.getSettings();
    });

    safeHandle('show-notification', async (event, options) => {
        return notificationManager.show(options) !== null;
    });

    safeHandle('get-scheduled-notifications', async () => {
        return notificationManager.getScheduled();
    });

    safeHandle('schedule-task-reminders', async (event, { tasks }) => {
        notificationManager.scheduleTaskReminders(tasks);
        return { success: true, scheduled: notificationManager.getScheduled().length };
    });

    safeHandle('schedule-calendar-reminders', async (event, { events }) => {
        notificationManager.scheduleCalendarReminders(events);
        return { success: true, scheduled: notificationManager.getScheduled().length };
    });

    safeHandle('schedule-meeting-reminders', async (event, { meetings }) => {
        notificationManager.scheduleMeetingReminders(meetings);
        return { success: true, scheduled: notificationManager.getScheduled().length };
    });

    safeHandle('cancel-notification', async (event, { id }) => {
        notificationManager.cancel(id);
        return { success: true };
    });

    safeHandle('cancel-all-notifications', async () => {
        notificationManager.cancelAll();
        return { success: true };
    });

    safeHandle('notification-supported', async () => {
        return notificationManager.isSupported();
    });

    safeHandle('sync-notification-reminders', async () => {
        await syncController.syncAll();
        return { success: true, scheduled: notificationManager.getScheduled().length };
    });

    // ========================================
    // Sync Controller IPC Handlers
    // ========================================

    safeHandle('get-sync-status', async () => {
        return syncController.getStatus();
    });

    safeHandle('force-sync', async (event, { service }) => {
        await syncController.forceSync(service || 'all');
        return syncController.getStatus();
    });

    safeHandle('reset-new-item-counts', async () => {
        syncController.resetNewItemCounts();
        return { success: true };
    });

    // ========================================
    // Recurrence IPC Handlers
    // ========================================

    safeHandle('get-recurrence-rules', async () => {
        return recurrenceManager.getAllRules();
    }, { fallback: [] });

    safeHandle('get-recurrence-rule', async (event, { ruleId }) => {
        return recurrenceManager.getRule(ruleId);
    });

    safeHandle('create-recurrence-rule', async (event, { title, notes, rruleString, taskListId }) => {
        const rule = recurrenceManager.createRule({ title, notes, rruleString, taskListId });
        // Trigger immediate check if task is due now
        setTimeout(() => checkAndGenerateRecurringTasks(), 1000);
        return rule;
    });

    safeHandle('update-recurrence-rule', async (event, { ruleId, updates }) => {
        return recurrenceManager.updateRule(ruleId, updates);
    });

    safeHandle('delete-recurrence-rule', async (event, { ruleId }) => {
        recurrenceManager.deleteRule(ruleId);
        return { success: true };
    });

    safeHandle('get-rule-for-task', async (event, { taskId }) => {
        // Find rule that might be associated with this task
        // We track this via task title matching for now
        const rules = recurrenceManager.getAllRules();
        return rules.find(r => r.lastGeneratedTaskId === taskId) || null;
    });

    safeHandle('set-task-recurrence', async (event, { taskListId, taskId, title, notes, rruleString }) => {
        if (!rruleString) {
            // Remove recurrence - find and delete any matching rule
            const rules = recurrenceManager.getAllRules();
            const matchingRule = rules.find(r => r.title === title && r.taskListId === taskListId);
            if (matchingRule) {
                recurrenceManager.deleteRule(matchingRule.id);
            }
            return { success: true, removed: true };
        }

        // Check if rule already exists for this task
        const rules = recurrenceManager.getAllRules();
        const existingRule = rules.find(r => r.title === title && r.taskListId === taskListId);

        if (existingRule) {
            // Update existing rule
            recurrenceManager.updateRule(existingRule.id, { rrule: rruleString, notes });
            return { success: true, rule: recurrenceManager.getRule(existingRule.id) };
        }

        // Create new rule
        const rule = recurrenceManager.createRule({ title, notes, rruleString, taskListId });
        return { success: true, rule };
    });

    // Switch document to edit mode
    safeHandle('switch-to-edit', async (event, { docId, docType }) => {
        if (!contentView) return;

        const editUrls = {
            'document': `https://docs.google.com/document/d/${docId}/edit`,
            'spreadsheet': `https://docs.google.com/spreadsheets/d/${docId}/edit`,
            'presentation': `https://docs.google.com/presentation/d/${docId}/edit`
        };

        if (editUrls[docType]) {
            contentView.webContents.loadURL(editUrls[docType]);
        }
    });

    safeHandle('view-content', async (event, { url, type }) => {
        // Security: Only allow trusted Google domains in the BrowserView
        // The BrowserView shares the persist:googleos session (Google auth cookies)
        if (!isTrustedURL(url)) {
            log.warn('[Security] Blocked view-content for untrusted URL:', url);
            return;
        }

        // Meet now uses BrowserView with permission handler (see createWindow)
        if (contentView) {
            mainWindow.removeBrowserView(contentView);
            contentView.webContents.destroy();
            contentView = null;
        }

        contentView = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                partition: 'persist:googleos'
            }
        });

        mainWindow.setBrowserView(contentView);

        const bounds = mainWindow.getBounds();
        // Offset y: 80 to leave room for a header/close button in the main window
        const headerHeight = 80;
        contentView.setBounds({ x: 0, y: headerHeight, width: bounds.width, height: bounds.height - headerHeight });
        contentView.setAutoResize({ width: true, height: true });

        contentView.webContents.loadURL(url);

        // Notify renderer that content is open so it can show a "Close" button
        mainWindow.webContents.send('content-view-opened');
    });

    safeHandle('close-content', async () => {
        if (contentView) {
            mainWindow.removeBrowserView(contentView);
            contentView = null;
            mainWindow.webContents.send('content-view-closed');
        }
    });

    // ========================================
    // AI Agent IPC Handlers
    // ========================================

    // Streaming AI chat - main entry point
    safeHandle('ask-agent-stream', async (event, { message, sessionId }) => {
        // Ensure Google auth is available for tools
        if (!authClient) authClient = await loadSavedCredentialsIfExist();
        if (authClient) {
            aiAgent.setAuthClient(authClient);
        }

        await aiAgent.chat(message, sessionId);
        return { success: true };
    });

    // API Key Management
    safeHandle('save-anthropic-key', async (event, key) => {
        secureStorage.saveKey(key);
        aiAgent.refreshClient();
        return { success: true };
    });

    safeHandle('get-anthropic-key-status', async () => {
        return { configured: secureStorage.hasKey() };
    });

    safeHandle('test-anthropic-key', async () => {
        return await aiAgent.testApiKey();
    });

    safeHandle('clear-anthropic-key', async () => {
        secureStorage.deleteKey();
        aiAgent.refreshClient(); // Will set client to null
        return { success: true };
    });

    // Session History Management
    safeHandle('get-ai-sessions', async () => {
        return aiMemory.getSessions();
    });

    safeHandle('clear-ai-history', async () => {
        aiMemory.clearAll();
        return { success: true };
    });

    safeHandle('start-new-ai-session', async () => {
        return aiMemory.startNewSession();
    });

    // Open a URL in the system browser (used for external links like API key console)
    safeHandle('open-external', async (event, urlToOpen) => {
        if (typeof urlToOpen === 'string' && urlToOpen.startsWith('https://')) {
            shell.openExternal(urlToOpen);
        }
    });

    safeHandle('logout', async () => {
        try {
            // Remove token from new location
            const tokenPath = configManager.getTokenPath();
            if (fs.existsSync(tokenPath)) {
                await fs.promises.unlink(tokenPath);
            }
            // Also remove legacy token if exists
            const legacyPath = configManager.getLegacyTokenPath();
            if (fs.existsSync(legacyPath)) {
                await fs.promises.unlink(legacyPath);
            }
        } catch (e) {
            log.error("Error removing token:", e);
        }

        try {
            if (mainWindow) {
                await mainWindow.webContents.session.clearStorageData();
            }
            // Clear the partition session
            const sharedSession = require('electron').session.fromPartition('persist:googolvibe');
            await sharedSession.clearStorageData();
        } catch (e) {
            log.error("Error clearing session", e);
        }

        // Reset onboarding state
        configManager.updateOnboarding({
            onboardingComplete: false,
            connectedEmail: null
        });

        authClient = null;
        return { success: true };
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    // Clean up schedulers
    stopRecurrenceScheduler();
    stopSyncController();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
