# Google MCP Servers

This directory contains MCP (Model Context Protocol) servers for AI agent integration.

## Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Clone Gmail MCP
git clone https://github.com/pab1it0/gmail-mcp.git

# Clone Calendar MCP
git clone https://github.com/takumi0706/mcp-google-calendar.git

# Install dependencies
pip install -e gmail-mcp/
pip install -e mcp-google-calendar/
```

## Configuration

See `.agent/README.md` for MCP client configuration.
