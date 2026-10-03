# @mesh/server

One process that serves the REST API, the remote MCP server (Streamable HTTP at `/mcp`) and the intelligence layer, backed by Supabase Postgres.

Not built yet. What it must implement for the hook and CLI to work:

- [Server contract](../../docs/server-contract.md): REST endpoints, the `report_progress` MCP tool, expected behaviour
- [Database](../../docs/database.md): Postgres schema and the query behind each feature

Import every shared type and enum from `@mesh/contract`. Do not redefine them here.

When adding `build`, `dev`, `typecheck` and `test` scripts to this package, the root `pnpm build`, `pnpm dev`, `pnpm typecheck` and `pnpm test` pick them up automatically.
