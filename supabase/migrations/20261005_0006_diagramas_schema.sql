-- App: diagramas · schema propio dentro del proyecto compartido tubroki-apps
-- Biblioteca de diagramas (grupos + etiquetas) + modelo JSON de swimlanes.

create schema if not exists diagramas;

create table if not exists diagramas.grupos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  color       text,
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists diagramas.etiquetas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  color       text,
  created_at  timestamptz not null default now(),
  constraint etiquetas_nombre_uq unique (nombre)
);

create table if not exists diagramas.diagramas (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  tipo         text not null default 'swimlane'
               check (tipo in ('swimlane')),
  grupo_id     uuid references diagramas.grupos(id) on delete set null,
  modelo       jsonb not null default '{}'::jsonb,
  revision     integer not null default 1,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists diagramas_grupo_idx
  on diagramas.diagramas (grupo_id) where archived_at is null;
create index if not exists diagramas_archived_idx
  on diagramas.diagramas (archived_at);
create index if not exists diagramas_updated_idx
  on diagramas.diagramas (updated_at desc);

create table if not exists diagramas.diagrama_etiquetas (
  diagrama_id  uuid not null references diagramas.diagramas(id) on delete cascade,
  etiqueta_id  uuid not null references diagramas.etiquetas(id) on delete cascade,
  primary key (diagrama_id, etiqueta_id)
);

create index if not exists diagrama_etiquetas_etiqueta_idx
  on diagramas.diagrama_etiquetas (etiqueta_id);

alter table diagramas.grupos enable row level security;
alter table diagramas.etiquetas enable row level security;
alter table diagramas.diagramas enable row level security;
alter table diagramas.diagrama_etiquetas enable row level security;

revoke all on schema diagramas from anon, authenticated;
revoke all on all tables in schema diagramas from anon, authenticated;

grant usage on schema diagramas to tubroki_apps;
grant select, insert, update, delete on all tables in schema diagramas to tubroki_apps;
grant usage, select on all sequences in schema diagramas to tubroki_apps;
alter default privileges in schema diagramas
  grant select, insert, update, delete on tables to tubroki_apps;
alter default privileges in schema diagramas
  grant usage, select on sequences to tubroki_apps;

create policy backend_total on diagramas.grupos for all to tubroki_apps using (true) with check (true);
create policy backend_total on diagramas.etiquetas for all to tubroki_apps using (true) with check (true);
create policy backend_total on diagramas.diagramas for all to tubroki_apps using (true) with check (true);
create policy backend_total on diagramas.diagrama_etiquetas for all to tubroki_apps using (true) with check (true);
