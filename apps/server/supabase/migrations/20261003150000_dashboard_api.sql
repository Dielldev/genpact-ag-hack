create table exit_questions (
  id                  bigint      generated always as identity primary key,
  workspace           text        not null,
  person              text        not null,
  module              text,
  question            text        not null check (btrim(question) <> ''),
  rationale           text,
  source_event_ids    jsonb       not null default '[]' check (jsonb_typeof(source_event_ids) = 'array'),
  knowledge_entry_id  bigint      references knowledge_entries (id),
  created_at          timestamptz not null default now(),
  foreign key (workspace, person) references people (workspace, name) on update cascade
);
create index exit_questions_person_idx on exit_questions (workspace, person);

create function session_status_since(p_session_pk bigint, p_status text) returns timestamptz
  language sql stable
  set search_path = public, pg_temp
  as $$
  select min(r.ts) from reports r
  where r.session_pk = p_session_pk
    and r.ts > coalesce((select max(r2.ts) from reports r2
                         where r2.session_pk = p_session_pk and r2.status is distinct from p_status),
                        '-infinity'::timestamptz)
$$;

create function session_json(p_session_pk bigint) returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select jsonb_build_object(
    'event_id',       (select r.id from reports r where r.session_pk = s.id order by r.ts desc limit 1),
    'session_pk',     s.id,
    'client',         s.client,
    'session_id',     s.session_id,
    'person',         s.person,
    'workspace',      s.workspace,
    'project',        s.project,
    'visibility',     s.visibility,
    'ticket_ref',     s.ticket_ref,
    'task',           s.task,
    'status',         s.status,
    'status_since',   case when s.status is null then s.first_seen_at else session_status_since(s.id, s.status) end,
    'summary',        s.summary,
    'modules',        coalesce((select jsonb_agg(m.module order by m.module) from session_modules m where m.session_pk = s.id), '[]'),
    'tags',           coalesce((select jsonb_agg(t.tag order by t.tag) from session_tags t where t.session_pk = s.id), '[]'),
    'artifacts',      coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('kind', a.kind, 'ref', a.ref, 'label', a.label))
                                         order by a.first_seen_at, a.ref)
                                from session_artifacts a where a.session_pk = s.id), '[]'),
    'items',          coalesce((select jsonb_agg(jsonb_build_object('kind', ri.kind, 'text', ri.text, 'reason', ri.reason,
                                                                    'ts', ri.ts, 'event_id', ri.report_id) order by ri.ts, ri.id)
                                from report_items ri where ri.session_pk = s.id and ri.visibility = 'shared'), '[]'),
    'blockers',       coalesce((select r.raw_json->'blockers' from reports r where r.session_pk = s.id order by r.ts desc limit 1), '[]'),
    'event_ids',      coalesce((select jsonb_agg(r.id order by r.ts) from reports r where r.session_pk = s.id), '[]'),
    'first_seen_at',  s.first_seen_at,
    'last_seen_at',   s.last_seen_at,
    'last_report_at', s.last_report_at,
    'report_count',   s.report_count)
  from sessions s where s.id = p_session_pk
$$;

