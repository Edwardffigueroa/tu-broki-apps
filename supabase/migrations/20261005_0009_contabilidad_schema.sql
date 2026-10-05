-- App: contabilidad · libro de movimientos, metas y catálogo/supuestos.

create schema if not exists contabilidad;

create table if not exists contabilidad.movimientos (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('ingreso', 'gasto')),
  fecha           date not null,
  fecha_pendiente boolean not null default false,
  estado          text not null check (estado in ('pagado', 'pendiente')),
  monto           numeric(14, 2) not null default 0,
  quien           text not null default '',
  tercero         text not null default '',
  concepto        text not null default '',
  notas           text not null default '',
  -- ingreso
  servicio        text,
  cantidad        integer,
  costo_directo   numeric(14, 2),
  medio           text,
  -- gasto
  categoria       text,
  servicio_cac    text,
  creado          timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists movimientos_fecha_idx
  on contabilidad.movimientos (fecha desc);
create index if not exists movimientos_tipo_idx
  on contabilidad.movimientos (tipo);
create index if not exists movimientos_estado_idx
  on contabilidad.movimientos (estado);

create table if not exists contabilidad.metas (
  mes         text primary key,
  unidades    jsonb not null default '{}'::jsonb,
  ventas      numeric(14, 2) not null default 0,
  utilidad    numeric(14, 2) not null default 0,
  updated_at  timestamptz not null default now(),
  constraint metas_mes_fmt check (mes ~ '^\d{4}-\d{2}$')
);

create table if not exists contabilidad.config (
  clave       text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table contabilidad.movimientos enable row level security;
alter table contabilidad.metas enable row level security;
alter table contabilidad.config enable row level security;

revoke all on schema contabilidad from anon, authenticated;
revoke all on all tables in schema contabilidad from anon, authenticated;

grant usage on schema contabilidad to tubroki_apps;
grant select, insert, update, delete on all tables in schema contabilidad to tubroki_apps;
grant usage, select on all sequences in schema contabilidad to tubroki_apps;
alter default privileges in schema contabilidad
  grant select, insert, update, delete on tables to tubroki_apps;
alter default privileges in schema contabilidad
  grant usage, select on sequences to tubroki_apps;

create policy backend_total on contabilidad.movimientos
  for all to tubroki_apps using (true) with check (true);
create policy backend_total on contabilidad.metas
  for all to tubroki_apps using (true) with check (true);
create policy backend_total on contabilidad.config
  for all to tubroki_apps using (true) with check (true);
