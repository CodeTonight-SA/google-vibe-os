const log = require('electron-log/main');
const { redactSecrets } = require('./log-redact');

log.initialize();

// File transport: 5MB max, 5 files retained
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.file.maxFiles = 5;
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

// Level: debug in development, info in production
const level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
log.transports.file.level = level;
log.transports.console.level = level;

// Redact secret-shaped strings from every log line (defence in depth). Guarded so
// an electron-log API change cannot break logging.
if (Array.isArray(log.hooks)) {
    log.hooks.push((message) => {
        if (message && Array.isArray(message.data)) {
            message.data = message.data.map((d) => (typeof d === 'string' ? redactSecrets(d) : d));
        }
        return message;
    });
}

module.exports = log;