create function session_records(p_workspace text, p_filter jsonb default '{}') returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select coalesce(jsonb_agg(session_json(x.id) order by x.last_seen_at desc), '[]')
  from (
    select s.id, s.last_seen_at from sessions s
    where s.workspace = p_workspace
      and s.visibility = 'shared'
      and (p_filter->>'person' is null or s.person = p_filter->>'person')
      and (p_filter->>'status' is null
           or (p_filter->>'status' = 'active' and s.report_count = 0)
           or s.status = p_filter->>'status')
      and (p_filter->>'module' is null
           or exists (select 1 from session_modules m where m.session_pk = s.id and m.module = p_filter->>'module'))
      and (p_filter->>'since' is null or s.last_seen_at > (p_filter->>'since')::timestamptz)
      and (p_filter->>'ticket_ref' is null or lower(s.ticket_ref) = lower(p_filter->>'ticket_ref'))
      and (coalesce((p_filter->>'reported')::boolean, false) = false or s.report_count > 0)
      and (p_filter->'session_pks' is null
           or s.id in (select (v #>> '{}')::bigint from jsonb_array_elements(p_filter->'session_pks') v))
      and (p_filter->'event_ids' is null
           or s.id in (select r.session_pk from reports r
                       where r.id in (select v #>> '{}' from jsonb_array_elements(p_filter->'event_ids') v)))
    order by s.last_seen_at desc
    limit least(greatest(coalesce((p_filter->>'limit')::int, 150), 1), 500)
  ) x
$$;

create function list_warnings(p_workspace text, p_filter jsonb default '{}') returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select coalesce(jsonb_agg(c.card order by c.created_at desc), '[]')
  from (
    select w.created_at,
           jsonb_build_object(
             'warning_id',          w.id::text,
             'kind',                w.kind,
             'message',             w.message,
             'created_at',          w.created_at,
             'reporter_event_id',   w.report_id,
             'source_event_ids',    coalesce((select jsonb_agg(v) from jsonb_array_elements(w.source_event_ids) v
                                              where exists (select 1 from reports r2
                                                            where r2.id = v #>> '{}' and r2.workspace = p_workspace
                                                              and r2.visibility = 'shared')), '[]')) as card
    from warnings w
    join reports r on r.id = w.report_id
    where w.workspace = p_workspace
      and r.workspace = p_workspace
      and r.visibility = 'shared'
      and not w.dismissed
      and (p_filter->>'since' is null or w.created_at > (p_filter->>'since')::timestamptz)
      and (p_filter->>'event_id' is null
           or w.report_id = p_filter->>'event_id'
           or w.source_event_ids ? (p_filter->>'event_id')
           or r.session_pk = (select r3.session_pk from reports r3 where r3.id = p_filter->>'event_id'))
    order by w.created_at desc
    limit least(greatest(coalesce((p_filter->>'limit')::int, 100), 1), 300)
  ) c
  where jsonb_array_length(c.card->'source_event_ids') > 0
$$;

create function list_workspaces() returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select coalesce(jsonb_agg(jsonb_build_object('workspace', x.workspace, 'people', x.people,
                                               'sessions', x.sessions, 'last_activity_at', x.last)
                            order by x.workspace), '[]')
  from (select workspace, count(distinct person) as people, count(*) as sessions, max(last_seen_at) as last
        from sessions where visibility = 'shared' group by workspace) x
$$;

create function workspace_people(p_workspace text) returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'person',           p.name,
           'status',           p.status,
           'role',             p.role,
           'sessions',         st.sessions,
           'open_sessions',    st.open_sessions,
           'last_activity_at', st.last_seen,
           'modules',          coalesce((select jsonb_agg(mm.module order by mm.n desc, mm.module)
                                         from (select m.module, count(*) as n
                                               from session_modules m join sessions s2 on s2.id = m.session_pk
                                               where s2.workspace = p_workspace and s2.visibility = 'shared'
                                                 and s2.person = p.name
                                               group by m.module) mm), '[]'))
         order by p.name), '[]')
  from people p
  cross join lateral (
    select count(*) filter (where s.report_count > 0) as sessions,
           count(*) filter (where s.status in ('in_progress', 'blocked')) as open_sessions,
           max(s.last_seen_at) as last_seen
    from sessions s
    where s.workspace = p_workspace and s.visibility = 'shared' and s.person = p.name
  ) st
  where p.workspace = p_workspace
    and (st.last_seen is not null
         or exists (select 1 from knowledge_entries k where k.workspace = p_workspace and k.person = p.name))
$$;

create function set_person_status(p jsonb) returns jsonb
  language plpgsql
  set search_path = public, pg_temp
  as $$
begin
  if coalesce(btrim(p->>'workspace'), '') = '' or coalesce(btrim(p->>'person'), '') = '' then
    raise exception 'workspace and person are required' using errcode = '22023';
  end if;
  perform ensure_person(btrim(p->>'workspace'), btrim(p->>'person'));
  update people set status = p->>'status' where workspace = btrim(p->>'workspace') and name = btrim(p->>'person');
  return jsonb_build_object('person', btrim(p->>'person'), 'status', p->>'status');
end $$;

create function ticket_json(t tickets) returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select jsonb_build_object('ticket_id', t.id::text, 'workspace', t.workspace, 'ref', t.ref, 'title', t.title,
                            'description', t.description, 'status', t.status, 'assignee', t.assignee,
                            'created_by', t.created_by, 'created_at', t.created_at)
$$;

create function create_ticket(p jsonb) returns jsonb
  language plpgsql
  set search_path = public, pg_temp
  as $$
declare
  v_ws  text := btrim(p->>'workspace');
  v_ref text := nullif(upper(regexp_replace(btrim(coalesce(p->>'ref', '')), '\s+', '-', 'g')), '');
  v_row tickets;
begin
  if coalesce(v_ws, '') = '' or coalesce(btrim(p->>'title'), '') = '' or coalesce(btrim(p->>'created_by'), '') = '' then
    raise exception 'workspace, title and created_by are required' using errcode = '22023';
  end if;
  if v_ref is null then
    v_ref := 'TKT-' || ((select count(*) from tickets t where t.workspace = v_ws) + 1);
  end if;
  insert into tickets (workspace, ref, title, description, assignee, created_by)
  values (v_ws, v_ref, btrim(p->>'title'), nullif(btrim(coalesce(p->>'description', '')), ''),
          nullif(btrim(coalesce(p->>'assignee', '')), ''), btrim(p->>'created_by'))
  on conflict (workspace, ref) do update set title = tickets.title
  returning * into v_row;
  return ticket_json(v_row);
end $$;

create function list_tickets(p_workspace text, p_filter jsonb default '{}') returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select coalesce(jsonb_agg(ticket_json(t) order by t.created_at desc), '[]')
  from tickets t
  where t.workspace = p_workspace
    and (coalesce((p_filter->>'include_closed')::boolean, false) or t.status = 'open')
    and (p_filter->>'ref' is null or lower(t.ref) = lower(p_filter->>'ref'))
    and (p_filter->>'person' is null
         or t.assignee = p_filter->>'person'
         or t.created_by = p_filter->>'person'
         or exists (select 1 from sessions s
                    where s.workspace = p_workspace and s.visibility = 'shared'
                      and s.person = p_filter->>'person' and lower(s.ticket_ref) = lower(t.ref)))
$$;

create function knowledge_json(k knowledge_entries) returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select jsonb_build_object('entry_id', k.id::text, 'workspace', k.workspace, 'person', k.person, 'module', k.module,
                            'question', k.question, 'answer', k.answer, 'source', k.source,
                            'source_event_ids', k.source_event_ids, 'created_at', k.created_at)
$$;

create function list_knowledge(p_workspace text, p_filter jsonb default '{}') returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select coalesce(jsonb_agg(knowledge_json(k) order by k.created_at), '[]')
  from knowledge_entries k
  where k.workspace = p_workspace
    and (p_filter->>'person' is null or k.person = p_filter->>'person')
    and (p_filter->'modules' is null
         or k.module in (select v #>> '{}' from jsonb_array_elements(p_filter->'modules') v))
    and (p_filter->'ids' is null
         or k.id::text in (select v #>> '{}' from jsonb_array_elements(p_filter->'ids') v))
$$;

create function list_exit_questions(p_workspace text, p_person text) returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select jsonb_build_object(
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
                             'question_id', q.id::text, 'person', q.person, 'module', q.module,
                             'question', q.question, 'rationale', q.rationale,
                             'source_event_ids', q.source_event_ids, 'created_at', q.created_at,
                             'answer', case when k.id is null then null else knowledge_json(k) end) order by q.id)
                           from exit_questions q left join knowledge_entries k on k.id = q.knowledge_entry_id
                           where q.workspace = p_workspace and q.person = p_person), '[]'),
    'entries',   list_knowledge(p_workspace, jsonb_build_object('person', p_person)))
$$;

create function replace_exit_questions(p jsonb) returns jsonb
  language plpgsql
  set search_path = public, pg_temp
  as $$
begin
  perform ensure_person(btrim(p->>'workspace'), btrim(p->>'person'));
  delete from exit_questions
  where workspace = btrim(p->>'workspace') and person = btrim(p->>'person') and knowledge_entry_id is null;
  insert into exit_questions (workspace, person, module, question, rationale, source_event_ids)
  select btrim(p->>'workspace'), btrim(p->>'person'), nullif(btrim(coalesce(q->>'module', '')), ''),
         btrim(q->>'question'), q->>'rationale', coalesce(q->'source_event_ids', '[]')
  from jsonb_array_elements(coalesce(p->'questions', '[]')) q
  where coalesce(btrim(q->>'question'), '') <> '';
  return list_exit_questions(btrim(p->>'workspace'), btrim(p->>'person'));
end $$;

create function answer_exit_question(p jsonb) returns jsonb
  language plpgsql
  set search_path = public, pg_temp
  as $$
declare
  v_q   exit_questions;
  v_kid bigint;
  v_k   knowledge_entries;
begin
  select * into v_q from exit_questions
  where id = (p->>'question_id')::bigint and workspace = btrim(p->>'workspace') and person = btrim(p->>'person')
  for update;
  if v_q.id is null then
    raise exception 'unknown exit question %', p->>'question_id' using errcode = '22023';
  end if;
  v_kid := record_knowledge(jsonb_build_object('workspace', v_q.workspace, 'person', v_q.person, 'module', v_q.module,
                                               'question', v_q.question, 'answer', p->>'answer',
                                               'source_event_ids', v_q.source_event_ids));
  update exit_questions set knowledge_entry_id = v_kid where id = v_q.id;
  select * into v_k from knowledge_entries where id = v_kid;
  return knowledge_json(v_k);
end $$;

create or replace function workspace_vocabulary(p_workspace text) returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select jsonb_build_object(
    'people',  coalesce((select jsonb_agg(x.person order by x.person) from (
                           select distinct s.person from sessions s
                           join people p on p.workspace = s.workspace and p.name = s.person
                           where s.workspace = p_workspace and s.visibility = 'shared' and p.status <> 'left') x), '[]'),
    'modules', coalesce((select jsonb_agg(x.module order by x.module) from (
                           select distinct m.module from session_modules m
                           join sessions s on s.id = m.session_pk
                           where s.workspace = p_workspace and s.visibility = 'shared') x), '[]'),
    'tags',    coalesce((select jsonb_agg(x.tag order by x.tag) from (
                           select distinct t.tag from session_tags t
                           join sessions s on s.id = t.session_pk
                           where s.workspace = p_workspace and s.visibility = 'shared') x), '[]')
  )
$$;

alter table exit_questions enable row level security;

do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all functions in schema public from %I', r);
    end if;
  end loop;
end $$;

revoke execute on all functions in schema public from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on all functions in schema public to service_role;
  end if;
end $$;
