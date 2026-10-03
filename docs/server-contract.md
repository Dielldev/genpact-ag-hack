# Server contract

What `@mesh/server` must expose so the hook installed by `mesh init` works. Every type and enum named here lives in `@mesh/contract`. Import it, do not copy it.

The server receives data through two separate channels:

1. **Hook to REST ping.** Fires each time an agent finishes a response. Metadata only, never message text or code.
2. **Agent to MCP `report_progress`.** The structured report. The hook asks the agent to call it, and what the tool returns goes straight back to the agent.

## REST

### `GET /api/v1/me` (`ApiRoute.me`)

Returns `{ person, workspace, auth }` for the bearer key (`person` and `workspace` are null when the server has no keys configured, `auth` says whether keys are required). `401` when keys are required and the key is missing or wrong. `mesh init` uses it to take the name and workspace from the key.

### `GET /api/v1/health` (`ApiRoute.health`)

Any 2xx. Used by `mesh init` and `mesh status`.

### `POST /api/v1/turns` (`ApiRoute.turns`)

Body: `TurnPing`

```json
{
  "client": "claude-code",
  "session_id": "abc123",
  "turn_id": "550e8400-...",
  "person": "Ana Lee",
  "workspace": "acme-dev",
  "project": "billing-service",
  "visibility": "shared",
  "ts": "2026-10-03T14:02:11.000Z"
}
```

- `client` is a `Client`, `visibility` is a `Visibility`, `turn_id` is optional
- `project` is the folder name of the working directory, never a full path

Response: `TurnPingResponse`

```json
{ "request_report": true, "note": "optional, max 500 chars, appended to the agent's instruction" }
```

How the hook behaves:

- **Fail-open.** If there is no reply within `TURN_PING_TIMEOUT_MS` (2.5s), or the status is non-2xx, or the server is unreachable, the agent stops normally and nothing is reported
- A missing `request_report` is treated as `true`. Return `false` to skip a report, for example when the session reported seconds ago
- Use the ping to mark a session as active and update its last-seen time in the live feed, even when no report follows

## MCP

- Transport: Streamable HTTP at `/mcp` (`ApiRoute.mcp`)
- Auth: when the server has team keys configured (`MESH_MEMBERS`), every route except `GET /api/v1/health` needs `Authorization: Bearer <key>`, and `mesh init --key` writes that header into each client's MCP config. The person (and the workspace, when `MESH_WORKSPACE` is set) come from the key, not from the request body. With no keys configured the server is open (local development)
- `mesh init` registers the server as `mesh` (`MCP_SERVER_NAME`) in every client and pre-approves `mcp__mesh__report_progress` in Claude Code, so the tool name must be exactly `report_progress` (`McpTool.reportProgress`)
- Tool descriptions are part of the agent's instructions, so write them carefully

### `report_progress`

Input: `ReportProgressInput`

| Field | Type | Notes |
|---|---|---|
| `session_id` | string | Copied from the hook. Upsert key together with `client` |
| `client` | `Client` | |
| `person` | string | From the user's local config, not authenticated |
| `workspace` | string | The permission boundary |
| `visibility` | `Visibility` | |
| `ticket_ref` | string, optional | |
| `task` | string | |
| `status` | `ReportStatus` | `in_progress`, `blocked` or `done` |
| `summary` | string | 1 to 2 sentences |
| `artifacts` | `ArtifactRef[]` | `{kind, ref, label?}`, for example `{kind: "file", ref: "src/billing/retry.ts"}` or `{kind: "deal", ref: "Project Falcon"}` |
| `modules` | string[] | Retrieval keys |
| `tags` | string[] | |
| `decisions` | `{area, choice, reason}[]`, optional | `area` is a `DecisionArea` (`technical` or `product`). Only important decisions that were explicitly made and matter for future work. Usually absent |
| `dead_ends` | `{attempt, reason}[]` | |
| `human_corrections` | `{correction, reason}[]` | |
| `blockers` | string[] | |

Server behaviour:

- Upsert the session on `(client, session_id)` and append the report and its items (see [database.md](database.md))
- Default every missing array to `[]`, agents will omit fields
- Reject values outside the enums
- Run secret redaction before anything is written
- Keep `private` reports out of every shared query and out of the warning check
- Keep the whole call fast, ideally under 5 seconds, because the agent waits on it

Output: `ReportProgressResult`

```json
{
  "event_id": "4b6f...",
  "warnings": [
    { "kind": "collision", "message": "Ana is rewriting the retry logic you depend on.", "source_event_ids": ["91ac..."] }
  ]
}
```

Return it as `structuredContent` and also as a short text content block, since some clients only show text to the model. With no warnings the text can just say `Recorded.` Return an empty `warnings` array unless the match is real: the agent is told to relay every warning to the user.

### Other tools

`list_my_tickets`, `get_ticket`, `create_ticket` and `ask_team` are named in `McpTool`. Their schemas are still open and the hook does not depend on them.
