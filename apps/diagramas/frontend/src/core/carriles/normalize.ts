import {
  ALIAS,
  DEFAULT_LANE_ROWS,
  MAX_LANE_ROWS,
  MIN_LANE_ROWS,
  PORT_ALIAS,
  TYPES,
  clamp,
  slug,
  type DiagramModel,
  type DocCard,
  type NodeType,
  type Port,
} from './schema'

function parsePort(v: unknown): Port | undefined {
  if (v == null) return undefined
  return PORT_ALIAS[String(v).toLowerCase()]
}

function parseDocs(raw: unknown, warn: string[]): DocCard[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) {
    warn.push('"docs" ignorado: debe ser un arreglo de cards.')
    return []
  }
  const out: DocCard[] = []
  const seen: Record<string, number> = {}
  raw.forEach((item, i) => {
    let title: string | undefined
    let body = ''
    let id = ''
    if (typeof item === 'string') {
      body = item
      id = `doc${i + 1}`
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      body = String(o.body ?? o.md ?? o.content ?? '')
      if (o.title != null && String(o.title).trim()) title = String(o.title).trim().slice(0, 120)
      id = String(o.id != null ? o.id : slug(title || `doc-${i + 1}`))
    } else {
      warn.push(`docs[${i}] ignorado: formato inválido.`)
      return
    }
    if (seen[id]) id = `${id}-${i + 1}`
    seen[id] = 1
    if (body.length > 80_000) {
      warn.push(`docs[${i}] recortado: body demasiado largo.`)
      body = body.slice(0, 80_000)
    }
    const doc: DocCard = { id, body }
    if (title) doc.title = title
    out.push(doc)
  })
  return out
}

export interface NormalizeResult {
  m: DiagramModel
  warn: string[]
}

export function normalize(obj: unknown): NormalizeResult {
  const warn: string[] = []
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('La raíz debe ser un objeto con "lanes", "nodes" y "edges".')
  }
  const root = obj as Record<string, unknown>
  const m: DiagramModel = {
    title: typeof root.title === 'string' ? root.title : '',
    lanes: [],
    nodes: [],
    edges: [],
  }

  const rawLanes = Array.isArray(root.lanes) ? root.lanes : []
  if (!rawLanes.length) throw new Error('Falta "lanes": agrega al menos un carril.')

  const laneIds: Record<string, number> = {}
  rawLanes.forEach((raw, i) => {
    let l = raw
    if (typeof l === 'string') l = { name: l }
    if (!l || typeof l !== 'object') throw new Error(`lanes[${i}] no es válido.`)
    const lo = l as Record<string, unknown>
    const name = String(
      lo.name != null ? lo.name : lo.label != null ? lo.label : lo.id != null ? lo.id : `Carril ${i + 1}`,
    )
    const id = String(lo.id != null ? lo.id : slug(name))
    if (laneIds[id]) throw new Error(`Carril repetido: "${id}".`)
    laneIds[id] = 1
    const lane: DiagramModel['lanes'][number] = { id, name }
    if (lo.rows != null && Number.isFinite(+lo.rows)) {
      const rows = clamp(Math.round(+lo.rows), MIN_LANE_ROWS, MAX_LANE_ROWS)
      // Solo persistimos si no es el default (2), para no ensuciar el JSON.
      if (rows !== DEFAULT_LANE_ROWS) lane.rows = rows
    }
    m.lanes.push(lane)
  })

  function laneBy(k: unknown): string | null {
    if (k == null) return null
    const key = String(k)
    const byId = m.lanes.find((l) => l.id === key)
    if (byId) return byId.id
    const byName = m.lanes.find((l) => l.name.toLowerCase() === key.toLowerCase())
    return byName ? byName.id : null
  }

  const nodeIds: Record<string, number> = {}
  const rawNodes = Array.isArray(root.nodes) ? root.nodes : []
  rawNodes.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') throw new Error(`nodes[${i}] no es válido.`)
    const n = raw as Record<string, unknown>
    const label = String(
      n.label != null ? n.label : n.name != null ? n.name : n.id != null ? n.id : '',
    )
    const id = String(n.id != null ? n.id : `${slug(label)}-${i}`)
    if (nodeIds[id]) throw new Error(`Paso repetido: "${id}".`)
    if (n.lane == null) throw new Error(`Al paso "${id}" le falta "lane" (el id de su carril).`)
    const lane = laneBy(n.lane)
    if (lane === null) {
      throw new Error(`El paso "${id}" usa el carril "${n.lane}", que no existe en "lanes".`)
    }
    let type = String(n.type != null ? n.type : 'task').toLowerCase()
    if (!(type in TYPES)) type = ALIAS[type] || ''
    if (!type) {
      warn.push(`Tipo desconocido en "${id}": se usó "task".`)
      type = 'task'
    }
    const node: DiagramModel['nodes'][number] = {
      id,
      lane,
      type: type as NodeType,
      label: label || id,
    }
    const st = n.step != null ? n.step : null
    if (st != null && Number.isFinite(+st) && +st >= 1) node.step = Math.round(+st)
    const rw = n.row != null ? n.row : null
    if (rw != null && Number.isFinite(+rw) && +rw >= 1) node.row = Math.round(+rw)
    if (n.note) node.note = String(n.note)
    const width = n.w ?? n.width
    const height = n.h ?? n.height
    if (width != null && Number.isFinite(+width) && +width >= 24) node.w = Math.round(+width)
    if (height != null && Number.isFinite(+height) && +height >= 24) node.h = Math.round(+height)
    nodeIds[id] = 1
    m.nodes.push(node)
  })

  const rawEdges = Array.isArray(root.edges) ? root.edges : []
  rawEdges.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') throw new Error(`edges[${i}] no es válido.`)
    const e = raw as Record<string, unknown>
    const from = String(e.from != null ? e.from : e.source != null ? e.source : '')
    const to = String(e.to != null ? e.to : e.target != null ? e.target : '')
    if (!nodeIds[from] || !nodeIds[to]) {
      warn.push(`Conexión ${i + 1} ignorada: "${from}" → "${to}" no existe.`)
      return
    }
    if (from === to) {
      warn.push(`Conexión ${i + 1} ignorada: un paso no se conecta consigo mismo.`)
      return
    }
    const ed: DiagramModel['edges'][number] = { from, to }
    if (e.label) ed.label = String(e.label)
    const fp = parsePort(e.fromPort ?? e.from_port)
    const tp = parsePort(e.toPort ?? e.to_port)
    if (fp) ed.fromPort = fp
    if (tp) ed.toPort = tp
    m.edges.push(ed)
  })

  const docs = parseDocs(root.docs, warn)
  if (docs.length) m.docs = docs

  return { m, warn }
}
