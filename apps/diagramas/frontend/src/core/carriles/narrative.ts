import { layout } from './layout'
import { PORT_NAMES, TYPES, type DiagramModel } from './schema'

/**
 * Describe el diagrama en texto plano, pensado para que una IA (o una persona)
 * entienda actores, pasos y conexiones sin mirar el SVG.
 */
export function toNarrative(m: DiagramModel): string {
  const L = layout(m)
  const laneName = (id: string) => m.lanes.find((l) => l.id === id)?.name ?? id
  const nodeById = (id: string) => m.nodes.find((n) => n.id === id)
  const label = (id: string) => {
    const n = nodeById(id)
    return n ? `${n.label} [${n.id}]` : id
  }

  const out: string[] = []
  out.push(`# ${m.title || 'Diagrama de carriles'}`)
  out.push('')
  out.push(`Carriles (actores): ${m.lanes.map((l) => l.name).join(' · ')}`)
  out.push('')
  out.push('## Pasos (ordenados por columna)')
  const ordered = [...m.nodes].sort((a, b) => {
    const ca = L.G[a.id]?.c ?? 0
    const cb = L.G[b.id]?.c ?? 0
    return ca - cb || (L.G[a.id]?.li ?? 0) - (L.G[b.id]?.li ?? 0)
  })
  for (const n of ordered) {
    const c = (L.G[n.id]?.c ?? 0) + 1
    out.push(`- Paso ${c} · ${laneName(n.lane)} · ${TYPES[n.type].name}: ${n.label} [${n.id}]`)
  }
  out.push('')
  out.push('## Conexiones (quién pasa a quién)')
  m.edges.forEach((e, i) => {
    const a = nodeById(e.from)
    const b = nodeById(e.to)
    const back = L.back[i] ? ' (retorno)' : ''
    const lab = e.label ? ` —"${e.label}"→ ` : ' → '
    const ports =
      e.fromPort || e.toPort
        ? ` [sale: ${e.fromPort ? PORT_NAMES[e.fromPort] : 'auto'}, entra: ${e.toPort ? PORT_NAMES[e.toPort] : 'auto'}]`
        : ''
    out.push(
      `- ${a ? laneName(a.lane) + ': ' : ''}${label(e.from)}${lab}${b ? laneName(b.lane) + ': ' : ''}${label(e.to)}${back}${ports}`,
    )
  })
  const notes = m.nodes.filter((n) => n.note)
  if (notes.length) {
    out.push('')
    out.push('## Notas de pasos')
    notes.forEach((n, i) => {
      out.push(`${i + 1}. ${n.label} [${n.id}]: ${n.note}`)
    })
  }
  if (m.docs?.length) {
    out.push('')
    out.push('## Documentación del proceso')
    m.docs.forEach((d, i) => {
      out.push('')
      out.push(`### ${i + 1}. ${d.title || d.id}`)
      out.push('')
      out.push(d.body || '(vacío)')
    })
  }
  return out.join('\n')
}
