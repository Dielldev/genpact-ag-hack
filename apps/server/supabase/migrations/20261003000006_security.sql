alter table item_kinds        enable row level security;
alter table person_statuses   enable row level security;
alter table session_statuses  enable row level security;
alter table knowledge_sources enable row level security;
alter table warning_kinds     enable row level security;
alter table people            enable row level security;
alter table sessions          enable row level security;
alter table reports           enable row level security;
alter table report_items      enable row level security;
alter table session_artifacts enable row level security;
alter table session_modules   enable row level security;
alter table session_tags      enable row level security;
alter table warnings          enable row level security;
alter table tickets           enable row level security;
alter table knowledge_entries enable row level security;
alter table search_documents  enable row level security;

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
