import { useCallback, useEffect, useRef, useState } from 'react'
import {
  EXAMPLES,
  TYPES,
  TYPE_ORDER,
  clamp,
  layout,
  materialize,
  nextNodeId,
  normalize,
  toText,
  type DiagramModel,
  type NodeType,
} from '../../core/carriles'
import {
  actualizarDiagrama,
  AuthError,
  ConflictError,
  irAAcceso,
} from '../../api/client'
import type { SaveStatus } from '../../lib/types'

export type Sel =
  | null
  | { kind: 'node'; id: string }
  | { kind: 'edge'; i: number }
  | { kind: 'lane'; i: number }

function clone(m: DiagramModel): DiagramModel {
  return JSON.parse(JSON.stringify(m)) as DiagramModel
}

function validSel(m: DiagramModel, sel: Sel): Sel {
  if (!sel) return null
  if (sel.kind === 'node' && m.nodes.some((n) => n.id === sel.id)) return sel
  if (sel.kind === 'edge' && sel.i < m.edges.length) return sel
  if (sel.kind === 'lane' && sel.i < m.lanes.length) return sel
  return null
}

export function useEditorController(diagramId: string, initial: DiagramModel, initialRevision: number) {
  const [model, setModel] = useState(() => clone(initial))
  const [sel, setSel] = useState<Sel>(null)
  const [zoom, setZoom] = useState(1)
  const [jsonText, setJsonText] = useState(() => toText(initial))
  const [jsonStatus, setJsonStatus] = useState<{ kind: 'ok' | 'err'; msg: string }>({
    kind: 'ok',
    msg: '',
  })
  const [confirmLane, setConfirmLane] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [revision, setRevision] = useState(initialRevision)
  const [toast, setToast] = useState<string | null>(null)
  const [histTick, setHistTick] = useState(0)

  const hist = useRef<string[]>([JSON.stringify(initial)])
  const hi = useRef(0)
  const lastKey = useRef<string | null>(null)
  const lastT = useRef(0)
  const modelRef = useRef(model)
  const revisionRef = useRef(revision)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const jsonTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const jsonFocused = useRef(false)

  modelRef.current = model
  revisionRef.current = revision

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const syncJson = useCallback((m: DiagramModel, force = false) => {
    if (force || !jsonFocused.current) setJsonText(toText(m))
  }, [])

  const okStatus = useCallback((m: DiagramModel, warn?: string[]) => {
    setJsonStatus({
      kind: 'ok',
      msg:
        `JSON válido · ${m.nodes.length} pasos · ${m.edges.length} conexiones` +
        (warn?.length ? ` · ${warn[0]}` : ''),
    })
  }, [])

  const pushHist = useCallback(
    (m: DiagramModel, key?: string | null) => {
      const snap = JSON.stringify(m)
      if (hist.current[hi.current] === snap) return
      const now = Date.now()
      if (key && key === lastKey.current && now - lastT.current < 1200 && hi.current === hist.current.length - 1) {
        hist.current[hi.current] = snap
      } else {
        hist.current = hist.current.slice(0, hi.current + 1)
        hist.current.push(snap)
        hi.current = hist.current.length - 1
        if (hist.current.length > 120) {
          hist.current.shift()
          hi.current--
        }
      }
      lastKey.current = key || null
      lastT.current = now
      setHistTick((t) => t + 1)
    },
    [],
  )

  const persist = useCallback(async () => {
    const m = modelRef.current
    setSaveStatus('saving')
    try {
      const updated = await actualizarDiagrama(diagramId, {
        revision: revisionRef.current,
        titulo: m.title || 'Sin título',
        modelo: m,
      })
      setRevision(updated.revision)
      revisionRef.current = updated.revision
      setSaveStatus('saved')
    } catch (e) {
      if (e instanceof AuthError) {
        irAAcceso()
        return
      }
      if (e instanceof ConflictError) {
        setSaveStatus('conflict')
        showToast('Conflicto de versión: recarga el diagrama')
        return
      }
      setSaveStatus('error')
      showToast(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }, [diagramId, showToast])

  const scheduleSave = useCallback(() => {
    setSaveStatus('dirty')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void persist()
    }, 800)
  }, [persist])

  const applyModel = useCallback(
    (next: DiagramModel, opts?: { key?: string | null; syncText?: boolean; hist?: boolean }) => {
      const m = clone(next)
      setModel(m)
      setSel((s) => validSel(m, s))
      if (opts?.syncText !== false) syncJson(m)
      okStatus(m)
      if (opts?.hist !== false) pushHist(m, opts?.key)
      scheduleSave()
    },
    [okStatus, pushHist, scheduleSave, syncJson],
  )

  const mutate = useCallback(
    (fn: (m: DiagramModel) => void, opts?: { key?: string | null }) => {
      const m = clone(modelRef.current)
      materialize(m)
      fn(m)
      applyModel(m, { key: opts?.key })
    },
    [applyModel],
  )

  const undo = useCallback(() => {
    if (hi.current <= 0) return
    hi.current--
    const m = JSON.parse(hist.current[hi.current]) as DiagramModel
    setModel(m)
    setSel((s) => validSel(m, s))
    syncJson(m, true)
    okStatus(m)
    setHistTick((t) => t + 1)
    scheduleSave()
  }, [okStatus, scheduleSave, syncJson])

  const redo = useCallback(() => {
    if (hi.current >= hist.current.length - 1) return
    hi.current++
    const m = JSON.parse(hist.current[hi.current]) as DiagramModel
    setModel(m)
    setSel((s) => validSel(m, s))
    syncJson(m, true)
    okStatus(m)
    setHistTick((t) => t + 1)
    scheduleSave()
  }, [okStatus, scheduleSave, syncJson])

  const canUndo = histTick >= 0 && hi.current > 0
  const canRedo = histTick >= 0 && hi.current < hist.current.length - 1

  const select = useCallback((s: Sel) => {
    setConfirmLane(false)
    setSel(s)
  }, [])

  const addNode = useCallback(
    (type: NodeType) => {
      let newId = ''
      mutate((m) => {
        const from =
          sel && sel.kind === 'node' ? m.nodes.find((n) => n.id === sel.id) : null
        const laneId = from
          ? from.lane
          : sel && sel.kind === 'lane'
            ? m.lanes[sel.i].id
            : m.lanes[0].id
        let step = from
          ? (from.step || 1) + 1
          : Math.max(0, ...m.nodes.filter((n) => n.lane === laneId).map((n) => n.step || 0)) + 1
        while (m.nodes.some((n) => n.lane === laneId && n.step === step)) step++
        newId = nextNodeId(m.nodes)
        m.nodes.push({ id: newId, lane: laneId, type, label: TYPES[type].def, step })
        if (from && from.type !== 'end') m.edges.push({ from: from.id, to: newId })
      })
      setSel({ kind: 'node', id: newId })
    },
    [mutate, sel],
  )

  const addLane = useCallback(() => {
    let newI = 0
    mutate((m) => {
      let k = m.lanes.length + 1
      while (m.lanes.some((l) => l.id === 'carril-' + k)) k++
      m.lanes.push({ id: 'carril-' + k, name: 'Carril ' + (m.lanes.length + 1) })
      newI = m.lanes.length - 1
    })
    setSel({ kind: 'lane', i: newI })
  }, [mutate])

  const deleteSel = useCallback(() => {
    if (!sel) return
    const s = sel
    if (s.kind === 'lane') {
      if (model.lanes.length <= 1) {
        showToast('Debe quedar al menos un carril')
        return
      }
      const has = model.nodes.some((n) => n.lane === model.lanes[s.i].id)
      if (has && !confirmLane) {
        setConfirmLane(true)
        return
      }
    }
    setSel(null)
    setConfirmLane(false)
    mutate((m) => {
      if (s.kind === 'node') {
        m.nodes = m.nodes.filter((n) => n.id !== s.id)
        m.edges = m.edges.filter((e) => e.from !== s.id && e.to !== s.id)
      } else if (s.kind === 'edge') {
        m.edges.splice(s.i, 1)
      } else {
        const id = m.lanes[s.i].id
        const gone: Record<string, number> = {}
        m.nodes.forEach((n) => {
          if (n.lane === id) gone[n.id] = 1
        })
        m.nodes = m.nodes.filter((n) => !gone[n.id])
        m.edges = m.edges.filter((e) => !gone[e.from] && !gone[e.to])
        m.lanes.splice(s.i, 1)
      }
    })
  }, [confirmLane, model.lanes, model.nodes, mutate, sel, showToast])

  const loadExample = useCallback(
    (key: string) => {
      const ex = EXAMPLES[key]
      if (!ex) return
      const m = normalize(ex).m
      applyModel(m, { key: null })
      setSel(null)
      syncJson(m, true)
    },
    [applyModel, syncJson],
  )

  const applyJsonText = useCallback(
    (text: string) => {
      try {
        const obj = JSON.parse(text) as unknown
        const r = normalize(obj)
        applyModel(r.m, { key: 'text', syncText: false })
        okStatus(r.m, r.warn)
      } catch (err) {
        setJsonStatus({
          kind: 'err',
          msg: err instanceof Error ? err.message : 'JSON inválido',
        })
      }
    },
    [applyModel, okStatus],
  )

  const onJsonChange = useCallback(
    (text: string) => {
      setJsonText(text)
      if (jsonTimer.current) clearTimeout(jsonTimer.current)
      jsonTimer.current = setTimeout(() => applyJsonText(text), 350)
    },
    [applyJsonText],
  )

  const formatJson = useCallback(() => {
    try {
      const r = normalize(JSON.parse(jsonText) as unknown)
      applyModel(r.m, { key: 'fmt' })
      syncJson(r.m, true)
      okStatus(r.m, r.warn)
    } catch {
      showToast('Corrige el JSON antes de formatearlo')
    }
  }, [applyModel, jsonText, okStatus, showToast, syncJson])

  useEffect(() => {
    okStatus(model)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (jsonTimer.current) clearTimeout(jsonTimer.current)
    }
  }, [])

  const L = layout(model)

  return {
    model,
    sel,
    zoom,
    setZoom: (z: number) => setZoom(clamp(z, 0.3, 2)),
    jsonText,
    jsonStatus,
    confirmLane,
    saveStatus,
    toast,
    showToast,
    canUndo,
    canRedo,
    L,
    TYPE_ORDER,
    TYPES,
    mutate,
    applyModel,
    select,
    undo,
    redo,
    addNode,
    addLane,
    deleteSel,
    loadExample,
    onJsonChange,
    formatJson,
    setJsonFocused: (v: boolean) => {
      jsonFocused.current = v
    },
    setTitle: (title: string) => mutate((m) => {
      m.title = title
    }, { key: 'title' }),
    reorder: () => {
      mutate((m) => {
        m.nodes.forEach((n) => {
          delete n.step
        })
      })
      showToast('Pasos reordenados automáticamente')
    },
    persistNow: persist,
  }
}

export type EditorController = ReturnType<typeof useEditorController>
