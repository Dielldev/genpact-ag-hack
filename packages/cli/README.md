# @mesh/cli

`mesh init` connects every agent CLI on a machine to a Mesh server. It does two things per client:

1. Registers a hook that runs each time the agent finishes a response
2. Registers the Mesh MCP server so the agent can call `report_progress`

## How a turn works

1. The agent finishes a response and the client runs `~/.mesh/hook.mjs`
2. The hook sends a metadata-only ping to `POST /api/v1/turns`
3. If the server asks for a report, the hook tells the client to continue with an instruction to call `report_progress`
4. The agent calls the tool and gets any collision or rediscovery warnings back, relays them, and stops
5. On that second stop the hook lets the agent finish

The hook always fails open. If the server is down, the config is missing or anything throws, the agent stops normally.

## Supported clients

| Client | Hook config | Event | Continue response | Loop guard | MCP config |
|---|---|---|---|---|---|
| Claude Code | `~/.claude/settings.json` | `Stop` | `{"decision":"block","reason"}` | `stop_hook_active` | `~/.claude.json` (user scope) |
| Codex CLI | `~/.codex/hooks.json`, `[features] hooks = true` | `Stop` | `{"decision":"block","reason"}` | `stop_hook_active` | `~/.codex/config.toml` |
| Cursor | `~/.cursor/hooks.json` | `stop` | `{"followup_message"}` | `loop_count`, `loop_limit: 1` | `~/.cursor/mcp.json` |
| Gemini CLI | `~/.gemini/settings.json` | `AfterAgent` | `{"decision":"deny","reason"}` | `stop_hook_active` | `~/.gemini/settings.json` |

A per-session pending marker in `~/.mesh/state` is a second loop guard that does not depend on any client flag.

## Usage

```bash
pnpm --filter @mesh/cli build
node packages/cli/dist/cli.mjs init
node packages/cli/dist/cli.mjs status
node packages/cli/dist/cli.mjs uninstall
```

Non-interactive: `mesh init --yes --server https://mesh.example.com --person "Ana Lee" --workspace acme --clients claude-code,cursor`

Every config file is backed up once to `<file>.mesh-backup` before the first change. Files that cannot be parsed are left untouched and reported.

## Per project

Put a `.mesh.json` at the project root:

- `{"visibility": "private"}` sends reports marked private
- `{"enabled": false}` turns Mesh off for that project

The environment variables `MESH_PRIVATE=1` and `MESH_DISABLED=1` do the same for one shell.

## Debugging

`~/.mesh/hook.log` has one line per hook run with the client, a hashed session key and the decision. It never logs content.

## Not verified yet

- A live end-to-end run inside each real client. The tests use each client's documented payloads against the bundled hook
- Whether Codex and Cursor prompt for approval on the first `report_progress` call
- Cursor running a project's `.claude/settings.json` hooks as well when third-party hooks are enabled
