/**
 * Notification Manager for Googol Vibe
 * Handles macOS native push notifications via Electron Notification API
 */

const { Notification, nativeImage, app } = require('electron');
const path = require('path');

/**
 * Safe logging wrapper - prevents EPIPE crashes when stdout is closed
 */
function safeLog(...args) {
    try {
        if (process.stdout && process.stdout.writable) {
            console.log(...args);
        }
    } catch (err) {
        // Silently ignore EPIPE errors - stdout/stderr pipe closed
    }
}

// In-memory store for scheduled notifications
const scheduledNotifications = new Map();

// Default settings
let notificationSettings = {
    enabled: true,
    taskReminders: true,
    calendarReminders: true,
    emailNotifications: true,
    recurringTaskAlerts: true,
    // Reminder lead times (in minutes)
    taskReminderLeadTime: 30,      // 30 minutes before task due
    calendarReminderLeadTime: 15,  // 15 minutes before event
    // Quiet hours (24h format)
    quietHoursEnabled: false,
    quietHoursStart: 22,  // 10 PM
    quietHoursEnd: 8      // 8 AM
};

/**
 * Check if notifications are supported
 */
function isSupported() {
    return Notification.isSupported();
}

/**
 * Check if we're in quiet hours
 */
function isQuietHours() {
    if (!notificationSettings.quietHoursEnabled) return false;

    const now = new Date();
    const hour = now.getHours();
    const { quietHoursStart, quietHoursEnd } = notificationSettings;

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if (quietHoursStart > quietHoursEnd) {
        return hour >= quietHoursStart || hour < quietHoursEnd;
    }
    return hour >= quietHoursStart && hour < quietHoursEnd;
}

/**
 * Get the app icon for notifications
 */
function getIcon() {
    // Use app icon if available
    const iconPath = path.join(__dirname, '../assets/icon.png');
    try {
        return nativeImage.createFromPath(iconPath);
    } catch {
        return undefined;
    }
}

/**
 * Show a notification
 * @param {Object} options - Notification options
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body text
 * @param {string} [options.subtitle] - macOS subtitle
 * @param {string} [options.category] - Category for grouping (task, calendar, email, recurring)
 * @param {Object} [options.data] - Custom data to pass to click handler
 * @param {boolean} [options.silent] - Whether to play sound
 * @param {Function} [options.onClick] - Click handler
 */
function show(options) {
    if (!notificationSettings.enabled || !isSupported()) {
        safeLog('[Notifications] Disabled or unsupported');
        return null;
    }

    if (isQuietHours()) {
        safeLog('[Notifications] Quiet hours active, skipping');
        return null;
    }

    // Check category-specific settings
    const { category } = options;
    if (category === 'task' && !notificationSettings.taskReminders) return null;
    if (category === 'calendar' && !notificationSettings.calendarReminders) return null;
    if (category === 'email' && !notificationSettings.emailNotifications) return null;
    if (category === 'recurring' && !notificationSettings.recurringTaskAlerts) return null;

    const notification = new Notification({
        title: options.title,
        body: options.body,
        subtitle: options.subtitle,
        icon: getIcon(),
        silent: options.silent || false,
        hasReply: false,
        timeoutType: 'default'
    });

    // Store data for click handler
    if (options.data) {
        notification._customData = options.data;
    }

    notification.on('click', () => {
        safeLog('[Notifications] Clicked:', options.title);
        if (options.onClick) {
            options.onClick(notification._customData);
        }
    });

    notification.on('close', () => {
        safeLog('[Notifications] Closed:', options.title);
    });

    notification.show();
    safeLog('[Notifications] Shown:', options.title);

    return notification;
}

/**
 * Show a task reminder notification
 */
function showTaskReminder(task) {
    return show({
        title: 'Task Reminder',
        body: task.title,
        subtitle: task.due ? `Due: ${new Date(task.due).toLocaleString()}` : 'No due date',
        category: 'task',
        data: { type: 'task', taskId: task.id }
    });
}

/**
 * Show a calendar event reminder
 */
function showCalendarReminder(event) {
    const startTime = new Date(event.start).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    return show({
        title: event.summary || 'Calendar Event',
        body: `Starting at ${startTime}`,
        subtitle: event.location || undefined,
        category: 'calendar',
        data: { type: 'calendar', eventId: event.id, htmlLink: event.htmlLink }
    });
}

/**
 * Show a meeting starting soon notification
 */
function showMeetingReminder(meeting) {
    const startTime = new Date(meeting.start).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    return show({
        title: 'Meeting Starting Soon',
        body: meeting.summary || 'Untitled Meeting',
        subtitle: `Starts at ${startTime}`,
        category: 'calendar',
        data: { type: 'meeting', meetLink: meeting.meetLink }
    });
}

/**
 * Show a new email notification
 */
function showEmailNotification(email) {
    return show({
        title: email.from ? email.from.split('<')[0].trim() : 'New Email',
        body: email.subject || 'No Subject',
        category: 'email',
        data: { type: 'email', emailId: email.id }
    });
}

/**
 * Show a recurring task generated notification
 */
function showRecurringTaskGenerated(rule, taskId) {
    return show({
        title: 'Recurring Task Created',
        body: rule.title,
        subtitle: 'A new instance has been generated',
        category: 'recurring',
        data: { type: 'recurring', ruleId: rule.id, taskId }
    });
}

