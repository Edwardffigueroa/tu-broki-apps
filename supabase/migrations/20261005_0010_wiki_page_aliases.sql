-- Aliases de wikilinks: varios target_key pueden apuntar a la misma página.
-- Útil tras import Obsidian (títulos colisionados / nombres legacy).

create table if not exists wiki.page_aliases (
  alias_key text primary key,
  page_id uuid not null references wiki.pages(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists page_aliases_page_idx on wiki.page_aliases (page_id);

alter table wiki.page_aliases enable row level security;
drop policy if exists backend_total on wiki.page_aliases;
create policy backend_total on wiki.page_aliases for all to tubroki_apps using (true) with check (true);

grant select, insert, update, delete on wiki.page_aliases to tubroki_apps;
