/**
 * Googol Vibe - Telemetry Module
 *
 * Opt-in error reporting via Sentry.
 * No tracking or analytics - errors only.
 *
 * Privacy: Users must explicitly enable telemetry in settings.
 * No data is collected unless telemetryEnabled: true in config.json
 */

const configManager = require('./config-manager');

// Sentry DSN - replace with your actual DSN when ready
// For now, use empty string to prevent any data transmission
const SENTRY_DSN = process.env.SENTRY_DSN || '';

let sentryInitialized = false;

/**
 * Initialize Sentry if telemetry is enabled.
 * Called after app is ready and config is loaded.
 */
function initTelemetry() {
    // Only initialize if:
    // 1. Telemetry is enabled in config
    // 2. DSN is configured
    // 3. Not already initialized
    if (!configManager.isTelemetryEnabled()) {
        console.log('[Telemetry] Disabled - user has not opted in');
        return false;
    }

    if (!SENTRY_DSN) {
        console.log('[Telemetry] DSN not configured - skipping initialization');
        return false;
    }

    if (sentryInitialized) {
        return true;
    }

    try {
        const Sentry = require('@sentry/electron/main');

        Sentry.init({
            dsn: SENTRY_DSN,
            environment: process.env.NODE_ENV || 'production',
            release: require('../package.json').version,

            // Only capture errors, not transactions
            tracesSampleRate: 0,

            // Filter out sensitive data
            beforeSend(event) {
                // Remove potentially sensitive breadcrumbs
                if (event.breadcrumbs) {
                    event.breadcrumbs = event.breadcrumbs.filter(crumb => {
                        // Remove network breadcrumbs (may contain tokens)
                        if (crumb.category === 'fetch' || crumb.category === 'xhr') {
                            return false;
                        }
                        // Remove console logs (may contain sensitive data)
                        if (crumb.category === 'console') {
                            return false;
                        }
                        return true;
                    });
                }

                // Remove user email if accidentally captured
                if (event.user) {
                    delete event.user.email;
                    delete event.user.username;
                }

                // Remove file paths that might reveal usernames
                if (event.exception?.values) {
                    for (const exception of event.exception.values) {
                        if (exception.stacktrace?.frames) {
                            for (const frame of exception.stacktrace.frames) {
                                if (frame.filename) {
                                    // Replace home directory with ~
                                    frame.filename = frame.filename.replace(
                                        /\/Users\/[^/]+\//g,
                                        '~/'
                                    );
                                }
                            }
                        }
                    }
                }

                return event;
            },

            // Don't send if local development
            enabled: process.env.NODE_ENV !== 'development'
        });

        sentryInitialized = true;
        console.log('[Telemetry] Sentry initialized (opt-in)');
        return true;
    } catch (e) {
        console.error('[Telemetry] Failed to initialize Sentry:', e.message);
        return false;
    }
}

/**
 * Enable telemetry - saves preference and initializes Sentry
 */
function enableTelemetry() {
    configManager.setTelemetryEnabled(true);
    return initTelemetry();
}

/**
 * Disable telemetry - saves preference (Sentry cleanup happens on restart)
 */
function disableTelemetry() {
    configManager.setTelemetryEnabled(false);
    console.log('[Telemetry] Disabled - will take effect on next app start');
    return true;
}

/**
 * Check if telemetry is currently enabled
 */
function isEnabled() {
    return configManager.isTelemetryEnabled();
}

/**
 * Manually capture an error (for non-crash errors)
 */
function captureError(error, context = {}) {
    if (!sentryInitialized) {
        return;
    }

    try {
        const Sentry = require('@sentry/electron/main');
        Sentry.captureException(error, { extra: context });
    } catch (e) {
        // Silently fail - telemetry should never break the app
    }
}

/**
 * Manually capture a message
 */
function captureMessage(message, level = 'info') {
    if (!sentryInitialized) {
        return;
    }

    try {
        const Sentry = require('@sentry/electron/main');
        Sentry.captureMessage(message, level);
    } catch (e) {
        // Silently fail
    }
}

module.exports = {
    initTelemetry,
    enableTelemetry,
    disableTelemetry,
    isEnabled,
    captureError,
    captureMessage
};
