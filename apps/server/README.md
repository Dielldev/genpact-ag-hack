# @mesh/server

One process that serves the REST API, the remote MCP server (Streamable HTTP at `/mcp`) and the intelligence layer, backed by Supabase Postgres.

One Node process (Hono + MCP TypeScript SDK) over the Supabase functions. What it implements:

- [Server contract](../../docs/server-contract.md): REST endpoints, the `report_progress` MCP tool, expected behaviour
- [Database](../../docs/database.md): Postgres schema, the RPC functions the server calls, and how to change them

The database layer is in `supabase/migrations/`. Run `pnpm --filter @mesh/server test` to check it.

Import every shared type and enum from `@mesh/contract`. Do not redefine them here.

When adding `build`, `dev`, `typecheck` and `test` scripts to this package, the root `pnpm build`, `pnpm dev`, `pnpm typecheck` and `pnpm test` pick them up automatically.

## Run

```bash
cp .env.example .env   # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
pnpm --filter @mesh/server start
```

Without Supabase credentials the server uses an in-memory Postgres (PGlite) with the same migrations; set `PGLITE_DIR` to keep data. `pnpm --filter @mesh/server seed` loads demo data, `pnpm --filter @mesh/server smoke` runs the demo path end to end.

| Env | Default | |
|---|---|---|
| `PORT`, `HOST` | `8787`, `0.0.0.0` | |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | | Live database |
| `PGLITE_DIR` | in memory | Local database when Supabase is not set |
| `ANTHROPIC_API_KEY` | | Optional: summarized answers in Ask and tailored exit questions. Without it Ask lists matching records and exit questions come from each person's own records |
| `ANSWER_MODEL`, `WARN_MODEL` | `claude-sonnet-5-5`, `claude-haiku-4-5-20251001` | Answer and planner models |
| `COLLISION_WINDOW_HOURS` | `48` | |
| `REPORT_DEBOUNCE_SECONDS` | `10` | |
| `ALLOWED_HOSTS` | | Hostnames allowed on `/mcp` besides localhost; empty allows all (tunnels) |
