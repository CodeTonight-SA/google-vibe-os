/**
 * Background Sync Controller for Googol Vibe
 *
 * Single Responsibility: Orchestrate periodic sync of all Google APIs
 * - Gmail, Calendar, Drive, Tasks
 * - Detect NEW items and trigger notifications
 * - Expose sync status to renderer
 *
 * @module SyncController
 */

const { google } = require('googleapis');
const notificationManager = require('./notification-manager');

// Sync intervals (ms) - Aggressive polling for real-time feel
const SYNC_INTERVALS = {
    gmail: 30 * 1000,     // 30 seconds - emails are critical
    calendar: 60 * 1000,  // 1 minute
    tasks: 60 * 1000,     // 1 minute
    drive: 2 * 60 * 1000  // 2 minutes
};

// Initial delay before first sync (ms)
const INITIAL_DELAY = 3 * 1000; // 3 seconds after app ready

/**
 * Safe logging - prevents EPIPE crashes
 */
function log(...args) {
    try {
        if (process.stdout?.writable) {
            console.log('[SyncController]', ...args);
        }
    } catch {
        // Silently ignore EPIPE
    }
}

/**
 * SyncController - Background sync orchestrator
 */
class SyncController {
    constructor() {
        this.authClient = null;
        this.mainWindow = null;

        // Interval handles
        this.intervals = {
            gmail: null,
            calendar: null,
            tasks: null,
            drive: null
        };

        // Last sync timestamps
        this.lastSync = {
            gmail: null,
            calendar: null,
            tasks: null,
            drive: null
        };

        // Previous item IDs (for new item detection)
        this.previousIds = {
            gmail: new Set(),
            calendar: new Set(),
            tasks: new Set(),
            drive: new Set()
        };

        // Sync in progress flags (prevent overlap)
        this.syncing = {
            gmail: false,
            calendar: false,
            tasks: false,
            drive: false
        };

        // Total new items since last UI check
        this.newItemCounts = {
            gmail: 0,
            calendar: 0,
            tasks: 0,
            drive: 0
        };
    }

    /**
     * Initialize the sync controller
     * @param {Object} authClient - Google OAuth client
     * @param {BrowserWindow} mainWindow - Electron main window
     */
    init(authClient, mainWindow) {
        this.authClient = authClient;
        this.mainWindow = mainWindow;
        log('Initialised');
    }

    /**
     * Set/update the auth client
     */
    setAuthClient(authClient) {
        this.authClient = authClient;
    }

    /**
     * Set/update the main window reference
     */
    setMainWindow(mainWindow) {
        this.mainWindow = mainWindow;
    }

    /**
     * Start all sync schedulers
     */
    start() {
        if (!this.authClient) {
            log('No auth client, skipping start');
            return;
        }

        // Initial sync after delay
        setTimeout(() => this.syncAll(), INITIAL_DELAY);

        // Set up recurring syncs
        this.intervals.gmail = setInterval(
            () => this.syncGmail(),
            SYNC_INTERVALS.gmail
        );

        this.intervals.calendar = setInterval(
            () => this.syncCalendar(),
            SYNC_INTERVALS.calendar
        );

        this.intervals.tasks = setInterval(
            () => this.syncTasks(),
            SYNC_INTERVALS.tasks
        );

        this.intervals.drive = setInterval(
            () => this.syncDrive(),
            SYNC_INTERVALS.drive
        );

        log('Started - Gmail: 30s, Calendar: 1m, Tasks: 1m, Drive: 2m');
    }

    /**
     * Stop all sync schedulers
     */
    stop() {
        for (const [key, intervalId] of Object.entries(this.intervals)) {
            if (intervalId) {
                clearInterval(intervalId);
                this.intervals[key] = null;
            }
        }
        log('Stopped all syncs');
    }

    /**
     * Sync all services in parallel
     */
    async syncAll() {
        log('Syncing all services...');

        await Promise.allSettled([
            this.syncGmail(),
            this.syncCalendar(),
            this.syncTasks(),
            this.syncDrive()
        ]);

        log('All syncs complete');
        this.notifyRenderer('sync-complete', this.getStatus());
    }

