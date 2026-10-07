import type { DiagramModel } from './schema'

function line(o: Record<string, unknown>): string {
  const j = JSON.stringify
  return '{ ' + Object.keys(o).map((k) => j(k) + ': ' + j(o[k])).join(', ') + ' }'
}

function arr<T>(items: T[], fn: (x: T) => string): string {
  return items.length
    ? '[\n' + items.map((x) => '    ' + fn(x)).join(',\n') + '\n  ]'
    : '[]'
}

/** Pretty-print del modelo: un objeto por línea, fácil de leer para humanos e IA. */
export function toText(m: DiagramModel): string {
  const j = JSON.stringify
  return (
    '{\n  "title": ' +
    j(m.title) +
    ',\n  "lanes": ' +
    arr(m.lanes, (l) => {
      const o: Record<string, unknown> = { id: l.id, name: l.name }
      if (l.rows != null) o.rows = l.rows
      return line(o)
    }) +
    ',\n  "nodes": ' +
    arr(m.nodes, (n) => {
      const o: Record<string, unknown> = {
        id: n.id,
        lane: n.lane,
        type: n.type,
        label: n.label,
      }
      if (n.step != null) o.step = n.step
      if (n.row != null) o.row = n.row
      if (n.note) o.note = n.note
      if (n.w != null) o.w = n.w
      if (n.h != null) o.h = n.h
      return line(o)
    }) +
    ',\n  "edges": ' +
    arr(m.edges, (e) => {
      const o: Record<string, unknown> = { from: e.from, to: e.to }
      if (e.label) o.label = e.label
      if (e.fromPort) o.fromPort = e.fromPort
      if (e.toPort) o.toPort = e.toPort
      return line(o)
    }) +
    (m.docs && m.docs.length
      ? ',\n  "docs": ' +
        arr(m.docs, (d) => {
          const o: Record<string, unknown> = { id: d.id }
          if (d.title) o.title = d.title
          o.body = d.body
          return line(o)
        })
      : '') +
    '\n}'
  )
}
