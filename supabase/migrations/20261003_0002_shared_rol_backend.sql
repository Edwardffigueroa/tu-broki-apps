-- Rol de mínimo privilegio para el backend compartido de tu-broki-apps.
-- Solo ve los schemas de las apps a los que se le dé grant (hoy: roadmap).
-- Aplicada el 2026-10-03 vía Supabase MCP (nombre: shared_0001_rol_backend).
--
-- La contraseña NO va en el repo: al crear el rol se pasa en el momento y queda
-- en DATABASE_URL (Vercel / .env.local). Para rotarla:
--   alter role tubroki_apps with password '<nueva>';
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'tubroki_apps') then
    create role tubroki_apps login password '<DEFINIR_AL_APLICAR>'
      nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
end $$;

grant usage on schema roadmap to tubroki_apps;
grant select, insert, update, delete on all tables in schema roadmap to tubroki_apps;
grant usage, select on all sequences in schema roadmap to tubroki_apps;
alter default privileges in schema roadmap grant select, insert, update, delete on tables to tubroki_apps;
alter default privileges in schema roadmap grant usage, select on sequences to tubroki_apps;

-- RLS está activo sin políticas; el backend necesita pasar.
create policy backend_total on roadmap.tableros  for all to tubroki_apps using (true) with check (true);
create policy backend_total on roadmap.tareas    for all to tubroki_apps using (true) with check (true);
create policy backend_total on roadmap.respaldos for all to tubroki_apps using (true) with check (true);
