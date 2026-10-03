# Database

Supabase Postgres. Migrations live in `apps/server/supabase/migrations/` and run in filename order. Search uses built-in `tsvector` with GIN indexes, so no extension is needed. `pg_trgm` (fuzzy names) or `pgvector` (semantic search) can be added later by changing only `search_knowledge()`.

## The boundary

```
hook / MCP / web  ->  server  ->  RPC functions  ->  tables
```

- The hook only calls the server's HTTP API and never touches the database.
- The server only calls the functions below, never the tables. The functions are the database's public API.
- Only the server holds the Supabase `service_role` key. RLS is on with no policies, and `anon` / `authenticated` are revoked.
- Map contract types to function payloads in one adapter file in the server. A contract change then touches one file.
- Supabase's JS client has no transactions, so call `supabase.rpc(name, { p })`. A direct connection through the pooler works too.

## Core rule

A session is one row that is updated. Decisions, dead ends, corrections and blockers are rows that are only added. `reports`, `report_items` and `knowledge_entries` reject updates and deletes in the database. Only `visibility` (cascaded from the session) and `person` (cascaded from a rename) may change. Use `TRUNCATE` to reset a demo database.

## Functions (`mesh_api_version()` = 1)

| Function | Used by | Notes |
|---|---|---|
| `touch_session(p)` | `POST /api/v1/turns` | `p` is a `TurnPing`. Bumps `last_seen_at`, applies `visibility` and `project`, writes no report. Returns `{session_pk, last_report_at, report_count}` so the server can decide `request_report` |
| `report_progress(p)` | MCP `report_progress` | `p` is a `ReportProgressInput`. One transaction. Returns `{event_id, session_pk, warnings[]}` and each warning is `{id, kind, message, source_event_ids}` |
| `record_knowledge(p)` | exit interview | `{workspace, person, module?, question, answer, source_event_ids?}`. Also makes the answer searchable |
| `search_knowledge(workspace, query, modules, artifact_refs, limit)` | "why does Y work this way" | `ts_rank_cd` plus module and artifact boost plus recency decay. Shared only |
| `exit_interview_targets(workspace, person, limit)` | exit interview | Modules where the person is the main contributor, least-captured reasoning first |
| `module_history(workspace, module)` | onboarding | Reports, items and knowledge, oldest first |
| `workspace_vocabulary(workspace)` | planner | `{people, modules, tags}` from shared sessions |

`report_progress` requires `workspace, person, client, session_id, status, summary`. Everything else is optional. Missing arrays are fine (`decisions` is usually absent) and blank items are skipped. A decision's `area` (`technical` or `product`) is stored in `report_items.decision_area`; an unknown area is rejected. Items arrive as the contract's per-kind arrays (`decisions`, `dead_ends`, `human_corrections`, `blockers`) or as `items: [{kind, text, reason}]`. Unknown keys are ignored and kept in `reports.raw_json`. An unknown `status` or item `kind` is rejected.

## Tables

| Table | Purpose |
|---|---|
| `people`, `sessions` | One row each, updated. `sessions` is unique on `(workspace, client, session_id)`. A different person cannot reuse a session id |
| `reports`, `report_items` | Append-only history. Items are decisions, dead ends, human corrections and blockers |
| `session_artifacts`, `session_modules`, `session_tags` | Retrieval keys per session |
| `search_documents` | One row per report, item and knowledge entry, with a generated `tsvector`. Filled by triggers, so nothing is unsearchable |
| `warnings` | Collision and rediscovery warnings returned by `report_progress` |
| `tickets`, `knowledge_entries` | Tickets and exit-interview answers |
| `item_kinds`, `decision_areas`, `session_statuses`, `person_statuses`, `knowledge_sources`, `warning_kinds` | Value sets, mirrored from `@mesh/contract` |

`visibility` stays a fixed `CHECK` (`shared` or `private`) because it protects privacy. `client` is unconstrained so a new tool never blocks reporting.

## Rules the database enforces

- Child rows carry a composite foreign key to their session, so they cannot hold a different workspace or visibility.
- Changing a session's visibility cascades to its reports, items and search rows. A turn ping with `private` hides an existing session at once.
- Every read filters by workspace and `visibility = 'shared'`, including the warning check.
- Search text is turned into stemmed terms before it reaches the query, so `-`, `"` or `:` cannot break syntax.
- Repeat warnings for the same session are suppressed for an hour.

Not enforced here: redaction. The server must redact before calling any function, because `raw_json` stores the payload as received.

## Changing things

| Change | What to do |
|---|---|
| New value in a contract enum | Add it to `@mesh/contract`, then `insert` it into the matching table (`item_kinds` also needs `payload_key`, `label`, `rediscovery_relevant`). No function change. `pnpm test` fails if the two drift |
| New field the hook sends | Nothing breaks, it lands in `raw_json`. To use it, add a migration |
| New column or table | New file in `supabase/migrations/`, additive only. Never edit an applied migration |
| Breaking function shape | Add `report_progress_v2` beside the old one, move the server, then drop the old one and bump `mesh_api_version()` |
| Different search engine | Rewrite `search_knowledge()` and the `search_documents` indexes. The signature stays |

The server should assert `mesh_api_version()` at startup.

## Tests

`pnpm --filter @mesh/server test` runs every migration on an in-memory Postgres (`@electric-sql/pglite`). It checks the rules above, feeds the contract's exact payload shapes to the functions, and fails if a contract enum and its table differ.
