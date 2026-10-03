create function immutable_join(parts text[]) returns text
  language sql immutable parallel safe
  set search_path = pg_catalog
  as $$ select array_to_string(parts, ' ') $$;

create table search_documents (
  id          bigint      generated always as identity primary key,
  doc_type    text        not null check (doc_type in ('report', 'item', 'knowledge')),
  doc_id      text        not null,
  workspace   text        not null,
  visibility  text        not null default 'shared' check (visibility in ('shared', 'private')),
  person      text        not null,
  session_pk  bigint,
  item_kind   text        references item_kinds (kind),
  ts          timestamptz not null,
  body        text        not null,
  modules     text[]      not null default '{}',
  tsv         tsvector    generated always as (
                setweight(to_tsvector('english', body), 'A') ||
                setweight(to_tsvector('english', immutable_join(modules)), 'B')
              ) stored,
  unique (doc_type, doc_id),
  check ((doc_type = 'knowledge') = (session_pk is null)),
  check ((doc_type = 'item') = (item_kind is not null)),
  check (doc_type <> 'knowledge' or visibility = 'shared'),
  foreign key (workspace, person) references people (workspace, name) on update cascade,
  foreign key (session_pk, workspace, visibility)
    references sessions (id, workspace, visibility) on update cascade
);
create index search_documents_tsv_idx     on search_documents using gin (tsv);
create index search_documents_modules_idx on search_documents using gin (modules);
create index search_documents_scope_idx   on search_documents (workspace, doc_type, ts desc);
create index search_documents_session_idx on search_documents (session_pk);

create function forbid_mutation() returns trigger
  language plpgsql
  set search_path = public, pg_temp
  as $$
begin
  if tg_op = 'DELETE' then
    raise exception '% is append-only', tg_table_name using errcode = '55000';
  end if;
  if (to_jsonb(new) - tg_argv) is distinct from (to_jsonb(old) - tg_argv) then
    raise exception '% is append-only (only % may change)', tg_table_name, tg_argv using errcode = '55000';
  end if;
  return new;
end $$;

create trigger reports_append_only before update or delete on reports
  for each row execute function forbid_mutation('visibility');
create trigger report_items_append_only before update or delete on report_items
  for each row execute function forbid_mutation('visibility');
create trigger knowledge_append_only before update or delete on knowledge_entries
  for each row execute function forbid_mutation('person');

create function index_report() returns trigger
  language plpgsql
  set search_path = public, pg_temp
  as $$
begin
  insert into search_documents (doc_type, doc_id, workspace, visibility, person, session_pk, ts, body, modules)
  select 'report', new.id, new.workspace, new.visibility, s.person, new.session_pk, new.ts,
         concat_ws('. ', new.task, new.summary),
         coalesce((select array_agg(m.module order by m.module) from session_modules m where m.session_pk = new.session_pk), '{}')
  from sessions s where s.id = new.session_pk;
  return new;
end $$;

create function index_report_item() returns trigger
  language plpgsql
  set search_path = public, pg_temp
  as $$
begin
  insert into search_documents (doc_type, doc_id, workspace, visibility, person, session_pk, item_kind, ts, body, modules)
  select 'item', new.id::text, new.workspace, new.visibility, s.person, new.session_pk, new.kind, new.ts,
         concat_ws(' - ', new.text, new.reason),
         coalesce((select array_agg(m.module order by m.module) from session_modules m where m.session_pk = new.session_pk), '{}')
  from sessions s where s.id = new.session_pk;
  return new;
end $$;

create function index_knowledge() returns trigger
  language plpgsql
  set search_path = public, pg_temp
  as $$
begin
  insert into search_documents (doc_type, doc_id, workspace, visibility, person, ts, body, modules)
  values ('knowledge', new.id::text, new.workspace, 'shared', new.person, new.created_at,
          new.question || E'\n' || new.answer,
          case when new.module is null then '{}' else array[new.module] end);
  return new;
end $$;

create trigger reports_index  after insert on reports           for each row execute function index_report();
create trigger items_index    after insert on report_items      for each row execute function index_report_item();
create trigger knowledge_index after insert on knowledge_entries for each row execute function index_knowledge();

create function fts_or_query(q text, max_terms int default 32) returns tsquery
  language plpgsql immutable parallel safe
  set search_path = public, pg_temp
  as $$
declare
  lexeme text;
  result tsquery;
  term   tsquery;
begin
  for lexeme in
    select l from unnest(tsvector_to_array(to_tsvector('english', coalesce(q, '')))) as l limit max_terms
  loop
    term := plainto_tsquery('simple', lexeme);
    if numnode(term) > 0 then
      result := case when result is null then term else result || term end;
    end if;
  end loop;
  return coalesce(result, ''::tsquery);
end $$;
