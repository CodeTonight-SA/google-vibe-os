# Agent Configuration

This directory contains MCP server configurations for AI agent integration.

## Setup

1. Copy example files:

   ```bash
   cp mcp.json.example mcp.json
   ```

2. Create secrets directory:

   ```bash
   mkdir -p secrets
   ```

3. Add your Google OAuth credentials:

   ```bash
   cp ~/Downloads/client_secret_*.json secrets/credentials.json
   ```

4. Edit `mcp.json` and replace placeholders:
   - `${PROJECT_DIR}` - Full path to this repository
   - `${HOME}` - Your home directory

## Structure

```text
.agent/
├── mcp.json              # Your MCP server config (gitignored)
├── mcp.json.example      # Template
├── secrets/              # OAuth credentials (gitignored)
│   ├── credentials.json
│   └── token.json
└── workflows/            # Agent workflows (gitignored)
```

## Security

The following are gitignored for security:

- `secrets/` - OAuth credentials and tokens
- `mcp.json` - Contains user-specific paths
- `workflows/` - May contain sensitive prompts
