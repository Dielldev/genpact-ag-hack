# Mesh

Mesh turns AI-agent work into live, queryable team knowledge. Every time an agent finishes a response it reports what it did, why, what failed and what blocks it. PMs, teammates and other agents can ask questions of that shared record, and the server warns agents about collisions and known dead ends while the work is still in flight.

## Layout

```
apps/
  server/      REST API + remote MCP server + Postgres (Supabase) + intelligence
  web/         PM web app: live feed, ask box, collision cards, exit interview
packages/
  contract/    shared types, enums and routes used by everything else
  cli/         `mesh` installer and the hook that runs after every agent response
docs/
  server-contract.md   what the server must expose for the hook to work
  database.md          Postgres schema and queries
```

## Getting started

Requires Node 20+ and pnpm (`corepack enable` sets it up from the `packageManager` field).

```bash
pnpm install
pnpm build
pnpm test
```

Connect your agent CLIs to a server:

```bash
node packages/cli/dist/cli.mjs init
```

See [packages/cli/README.md](packages/cli/README.md) for how the hook works in each client.

## Scripts

| Command | What it does |
|---|---|
| `pnpm build` | Builds every package that has a build script |
| `pnpm dev` | Runs every package's dev script in parallel |
| `pnpm typecheck` | Builds the contract, then typechecks everything |
| `pnpm test` | Builds, then runs every package's tests |
