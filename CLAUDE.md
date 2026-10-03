# Mesh

A layer that turns AI-agent work into live, queryable team knowledge. See [README.md](README.md) for the layout.

## Ownership

Edit only the folder your track owns. Anything else goes through its owner or a small PR.

- `packages/contract`: shared types, enums, routes. Changes only by a small PR announced to the team
- `packages/cli`: hook runtime and `mesh` installer
- `apps/server`: REST API, MCP server, database, intelligence
- `apps/web`: PM web app

## Rules

- `@mesh/contract` is the single source of truth. Import types, enums and routes from it, never redefine them
- Use enum cases from the contract (`ReportStatus.done`), never the raw string
- Parameterized queries only. Validate input at every trust boundary
- No comments in code
- Keep source files between 100 and 300 lines, one module per file
- Never commit to `main` directly. Short-lived branches, small PRs

## Before pushing

```bash
pnpm install
pnpm typecheck
pnpm test
```
