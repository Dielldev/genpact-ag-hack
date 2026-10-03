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

### Install the hook on a computer

Needs Node.js 20 or newer. Nothing else.

Windows (PowerShell):

```powershell
irm https://github.com/Dielldev/genpact-ag-hack/releases/latest/download/install.ps1 | iex
```

Or download `install-mesh.cmd` from the [latest release](https://github.com/Dielldev/genpact-ag-hack/releases/latest) and double-click it.

macOS and Linux:

```bash
curl -fsSL https://github.com/Dielldev/genpact-ag-hack/releases/latest/download/install.sh | sh
```

The installer downloads the prebuilt hook, verifies its SHA-256 checksums, and connects every detected agent CLI. To skip the questions, set the values first, for example in PowerShell:

```powershell
$env:MESH_SERVER = "https://mesh.example.com"; $env:MESH_WORKSPACE = "acme"; irm https://github.com/Dielldev/genpact-ag-hack/releases/latest/download/install.ps1 | iex
```

`MESH_CLIENTS=claude-code,cursor` limits which CLIs are connected. See [packages/cli/README.md](packages/cli/README.md) for how the hook works in each client.

### Develop

Requires Node 20+ and pnpm (`corepack enable` sets it up from the `packageManager` field).

```bash
pnpm install
pnpm build
pnpm test
```

Pushing a `v*` tag builds and publishes a release with the hook and the install scripts.

## Scripts

| Command | What it does |
|---|---|
| `pnpm build` | Builds every package that has a build script |
| `pnpm dev` | Runs every package's dev script in parallel |
| `pnpm typecheck` | Builds the contract, then typechecks everything |
| `pnpm test` | Builds, then runs every package's tests |
