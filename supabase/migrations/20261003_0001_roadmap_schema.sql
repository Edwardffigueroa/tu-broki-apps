-- App: roadmap · schema propio dentro del proyecto compartido tubroki-apps
-- Aplicada el 2026-10-03 vía Supabase MCP (nombre: roadmap_0001_schema).
create schema if not exists roadmap;

create table if not exists roadmap.tableros (
  id          text primary key,
  nombre      text not null,
  version     bigint not null default 1,
  actualizado timestamptz not null default now()
);

insert into roadmap.tableros (id, nombre)
values ('principal', 'Roadmap TuBroki')
on conflict (id) do nothing;

create table if not exists roadmap.tareas (
  id              text primary key,
  tablero_id      text not null default 'principal' references roadmap.tableros(id) on delete cascade,
  padre_id        text references roadmap.tareas(id) on delete cascade deferrable initially deferred,
  tipo            text not null check (tipo in ('tarea','hito')),
  titulo          text not null,
  descripcion     text not null default '',
  grupo           text not null default '',
  estado          text not null check (estado in ('Por hacer','En curso','Bloqueada','Hecha')),
  prioridad       text not null check (prioridad in ('Alta','Media','Baja')),
  responsable     text not null default '',
  estimacion_dias numeric,
  fecha_inicio    date,
  fecha_fin       date,
  orden           integer not null default 0,
  creado          timestamptz not null default now(),
  actualizado     timestamptz not null default now(),
  constraint tareas_padre_distinto check (padre_id is null or padre_id <> id)
);

create index if not exists tareas_tablero_idx on roadmap.tareas (tablero_id, orden);
create index if not exists tareas_padre_idx on roadmap.tareas (padre_id);

-- Un respaldo CSV por día (se conservan los últimos 14 desde la app)
create table if not exists roadmap.respaldos (
  id         bigint generated always as identity primary key,
  tablero_id text not null references roadmap.tableros(id) on delete cascade,
  fecha      date not null,
  csv        text not null,
  creado     timestamptz not null default now(),
  unique (tablero_id, fecha)
);

-- El schema no se expone por PostgREST; el backend entra con su propio rol.
-- RLS activado sin políticas = cerrado para anon/authenticated por si algún día se expone.
alter table roadmap.tableros  enable row level security;
alter table roadmap.tareas    enable row level security;
alter table roadmap.respaldos enable row level security;

revoke all on schema roadmap from anon, authenticated;
revoke all on all tables in schema roadmap from anon, authenticated;
