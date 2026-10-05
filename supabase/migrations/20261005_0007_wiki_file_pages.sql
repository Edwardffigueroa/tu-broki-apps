-- Wiki: páginas de tipo archivo (PDF / HTML / imagen) como nodos del árbol.
--
-- kind='page'  → Markdown normal (asset_id NULL)
-- kind='file'  → documento hijo ligado a wiki.assets (asset_id NOT NULL)

alter table wiki.pages
  add column if not exists kind text not null default 'page';

alter table wiki.pages
  add column if not exists asset_id uuid references wiki.assets(id);

do $$ begin
  alter table wiki.pages
    add constraint pages_kind_check check (kind in ('page', 'file'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table wiki.pages
    add constraint pages_file_asset_check check (
      (kind = 'page' and asset_id is null)
      or (kind = 'file' and asset_id is not null)
    );
exception when duplicate_object then null;
end $$;

create index if not exists pages_asset_idx
  on wiki.pages (asset_id)
  where asset_id is not null;
