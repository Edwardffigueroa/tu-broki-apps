import { toText } from './toText'
import { EXAMPLES } from './examples'
import { normalize } from './normalize'

/** Prompt listo para pegar en una IA que genere el JSON del diagrama. */
export function buildAiPrompt(): string {
  const ex = toText(normalize(EXAMPLES.arriendo).m)
  return (
    'Eres un asistente que dibuja procesos como diagramas de carriles (swimlane) para la app Diagramas de TuBroki.\n' +
    'Responde SOLO con un bloque de código JSON válido, sin comentarios ni texto extra.\n\n' +
    'Esquema:\n' +
    '{\n' +
    '  "title": "texto",\n' +
    '  "lanes": [ { "id": "id-corto", "name": "Nombre visible del carril" } ],\n' +
    '  "nodes": [ { "id": "id-unico", "lane": "<id de un carril>", "type": "start | task | decision | document | end", "label": "Texto corto", "note": "opcional", "step": 1 } ],\n' +
    '  "edges": [ { "from": "<id de paso>", "to": "<id de paso>", "label": "opcional", "fromPort": "top | right | bottom | left (opcional)", "toPort": "top | right | bottom | left (opcional)" } ],\n' +
    '  "docs": [ { "id": "id-corto", "title": "Título de la nota", "body": "Markdown del proceso. Puedes incluir ```mermaid … ```" } ]\n' +
    '}\n\n' +
    'Reglas:\n' +
    '- Cada carril es un responsable o área (persona, equipo, sistema). Cada paso pertenece a un solo carril.\n' +
    '- ids únicos, en minúsculas y sin espacios. Textos de máximo 40 caracteres.\n' +
    '- Todo proceso empieza con un paso "start" y termina con uno o más "end".\n' +
    '- Cada "decision" tiene al menos dos salidas y cada salida lleva "label" (por ejemplo "Sí" y "No").\n' +
    '- "step" es la columna (1, 2, 3…) y es opcional: si lo omites, el editor ordena los pasos solo.\n' +
    '- Los reprocesos se dibujan con una conexión que vuelve a un paso anterior. Para que no se crucen con el flujo principal, usa "fromPort"/"toPort" (por ejemplo "bottom" → "bottom" dibuja la vuelta por debajo).\n' +
    '- "note" guarda detalle corto de un paso (responsable, regla, precio). Se listan numeradas debajo del diagrama.\n' +
    '- "docs" son notas del proceso completo en Markdown (cards debajo del swimlane). Usa bloques ```mermaid para diagramas auxiliares.\n\n' +
    'Ejemplo:\n' +
    ex +
    '\n\n' +
    'Proceso a dibujar: [describe aquí tu proceso]'
  )
}
