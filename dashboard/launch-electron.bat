@echo off
REM Clear ELECTRON_RUN_AS_NODE so Electron runs as GUI, not Node
set "ELECTRON_RUN_AS_NODE="
set "NODE_ENV=development"
cd /d "%~dp0"
"node_modules\electron\dist\electron.exe" .
