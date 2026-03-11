const log = require('electron-log/main');

log.initialize();

// File transport: 5MB max, 5 files retained
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.file.maxFiles = 5;
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

// Level: debug in development, info in production
const level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
log.transports.file.level = level;
log.transports.console.level = level;

module.exports = log;
