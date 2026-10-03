create table item_kinds (
  kind                 text    primary key,
  payload_key          text    not null unique,
  label                text    not null,
  rediscovery_relevant boolean not null default false
);
insert into item_kinds (kind, payload_key, label, rediscovery_relevant) values
  ('decision',         'decisions',         'decision',   true),
  ('dead_end',         'dead_ends',         'dead end',   true),
  ('human_correction', 'human_corrections', 'correction', false),
  ('blocker',          'blockers',          'blocker',    false);

create table person_statuses   (status text primary key);
insert into person_statuses   values ('active'), ('leaving'), ('left');

create table session_statuses  (status text primary key);
insert into session_statuses  values ('in_progress'), ('blocked'), ('done');

create table knowledge_sources (source text primary key);
insert into knowledge_sources values ('exit_interview');

create table warning_kinds     (kind text primary key);
insert into warning_kinds     values ('collision'), ('rediscovery');

create table people (
  id          bigint generated always as identity primary key,
  workspace   text        not null check (btrim(workspace) <> ''),
  name        text        not null check (btrim(name) <> ''),
  role        text,
  status      text        not null default 'active' references person_statuses (status),
  created_at  timestamptz not null default now(),
  unique (workspace, name)
);

create table sessions (
  id              bigint generated always as identity primary key,
  client          text        not null check (btrim(client) <> ''),
  session_id      text        not null check (btrim(session_id) <> ''),
  person          text        not null,
  workspace       text        not null,
  project         text,
  visibility      text        not null default 'shared' check (visibility in ('shared', 'private')),
  ticket_ref      text,
  task            text,
  status          text        references session_statuses (status),
  summary         text,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  last_report_at  timestamptz,
  report_count    integer     not null default 0 check (report_count >= 0),
  unique (workspace, client, session_id),

  unique (id, workspace, visibility),
  foreign key (workspace, person) references people (workspace, name) on update cascade
);
create index sessions_person_idx on sessions (workspace, person, last_seen_at desc);
create index sessions_live_idx   on sessions (workspace, last_seen_at desc)
  where visibility = 'shared' and status is distinct from 'done';

create table reports (
  id          text        primary key default ('evt_' || replace(gen_random_uuid()::text, '-', '')),
  session_pk  bigint      not null,
  workspace   text        not null,
  visibility  text        not null,
  ts          timestamptz not null default now(),
  task        text,
  status      text        not null references session_statuses (status),
  summary     text        not null check (btrim(summary) <> ''),
  raw_json    jsonb       not null,
  unique (id, session_pk),
  foreign key (session_pk, workspace, visibility)
    references sessions (id, workspace, visibility) on update cascade
);
create index reports_session_idx   on reports (session_pk, ts);
create index reports_workspace_idx on reports (workspace, ts desc);

create table report_items (
  id          bigint      generated always as identity primary key,
  report_id   text        not null,
  session_pk  bigint      not null,
  workspace   text        not null,
  visibility  text        not null,
  kind        text        not null references item_kinds (kind),
  text        text        not null check (btrim(text) <> ''),
  reason      text,
  ts          timestamptz not null default now(),
  foreign key (report_id, session_pk) references reports (id, session_pk),
  foreign key (session_pk, workspace, visibility)
    references sessions (id, workspace, visibility) on update cascade
);
create index report_items_kind_idx    on report_items (workspace, kind, ts desc);
create index report_items_session_idx on report_items (session_pk);
create index report_items_report_idx  on report_items (report_id);

create table session_artifacts (
  session_pk     bigint      not null references sessions (id),
  kind           text        not null,
  ref            text        not null,
  label          text,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  primary key (session_pk, kind, ref)
);
create index session_artifacts_ref_idx on session_artifacts (ref, kind);

create table session_modules (
  session_pk  bigint not null references sessions (id),
  module      text   not null check (btrim(module) <> ''),
  primary key (session_pk, module)
);
create index session_modules_module_idx on session_modules (module);

create table session_tags (
  session_pk  bigint not null references sessions (id),
  tag         text   not null check (btrim(tag) <> ''),
  primary key (session_pk, tag)
);
create index session_tags_tag_idx on session_tags (tag);

create table warnings (
  id                bigint      generated always as identity primary key,
  report_id         text        not null references reports (id),
  workspace         text        not null,
  kind              text        not null references warning_kinds (kind),
  message           text        not null,
  source_event_ids  jsonb       not null default '[]' check (jsonb_typeof(source_event_ids) = 'array'),
  created_at        timestamptz not null default now(),
  dismissed         boolean     not null default false
);
create index warnings_report_idx on warnings (report_id);
create index warnings_open_idx   on warnings (workspace, created_at desc) where not dismissed;

create table tickets (
  id           bigint      generated always as identity primary key,
  workspace    text        not null,
  ref          text        not null,
  title        text        not null,
  description  text,
  status       text        not null default 'open',
  assignee     text,
  created_by   text        not null,
  created_at   timestamptz not null default now(),
  unique (workspace, ref)
);
create index tickets_assignee_idx on tickets (workspace, assignee);

create table knowledge_entries (
  id                bigint      generated always as identity primary key,
  workspace         text        not null,
  person            text        not null,
  module            text,
  question          text        not null check (btrim(question) <> ''),
  answer            text        not null check (btrim(answer) <> ''),
  source            text        not null references knowledge_sources (source),
  source_event_ids  jsonb       not null default '[]' check (jsonb_typeof(source_event_ids) = 'array'),
  created_at        timestamptz not null default now(),
  foreign key (workspace, person) references people (workspace, name) on update cascade
);
create index knowledge_module_idx on knowledge_entries (workspace, module, created_at);
create index knowledge_person_idx on knowledge_entries (workspace, person);
