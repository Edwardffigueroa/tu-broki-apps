# Contabilidad · TuBroki Apps

Libro de movimientos, estado de resultados, CAC, rentabilidad por servicio, metas y catálogo. Datos compartidos en Supabase (schema `contabilidad`).

## Dev

```bash
# Terminal 1 — API + launcher
npm run dev

# Terminal 2 — Vite SPA
npm run dev:contabilidad   # http://127.0.0.1:5175/contabilidad/
```

Login con correo + código OTP en `/acceso` (allowlist del equipo).

## Seed

```bash
npm run seed:contabilidad
# FORCE_SEED=1 npm run seed:contabilidad   # borra movimientos y reimporta CSV
```

Siembra `config/catalogo` (tasas + costos fijos) y los movimientos de `seed/movimientos-2026-10.csv`.

## API

| Ruta | Métodos |
|---|---|
| `/api/contabilidad/movimientos` | GET, POST |
| `/api/contabilidad/movimiento?id=` | GET, PUT, DELETE |
| `/api/contabilidad/metas` | GET, PUT |
| `/api/contabilidad/config` | GET, PUT |
| `/api/contabilidad/exportar` | GET (CSV) |

## Estructura

```
apps/contabilidad/
  app.json
  lib/finanzas.mjs      # dominio puro (calc, pnl, catálogo)
  server/               # modelo → repositorio → servicio
  seed/
  frontend/             # React + Vite
```
