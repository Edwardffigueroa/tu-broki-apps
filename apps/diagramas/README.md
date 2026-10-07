# Diagramas

Biblioteca de diagramas internos de TuBroki. V1: **swimlanes / carriles** con JSON listo para IA.

## Stack

- Frontend: React 19 + Vite 8 + TypeScript → `public/diagramas/`
- Backend: `server/{modelo,repositorio,servicio}.js` + `api/diagramas/*`
- Schema Postgres: `diagramas` (grupos, etiquetas, diagramas, diagrama_etiquetas)

## Desarrollo

```bash
# en la raíz de tu-broki-apps
npm run dev              # API :4747
npm run dev:diagramas    # Vite :5174/diagramas/
```

## Contrato JSON (lo que lee la IA)

```json
{
  "title": "…",
  "lanes": [{ "id": "tubroki", "name": "TuBroki", "rows": 2 }],
  "nodes": [{ "id": "t1", "lane": "tubroki", "type": "task", "label": "…", "step": 3, "row": 1, "note": "opcional", "w": 146, "h": 60 }],
  "edges": [{ "from": "d1", "to": "t2", "label": "No", "fromPort": "bottom", "toPort": "bottom" }],
  "docs": [{ "id": "lectura", "title": "Cómo leer este flujo", "body": "Markdown del proceso. Puedes incluir bloques mermaid." }]
}
```

- `type`: `start | task | decision | document | end` (acepta alias en español).
- `step` es la columna; `row` es la fila dentro del carril (1-based). Si faltan, el layout los calcula.
- `lanes[].rows` (1–8, **default 2**): cuántas filas de grid tiene el carril. En el inspector del carril puedes subir/bajar filas; arrastra un paso a otra fila para interacciones más densas sin solapar.
- `fromPort` / `toPort` (`top | right | bottom | left`) son opcionales: fijan por qué lado sale y entra la flecha. Sin ellos la ruta es automática. Útil para retornos (ej. `bottom → bottom` dibuja la vuelta por debajo).
- Las `note` se numeran y se listan debajo del swimlane; el nodo muestra el número.
- `w`/`h` (opcionales): tamaño manual del shape. Sin ellos, el tamaño se adapta al texto. En el editor: arrastra la esquina SE o usa Ancho/Alto / Automático en el inspector.
- `docs` son **cards del proceso completo** (no de un paso): Markdown GFM con vista previa y Mermaid, debajo del gráfico. Se editan como en la Wiki (Markdown ↔ Vista previa).
- En el editor: **Copiar JSON** (contrato) y **Copiar texto** (narrativa: actores, pasos, conexiones, notas y docs — pensada para pegar en una IA).

## Rutas

| Ruta | Uso |
|---|---|
| `/diagramas/` | Biblioteca |
| `/diagramas/:id` | Editor |
| `/api/diagramas/*` | CRUD |
