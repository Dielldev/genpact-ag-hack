# Database

Supabase Postgres. Full-text search uses Postgres's built-in `tsvector` with GIN indexes, so no extension is needed for search. `pg_trgm` is optional for fuzzy name matching, and `pgvector` is available later if keyword search is not enough.

## Core rule

A session is **one row that is updated**, while decisions, dead ends, corrections and blockers are **rows that are only ever added**. Each `report_progress` call describes one turn. Overwriting `dead_ends` on upsert would erase earlier ones, and the exit interview and rediscovery warnings both need the full dated history.

## Schema

The enum types mirror `@mesh/contract`. Add a value to the contract first, then `ALTER TYPE ... ADD VALUE`.

```sql
create type client as enum ('claude-code', 'codex', 'cursor', 'gemini');
create type report_status as enum ('in_progress', 'blocked', 'done');
create type visibility as enum ('shared', 'private');
create type item_kind as enum ('decision', 'dead_end', 'human_correction', 'blocker');
create type warning_kind as enum ('collision', 'rediscovery');
create type person_status as enum ('active', 'leaving', 'left');
create type knowledge_source as enum ('exit_interview');

create table people (
  id uuid primary key default gen_random_uuid(),
  workspace text not null,
  name text not null,
  role text,
  status person_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (workspace, name)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  client client not null,
  session_id text not null,
  person text not null,
  workspace text not null,
  project text,
  visibility visibility not null default 'shared',
  ticket_ref text,
  task text,
  status report_status,
  summary text,
  modules text[] not null default '{}',
  tags text[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_report_at timestamptz,
  report_count integer not null default 0,
  unique (client, session_id)
);
create index sessions_feed_idx on sessions (workspace, last_seen_at desc);
create index sessions_person_idx on sessions (workspace, person, last_seen_at desc);
create index sessions_modules_idx on sessions using gin (modules);
create index sessions_tags_idx on sessions using gin (tags);

create table reports (
  id uuid primary key default gen_random_uuid(),
  session_pk uuid not null references sessions(id) on delete cascade,
  workspace text not null,
  visibility visibility not null,
  ts timestamptz not null default now(),
  task text,
  status report_status not null,
  summary text not null,
  raw jsonb not null,
  search tsvector generated always as (
    to_tsvector('english', coalesce(task, '') || ' ' || summary)
  ) stored
);
create index reports_session_idx on reports (session_pk, ts);
create index reports_search_idx on reports using gin (search);

create table report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  session_pk uuid not null references sessions(id) on delete cascade,
  workspace text not null,
  visibility visibility not null,
  person text not null,
  kind item_kind not null,
  text text not null,
  reason text,
  ts timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('english', text || ' ' || coalesce(reason, ''))
  ) stored
);
create index report_items_kind_idx on report_items (workspace, kind, ts desc);
create index report_items_search_idx on report_items using gin (search);

create table session_artifacts (
  session_pk uuid not null references sessions(id) on delete cascade,
  kind text not null,
  ref text not null,
  label text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (session_pk, kind, ref)
);
create index session_artifacts_ref_idx on session_artifacts (ref);

create table warnings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  workspace text not null,
  kind warning_kind not null,
  message text not null,
  source_event_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  dismissed boolean not null default false
);
create index warnings_feed_idx on warnings (workspace, created_at desc) where not dismissed;

create table tickets (
  id uuid primary key default gen_random_uuid(),
  workspace text not null,
  ref text not null,
  title text not null,
  description text,
  status text not null default 'open',
  assignee text,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (workspace, ref)
);

create table knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  workspace text not null,
  person text not null,
  module text,
  question text not null,
  answer text not null,
  source knowledge_source not null,
  source_event_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('english', question || ' ' || answer)
  ) stored
);
create index knowledge_search_idx on knowledge_entries using gin (search);
create index knowledge_module_idx on knowledge_entries (workspace, module);

alter table people enable row level security;
alter table sessions enable row level security;
alter table reports enable row level security;
alter table report_items enable row level security;
alter table session_artifacts enable row level security;
alter table warnings enable row level security;
alter table tickets enable row level security;
alter table knowledge_entries enable row level security;
```

Row level security is on with no policies, so only the server (service role or direct connection) can read or write. The web app goes through the server and never holds a Supabase key.

## Writes

- `POST /api/v1/turns`: upsert `sessions` with `insert ... on conflict (client, session_id) do update set last_seen_at = now()`. No report rows
- `report_progress`, in one transaction:
  1. Upsert `sessions` with the latest task, status, summary, the union of modules and tags, and increment `report_count`
  2. Insert one `reports` row
  3. Insert one `report_items` row per decision, dead end, correction and blocker
  4. Upsert `session_artifacts`
  5. Run the warning check, insert hits into `warnings`, return them
- Exit-interview answers go into `knowledge_entries`

## Reads

| Need | Query |
|---|---|
| Live feed, "what is X doing" | `sessions` by `workspace` and `person`, ordered by `last_seen_at desc` |
| "Why does Y work this way" | Module or artifact match (`modules && $1`, `session_artifacts.ref`), plus `search @@ websearch_to_tsquery('english', $2)` across reports, items and knowledge, ranked by `ts_rank_cd(search, query) * exp(-age_in_days / 30)`, limit about 8 |
| Collision warning | Other people's `sessions` with `status <> 'done'`, recent `last_seen_at`, and `modules && $1` or a shared artifact ref |
| Rediscovery warning | Full-text match on other people's `report_items` where `kind in ('dead_end', 'decision')` |
| Exit-interview targeting | Modules where the person owns most sessions, joined with a count of their `report_items` per module. Few items means little captured reasoning |
| Onboarding | All reports, items and knowledge entries for a module, oldest first |
| Planner vocabulary | Distinct people, `unnest(modules)` and `unnest(tags)` per workspace |

## Rules

- Filter every read by `workspace`, and every shared read, including the warning check, by `visibility = 'shared'`
- Parameterized queries only. `websearch_to_tsquery` accepts raw user text safely, so never build `to_tsquery` strings by hand
- Redact secrets before writing, including `raw`