/**
 * Schedule a notification for a specific time
 * @param {string} id - Unique identifier for this scheduled notification
 * @param {Date} scheduledTime - When to show the notification
 * @param {Object} options - Notification options (same as show())
 */
function schedule(id, scheduledTime, options) {
    // Cancel any existing notification with this ID
    cancel(id);

    const now = Date.now();
    let delay = scheduledTime.getTime() - now;

    if (delay <= 0) {
        safeLog('[Notifications] Scheduled time is in the past, skipping:', id);
        return;
    }

    // Cap delay to 24 hours to avoid 32-bit integer overflow
    // Notifications further out will be rescheduled on next sync
    const MAX_DELAY = 24 * 60 * 60 * 1000; // 24 hours
    if (delay > MAX_DELAY) {
        safeLog(`[Notifications] Delay too large, capping to 24h:`, id);
        delay = MAX_DELAY;
    }

    safeLog(`[Notifications] Scheduling "${id}" for ${scheduledTime.toISOString()} (${Math.round(delay / 60000)} min)`);

    const timeoutId = setTimeout(() => {
        show(options);
        scheduledNotifications.delete(id);
    }, delay);

    scheduledNotifications.set(id, {
        timeoutId,
        scheduledTime,
        options
    });
}

/**
 * Cancel a scheduled notification
 */
function cancel(id) {
    const scheduled = scheduledNotifications.get(id);
    if (scheduled) {
        clearTimeout(scheduled.timeoutId);
        scheduledNotifications.delete(id);
        safeLog('[Notifications] Cancelled scheduled:', id);
    }
}

/**
 * Cancel all scheduled notifications
 */
function cancelAll() {
    for (const [id, scheduled] of scheduledNotifications) {
        clearTimeout(scheduled.timeoutId);
    }
    scheduledNotifications.clear();
    safeLog('[Notifications] Cancelled all scheduled notifications');
}

/**
 * Schedule task reminders based on due dates
 */
function scheduleTaskReminders(tasks) {
    const leadTimeMs = notificationSettings.taskReminderLeadTime * 60 * 1000;

    for (const task of tasks) {
        if (!task.due) continue;

        const dueDate = new Date(task.due);
        const reminderTime = new Date(dueDate.getTime() - leadTimeMs);
        const id = `task-reminder-${task.id}`;

        schedule(id, reminderTime, {
            title: 'Task Due Soon',
            body: task.title,
            subtitle: `Due: ${dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            category: 'task',
            data: { type: 'task', taskId: task.id }
        });
    }
}

/**
 * Schedule calendar event reminders
 */
function scheduleCalendarReminders(events) {
    const leadTimeMs = notificationSettings.calendarReminderLeadTime * 60 * 1000;

    for (const event of events) {
        if (!event.start) continue;

        const startDate = new Date(event.start);
        const reminderTime = new Date(startDate.getTime() - leadTimeMs);
        const id = `calendar-reminder-${event.id}`;

        schedule(id, reminderTime, {
            title: 'Event Starting Soon',
            body: event.summary || 'Calendar Event',
            subtitle: `Starts at ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            category: 'calendar',
            data: { type: 'calendar', eventId: event.id, htmlLink: event.htmlLink }
        });
    }
}

/**
 * Schedule meeting reminders (15 min before)
 */
function scheduleMeetingReminders(meetings) {
    const leadTimeMs = notificationSettings.calendarReminderLeadTime * 60 * 1000;

    for (const meeting of meetings) {
        if (!meeting.start) continue;

        const startDate = new Date(meeting.start);
        const reminderTime = new Date(startDate.getTime() - leadTimeMs);
        const id = `meeting-reminder-${meeting.id}`;

        schedule(id, reminderTime, {
            title: 'Meeting Starting Soon',
            body: meeting.summary || 'Untitled Meeting',
            subtitle: `Starts at ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            category: 'calendar',
            data: { type: 'meeting', meetLink: meeting.meetLink }
        });
    }
}

/**
 * Update notification settings
 */
function updateSettings(newSettings) {
    notificationSettings = { ...notificationSettings, ...newSettings };
    safeLog('[Notifications] Settings updated:', notificationSettings);
}

/**
 * Get current notification settings
 */
function getSettings() {
    return { ...notificationSettings };
}

/**
 * Get scheduled notifications info
 */
function getScheduled() {
    const result = [];
    for (const [id, data] of scheduledNotifications) {
        result.push({
            id,
            scheduledTime: data.scheduledTime.toISOString(),
            title: data.options.title
        });
    }
    return result;
}

/**
 * Initialize notification manager
 */
function init(savedSettings = null) {
    if (savedSettings) {
        notificationSettings = { ...notificationSettings, ...savedSettings };
    }

    if (!isSupported()) {
        safeLog('[Notifications] Not supported on this platform');
        return;
    }

    safeLog('[Notifications] Manager initialized');
    safeLog('[Notifications] Settings:', notificationSettings);
}

module.exports = {
    init,
    isSupported,
    show,
    showTaskReminder,
    showCalendarReminder,
    showMeetingReminder,
    showEmailNotification,
    showRecurringTaskGenerated,
    schedule,
    cancel,
    cancelAll,
    scheduleTaskReminders,
    scheduleCalendarReminders,
    scheduleMeetingReminders,
    updateSettings,
    getSettings,
    getScheduled
};
