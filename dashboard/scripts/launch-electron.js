#!/usr/bin/env node
/**
 * Electron launcher script
 *
 * VSCode's integrated terminal sets ELECTRON_RUN_AS_NODE=1 which causes
 * the Electron binary to run as plain Node.js instead of initializing
 * Chromium and the Electron app context. This launcher removes that
 * variable before spawning the Electron process.
 */
const { spawn } = require('child_process');
const electronPath = require('electron');

// Build clean environment without ELECTRON_RUN_AS_NODE
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env,
    cwd: __dirname.replace(/[\\/]scripts$/, '')
});

child.on('close', (code) => process.exit(code ?? 1));

// Forward termination signals
['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => {
        if (!child.killed) child.kill(signal);
    });
});