    /**
     * Sync Gmail - detect new emails
     */
    async syncGmail() {
        if (this.syncing.gmail || !this.authClient) return;
        this.syncing.gmail = true;

        try {
            const gmail = google.gmail({ version: 'v1', auth: this.authClient });
            const res = await gmail.users.messages.list({
                userId: 'me',
                maxResults: 20,
                labelIds: ['INBOX', 'UNREAD']
            });

            const messages = res.data.messages || [];
            const currentIds = new Set(messages.map(m => m.id));

            // Detect new emails (IDs not in previous sync)
            const newEmails = [];
            for (const msg of messages) {
                if (!this.previousIds.gmail.has(msg.id)) {
                    // Fetch details for new email
                    try {
                        const detail = await gmail.users.messages.get({
                            userId: 'me',
                            id: msg.id,
                            format: 'metadata'
                        });
                        const headers = detail.data.payload.headers;
                        newEmails.push({
                            id: msg.id,
                            subject: headers.find(h => h.name === 'Subject')?.value || 'No Subject',
                            from: headers.find(h => h.name === 'From')?.value || 'Unknown'
                        });
                    } catch {
                        // Skip if can't fetch details
                    }
                }
            }

            // Show notifications for new emails (max 3 to avoid spam)
            if (this.previousIds.gmail.size > 0 && newEmails.length > 0) {
                const toNotify = newEmails.slice(0, 3);
                for (const email of toNotify) {
                    notificationManager.showEmailNotification(email);
                }

                if (newEmails.length > 3) {
                    notificationManager.show({
                        title: 'New Emails',
                        body: `You have ${newEmails.length} new emails`,
                        category: 'email'
                    });
                }

                this.newItemCounts.gmail += newEmails.length;
                log(`Gmail: ${newEmails.length} new email(s)`);
            }

            this.previousIds.gmail = currentIds;
            this.lastSync.gmail = new Date();
            this.notifyRenderer('gmail-synced', { count: newEmails.length });

        } catch (e) {
            log('Gmail sync error:', e.message);
        } finally {
            this.syncing.gmail = false;
        }
    }

    /**
     * Sync Calendar - detect new events, schedule reminders
     */
    async syncCalendar() {
        if (this.syncing.calendar || !this.authClient) return;
        this.syncing.calendar = true;

        try {
            const calendar = google.calendar({ version: 'v3', auth: this.authClient });
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            const res = await calendar.events.list({
                calendarId: 'primary',
                timeMin: now.toISOString(),
                timeMax: tomorrow.toISOString(),
                maxResults: 30,
                singleEvents: true,
                orderBy: 'startTime',
                conferenceDataVersion: 1
            });

            const events = res.data.items || [];
            const currentIds = new Set(events.map(e => e.id));

            // Detect new events
            const newEvents = events.filter(e => !this.previousIds.calendar.has(e.id));

            if (this.previousIds.calendar.size > 0 && newEvents.length > 0) {
                for (const event of newEvents.slice(0, 2)) {
                    notificationManager.show({
                        title: 'New Calendar Event',
                        body: event.summary || 'Untitled Event',
                        subtitle: new Date(event.start.dateTime || event.start.date).toLocaleString(),
                        category: 'calendar'
                    });
                }
                this.newItemCounts.calendar += newEvents.length;
                log(`Calendar: ${newEvents.length} new event(s)`);
            }

            // Schedule reminders for all upcoming events
            const formattedEvents = events.map(e => ({
                id: e.id,
                summary: e.summary || 'Untitled',
                start: e.start.dateTime || e.start.date,
                htmlLink: e.htmlLink
            }));
            notificationManager.scheduleCalendarReminders(formattedEvents);

            // Schedule meeting reminders (events with video)
            const meetings = events
                .filter(e => e.conferenceData?.entryPoints?.some(ep => ep.entryPointType === 'video'))
                .map(e => ({
                    id: e.id,
                    summary: e.summary || 'Untitled Meeting',
                    start: e.start.dateTime || e.start.date,
                    meetLink: e.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri
                }));

            if (meetings.length > 0) {
                notificationManager.scheduleMeetingReminders(meetings);
            }

            this.previousIds.calendar = currentIds;
            this.lastSync.calendar = new Date();
            this.notifyRenderer('calendar-synced', {
                events: formattedEvents.length,
                meetings: meetings.length
            });

        } catch (e) {
            log('Calendar sync error:', e.message);
        } finally {
            this.syncing.calendar = false;
        }
    }

    /**
     * Sync Tasks - detect new tasks, schedule reminders
     */
    async syncTasks() {
        if (this.syncing.tasks || !this.authClient) return;
        this.syncing.tasks = true;

        try {
            const tasksApi = google.tasks({ version: 'v1', auth: this.authClient });
            const lists = await tasksApi.tasklists.list({ maxResults: 1 });

            if (!lists.data.items?.length) {
                this.lastSync.tasks = new Date();
                return;
            }

            const taskListId = lists.data.items[0].id;
            const res = await tasksApi.tasks.list({
                tasklist: taskListId,
                maxResults: 50,
                showCompleted: false
            });

            const tasks = res.data.items || [];
            const currentIds = new Set(tasks.map(t => t.id));

            // Detect new tasks
            const newTasks = tasks.filter(t => !this.previousIds.tasks.has(t.id));

            if (this.previousIds.tasks.size > 0 && newTasks.length > 0) {
                for (const task of newTasks.slice(0, 2)) {
                    notificationManager.show({
                        title: 'New Task Added',
                        body: task.title,
                        subtitle: task.due ? `Due: ${new Date(task.due).toLocaleDateString()}` : null,
                        category: 'task'
                    });
                }
                this.newItemCounts.tasks += newTasks.length;
                log(`Tasks: ${newTasks.length} new task(s)`);
            }

            // Schedule reminders for tasks with due dates
            const tasksWithDue = tasks.filter(t => t.due);
            if (tasksWithDue.length > 0) {
                notificationManager.scheduleTaskReminders(tasksWithDue);
            }

            this.previousIds.tasks = currentIds;
            this.lastSync.tasks = new Date();
            this.notifyRenderer('tasks-synced', { count: tasks.length });

        } catch (e) {
            log('Tasks sync error:', e.message);
        } finally {
            this.syncing.tasks = false;
        }
    }

