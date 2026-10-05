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
20261005_0008_roadmap_drop_docs.sql    ← roadmap: quita docs embebidos
20261005_0009_contabilidad_schema.sql  ← schema contabilidad (movimientos, metas, config)
20261005_0010_wiki_page_aliases.sql    ← aliases de wikilinks (title_key alternos → page_id)
```

Se aplicaron vía Supabase MCP (`roadmap`/`shared` el 2026-10-03; `wiki` el 2026-10-05, nombres remotos `wiki_0003_schema`, `wiki_0004_extensions_grants`, `wiki_0005_sin_ciclos`, `wiki_0006_file_pages` y `wiki_0009_page_aliases`; `diagramas` el 2026-10-05; `contabilidad` el 2026-10-05 como `contabilidad_0009_schema`). Si usas la CLI (`supabase link --project-ref qovcebutzhovuxcqtdkb` y `supabase db push`), ten en cuenta esos nombres en el historial remoto.

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

## Auth (email OTP)

El mismo proyecto `tubroki-apps` autentica el launcher. No se usa Auth del proyecto de `tu-broki-app`.

### Checklist en el Dashboard

1. **Authentication → Providers → Email** activo.
2. **Authentication → Email Templates → Magic Link**: el cuerpo debe incluir el código, no solo el link:

```html
<h2>Tu código de acceso</h2>
<p>Ingresa este código en TuBroki Apps:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Vence en unos minutos. Si no pediste entrar, ignora este correo.</p>
```

3. **Authentication → URL Configuration**
   - Site URL: URL de producción de las apps (o `http://127.0.0.1:4747` en local)
   - Redirect URLs: incluye `http://127.0.0.1:4747/**` y el dominio de Vercel

4. Variables en Vercel / `.env.local`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APPS_ALLOWED_EMAILS`.

La anon key vive **solo en el servidor** (`shared/auth.js`). El HTML de `/acceso` no la incluye.

Checklist detallado: `supabase/AUTH-OTP.md`.
