# App · Roadmap

Tablero de tareas del equipo con tres vistas sobre los mismos datos: **Tabla** (agrupada, edición en línea), **Cronograma** (barras arrastrables, hitos, línea de hoy) y **Kanban** (por estado). Subtareas de un nivel, deshacer al eliminar, atajos `N` `/` `Esc` `1 2 3`.

| Pieza | Dónde |
|---|---|
| UI | `frontend/` — React + Vite + TypeScript → build a `public/roadmap/` |
| Modelo y validación | `server/modelo.js` |
| Datos | `server/repositorio.js` → schema `roadmap` (`tableros`, `tareas`, `respaldos`) |
| Casos de uso | `server/servicio.js` (cargar, guardar con control de versión, exportar) |
| CSV | `server/csv.js` (RFC 4180 + BOM) — solo exportación |
| Rutas | `api/roadmap/tareas.js` (GET/PUT) · `api/roadmap/exportar.js` (GET) |
| Migración | `supabase/migrations/20261003_0001_roadmap_schema.sql` |

## UI (React)

```bash
# Desde la raíz del monorepo:
npm run dev          # API + estáticos en :4747
npm run dev:roadmap  # Vite en :5173 con proxy /api → :4747
# Trabaja en http://127.0.0.1:5173/roadmap/
```

Build de producción (también lo hace el `npm run build` raíz):

```bash
npm run build:roadmap
```

Vite escribe en `public/roadmap/` con `base: '/roadmap/'`. El contrato de URL `/roadmap` no cambia.

## Contrato de la API

```
GET /api/roadmap/tareas      → { nombre, version, tareas[] }
PUT /api/roadmap/tareas      { tareas[], version } → { ok, version }
                             409 si la versión no coincide (alguien guardó antes)
                             400 si una tarea no pasa la validación
GET /api/roadmap/exportar    → tareas.csv (descarga)
```

El navegador manda el tablero completo tras cada cambio (debounce 400 ms). El servidor lo reemplaza en una transacción y sube `tableros.version`. Antes de pisar datos guarda un respaldo CSV por día (últimos 14) en `roadmap.respaldos`.

## Modelo (una fila por tarea o subtarea)

`id, padre_id, tipo (tarea|hito), titulo, descripcion, grupo, estado (Por hacer|En curso|Bloqueada|Hecha), prioridad (Alta|Media|Baja), responsable, estimacion_dias, fecha_inicio, fecha_fin, orden, creado, actualizado`
