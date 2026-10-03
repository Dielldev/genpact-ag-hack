create table projects (
  id          bigint      generated always as identity primary key,
  workspace   text        not null,
  title       text        not null check (btrim(title) <> '' and char_length(title) <= 80),
  github_url  text        check (github_url is null or github_url ~ '^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$'),
  created_by  text        not null,
  created_at  timestamptz not null default now()
);
create unique index projects_title_idx on projects (workspace, lower(title));

create function project_json(p projects) returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select jsonb_build_object('project_id', p.id::text, 'workspace', p.workspace, 'title', p.title,
                            'github_url', p.github_url, 'created_by', p.created_by, 'created_at', p.created_at)
$$;

create function create_project(p jsonb) returns jsonb
  language plpgsql
  set search_path = public, pg_temp
  as $$
declare
  v_ws    text := btrim(p->>'workspace');
  v_title text := btrim(p->>'title');
  v_row   projects;
begin
  if coalesce(v_ws, '') = '' or coalesce(v_title, '') = '' or coalesce(btrim(p->>'created_by'), '') = '' then
    raise exception 'workspace, title and created_by are required' using errcode = '22023';
  end if;
  select * into v_row from projects x where x.workspace = v_ws and lower(x.title) = lower(v_title);
  if found then
    return project_json(v_row);
  end if;
  begin
    insert into projects (workspace, title, github_url, created_by)
    values (v_ws, v_title, nullif(btrim(coalesce(p->>'github_url', '')), ''), btrim(p->>'created_by'))
    returning * into v_row;
  exception when unique_violation then
    select * into v_row from projects x where x.workspace = v_ws and lower(x.title) = lower(v_title);
  end;
  return project_json(v_row);
end $$;

create function list_projects(p_workspace text) returns jsonb
  language sql stable
  set search_path = public, pg_temp
  as $$
  select coalesce(jsonb_agg(project_json(x) order by lower(x.title)), '[]')
  from projects x
  where x.workspace = p_workspace
$$;

alter table projects enable row level security;

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
