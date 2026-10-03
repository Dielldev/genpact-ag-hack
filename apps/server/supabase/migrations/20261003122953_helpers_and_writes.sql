create function mesh_api_version() returns int
  language sql immutable parallel safe
  as $$ select 1 $$;

create function ensure_person(p_workspace text, p_name text) returns void
  language sql
  set search_path = public, pg_temp
  as $$
  insert into people (workspace, name) values (p_workspace, p_name) on conflict (workspace, name) do nothing
$$;

create function touch_session(p jsonb) returns jsonb
  language plpgsql
  set search_path = public, pg_temp
  as $$
declare
  v_id    bigint;
  v_last  timestamptz;
  v_count integer;
begin
  if coalesce(btrim(p->>'workspace'), '') = '' or coalesce(btrim(p->>'person'), '') = ''
     or coalesce(btrim(p->>'client'), '') = '' or coalesce(btrim(p->>'session_id'), '') = '' then
    raise exception 'workspace, person, client and session_id are required' using errcode = '22023';
  end if;

  perform ensure_person(p->>'workspace', p->>'person');

  insert into sessions (client, session_id, person, workspace, project, visibility, ticket_ref)
  values (p->>'client', p->>'session_id', p->>'person', p->>'workspace', p->>'project',
          coalesce(p->>'visibility', 'shared'), p->>'ticket_ref')
  on conflict (workspace, client, session_id) do update
    set last_seen_at = greatest(sessions.last_seen_at, now()),
        visibility   = coalesce(p->>'visibility', sessions.visibility),
        project      = coalesce(excluded.project, sessions.project)
    where sessions.person = excluded.person
  returning id, last_report_at, report_count into v_id, v_last, v_count;

  if v_id is null then
    raise exception 'session % already belongs to another person', p->>'session_id' using errcode = '42501';
  end if;
  return jsonb_build_object('session_pk', v_id, 'last_report_at', v_last, 'report_count', v_count);
end $$;

create function record_knowledge(p jsonb) returns bigint
  language plpgsql
  set search_path = public, pg_temp
  as $$
declare
  v_id bigint;
begin
  perform ensure_person(btrim(p->>'workspace'), btrim(p->>'person'));
  insert into knowledge_entries (workspace, person, module, question, answer, source, source_event_ids)
  values (btrim(p->>'workspace'), btrim(p->>'person'), nullif(btrim(p->>'module'), ''),
          p->>'question', p->>'answer', coalesce(p->>'source', 'exit_interview'),
          coalesce(p->'source_event_ids', '[]'))
  returning id into v_id;
  return v_id;
end $$;
