# tu-broki-apps

Herramientas internas de TuBroki en un solo despliegue: **un launcher**, **un backend compartido**, **un proyecto de Supabase** y **una app por carpeta**. Apps: `roadmap`, `wiki`, `diagramas`.

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
├── shared/                    db, auth, http, env
├── supabase/                  Migraciones por schema
├── scripts/                   build.mjs · dev.mjs
├── vercel.json · package.json · .env.example
└── public/                    (generado, no se versiona)
```

## Cómo funciona

- **Una clave para todo.** `/acceso` pide la clave del equipo (`APPS_PASSWORD`), cookie httpOnly firmada con `SESSION_SECRET`.
- **Un Supabase, un schema por app.** Rol `tubroki_apps` por el transaction pooler.
- **Build:** `scripts/build.mjs` copia `home/` + apps HTML (`wiki`) y genera `apps.json`. Luego Vite construye `roadmap` y `diagramas`.

## Desarrollo local

```bash
npm install
cp .env.example .env.local     # DATABASE_URL, APPS_PASSWORD, SESSION_SECRET
npm run dev                    # API + launcher/wiki en http://127.0.0.1:4747
npm run dev:roadmap            # Vite roadmap en http://127.0.0.1:5173/roadmap/ (proxy /api)
npm run dev:diagramas          # Vite diagramas en http://127.0.0.1:5174/diagramas/ (proxy /api)
npm test
```

En local, usa Vite para las SPAs; en Vercel un solo deploy sirve `public/<slug>/`.

## Desplegar en Vercel

1. Importa el repo (preset **Other**; `vercel.json` trae `buildCommand` y `outputDirectory`).
2. Env: `DATABASE_URL`, `APPS_PASSWORD`, `SESSION_SECRET`.
3. Deploy. Rutas: `/` · `/acceso` · `/roadmap` · `/diagramas` · `/wiki` · `/api/...`.

Todas las páginas llevan `noindex` (meta + `X-Robots-Tag`).

## Agregar una app nueva

1. Crea `apps/<slug>/` con `app.json`, UI (`web/` HTML o `frontend/` Vite) y `server/`.
2. Migración schema + grants al rol `tubroki_apps`.
3. Rutas en `api/<slug>/*.js`.
4. Si es Vite: añádela a `VITE_APPS` en `scripts/build.mjs` y al script `build` raíz.