    /**
     * Sync Drive - detect new files
     */
    async syncDrive() {
        if (this.syncing.drive || !this.authClient) return;
        this.syncing.drive = true;

        try {
            const drive = google.drive({ version: 'v3', auth: this.authClient });
            const res = await drive.files.list({
                pageSize: 20,
                q: 'trashed = false',
                orderBy: 'modifiedTime desc',
                fields: 'files(id, name, mimeType, modifiedTime)'
            });

            const files = res.data.files || [];
            const currentIds = new Set(files.map(f => f.id));

            // Detect new files (brand new, not just modified)
            const newFiles = files.filter(f => !this.previousIds.drive.has(f.id));

            if (this.previousIds.drive.size > 0 && newFiles.length > 0) {
                // Only notify for truly new files (created in last 5 min)
                const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
                const recentNewFiles = newFiles.filter(f =>
                    new Date(f.modifiedTime) > fiveMinAgo
                );

                if (recentNewFiles.length > 0) {
                    notificationManager.show({
                        title: 'New Files',
                        body: recentNewFiles.length === 1
                            ? recentNewFiles[0].name
                            : `${recentNewFiles.length} new files added`,
                        category: 'email' // Reuse email category for now
                    });
                    this.newItemCounts.drive += recentNewFiles.length;
                    log(`Drive: ${recentNewFiles.length} new file(s)`);
                }
            }

            this.previousIds.drive = currentIds;
            this.lastSync.drive = new Date();
            this.notifyRenderer('drive-synced', { count: files.length });

        } catch (e) {
            log('Drive sync error:', e.message);
        } finally {
            this.syncing.drive = false;
        }
    }

    /**
     * Force immediate sync of a specific service
     */
    async forceSync(service) {
        switch (service) {
            case 'gmail': return this.syncGmail();
            case 'calendar': return this.syncCalendar();
            case 'tasks': return this.syncTasks();
            case 'drive': return this.syncDrive();
            case 'all': return this.syncAll();
            default: log(`Unknown service: ${service}`);
        }
    }

    /**
     * Get sync status for all services
     */
    getStatus() {
        const now = Date.now();

        const formatNextSync = (lastSync, interval) => {
            if (!lastSync) return 'Pending...';
            const next = lastSync.getTime() + interval;
            const remaining = Math.max(0, next - now);
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        };

        return {
            gmail: {
                lastSync: this.lastSync.gmail?.toISOString() || null,
                nextSync: formatNextSync(this.lastSync.gmail, SYNC_INTERVALS.gmail),
                syncing: this.syncing.gmail,
                newItems: this.newItemCounts.gmail
            },
            calendar: {
                lastSync: this.lastSync.calendar?.toISOString() || null,
                nextSync: formatNextSync(this.lastSync.calendar, SYNC_INTERVALS.calendar),
                syncing: this.syncing.calendar,
                newItems: this.newItemCounts.calendar
            },
            tasks: {
                lastSync: this.lastSync.tasks?.toISOString() || null,
                nextSync: formatNextSync(this.lastSync.tasks, SYNC_INTERVALS.tasks),
                syncing: this.syncing.tasks,
                newItems: this.newItemCounts.tasks
            },
            drive: {
                lastSync: this.lastSync.drive?.toISOString() || null,
                nextSync: formatNextSync(this.lastSync.drive, SYNC_INTERVALS.drive),
                syncing: this.syncing.drive,
                newItems: this.newItemCounts.drive
            },
            intervals: {
                gmail: SYNC_INTERVALS.gmail / 1000,
                calendar: SYNC_INTERVALS.calendar / 1000,
                tasks: SYNC_INTERVALS.tasks / 1000,
                drive: SYNC_INTERVALS.drive / 1000
            }
        };
    }

    /**
     * Reset new item counts (call when UI acknowledges)
     */
    resetNewItemCounts() {
        this.newItemCounts = { gmail: 0, calendar: 0, tasks: 0, drive: 0 };
    }

    /**
     * Notify renderer of sync events
     */
    notifyRenderer(channel, data) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
    }
}

// Singleton instance
const syncController = new SyncController();

module.exports = syncController;
