create table decision_areas (area text primary key);
insert into decision_areas values ('technical'), ('product');
alter table decision_areas enable row level security;

do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on decision_areas from %I', r);
    end if;
  end loop;
end $$;

alter table report_items
  add column decision_area text references decision_areas (area),
  add constraint report_items_area_only_for_decisions check (decision_area is null or kind = 'decision');

create or replace function report_progress(
  p                    jsonb,
  p_collision_window   interval default interval '30 minutes',
  p_min_shared_terms   int      default 3
) returns jsonb
  language plpgsql
  set search_path = public, pg_temp
  as $$
declare
  v_now        timestamptz := now();
  v_ws         text := btrim(p->>'workspace');
  v_person     text := btrim(p->>'person');
  v_sid        bigint;
  v_vis        text;
  v_event      text;
  v_warnings   jsonb := '[]';
  v_row        record;
  v_item       record;
  v_msg        text;
  v_ids        jsonb;
  v_wid        bigint;
  v_lexemes    text[];
  v_min_shared int;
begin
  if coalesce(v_ws, '') = '' or coalesce(v_person, '') = ''
     or coalesce(btrim(p->>'client'), '') = '' or coalesce(btrim(p->>'session_id'), '') = ''
     or coalesce(btrim(p->>'summary'), '') = '' or coalesce(p->>'status', '') = '' then
    raise exception 'workspace, person, client, session_id, status and summary are required' using errcode = '22023';
  end if;

  perform ensure_person(v_ws, v_person);

  insert into sessions (client, session_id, person, workspace, project, visibility, ticket_ref,
                        task, status, summary, first_seen_at, last_seen_at, last_report_at, report_count)
  values (p->>'client', p->>'session_id', v_person, v_ws, p->>'project',
          coalesce(p->>'visibility', 'shared'), p->>'ticket_ref',
          p->>'task', p->>'status', p->>'summary', v_now, v_now, v_now, 1)
  on conflict (workspace, client, session_id) do update
    set project        = coalesce(excluded.project, sessions.project),
        visibility     = coalesce(p->>'visibility', sessions.visibility),
        ticket_ref     = coalesce(excluded.ticket_ref, sessions.ticket_ref),
        task           = coalesce(excluded.task, sessions.task),
        status         = excluded.status,
        summary        = excluded.summary,
        last_seen_at   = greatest(sessions.last_seen_at, v_now),
        last_report_at = v_now,
        report_count   = sessions.report_count + 1
    where sessions.person = excluded.person
  returning id, visibility into v_sid, v_vis;

  if v_sid is null then
    raise exception 'session % already belongs to another person', p->>'session_id' using errcode = '42501';
  end if;

  insert into session_modules (session_pk, module)
  select distinct v_sid, btrim(m) from jsonb_array_elements_text(coalesce(p->'modules', '[]')) m
  where btrim(m) <> '' on conflict do nothing;

  insert into session_tags (session_pk, tag)
  select distinct v_sid, btrim(t) from jsonb_array_elements_text(coalesce(p->'tags', '[]')) t
  where btrim(t) <> '' on conflict do nothing;

  insert into session_artifacts (session_pk, kind, ref, label, first_seen_at, last_seen_at)
  select v_sid, a.kind, a.ref, max(a.label), v_now, v_now
  from (
    select case when jsonb_typeof(e) = 'string' then 'file' else coalesce(e->>'kind', e->>'type', 'file') end as kind,
           case when jsonb_typeof(e) = 'string' then e #>> '{}' else coalesce(e->>'ref', e->>'path', e->>'id') end as ref,
           case when jsonb_typeof(e) = 'object' then coalesce(e->>'label', e->>'name', e->>'title') end as label
    from jsonb_array_elements(case when jsonb_typeof(p->'artifacts') = 'array' then p->'artifacts' else '[]' end) e
  ) a
  where coalesce(btrim(a.kind), '') <> '' and coalesce(btrim(a.ref), '') <> ''
  group by a.kind, a.ref
  on conflict (session_pk, kind, ref) do update
    set last_seen_at = v_now, label = coalesce(excluded.label, session_artifacts.label);

  insert into reports (session_pk, workspace, visibility, ts, task, status, summary, raw_json)
  values (v_sid, v_ws, v_vis, v_now, p->>'task', p->>'status', p->>'summary', p)
  returning id into v_event;

  insert into report_items (report_id, session_pk, workspace, visibility, kind, text, reason, decision_area, ts)
  select v_event, v_sid, v_ws, v_vis, n.kind, btrim(n.txt), nullif(btrim(n.reason), ''),
         case when n.kind = 'decision' then nullif(btrim(n.area), '') end, v_now
  from (
    select coalesce(case when jsonb_typeof(e.elem) = 'object' then e.elem->>'kind' end, e.kind_hint) as kind,
           case when jsonb_typeof(e.elem) = 'string' then e.elem #>> '{}'
                else coalesce(e.elem->>'text', e.elem->>'choice', e.elem->>'attempt',
                              e.elem->>'correction', e.elem->>'blocker', e.elem->>'description') end as txt,
           case when jsonb_typeof(e.elem) = 'object' then e.elem->>'reason' end as reason,
           case when jsonb_typeof(e.elem) = 'object' then e.elem->>'area' end as area,
           e.ord
    from (
      select x.elem, null::text as kind_hint, 0 as ord
      from jsonb_array_elements(case when jsonb_typeof(p->'items') = 'array' then p->'items' else '[]' end) as x(elem)
      union all
      select x.elem, k.kind, 1
      from item_kinds k
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(p->k.payload_key) = 'array' then p->k.payload_key else '[]' end) as x(elem)
    ) e
  ) n
  where coalesce(btrim(n.txt), '') <> '';

  for v_row in
    select s.id, s.person, s.task,
           (select r.id from reports r where r.session_pk = s.id order by r.ts desc limit 1) as last_event,
           array(select m.module from session_modules m
                 join session_modules mine on mine.module = m.module and mine.session_pk = v_sid
                 where m.session_pk = s.id order by m.module) as modules,
           array(select a.ref from session_artifacts a
                 join session_artifacts mine on mine.kind = a.kind and mine.ref = a.ref and mine.session_pk = v_sid
                 where a.session_pk = s.id order by a.ref) as artifacts
    from sessions s
    where s.workspace = v_ws
      and s.visibility = 'shared'
      and s.person <> v_person
      and coalesce(s.status, 'in_progress') <> 'done'
      and s.last_seen_at > v_now - p_collision_window
  loop
    continue when cardinality(v_row.modules) = 0 and cardinality(v_row.artifacts) = 0;

    v_msg := format('%s is working on the same area (%s)%s',
                    v_row.person,
                    array_to_string(v_row.modules || v_row.artifacts, ', '),
                    case when v_row.task is null then '' else ': ' || v_row.task end);
    v_ids := case when v_row.last_event is null then '[]'::jsonb else jsonb_build_array(v_row.last_event) end;

    continue when exists (
      select 1 from warnings w join reports r on r.id = w.report_id
      where r.session_pk = v_sid and w.kind = 'collision' and w.message = v_msg
        and w.created_at > v_now - interval '1 hour');

    insert into warnings (report_id, workspace, kind, message, source_event_ids, created_at)
    values (v_event, v_ws, 'collision', v_msg, v_ids, v_now) returning id into v_wid;
    v_warnings := v_warnings || jsonb_build_object('id', v_wid, 'kind', 'collision', 'message', v_msg, 'source_event_ids', v_ids);
  end loop;

  for v_item in
    select ri.id, ri.kind, ri.text, ri.reason
    from report_items ri
    where ri.report_id = v_event
      and ri.kind in (select k.kind from item_kinds k where k.rediscovery_relevant)
  loop
    v_lexemes := tsvector_to_array(to_tsvector('english', concat_ws(' - ', v_item.text, v_item.reason)));
    v_min_shared := least(p_min_shared_terms, coalesce(cardinality(v_lexemes), 0));
    continue when v_min_shared < 2;

    for v_row in
      select d.doc_id, k.label, d.person, d.ts, d.body, ri2.report_id
      from search_documents d
      join item_kinds k on k.kind = d.item_kind and k.rediscovery_relevant
      join report_items ri2 on ri2.id = d.doc_id::bigint
      where d.doc_type = 'item'
        and d.workspace = v_ws
        and d.visibility = 'shared'
        and d.person <> v_person
        and d.tsv @@ fts_or_query(concat_ws(' - ', v_item.text, v_item.reason))
        and (select count(*) from unnest(tsvector_to_array(d.tsv)) as l where l = any (v_lexemes)) >= v_min_shared
      order by ts_rank_cd(d.tsv, fts_or_query(concat_ws(' - ', v_item.text, v_item.reason))) desc, d.ts desc
      limit 2
    loop
      v_msg := format('%s already recorded a %s on %s: %s',
                      v_row.person,
                      v_row.label,
                      to_char(v_row.ts, 'YYYY-MM-DD'),
                      left(v_row.body, 300));
      v_ids := jsonb_build_array(v_row.report_id);

      continue when exists (
        select 1 from warnings w join reports r on r.id = w.report_id
        where r.session_pk = v_sid and w.kind = 'rediscovery' and w.message = v_msg
          and w.created_at > v_now - interval '1 hour');

      insert into warnings (report_id, workspace, kind, message, source_event_ids, created_at)
      values (v_event, v_ws, 'rediscovery', v_msg, v_ids, v_now) returning id into v_wid;
      v_warnings := v_warnings || jsonb_build_object('id', v_wid, 'kind', 'rediscovery', 'message', v_msg, 'source_event_ids', v_ids);
    end loop;
  end loop;

  return jsonb_build_object('event_id', v_event, 'session_pk', v_sid, 'warnings', v_warnings);
end $$;
