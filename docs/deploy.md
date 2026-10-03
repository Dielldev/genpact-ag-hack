# Deploy

One Vercel project serves everything: the web app, the REST API (`/api/v1/*`), the MCP endpoint (`/mcp`) and the hook installer (`/install.sh`, `/install.ps1`, `/install/*`). The database stays on Supabase. Teammates never need the repo.

```
teammate's Claude Code --hook + MCP--> https://YOUR-SITE/api/v1/turns, /mcp --> Supabase
PM in the browser      ---------------> https://YOUR-SITE/                    --> /api/v1/*
```

## 1. Supabase (once)

1. Open the Supabase dashboard, pick the project, then **SQL Editor** and **New query**.
2. Run this check and read the three columns:

```sql
select
  to_regclass('public.decision_areas') is not null as decision_areas,
  to_regprocedure('public.session_records(text,jsonb)') is not null as dashboard_api,
  to_regclass('public.projects') is not null as projects;
```

3. For every column that says `false`, run the matching file once, in this order. Copy a file to the clipboard with `pbcopy < "<path>"`, paste it into the editor and press **Run**.

| Column is false | Run this file (`apps/server/supabase/migrations/`) |
|---|---|
| `decision_areas` | `20261003130354_decision_area.sql` |
| `dashboard_api` | `20261003150000_dashboard_api.sql` |
| `projects` | `20261004100000_projects.sql` |

Each file creates things with plain `create`, so run each one only once. If you get "already exists", that file was already applied.

4. Run the check again. All three columns must say `true`.
5. Copy two values for Vercel from **Project Settings → API**: the **Project URL** (`SUPABASE_URL`) and the **service_role** key (`SUPABASE_SERVICE_ROLE_KEY`). The service_role key bypasses row-level security. It only ever goes into Vercel's environment settings, never into the browser, the repo or chat.

Leave row-level security as it is: it is on with no policies on purpose, so only the server can reach the tables.

## 2. Team keys

Everyone gets one personal key. The server derives the person's name from the key, so nobody can report as someone else.

```bash
pnpm --filter @mesh/server keys "Ana Lee" "Bo Chen" "Sam Ortiz" "Noor Haddad" "Jules Moreau"
```

It prints a `MESH_MEMBERS=...` line (put that into Vercel) and a table of name and key (send each person their own key). Names must not contain `,` or `:`. To rename someone later, change the name in `MESH_MEMBERS` and keep the key.

## 3. Vercel

1. **Add New → Project**, import the GitHub repo.
2. Root Directory `./`. If the page offers the **Services** preset, choose **Other**. The build command and output come from `vercel.json`.
3. Under **Settings → General**, set Node.js Version to `22.x`.
4. Environment Variables (Production):

| Name | Value |
|---|---|
| `SUPABASE_URL` | from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase |
| `MESH_MEMBERS` | the line from step 2, without the `MESH_MEMBERS=` prefix |
| `MESH_WORKSPACE` | `genpact` |
| `ANTHROPIC_API_KEY` | optional, for written answers in Ask |

5. Deploy, then open `https://YOUR-SITE/api/v1/health`. It should show `{"ok":true,...}`.

The build runs `scripts/build-vercel.mjs`, which builds the web app and the hook, bundles the server into one function and copies the installer files next to the site.

## 4. Teammates

1. Open `https://YOUR-SITE/`, paste your key.
2. Profile menu, **Install the hook**, copy the command for your system and run it.
3. Restart Claude Code and work as usual. Sessions show up on the dashboard within seconds.

The installer ends by printing a `status` command that shows whether the server accepts the key.

## Things to know

- The function sleeps when idle. The hook gives up after 2.5 seconds and fails open, so the first response after a quiet period may not be recorded.
- Anyone with a key can read everything in the workspace. Keys are not per project.
- `MESH_WORKSPACE` forces every report and every dashboard read into one workspace. Leave it unset to allow several.
- Local development is unchanged: without `MESH_MEMBERS` nothing asks for a key.
