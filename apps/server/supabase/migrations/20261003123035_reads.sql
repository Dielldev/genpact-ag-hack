create function search_knowledge(
  p_workspace       text,
  p_query           text,
  p_modules         text[] default '{}',
  p_artifact_refs   text[] default '{}',
  p_limit           int    default 8,
  p_half_life_days  numeric default 30
) returns table (
  doc_type text, doc_id text, person text, session_pk bigint, item_kind text,
  ts timestamptz, body text, modules text[], score double precision
)
  language sql stable
  set search_path = public, pg_temp
  as $$
  with q as (select fts_or_query(p_query) as tsq),
  hits as (
    select d.*,
           ts_rank_cd(d.tsv, q.tsq) as rank,
           (cardinality(p_modules) > 0 and d.modules && p_modules) as module_hit,
           (cardinality(p_artifact_refs) > 0 and d.session_pk is not null and exists (
              select 1 from session_artifacts a
              where a.session_pk = d.session_pk and a.ref = any (p_artifact_refs))) as artifact_hit
    from search_documents d cross join q
    where d.workspace = p_workspace
      and d.visibility = 'shared'
      and (d.tsv @@ q.tsq
           or (cardinality(p_modules) > 0 and d.modules && p_modules)
           or (cardinality(p_artifact_refs) > 0 and d.session_pk is not null and exists (
                select 1 from session_artifacts a
                where a.session_pk = d.session_pk and a.ref = any (p_artifact_refs))))
  )
  select h.doc_type, h.doc_id, h.person, h.session_pk, h.item_kind, h.ts, h.body, h.modules,
         ((h.rank + 0.2 * h.module_hit::int + 0.2 * h.artifact_hit::int)
           * (0.25 + 0.75 * power(0.5, greatest(extract(epoch from (now() - h.ts)) / 86400.0, 0) / p_half_life_days)))::double precision as score
  from hits h
  order by score desc, h.ts desc
  limit least(greatest(p_limit, 1), 50)
$$;

create function exit_interview_targets(p_workspace text, p_person text, p_limit int default 5)
  returns table (
    module text, my_sessions bigint, total_sessions bigint, share numeric,
    captured_items bigint, knowledge_entries bigint, items_per_session numeric
  )
  language sql stable
  set search_path = public, pg_temp
  as $$
  with shared_sessions as (
    select s.id, s.person, m.module
    from sessions s join session_modules m on m.session_pk = s.id
    where s.workspace = p_workspace and s.visibility = 'shared'
  ),
  per_person as (
    select module, person, count(*) as n from shared_sessions group by module, person
  ),
  mine as (
    select pp.module, pp.n as my_sessions,
           sum(pp.n) over (partition by pp.module) as total_sessions,
           max(pp.n) over (partition by pp.module) as top_sessions,
           pp.person
    from per_person pp
  )
  select mi.module,
         mi.my_sessions,
         mi.total_sessions,
         round(mi.my_sessions::numeric / mi.total_sessions, 2) as share,
         coalesce(it.n, 0) as captured_items,
         coalesce(kn.n, 0) as knowledge_entries,
         round((coalesce(it.n, 0) + coalesce(kn.n, 0))::numeric / mi.my_sessions, 2) as items_per_session
  from mine mi
  left join lateral (
    select count(*) as n
    from report_items ri
    join shared_sessions ss on ss.id = ri.session_pk and ss.module = mi.module and ss.person = p_person
    where ri.workspace = p_workspace and ri.visibility = 'shared'
  ) it on true
  left join lateral (
    select count(*) as n from knowledge_entries k
    where k.workspace = p_workspace and k.person = p_person and k.module = mi.module
  ) kn on true
  where mi.person = p_person and mi.my_sessions = mi.top_sessions
  order by items_per_session asc, mi.my_sessions desc, mi.module
  limit greatest(p_limit, 1)
$$;

create function module_history(p_workspace text, p_module text)
  returns table (source text, id text, ts timestamptz, person text, kind text, text text, reason text)
  language sql stable
  set search_path = public, pg_temp
  as $$
  select * from (
    select 'report'::text, r.id, r.ts, s.person, r.status, r.summary, null::text
    from reports r join sessions s on s.id = r.session_pk
    where r.workspace = p_workspace and r.visibility = 'shared'
      and exists (select 1 from session_modules m where m.session_pk = r.session_pk and m.module = p_module)
    union all
    select 'item', ri.id::text, ri.ts, s.person, ri.kind, ri.text, ri.reason
    from report_items ri join sessions s on s.id = ri.session_pk
    where ri.workspace = p_workspace and ri.visibility = 'shared'
      and exists (select 1 from session_modules m where m.session_pk = ri.session_pk and m.module = p_module)
    union all
    select 'knowledge', k.id::text, k.created_at, k.person, k.source, k.answer, k.question
    from knowledge_entries k
    where k.workspace = p_workspace and k.module = p_module
  ) h
  order by 3, 1, 2
$$;

create function workspace_vocabulary(p_workspace text) returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select jsonb_build_object(
    'people',  coalesce((select jsonb_agg(p.name order by p.name) from people p
                         where p.workspace = p_workspace and p.status <> 'left'), '[]'),
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
