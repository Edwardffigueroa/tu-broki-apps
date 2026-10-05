# Wiki

Base de conocimiento interna tipo Confluence: páginas en Markdown, versiones al guardar, wikilinks `[[...]]`, búsqueda en español, imágenes y import/export de vault Obsidian.

## Rutas

| Qué | Dónde |
|---|---|
| UI | `/wiki` → `apps/wiki/web/` |
| Schema Postgres | `wiki` |
| API | `/api/wiki/*` |

### API

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/wiki/bootstrap` | Árbol + contenidos (calienta cache SWR) |
| GET/POST | `/api/wiki/pages` | Árbol / crear (`?papelera=1`) |
| GET/PATCH/DELETE | `/api/wiki/page?id=` | Detalle / meta / papelera |
| POST | `/api/wiki/untrash?id=` | Recuperar |
| PUT/DELETE | `/api/wiki/draft?id=` | Autoguardar / descartar borrador |
| GET/POST | `/api/wiki/versions?id=` | Listar / guardar versión (`&vid=` detalle; `&vid=&accion=restaurar`) |
| GET | `/api/wiki/backlinks?id=` | Enlaces entrantes |
| GET | `/api/wiki/search?q=` | FTS español |
| GET/POST | `/api/wiki/assets` | Servir / subir (`base64`) |
| POST/PUT | `/api/wiki/documents` | Crear / reemplazar página-documento (`?id=` en PUT) |
| POST | `/api/wiki/import` | Lote Obsidian |
| POST | `/api/wiki/export` | Árbol + assets para ZIP en el cliente |

Auth: cookie compartida de `tu-broki-apps`. Autoría fija: **TuBroki**.

## Modelo

- Autoguardado (~2 s) → solo borrador (`draft_*`).
- **Guardar** (Ctrl/Cmd+S) → `wiki.save_page_version` crea versión inmutable.
- El cliente usa **cache SWR en memoria**: al abrir descarga todo con `/api/wiki/bootstrap`,
  navegar entre páginas pinta al instante y revalida en background. Las mutaciones
  invalidan lo afectado; al volver el foco a la ventana se revalida el árbol (~30 s).
- Wikilinks se resuelven por `title_key` (minúsculas, sin tildes). Títulos únicos entre páginas activas.
- Assets en `bytea`, referencia `![alt](asset:UUID)`. Máx. **20 MB** por archivo en servidor
  (import por script). La UI del browser sigue limitada ~3 MB efectivos por el body de Vercel.
- **Páginas-documento** (`kind=file` + `asset_id`): PDF, HTML, imágenes (visor) y Office/CSV/TXT
  (solo descarga). HTML en sandbox aislado. Botón 📎 o drop sobre el árbol.
- Import masivo del vault: `CONFIRM_WIPE=1 node scripts/import-vault-wiki.mjs`
- El árbol no admite ciclos (trigger `wiki.pages_sin_ciclos`): mover una página dentro
  de su propia subpágina devuelve 409, no deja el subárbol huérfano.
- Al mandar a la papelera, los hijos suben al abuelo y los enlaces entrantes quedan sin resolver.

## Pruebas

```bash
npm test              # unitarias (markdown, validación) — sin red ni base
npm run smoke:wiki    # extremo a extremo contra `npm run dev` + base real
npm run seed:wiki     # páginas de ejemplo (Markdown)
npm run seed:wiki-docs # Biblioteca de documentos (imagen/PDF/HTML)
npm run import:wiki-vault # IMPORTANTE: vacía la wiki e importa el vault Tubroki
npm run import:wiki-vault:resume # reanuda un import interrumpido
```

Reporte del último import: `scripts/import-vault-wiki-report.json`.

> En local, editar `web/` se ve al recargar; tocar `server/` o `api/` pide reiniciar
> `npm run dev` (Node cachea los módulos ya importados).

## Atajos

- `Ctrl/Cmd + S` guardar versión
- `Ctrl/Cmd + K` buscar (título + contenido, con snippets y teclado ↑↓↵)
- Bloques ` ```mermaid ` en **Vista previa** → diagramas SVG (Mermaid 11, solo cliente)
- `Ctrl/Cmd + Shift + H` panel historial
- `[[` autocompletar páginas
- `📎` en la barra lateral → subir documento como hija