const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // ========================================
    // Onboarding
    // ========================================
    getOnboardingState: () => ipcRenderer.invoke('get-onboarding-state'),
    importCredentials: (filePath) => ipcRenderer.invoke('import-credentials', filePath),
    selectCredentialsFile: () => ipcRenderer.invoke('select-credentials-file'),
    updateOnboarding: (updates) => ipcRenderer.invoke('update-onboarding', updates),
    getConfigPaths: () => ipcRenderer.invoke('get-config-paths'),

    // ========================================
    // Telemetry (Opt-in)
    // ========================================
    getTelemetryStatus: () => ipcRenderer.invoke('get-telemetry-status'),
    setTelemetry: (enabled) => ipcRenderer.invoke('set-telemetry', enabled),

    // ========================================
    // Authentication
    // ========================================
    login: () => ipcRenderer.invoke('google-login'),
    logout: () => ipcRenderer.invoke('logout'),
    getProfile: () => ipcRenderer.invoke('get-profile'),

    // ========================================
    // Data Fetching
    // ========================================
    getGmail: () => ipcRenderer.invoke('get-gmail'),
    getCalendar: () => ipcRenderer.invoke('get-calendar'),
    getDrive: () => ipcRenderer.invoke('get-drive'),
    getDocuments: () => ipcRenderer.invoke('get-documents'),
    getMeetings: () => ipcRenderer.invoke('get-meetings'),
    getTasks: () => ipcRenderer.invoke('get-tasks'),

    // ========================================
    // Tasks CRUD
    // ========================================
    createTask: (taskListId, title, due) => ipcRenderer.invoke('create-task', { taskListId, title, due }),
    updateTask: (taskListId, taskId, updates) => ipcRenderer.invoke('update-task', { taskListId, taskId, updates }),
    completeTask: (taskListId, taskId) => ipcRenderer.invoke('complete-task', { taskListId, taskId }),
    deleteTask: (taskListId, taskId) => ipcRenderer.invoke('delete-task', { taskListId, taskId }),

    // ========================================
    // Recurrence
    // ========================================
    getRecurrenceRules: () => ipcRenderer.invoke('get-recurrence-rules'),
    getRecurrenceRule: (ruleId) => ipcRenderer.invoke('get-recurrence-rule', { ruleId }),
    createRecurrenceRule: (title, notes, rruleString, taskListId) =>
        ipcRenderer.invoke('create-recurrence-rule', { title, notes, rruleString, taskListId }),
    updateRecurrenceRule: (ruleId, updates) => ipcRenderer.invoke('update-recurrence-rule', { ruleId, updates }),
    deleteRecurrenceRule: (ruleId) => ipcRenderer.invoke('delete-recurrence-rule', { ruleId }),
    setTaskRecurrence: (taskListId, taskId, title, notes, rruleString) =>
        ipcRenderer.invoke('set-task-recurrence', { taskListId, taskId, title, notes, rruleString }),
    onRecurringTaskGenerated: (callback) => ipcRenderer.on('recurring-task-generated', (event, data) => callback(data)),

    // ========================================
    // Content Viewing
    // ========================================
    viewContent: (url, type) => ipcRenderer.invoke('view-content', { url, type }),
    switchToEdit: (docId, docType) => ipcRenderer.invoke('switch-to-edit', { docId, docType }),
    closeContent: () => ipcRenderer.invoke('close-content'),

    // ========================================
    // AI Agent (Streaming)
    // ========================================
    askAgentStream: (message, sessionId) =>
        ipcRenderer.invoke('ask-agent-stream', { message, sessionId }),
    onAgentStreamChunk: (callback) =>
        ipcRenderer.on('agent-stream-chunk', (event, data) => callback(data)),
    onAgentStreamEnd: (callback) =>
        ipcRenderer.on('agent-stream-end', (event, data) => callback(data)),
    onAgentStreamError: (callback) =>
        ipcRenderer.on('agent-stream-error', (event, data) => callback(data)),
    removeAgentStreamListeners: () => {
        ipcRenderer.removeAllListeners('agent-stream-chunk');
        ipcRenderer.removeAllListeners('agent-stream-end');
        ipcRenderer.removeAllListeners('agent-stream-error');
    },

    // ========================================
    // AI Key Management
    // ========================================
    saveAnthropicKey: (key) =>
        ipcRenderer.invoke('save-anthropic-key', key),
    getAnthropicKeyStatus: () =>
        ipcRenderer.invoke('get-anthropic-key-status'),
    testAnthropicKey: () =>
        ipcRenderer.invoke('test-anthropic-key'),
    clearAnthropicKey: () =>
        ipcRenderer.invoke('clear-anthropic-key'),

    // ========================================
    // AI Session History
    // ========================================
    getAiSessions: () =>
        ipcRenderer.invoke('get-ai-sessions'),
    clearAiHistory: () =>
        ipcRenderer.invoke('clear-ai-history'),
    startNewAiSession: () =>
        ipcRenderer.invoke('start-new-ai-session'),

    // ========================================
    // Notifications
    // ========================================
    getNotificationSettings: () => ipcRenderer.invoke('get-notification-settings'),
    updateNotificationSettings: (updates) => ipcRenderer.invoke('update-notification-settings', updates),
    showNotification: (options) => ipcRenderer.invoke('show-notification', options),
    getScheduledNotifications: () => ipcRenderer.invoke('get-scheduled-notifications'),
    scheduleTaskReminders: (tasks) => ipcRenderer.invoke('schedule-task-reminders', { tasks }),
    scheduleCalendarReminders: (events) => ipcRenderer.invoke('schedule-calendar-reminders', { events }),
    scheduleMeetingReminders: (meetings) => ipcRenderer.invoke('schedule-meeting-reminders', { meetings }),
    cancelNotification: (id) => ipcRenderer.invoke('cancel-notification', { id }),
    cancelAllNotifications: () => ipcRenderer.invoke('cancel-all-notifications'),
    isNotificationSupported: () => ipcRenderer.invoke('notification-supported'),
    syncNotificationReminders: () => ipcRenderer.invoke('sync-notification-reminders'),

    // ========================================
    // Background Sync Controller
    // ========================================
    getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
    forceSync: (service) => ipcRenderer.invoke('force-sync', { service }),
    resetNewItemCounts: () => ipcRenderer.invoke('reset-new-item-counts'),
    onSyncComplete: (callback) => ipcRenderer.on('sync-complete', (event, data) => callback(data)),
    onGmailSynced: (callback) => ipcRenderer.on('gmail-synced', (event, data) => callback(data)),
    onCalendarSynced: (callback) => ipcRenderer.on('calendar-synced', (event, data) => callback(data)),
    onTasksSynced: (callback) => ipcRenderer.on('tasks-synced', (event, data) => callback(data)),
    onDriveSynced: (callback) => ipcRenderer.on('drive-synced', (event, data) => callback(data)),
    removeSyncListeners: () => {
        ipcRenderer.removeAllListeners('sync-complete');
        ipcRenderer.removeAllListeners('gmail-synced');
        ipcRenderer.removeAllListeners('calendar-synced');
        ipcRenderer.removeAllListeners('tasks-synced');
        ipcRenderer.removeAllListeners('drive-synced');
    },

    // ========================================
    // Shell
    // ========================================
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // ========================================
    // Event Listeners
    // ========================================
    onContentOpened: (callback) => ipcRenderer.on('content-view-opened', () => callback()),
    onContentClosed: (callback) => ipcRenderer.on('content-view-closed', () => callback()),
    removeContentListeners: () => {
        ipcRenderer.removeAllListeners('content-view-opened');
        ipcRenderer.removeAllListeners('content-view-closed');
    }
});
