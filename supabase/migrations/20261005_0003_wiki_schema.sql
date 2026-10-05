-- App: wiki · schema propio dentro del proyecto compartido tubroki-apps
-- Base de conocimiento colaborativa (Markdown + versiones + wikilinks).

create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists wiki;

do $$ begin
  create type wiki.version_source as enum ('web', 'import', 'system');
exception when duplicate_object then null;
end $$;

create table if not exists wiki.pages (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references wiki.pages(id) on delete set null,
  position text not null default 'a0',
  title text not null,
  title_key text not null,
  icon text,
  metadata jsonb not null default '{}'::jsonb,
  current_version_id uuid,
  draft_title text,
  draft_content text,
  draft_revision int not null default 0,
  draft_base_version_id uuid,
  draft_updated_at timestamptz,
  search tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pages_parent_distinto check (parent_id is null or parent_id <> id)
);

create unique index if not exists pages_title_key_uq
  on wiki.pages (title_key) where deleted_at is null;
create index if not exists pages_tree_idx
  on wiki.pages (parent_id, position) where deleted_at is null;
create index if not exists pages_search_idx
  on wiki.pages using gin (search);
create index if not exists pages_deleted_idx
  on wiki.pages (deleted_at) where deleted_at is not null;

create table if not exists wiki.page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references wiki.pages(id) on delete cascade,
  version_number int not null,
  title text not null,
  content text not null,
  content_hash text not null,
  author text not null default 'TuBroki',
  message text,
  source wiki.version_source not null default 'web',
  restored_from uuid references wiki.page_versions(id),
  created_at timestamptz not null default now(),
  unique (page_id, version_number)
);

create index if not exists page_versions_page_idx
  on wiki.page_versions (page_id, version_number desc);

do $$ begin
  alter table wiki.pages
    add constraint pages_current_version_fk
    foreign key (current_version_id) references wiki.page_versions(id);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table wiki.pages
    add constraint pages_draft_base_fk
    foreign key (draft_base_version_id) references wiki.page_versions(id);
exception when duplicate_object then null;
end $$;

create or replace function wiki.forbid_version_update()
returns trigger
language plpgsql as $$
begin
  raise exception 'page_versions es inmutable';
end $$;

drop trigger if exists page_versions_immutable on wiki.page_versions;
create trigger page_versions_immutable
  before update on wiki.page_versions
  for each row execute function wiki.forbid_version_update();

create table if not exists wiki.page_links (
  source_page_id uuid not null references wiki.pages(id) on delete cascade,
  target_key text not null,
  target_page_id uuid references wiki.pages(id) on delete set null,
  primary key (source_page_id, target_key)
);

create index if not exists page_links_target_idx
  on wiki.page_links (target_page_id);
create index if not exists page_links_key_idx
  on wiki.page_links (target_key);

create table if not exists wiki.assets (
  id uuid primary key default gen_random_uuid(),
  sha256 text not null unique,
  mime_type text not null,
  size_bytes bigint not null,
  original_name text,
  content bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists wiki.version_assets (
  version_id uuid not null references wiki.page_versions(id) on delete cascade,
  asset_id uuid not null references wiki.assets(id),
  primary key (version_id, asset_id)
);

create or replace function wiki.normalize_title(p_title text)
returns text
language sql immutable as $$
  select lower(extensions.unaccent(btrim(coalesce(p_title, ''))));
$$;

create or replace function wiki.save_page_version(
  p_page_id uuid,
  p_base_version_id uuid,
  p_author text default 'TuBroki',
  p_message text default null,
  p_source wiki.version_source default 'web',
  p_title text default null,
  p_content text default null
) returns wiki.page_versions
language plpgsql security invoker as $$
declare
  v_page wiki.pages;
  v_title text;
  v_content text;
  v_hash text;
  v_prev_hash text;
  v_version wiki.page_versions;
begin
  select * into v_page from wiki.pages
    where id = p_page_id and deleted_at is null
    for update;
  if not found then
    raise exception 'page_not_found' using errcode = 'P0001';
  end if;

  if v_page.current_version_id is distinct from p_base_version_id then
    raise exception 'version_conflict'
      using errcode = 'P0001',
            detail = coalesce(v_page.current_version_id::text, '');
  end if;

  v_title := coalesce(nullif(btrim(p_title), ''), v_page.draft_title, v_page.title);
  v_content := coalesce(
    p_content,
    v_page.draft_content,
    (select content from wiki.page_versions where id = v_page.current_version_id)
  );
  if v_content is null then
    raise exception 'nothing_to_save' using errcode = 'P0001';
  end if;

  v_hash := encode(extensions.digest(v_content, 'sha256'), 'hex');
  select content_hash into v_prev_hash
    from wiki.page_versions where id = v_page.current_version_id;
  if v_hash = v_prev_hash and v_title = v_page.title then
    raise exception 'no_changes' using errcode = 'P0001';
  end if;

  insert into wiki.page_versions
    (page_id, version_number, title, content, content_hash, author, message, source)
  values (
    v_page.id,
    coalesce((select max(version_number) from wiki.page_versions where page_id = v_page.id), 0) + 1,
    v_title, v_content, v_hash, coalesce(nullif(btrim(p_author), ''), 'TuBroki'),
    p_message, p_source
  )
  returning * into v_version;

  update wiki.pages set
    title = v_title,
    title_key = wiki.normalize_title(v_title),
    current_version_id = v_version.id,
    draft_title = null,
    draft_content = null,
    draft_base_version_id = null,
    draft_updated_at = null,
    draft_revision = draft_revision + 1,
    search = to_tsvector(
      'spanish',
      extensions.unaccent(v_title || ' ' || left(v_content, 500000))
    ),
    updated_at = now()
  where id = v_page.id;

  return v_version;
end $$;

-- RLS: cerrado para anon/authenticated; el backend entra con tubroki_apps.
alter table wiki.pages enable row level security;
alter table wiki.page_versions enable row level security;
alter table wiki.page_links enable row level security;
alter table wiki.assets enable row level security;
alter table wiki.version_assets enable row level security;

revoke all on schema wiki from anon, authenticated;
revoke all on all tables in schema wiki from anon, authenticated;
revoke all on all sequences in schema wiki from anon, authenticated;
revoke all on all functions in schema wiki from anon, authenticated;

grant usage on schema wiki to tubroki_apps;
grant select, insert, update, delete on all tables in schema wiki to tubroki_apps;
grant usage, select on all sequences in schema wiki to tubroki_apps;
grant execute on all functions in schema wiki to tubroki_apps;
alter default privileges in schema wiki grant select, insert, update, delete on tables to tubroki_apps;
alter default privileges in schema wiki grant usage, select on sequences to tubroki_apps;
alter default privileges in schema wiki grant execute on functions to tubroki_apps;

-- unaccent / digest viven en schema extensions
grant usage on schema extensions to tubroki_apps;
grant execute on all functions in schema extensions to tubroki_apps;

drop policy if exists backend_total on wiki.pages;
drop policy if exists backend_total on wiki.page_versions;
drop policy if exists backend_total on wiki.page_links;
drop policy if exists backend_total on wiki.assets;
drop policy if exists backend_total on wiki.version_assets;

create policy backend_total on wiki.pages for all to tubroki_apps using (true) with check (true);
create policy backend_total on wiki.page_versions for all to tubroki_apps using (true) with check (true);
create policy backend_total on wiki.page_links for all to tubroki_apps using (true) with check (true);
create policy backend_total on wiki.assets for all to tubroki_apps using (true) with check (true);
create policy backend_total on wiki.version_assets for all to tubroki_apps using (true) with check (true);
