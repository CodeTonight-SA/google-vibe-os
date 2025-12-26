/**
 * Googol Vibe - Unified Configuration Manager
 *
 * Provides single source of truth for all paths and configuration.
 * Supports environment variables, config files, and backwards compatibility.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { app } = require('electron');

// App constants
const APP_NAME = 'googol-vibe';
const LEGACY_SECRETS_PATH = '.agent/secrets';

class ConfigManager {
    constructor() {
        this.configDir = null;
        this.config = null;
        this._initialized = false;
    }

    /**
     * Initialize the config manager. Must be called after app is ready.
     */
    init() {
        if (this._initialized) return;

        this.configDir = this._resolveConfigDir();
        this._ensureDirectories();
        this.config = this._loadConfig();
        this._initialized = true;

        console.log(`[ConfigManager] Initialized: ${this.configDir}`);
    }

    /**
     * Resolve the configuration directory.
     * Priority: GOOGOL_VIBE_CONFIG_DIR > ~/.googol-vibe
     */
    _resolveConfigDir() {
        const envDir = process.env.GOOGOL_VIBE_CONFIG_DIR;
        if (envDir) {
            return this._expandPath(envDir);
        }
        return path.join(os.homedir(), `.${APP_NAME}`);
    }

    /**
     * Expand ~ to home directory
     */
    _expandPath(p) {
        if (p.startsWith('~')) {
            return path.join(os.homedir(), p.slice(1));
        }
        return p;
    }

    /**
     * Ensure required directories exist
     */
    _ensureDirectories() {
        const dirs = [
            this.configDir,
            path.join(this.configDir, 'tokens')
        ];

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }

    /**
     * Load or create config.json
     */
    _loadConfig() {
        const configPath = path.join(this.configDir, 'config.json');

        if (fs.existsSync(configPath)) {
            try {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch (e) {
                console.error('[ConfigManager] Error loading config:', e);
            }
        }

        // Default config
        return {
            version: 1,
            onboardingComplete: false,
            onboardingStep: 0,
            telemetryEnabled: false,
            connectedEmail: null,
            notifications: {
                enabled: true,
                taskReminders: true,
                calendarReminders: true,
                emailNotifications: true,
                recurringTaskAlerts: true,
                taskReminderLeadTime: 30,
                calendarReminderLeadTime: 15,
                quietHoursEnabled: false,
                quietHoursStart: 22,
                quietHoursEnd: 8
            }
        };
    }

    /**
     * Save config to disk
     */
    saveConfig() {
        const configPath = path.join(this.configDir, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    }

    /**
     * Get credentials.json path.
     * Priority: GOOGLE_CREDS_PATH > ~/.googol-vibe/credentials.json > legacy .agent/secrets
     */
    getCredentialsPath() {
        // Environment variable override
        const envPath = process.env.GOOGLE_CREDS_PATH;
        if (envPath && fs.existsSync(this._expandPath(envPath))) {
            return this._expandPath(envPath);
        }

        // New unified location
        const newPath = path.join(this.configDir, 'credentials.json');
        if (fs.existsSync(newPath)) {
            return newPath;
        }

        // Legacy location (backwards compatibility)
        const legacyPath = this._findLegacyCredentials();
        if (legacyPath) {
            console.log(`[ConfigManager] Using legacy credentials: ${legacyPath}`);
            return legacyPath;
        }

        // Default to new location (even if doesn't exist yet)
        return newPath;
    }

    /**
     * Find legacy credentials in .agent/secrets or dashboard/credentials.json
     */
    _findLegacyCredentials() {
        // Check relative to app
        const appDir = app.getAppPath();

        // Try .agent/secrets/credentials.json (project root)
        const projectRoot = path.resolve(appDir, '..');
        const agentSecrets = path.join(projectRoot, LEGACY_SECRETS_PATH, 'credentials.json');
        if (fs.existsSync(agentSecrets)) {
            return agentSecrets;
        }

        // Try dashboard/credentials.json
        const dashboardCreds = path.join(appDir, 'credentials.json');
        if (fs.existsSync(dashboardCreds)) {
            return dashboardCreds;
        }

        // Try __dirname/../credentials.json (original hardcoded path)
        const originalPath = path.join(__dirname, '..', 'credentials.json');
        if (fs.existsSync(originalPath)) {
            return originalPath;
        }

        return null;
    }

    /**
     * Get token file path for a specific service.
     * @param {string} service - Service name (electron, flask, gmail-mcp, calendar-mcp)
     */
    getTokenPath(service = 'electron') {
        // Environment variable override
        const envDir = process.env.GOOGLE_TOKEN_DIR;
        if (envDir) {
            return path.join(this._expandPath(envDir), `token_${service}.json`);
        }

        // New unified location
        return path.join(this.configDir, 'tokens', `token_${service}.json`);
    }

    /**
     * Get legacy token path (for backwards compatibility during migration)
     */
    getLegacyTokenPath() {
        // Electron's userData token
        return path.join(app.getPath('userData'), 'token.json');
    }

    /**
     * Check if credentials exist and are valid
     */
    hasValidCredentials() {
        const credPath = this.getCredentialsPath();
        if (!fs.existsSync(credPath)) {
            return false;
        }

        try {
            const content = JSON.parse(fs.readFileSync(credPath, 'utf8'));
            return !!(content.installed?.client_id || content.web?.client_id);
        } catch (e) {
            return false;
        }
    }

    /**
     * Check if user has completed OAuth
     */
    hasValidToken() {
        const tokenPath = this.getTokenPath();
        if (fs.existsSync(tokenPath)) {
            return true;
        }

        // Check legacy location
        const legacyPath = this.getLegacyTokenPath();
        return fs.existsSync(legacyPath);
    }

    /**
     * Check if onboarding is required
     */
    needsOnboarding() {
        return !this.hasValidCredentials() || !this.config.onboardingComplete;
    }

    /**
     * Get onboarding state
     */
    getOnboardingState() {
        return {
            needsOnboarding: this.needsOnboarding(),
            hasCredentials: this.hasValidCredentials(),
            hasToken: this.hasValidToken(),
            onboardingComplete: this.config.onboardingComplete,
            onboardingStep: this.config.onboardingStep,
            connectedEmail: this.config.connectedEmail
        };
    }

    /**
     * Update onboarding progress
     */
    updateOnboarding(updates) {
        Object.assign(this.config, updates);
        this.saveConfig();
    }

    /**
     * Import credentials from a file path
     * @param {string} sourcePath - Path to credentials file to import
     */
    async importCredentials(sourcePath) {
        const content = await fs.promises.readFile(sourcePath, 'utf8');
        const creds = JSON.parse(content);

        // Validate structure
        if (!creds.installed?.client_id && !creds.web?.client_id) {
            throw new Error('Invalid credentials file: missing client_id');
        }

        // Copy to config directory
        const destPath = path.join(this.configDir, 'credentials.json');
        await fs.promises.writeFile(destPath, content);

        console.log(`[ConfigManager] Credentials imported to: ${destPath}`);
        return destPath;
    }

    /**
     * Migrate token from legacy location to new location
     */
    async migrateTokenIfNeeded() {
        const newTokenPath = this.getTokenPath();
        const legacyTokenPath = this.getLegacyTokenPath();

        // Already have new token
        if (fs.existsSync(newTokenPath)) {
            return false;
        }

        // Migrate legacy token
        if (fs.existsSync(legacyTokenPath)) {
            const content = await fs.promises.readFile(legacyTokenPath);
            await fs.promises.writeFile(newTokenPath, content);
            console.log(`[ConfigManager] Token migrated to: ${newTokenPath}`);
            return true;
        }

        return false;
    }

    /**
     * Get OAuth callback port
     */
    getOAuthPort() {
        return parseInt(process.env.OAUTH_CALLBACK_PORT || '3000', 10);
    }

    /**
     * Get Vite dev server port
     */
    getVitePort() {
        return parseInt(process.env.VITE_PORT || '9000', 10);
    }

    /**
     * Check if telemetry is enabled
     */
    isTelemetryEnabled() {
        return this.config.telemetryEnabled === true;
    }

    /**
     * Set telemetry preference
     */
    setTelemetryEnabled(enabled) {
        this.config.telemetryEnabled = enabled;
        this.saveConfig();
    }

    /**
     * Get notification settings
     */
    getNotificationSettings() {
        return this.config.notifications || {
            enabled: true,
            taskReminders: true,
            calendarReminders: true,
            emailNotifications: true,
            recurringTaskAlerts: true,
            taskReminderLeadTime: 30,
            calendarReminderLeadTime: 15,
            quietHoursEnabled: false,
            quietHoursStart: 22,
            quietHoursEnd: 8
        };
    }

    /**
     * Update notification settings
     */
    updateNotificationSettings(updates) {
        if (!this.config.notifications) {
            this.config.notifications = {};
        }
        Object.assign(this.config.notifications, updates);
        this.saveConfig();
        return this.config.notifications;
    }

    /**
     * Get all paths for debugging
     */
    debugPaths() {
        return {
            configDir: this.configDir,
            credentialsPath: this.getCredentialsPath(),
            tokenPath: this.getTokenPath(),
            legacyTokenPath: this.getLegacyTokenPath(),
            hasCredentials: this.hasValidCredentials(),
            hasToken: this.hasValidToken(),
            needsOnboarding: this.needsOnboarding()
        };
    }
}

// Singleton instance
const configManager = new ConfigManager();

module.exports = configManager;
