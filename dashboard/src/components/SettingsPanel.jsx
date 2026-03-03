import { useState, useEffect } from 'react';
import { X, Bell, RefreshCw, BarChart3, User, ChevronDown, ChevronUp, Moon, Sun } from 'lucide-react';
import { useTheme } from '../ThemeContext';

function SettingsPanel({ isOpen, onClose, profile, onLogout, addToast }) {
    const { theme, toggleTheme } = useTheme();
    const [notifSettings, setNotifSettings] = useState(null);
    const [telemetryEnabled, setTelemetryEnabled] = useState(false);
    const [syncStatus, setSyncStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedSection, setExpandedSection] = useState('notifications');

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const [notif, telemetry, sync] = await Promise.all([
                window.electronAPI.getNotificationSettings(),
                window.electronAPI.getTelemetryStatus(),
                window.electronAPI.getSyncStatus()
            ]);
            setNotifSettings(notif);
            setTelemetryEnabled(telemetry.enabled);
            setSyncStatus(sync);
        } catch (e) {
            console.error('Failed to load settings', e);
            addToast('Failed to load settings', 'error');
        } finally {
            setLoading(false);
        }
    };

    const updateNotifSetting = async (key, value) => {
        try {
            const updates = { [key]: value };
            const updated = await window.electronAPI.updateNotificationSettings(updates);
            setNotifSettings(updated);
            addToast('Notification settings updated', 'success');
        } catch (e) {
            console.error('Failed to update notification setting', e);
            addToast('Failed to update settings', 'error');
        }
    };

    const toggleTelemetry = async () => {
        try {
            const newState = !telemetryEnabled;
            await window.electronAPI.setTelemetry(newState);
            setTelemetryEnabled(newState);
            addToast(newState ? 'Telemetry enabled' : 'Telemetry disabled', 'success');
        } catch (e) {
            console.error('Failed to toggle telemetry', e);
            addToast('Failed to update telemetry setting', 'error');
        }
    };

    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    if (!isOpen) return null;

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-panel" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="settings-header">
                    <span className="settings-title">Settings</span>
                    <button className="settings-close" onClick={onClose} aria-label="Close settings">
                        <X size={18} />
                    </button>
                </div>

                <div className="settings-body">
                    {loading ? (
                        <div className="settings-loading">Loading settings...</div>
                    ) : (
                        <>
                            {/* Account Section */}
                            <div className="settings-section">
                                <button
                                    className="settings-section-header"
                                    onClick={() => toggleSection('account')}
                                >
                                    <div className="settings-section-title">
                                        <User size={16} /> Account
                                    </div>
                                    {expandedSection === 'account' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {expandedSection === 'account' && (
                                    <div className="settings-section-content">
                                        {profile && (
                                            <div className="settings-account-info">
                                                <img
                                                    src={profile.picture}
                                                    alt="Profile"
                                                    referrerPolicy="no-referrer"
                                                    className="settings-avatar"
                                                />
                                                <div>
                                                    <div className="settings-account-name">{profile.name}</div>
                                                    <div className="settings-account-email">{profile.email}</div>
                                                </div>
                                            </div>
                                        )}
                                        <button
                                            className="settings-btn-danger"
                                            onClick={() => {
                                                onLogout();
                                                onClose();
                                            }}
                                        >
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Appearance Section */}
                            <div className="settings-section">
                                <button
                                    className="settings-section-header"
                                    onClick={() => toggleSection('appearance')}
                                >
                                    <div className="settings-section-title">
                                        {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />} Appearance
                                    </div>
                                    {expandedSection === 'appearance' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {expandedSection === 'appearance' && (
                                    <div className="settings-section-content">
                                        <ToggleRow
                                            label="Dark mode"
                                            checked={theme === 'dark'}
                                            onChange={toggleTheme}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Notifications Section */}
                            <div className="settings-section">
                                <button
                                    className="settings-section-header"
                                    onClick={() => toggleSection('notifications')}
                                >
                                    <div className="settings-section-title">
                                        <Bell size={16} /> Notifications
                                    </div>
                                    {expandedSection === 'notifications' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {expandedSection === 'notifications' && notifSettings && (
                                    <div className="settings-section-content">
                                        <ToggleRow
                                            label="Enable notifications"
                                            checked={notifSettings.enabled}
                                            onChange={(v) => updateNotifSetting('enabled', v)}
                                        />
                                        <ToggleRow
                                            label="Task reminders"
                                            checked={notifSettings.taskReminders}
                                            onChange={(v) => updateNotifSetting('taskReminders', v)}
                                            disabled={!notifSettings.enabled}
                                        />
                                        <ToggleRow
                                            label="Calendar reminders"
                                            checked={notifSettings.calendarReminders}
                                            onChange={(v) => updateNotifSetting('calendarReminders', v)}
                                            disabled={!notifSettings.enabled}
                                        />
                                        <ToggleRow
                                            label="Email notifications"
                                            checked={notifSettings.emailNotifications}
                                            onChange={(v) => updateNotifSetting('emailNotifications', v)}
                                            disabled={!notifSettings.enabled}
                                        />
                                        <ToggleRow
                                            label="Recurring task alerts"
                                            checked={notifSettings.recurringTaskAlerts}
                                            onChange={(v) => updateNotifSetting('recurringTaskAlerts', v)}
                                            disabled={!notifSettings.enabled}
                                        />
                                        <div className="settings-row">
                                            <span className="settings-row-label">Task reminder lead time</span>
                                            <select
                                                className="settings-select"
                                                value={notifSettings.taskReminderLeadTime}
                                                onChange={(e) => updateNotifSetting('taskReminderLeadTime', Number(e.target.value))}
                                                disabled={!notifSettings.enabled}
                                            >
                                                <option value={5}>5 min</option>
                                                <option value={10}>10 min</option>
                                                <option value={15}>15 min</option>
                                                <option value={30}>30 min</option>
                                                <option value={60}>1 hour</option>
                                            </select>
                                        </div>
                                        <div className="settings-row">
                                            <span className="settings-row-label">Calendar reminder lead time</span>
                                            <select
                                                className="settings-select"
                                                value={notifSettings.calendarReminderLeadTime}
                                                onChange={(e) => updateNotifSetting('calendarReminderLeadTime', Number(e.target.value))}
                                                disabled={!notifSettings.enabled}
                                            >
                                                <option value={5}>5 min</option>
                                                <option value={10}>10 min</option>
                                                <option value={15}>15 min</option>
                                                <option value={30}>30 min</option>
                                                <option value={60}>1 hour</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sync Section */}
                            <div className="settings-section">
                                <button
                                    className="settings-section-header"
                                    onClick={() => toggleSection('sync')}
                                >
                                    <div className="settings-section-title">
                                        <RefreshCw size={16} /> Sync
                                    </div>
                                    {expandedSection === 'sync' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {expandedSection === 'sync' && syncStatus && (
                                    <div className="settings-section-content">
                                        <SyncRow label="Gmail" status={syncStatus.gmail} />
                                        <SyncRow label="Calendar" status={syncStatus.calendar} />
                                        <SyncRow label="Tasks" status={syncStatus.tasks} />
                                        <SyncRow label="Drive" status={syncStatus.drive} />
                                    </div>
                                )}
                            </div>

                            {/* Telemetry Section */}
                            <div className="settings-section">
                                <button
                                    className="settings-section-header"
                                    onClick={() => toggleSection('telemetry')}
                                >
                                    <div className="settings-section-title">
                                        <BarChart3 size={16} /> Telemetry
                                    </div>
                                    {expandedSection === 'telemetry' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {expandedSection === 'telemetry' && (
                                    <div className="settings-section-content">
                                        <p className="settings-telemetry-note">
                                            Anonymous usage data helps improve the app. No personal data or Google content is ever collected.
                                        </p>
                                        <ToggleRow
                                            label="Send anonymous usage data"
                                            checked={telemetryEnabled}
                                            onChange={toggleTelemetry}
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Sub-components
// ============================================================

function ToggleRow({ label, checked, onChange, disabled = false }) {
    return (
        <div className={`settings-row ${disabled ? 'settings-row-disabled' : ''}`}>
            <span className="settings-row-label">{label}</span>
            <button
                className={`settings-toggle ${checked ? 'settings-toggle-on' : ''}`}
                onClick={() => !disabled && onChange(!checked)}
                disabled={disabled}
                role="switch"
                aria-checked={checked}
            >
                <div className="settings-toggle-knob" />
            </button>
        </div>
    );
}

function SyncRow({ label, status }) {
    if (!status) return null;
    const lastSync = status.lastSync ? new Date(status.lastSync).toLocaleTimeString() : 'Never';
    return (
        <div className="settings-row">
            <span className="settings-row-label">{label}</span>
            <span className="settings-sync-time">{lastSync}</span>
        </div>
    );
}

export default SettingsPanel;
