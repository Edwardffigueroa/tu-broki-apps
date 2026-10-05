# Supabase · proyecto compartido `tubroki-apps`

Un solo proyecto de Supabase para todas las apps internas. **Cada app vive en su propio schema** (`roadmap`, `wiki`, …). El schema `public` queda vacío a propósito.

| Dato | Valor |
|---|---|
| Proyecto | `tubroki-apps` (ref `qovcebutzhovuxcqtdkb`, región `us-east-1`) |
| Rol del backend | `tubroki_apps` — login, sin superuser, sin bypass RLS; solo grants sobre los schemas de las apps |
| Conexión | Transaction pooler `aws-0-us-east-1.pooler.supabase.com:6543` (Vercel no tiene IPv6; el host directo lo exige) |
| PostgREST | Ningún schema de apps está expuesto. Se entra solo por el backend (`shared/db.js`). |

## Migraciones

Están en `migrations/` con prefijo de fecha + número + app:

```
20261003_0001_roadmap_schema.sql       ← schema roadmap (tableros, tareas, respaldos)
20261003_0002_shared_rol_backend.sql   ← rol tubroki_apps + grants sobre roadmap
20261005_0003_wiki_schema.sql          ← schema wiki (páginas, versiones, links, assets)
20261005_0004_wiki_extensions_grants.sql ← usage/execute en schema extensions (unaccent, digest)
20261005_0005_wiki_sin_ciclos.sql      ← trigger: el árbol de páginas no admite ciclos
20261005_0006_diagramas_schema.sql     ← schema diagramas (grupos, etiquetas, swimlanes)
20261005_0007_wiki_file_pages.sql      ← kind=file + asset_id (PDF/HTML/imagen como nodos)
```

Se aplicaron vía Supabase MCP (`roadmap`/`shared` el 2026-10-03; `wiki` el 2026-10-05, nombres remotos `wiki_0003_schema`, `wiki_0004_extensions_grants`, `wiki_0005_sin_ciclos` y `wiki_0006_file_pages`; `diagramas` el 2026-10-05). Si usas la CLI (`supabase link --project-ref qovcebutzhovuxcqtdkb` y `supabase db push`), ten en cuenta esos nombres en el historial remoto.

## Agregar una app nueva (ej. `crm`)

1. `migrations/AAAAMMDD_000N_crm_schema.sql`: `create schema crm;` + tablas + `enable row level security` + `revoke ... from anon, authenticated`.
2. En la misma migración, grants al rol compartido:

```sql
grant usage on schema crm to tubroki_apps;
grant select, insert, update, delete on all tables in schema crm to tubroki_apps;
grant usage, select on all sequences in schema crm to tubroki_apps;
alter default privileges in schema crm grant select, insert, update, delete on tables to tubroki_apps;
alter default privileges in schema crm grant usage, select on sequences to tubroki_apps;
create policy backend_total on crm.<tabla> for all to tubroki_apps using (true) with check (true);
```

3. El backend de la app consulta siempre con el schema explícito: `select ... from crm.<tabla>`.

## Rotar la contraseña del rol

```sql
alter role tubroki_apps with password '<nueva>';
```

Luego actualiza `DATABASE_URL` en Vercel y en `.env.local`.
