/**
 * Prompt para IA (contrato §11).
 */

import { EXAMPLE_MINI } from './examples.mjs';
import { normalizeFlow } from './normalize.mjs';
import { toText } from './totext.mjs';

export function buildFlowAiPrompt() {
  const r = normalizeFlow(EXAMPLE_MINI);
  const sample = r.ok ? toText(r.modelo) : '{}';

  return `Eres un asistente que escribe diagramas de carriles Pro (swimlane-flow) en JSON para TuBroki.

Contrato:
- kind: "swimlane-flow", version: 1
- lanes: [{ id, name, color?, height? }]
- phases: [{ id, name, width? }] (opcionales)
- nodes: [{ id, lane, type, label, col?, slot?, color?, textColor?, event?, note?, meta? }]
  (color / textColor opcionales #RRGGBB para relleno y letra del paso)
- edges: [{ id?, from, to, kind?, label?, fromHandle?, toHandle? }]
- docs: [{ id, title?, body }] (Markdown del proceso)

Tipos de paso: start, end, task, decision, document, event, subprocess, data, annotation.
Eventos (solo type=event): message, timer, signal, error.
Tipos de conexión (kind): flow, message, return, async, association.
Handles: top, right, bottom, left.

Importante:
- NO envíes x ni dy: el editor los calcula. Usa col (columna 1-based) y slot (fila dentro del carril).
- Usa phases para agrupar etapas del proceso.
- Entre actores distintos usa kind: "message". Reprocesos: kind: "return".
- Precios en COP con punto de miles ($629.000 COP). Sin comisiones porcentuales en flujos de cliente.

Ejemplo corto:

\`\`\`json
${sample}
\`\`\`

Responde SOLO con el JSON del diagrama (sin markdown envolvente).`;
}
