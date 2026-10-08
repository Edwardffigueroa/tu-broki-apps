# tu-broki-apps

Herramientas internas de TuBroki en un solo despliegue: **un launcher**, **un backend compartido**, **un proyecto de Supabase** y **una app por carpeta**. Apps: `contabilidad`, `diagramas`, `roadmap`, `wiki`.

```
tu-broki-apps/
├── home/                      Launcher (/) y pantalla de acceso (/acceso). HTML plano.
├── apps/
│   ├── roadmap/
│   │   ├── frontend/          React + Vite + TS → public/roadmap/
│   │   └── server/            modelo, repo, servicio, csv
│   ├── diagramas/
│   │   ├── frontend/          React + Vite + TS → public/diagramas/
│   │   └── server/            modelo, repo, servicio (swimlanes)
│   └── wiki/                  Base de conocimiento (HTML en web/)
├── api/                       Rutas HTTP = Vercel Functions
├── shared/                    prisma, auth, http, env
├── prisma/                    schema + migraciones (fuente de verdad)
├── supabase/                  Migraciones históricas (congeladas) + Auth OTP
├── scripts/                   build.mjs · dev.mjs · prisma-env.mjs
├── vercel.json · package.json · .env.example
└── public/                    (generado, no se versiona)
```

## Cómo funciona

- **Email OTP del equipo.** `/acceso` pide tu correo, llega un código (Supabase Auth del proyecto `tubroki-apps`). Solo correos en `APPS_ALLOWED_EMAILS` entran; cookie httpOnly firmada con `SESSION_SECRET`.
- **Un Supabase, un schema por app.** Acceso tipado con **Prisma** (`shared/prisma.js`); rol `tubroki_apps` por el transaction pooler.
- **Build:** `prisma generate` + `scripts/build.mjs` (home + apps HTML + Vite).

## Desarrollo local

```bash
npm install                     # postinstall → prisma generate
cp .env.example .env.local      # DATABASE_URL, DIRECT_URL, SESSION_SECRET, SUPABASE_*, APPS_ALLOWED_EMAILS
npm run db:status               # migraciones Prisma
npm run dev                     # API + launcher/wiki en http://127.0.0.1:4747
npm run dev:roadmap             # Vite roadmap en http://127.0.0.1:5173/roadmap/ (proxy /api)
npm run dev:diagramas           # Vite diagramas en http://127.0.0.1:5174/diagramas/ (proxy /api)
npm run dev:contabilidad        # Vite contabilidad en http://127.0.0.1:5175/contabilidad/ (proxy /api)
npm test
```

En local, usa Vite para las SPAs; en Vercel un solo deploy sirve `public/<slug>/`.

## Desplegar en Vercel

1. Importa el repo (preset **Other**). No uses “multiple services”: es un solo deploy.
2. `vercel.json` define `installCommand` (raíz + frontends Vite), `buildCommand` y `outputDirectory: public`.
3. Env: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APPS_ALLOWED_EMAILS`.
4. Deploy. Rutas: `/` · `/acceso` · `/contabilidad` · `/roadmap` · `/diagramas` · `/wiki` · `/api/...`.

Todas las páginas llevan `noindex` (meta + `X-Robots-Tag`).

## Agregar una app nueva

1. Crea `apps/<slug>/` con `app.json`, UI (`web/` HTML o `frontend/` Vite) y `server/`.
2. Migración Prisma (`prisma/migrations/`) con schema + grants al rol `tubroki_apps`; actualizar `prisma/schema.prisma`.
3. Handlers en `handlers/<slug>/*.js` + entrypoint `api/<slug>.js` + rewrite en `vercel.json` (`/api/<slug>/:path*` → `/api/<slug>?__path=:path*`). Máx. 12 archivos en `api/` (Hobby).
4. Si es Vite: añádela a `VITE_APPS` en `scripts/build.mjs` y al script `build` raíz.
