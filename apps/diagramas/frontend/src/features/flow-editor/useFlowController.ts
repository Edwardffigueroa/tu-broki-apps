import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  reconnectEdge as rfReconnectEdge,
  type Connection,
  type EdgeChange,
  type FinalConnectionState,
  type NodeChange,
  type OnDelete,
  type OnSelectionChangeFunc,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import {
  EXAMPLE_ARRIENDO,
  EXAMPLE_MINI,
  absolutePosition,
  addEdge,
  addLane,
  addNode,
  addNodeAfter,
  addPhase,
  alignNodes,
  contentWidth,
  deleteElements,
  deleteLane,
  deletePhase,
  distributeNodes,
  duplicateNodes,
  laneGeometry,
  lintFlow,
  moveLane,
  moveNodes,
  movePhase,
  normalizeFlow,
  pasteNodes,
  placeFromAbsolute,
  reconnectEdge,
  resizeNode,
  reverseEdge,
  toText,
  updateEdge,
  updateLane,
  updateNode,
  updatePhase,
  nodeSize,
  type FlowModel,
  type FlowNode,
  type FlowEdge,
} from '@flow'
import {
  actualizarDiagrama,
  AuthError,
  ConflictError,
  irAAcceso,
} from '../../api/client'
import { diagramasKeys } from '../../api/queryClient'
import type { SaveStatus } from '../../lib/types'
import { nearestSide, selectedIds, toRfEdges, toRfNodes, type RFStepNode, type RFFlowEdge } from './project'

const LS_READONLY = 'diagramas.flow.readonly'
const LS_CLIP = 'diagramas.flow.clip'
const VP_PREFIX = 'diagramas.flow.vp.'

function clone(m: FlowModel): FlowModel {
  return structuredClone(m)
}

function readVp(id: string): { x: number; y: number; zoom: number } | null {
  try {
    const raw = localStorage.getItem(VP_PREFIX + id)
    if (!raw) return null
    const v = JSON.parse(raw) as { x: number; y: number; zoom: number }
    if (Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.zoom)) return v
  } catch {
    /* */
  }
  return null
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function useFlowController(
  diagramId: string,
  initial: FlowModel,
  initialRevision: number,
) {
  const qc = useQueryClient()
  const rf = useReactFlow()
  const [model, setModel] = useState(() => clone(initial))
  const [nodes, setNodes, onNodesChangeRF] = useNodesState<RFStepNode>([])
  const [edges, setEdges, onEdgesChangeRF] = useEdgesState<RFFlowEdge>([])
  const [sel, setSel] = useState<{ nodeIds: string[]; edgeIds: string[] }>({
    nodeIds: [],
    edgeIds: [],
  })
  const [headerSel, setHeaderSel] = useState<null | { kind: 'lane' | 'phase'; id: string }>(
    null,
  )
  const [dropLaneId, setDropLaneId] = useState<string | null>(null)
  const [readOnly, setReadOnlyState] = useState(() => {
    try {
      return localStorage.getItem(LS_READONLY) === '1'
    } catch {
      return false
    }
  })
  const [highlight, setHighlight] = useState<Set<string> | null>(null)
  const [jsonText, setJsonText] = useState(() => toText(initial))
  const [jsonStatus, setJsonStatus] = useState<{ kind: 'ok' | 'err'; msg: string }>({
    kind: 'ok',
    msg: '',
  })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [revision, setRevision] = useState(initialRevision)
  const [toast, setToast] = useState<string | null>(null)
  const [histTick, setHistTick] = useState(0)

  const draggingRef = useRef(false)
  const modelRef = useRef(model)
  const revisionRef = useRef(revision)
  const hist = useRef<string[]>([JSON.stringify(initial)])
  const hi = useRef(0)
  const lastKey = useRef<string | null>(null)
  const lastT = useRef(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const jsonTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const jsonFocused = useRef(false)
  const kbdMoveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const kbdMoveIds = useRef<Set<string>>(new Set())
  const clipRef = useRef<{ nodes: FlowNode[]; edges: FlowEdge[] } | null>(null)
  const vpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  modelRef.current = model
  revisionRef.current = revision

  const lint = useMemo(() => lintFlow(model), [model])
  const issuesByNode = useMemo(() => {
    const map = new Map<string, typeof lint>()
    for (const iss of lint) {
      if (!iss.nodeId) continue
      const arr = map.get(iss.nodeId) || []
      arr.push(iss)
      map.set(iss.nodeId, arr)
    }
    return map
  }, [lint])

  const defaultViewport = useMemo(() => {
    const saved = readVp(diagramId)
    return saved ?? { x: 168 + 24, y: 36 + 16, zoom: 0.8 }
  }, [diagramId])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const syncJson = useCallback((m: FlowModel, force = false) => {
    if (force || !jsonFocused.current) setJsonText(toText(m))
  }, [])

  const okStatus = useCallback((m: FlowModel, warn?: string[]) => {
    const errs = lintFlow(m).filter((i) => i.level === 'error').length
    const avis = lintFlow(m).filter((i) => i.level === 'aviso').length
    setJsonStatus({
      kind: 'ok',
      msg:
        `JSON válido · ${m.nodes.length} pasos · ${m.edges.length} conexiones` +
        (warn?.length ? ` · ${warn[0]}` : '') +
        (errs || avis ? ` · ${errs} errores · ${avis} avisos` : ''),
    })
  }, [])

  const pushHist = useCallback((m: FlowModel, key?: string | null) => {
    const snap = JSON.stringify(m)
    if (hist.current[hi.current] === snap) return
    const now = Date.now()
    if (key && key === lastKey.current && now - lastT.current < 1200 && hi.current === hist.current.length - 1) {
      hist.current[hi.current] = snap
    } else {
      hist.current = hist.current.slice(0, hi.current + 1)
      hist.current.push(snap)
      hi.current = hist.current.length - 1
      if (hist.current.length > 150) {
        hist.current.shift()
        hi.current--
      }
    }
    lastKey.current = key || null
    lastT.current = now
    setHistTick((t) => t + 1)
  }, [])

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
      qc.setQueryData(diagramasKeys.detail(diagramId), updated)
      void qc.invalidateQueries({ queryKey: diagramasKeys.lists(), refetchType: 'none' })
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
  }, [diagramId, qc, showToast])

  const scheduleSave = useCallback(() => {
    setSaveStatus('dirty')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void persist()
    }, 800)
  }, [persist])

  const applyModel = useCallback(
    (next: FlowModel, opts?: { key?: string | null; syncText?: boolean; hist?: boolean }) => {
      const m = clone(next)
      setModel(m)
      if (opts?.syncText !== false) syncJson(m)
      okStatus(m)
      if (opts?.hist !== false) pushHist(m, opts?.key)
      scheduleSave()
    },
    [okStatus, pushHist, scheduleSave, syncJson],
  )

  const mutate = useCallback(
    (fn: (m: FlowModel) => FlowModel, opts?: { key?: string | null }) => {
      const prev = modelRef.current
      const next = fn(clone(prev))
      if (next === prev) return
      applyModel(next, opts)
    },
    [applyModel],
  )

  useEffect(() => {
    if (draggingRef.current) return
    setNodes((prev) =>
      toRfNodes(model, {
        selected: selectedIds(prev),
        issuesByNode,
        highlight,
        readOnly,
      }),
    )
    setEdges((prev) =>
      toRfEdges(model, {
        selected: new Set(prev.filter((e) => e.selected).map((e) => e.id)),
        highlight,
        readOnly,
      }),
    )
  }, [model, issuesByNode, highlight, readOnly, setNodes, setEdges])

  const commitKbdMove = useCallback(() => {
    const ids = [...kbdMoveIds.current]
    kbdMoveIds.current.clear()
    if (!ids.length) return
    const rfNodes = rf.getNodes() as RFStepNode[]
    mutate((m) => {
      const moves = ids.map((id) => {
        const rn = rfNodes.find((n) => n.id === id)
        if (!rn) return { id }
        const sz = { w: rn.width || nodeSize(m.nodes.find((x) => x.id === id)!).w, h: rn.height || 48 }
        const placed = placeFromAbsolute(m, rn.position, sz)
        return { id, ...placed }
      })
      return moveNodes(m, moves)
    }, { key: 'kbd-move' })
  }, [mutate, rf])

  const onNodesChange = useCallback(
    (changes: NodeChange<RFStepNode>[]) => {
      onNodesChangeRF(changes)
      if (draggingRef.current) return
      for (const ch of changes) {
        if (ch.type === 'position' && ch.position && !ch.dragging) {
          kbdMoveIds.current.add(ch.id)
        }
      }
      if (kbdMoveIds.current.size) {
        if (kbdMoveTimer.current) clearTimeout(kbdMoveTimer.current)
        kbdMoveTimer.current = setTimeout(commitKbdMove, 250)
      }
    },
    [commitKbdMove, onNodesChangeRF],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange<RFFlowEdge>[]) => {
      onEdgesChangeRF(changes)
    },
    [onEdgesChangeRF],
  )

  const onNodeDragStart = useCallback(() => {
    draggingRef.current = true
  }, [])

  const onNodeDrag = useCallback(
    (_: MouseEvent | TouchEvent, node: RFStepNode) => {
      const sz = { w: node.width || 160, h: node.height || 64 }
      const cy = node.position.y + sz.h / 2
      const placed = placeFromAbsolute(modelRef.current, { x: node.position.x, y: cy - sz.h / 2 }, sz)
      setDropLaneId(placed.lane)
    },
    [],
  )

  const onNodeDragStop = useCallback(
    (_: MouseEvent | TouchEvent, __: RFStepNode, dragged: RFStepNode[]) => {
      draggingRef.current = false
      setDropLaneId(null)
      const prev = modelRef.current
      let changed = false
      const moves = dragged.map((d) => {
        const sz = { w: d.width || 160, h: d.height || 64 }
        const placed = placeFromAbsolute(prev, d.position, sz)
        const n = prev.nodes.find((x) => x.id === d.id)
        if (!n) return { id: d.id, ...placed }
        if (n.lane !== placed.lane || n.x !== placed.x || n.dy !== placed.dy) changed = true
        return { id: d.id, ...placed }
      })
      if (changed) mutate((m) => moveNodes(m, moves))
    },
    [mutate],
  )

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return
      const prev = modelRef.current
      const next = addEdge(prev, {
        from: conn.source,
        to: conn.target,
        fromHandle: (conn.sourceHandle as string | undefined) || undefined,
        toHandle: (conn.targetHandle as string | undefined) || undefined,
      })
      if (next === prev) showToast('Esos pasos ya están conectados')
      else mutate(() => next)
    },
    [mutate, showToast],
  )

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (!state.fromNode?.id) return
      const fromId = state.fromNode.id
      if (state.toNode?.id && !state.toHandle) {
        const clientX = 'clientX' in event ? event.clientX : event.touches[0]?.clientX ?? 0
        const clientY = 'clientY' in event ? event.clientY : event.touches[0]?.clientY ?? 0
        const pt = rf.screenToFlowPosition({ x: clientX, y: clientY })
        const toHandle = nearestSide(modelRef.current, state.toNode.id, pt)
        const prev = modelRef.current
        const next = addEdge(prev, {
          from: fromId,
          to: state.toNode.id,
          fromHandle: (state.fromHandle as unknown as string | undefined) || undefined,
          toHandle,
        })
        if (next !== prev) mutate(() => next)
        else showToast('Esos pasos ya están conectados')
        return
      }
      if (!state.toNode && state.fromNode) {
        const clientX = 'clientX' in event ? event.clientX : event.touches[0]?.clientX ?? 0
        const clientY = 'clientY' in event ? event.clientY : event.touches[0]?.clientY ?? 0
        const pos = rf.screenToFlowPosition({ x: clientX, y: clientY })
        mutate((m) => {
          const sz = { w: 160, h: 64 }
          const placed = placeFromAbsolute(m, { x: pos.x - sz.w / 2, y: pos.y - sz.h / 2 }, sz)
          let nm = addNode(m, { type: 'task', lane: placed.lane, x: placed.x, dy: placed.dy })
          const newNode = nm.nodes[nm.nodes.length - 1]
          nm = addEdge(nm, {
            from: fromId,
            to: newNode.id,
            fromHandle: (state.fromHandle as unknown as string | undefined) || undefined,
          })
          return nm
        })
      }
    },
    [mutate, rf, showToast],
  )

  const onReconnect = useCallback(
    (oldEdge: RFFlowEdge, conn: Connection) => {
      if (!conn.source || !conn.target) return
      mutate((m) =>
        reconnectEdge(m, oldEdge.id, {
          from: conn.source!,
          to: conn.target!,
          fromHandle: (conn.sourceHandle as string | undefined) || undefined,
          toHandle: (conn.targetHandle as string | undefined) || undefined,
        }),
      )
      setEdges((eds) => rfReconnectEdge(oldEdge, conn, eds))
    },
    [mutate, setEdges],
  )

  const onBeforeDelete = useCallback(
    async ({ nodes: nds }: { nodes: RFStepNode[]; edges: RFFlowEdge[] }) => {
      if (readOnly) return false
      if (nds.length > 5) {
        return window.confirm(
          `Vas a eliminar ${nds.length} pasos y sus conexiones. ¿Continuar?`,
        )
      }
      return true
    },
    [readOnly],
  )

  const onDelete: OnDelete<RFStepNode, RFFlowEdge> = useCallback(
    ({ nodes: nds, edges: eds }) => {
      mutate((m) =>
        deleteElements(m, {
          nodeIds: nds.map((n) => n.id),
          edgeIds: eds.map((e) => e.id),
        }),
      )
      setSel({ nodeIds: [], edgeIds: [] })
    },
    [mutate],
  )

  const onSelectionChange: OnSelectionChangeFunc<RFStepNode, RFFlowEdge> = useCallback(
    ({ nodes: nds, edges: eds }) => {
      setSel({ nodeIds: nds.map((n) => n.id), edgeIds: eds.map((e) => e.id) })
      if (nds.length || eds.length) setHeaderSel(null)
    },
    [],
  )

  const onMoveEnd = useCallback(() => {
    if (vpTimer.current) clearTimeout(vpTimer.current)
    vpTimer.current = setTimeout(() => {
      const vp = rf.getViewport()
      try {
        localStorage.setItem(
          VP_PREFIX + diagramId,
          JSON.stringify({ x: vp.x, y: vp.y, zoom: vp.zoom }),
        )
      } catch {
        /* */
      }
    }, 400)
  }, [diagramId, rf])

  const undo = useCallback(() => {
    if (hi.current <= 0) return
    hi.current--
    const m = JSON.parse(hist.current[hi.current]) as FlowModel
    setModel(m)
    syncJson(m, true)
    okStatus(m)
    setHistTick((t) => t + 1)
    scheduleSave()
  }, [okStatus, scheduleSave, syncJson])

  const redo = useCallback(() => {
    if (hi.current >= hist.current.length - 1) return
    hi.current++
    const m = JSON.parse(hist.current[hi.current]) as FlowModel
    setModel(m)
    syncJson(m, true)
    okStatus(m)
    setHistTick((t) => t + 1)
    scheduleSave()
  }, [okStatus, scheduleSave, syncJson])

  const canUndo = histTick >= 0 && hi.current > 0
  const canRedo = histTick >= 0 && hi.current < hist.current.length - 1

  const setReadOnly = useCallback((v: boolean) => {
    setReadOnlyState(v)
    try {
      localStorage.setItem(LS_READONLY, v ? '1' : '0')
    } catch {
      /* */
    }
  }, [])

  const selectHeader = useCallback((kind: 'lane' | 'phase', id: string) => {
    setHeaderSel({ kind, id })
    setSel({ nodeIds: [], edgeIds: [] })
  }, [])

  const fitWithHeaders = useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    const m = modelRef.current
    const bw = contentWidth(m)
    const bh = laneGeometry(m).total
    const availW = el.clientWidth - 168 - 32
    const availH = el.clientHeight - 36 - 24
    const zoom = Math.min(Math.max(Math.min(availW / bw, availH / bh), 0.15), 1.2)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rf.setViewport({ x: 168 + 16, y: 36 + 12, zoom }, { duration: reduced ? 0 : 300 })
  }, [rf])

  const focusNode = useCallback(
    (id: string) => {
      const n = modelRef.current.nodes.find((x) => x.id === id)
      if (!n) return
      const pos = absolutePosition(modelRef.current, n)
      const { w, h } = nodeSize(n)
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      rf.setCenter(pos.x + w / 2, pos.y + h / 2, {
        zoom: Math.max(rf.getZoom(), 1),
        duration: reduced ? 0 : 300,
      })
      setSel({ nodeIds: [id], edgeIds: [] })
      setHeaderSel(null)
    },
    [rf],
  )

  const togglePath = useCallback(
    (id: string) => {
      if (highlight?.has(id) && highlight.size > 1) {
        setHighlight(null)
        return
      }
      const m = modelRef.current
      const fwd = new Set<string>([id])
      const back = new Set<string>([id])
      const qf = [id]
      const qb = [id]
      while (qf.length) {
        const cur = qf.shift()!
        for (const e of m.edges) {
          if (e.from === cur && e.kind !== 'association' && !fwd.has(e.to)) {
            fwd.add(e.to)
            qf.push(e.to)
          }
        }
      }
      while (qb.length) {
        const cur = qb.shift()!
        for (const e of m.edges) {
          if (e.to === cur && e.kind !== 'association' && !back.has(e.from)) {
            back.add(e.from)
            qb.push(e.from)
          }
        }
      }
      setHighlight(new Set([...fwd, ...back]))
    },
    [highlight],
  )

  const searchNodes = useCallback((q: string) => {
    const needle = norm(q.trim())
    if (!needle) return []
    const out: Array<{ id: string; label: string; lane: string }> = []
    for (const n of modelRef.current.nodes) {
      const hay = [n.label, n.note, n.meta?.owner, n.meta?.system]
        .filter(Boolean)
        .join(' ')
      if (norm(hay).includes(needle)) {
        const lane = modelRef.current.lanes.find((l) => l.id === n.lane)
        out.push({ id: n.id, label: n.label, lane: lane?.name || n.lane })
        if (out.length >= 20) break
      }
    }
    return out
  }, [])

  const copySelection = useCallback(() => {
    const ids = new Set(sel.nodeIds)
    if (!ids.size) return
    const m = modelRef.current
    const nodes = m.nodes.filter((n) => ids.has(n.id))
    const edges = m.edges.filter((e) => ids.has(e.from) && ids.has(e.to))
    clipRef.current = { nodes: structuredClone(nodes), edges: structuredClone(edges) }
    try {
      localStorage.setItem(LS_CLIP, JSON.stringify(clipRef.current))
    } catch {
      /* */
    }
    showToast(`Copiaste ${nodes.length} pasos`)
  }, [sel.nodeIds, showToast])

  const cut = useCallback(() => {
    copySelection()
    if (!sel.nodeIds.length) return
    mutate((m) => deleteElements(m, { nodeIds: sel.nodeIds, edgeIds: sel.edgeIds }))
    setSel({ nodeIds: [], edgeIds: [] })
  }, [copySelection, mutate, sel.edgeIds, sel.nodeIds])

  const paste = useCallback(() => {
    let clip = clipRef.current
    if (!clip) {
      try {
        const raw = localStorage.getItem(LS_CLIP)
        if (raw) clip = JSON.parse(raw) as typeof clip
      } catch {
        /* */
      }
    }
    if (!clip?.nodes.length) return
    mutate((m) => pasteNodes(m, clip!, { x: 24, y: 24 }).m)
    showToast(`Pegaste ${clip.nodes.length} pasos`)
  }, [mutate, showToast])

  const duplicate = useCallback(() => {
    if (!sel.nodeIds.length) return
    mutate((m) => duplicateNodes(m, sel.nodeIds).m)
  }, [mutate, sel.nodeIds])

  const selectAll = useCallback(() => {
    setSel({
      nodeIds: modelRef.current.nodes.map((n) => n.id),
      edgeIds: modelRef.current.edges.map((e) => e.id),
    })
  }, [])

  const loadExample = useCallback(
    (key: 'arriendo' | 'mini') => {
      const raw = key === 'arriendo' ? EXAMPLE_ARRIENDO : EXAMPLE_MINI
      const r = normalizeFlow(raw)
      if (!r.ok) {
        showToast(r.error)
        return
      }
      applyModel(r.modelo, { key: null })
      setSel({ nodeIds: [], edgeIds: [] })
      window.setTimeout(() => fitWithHeaders(), 50)
    },
    [applyModel, fitWithHeaders, showToast],
  )

  const applyJsonText = useCallback(
    (text: string) => {
      try {
        const r = normalizeFlow(JSON.parse(text) as unknown)
        if (!r.ok) {
          setJsonStatus({ kind: 'err', msg: r.error })
          return
        }
        applyModel(r.modelo, { key: 'text', syncText: false })
        okStatus(r.modelo, r.warn)
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
    if (readOnly) {
      syncJson(modelRef.current, true)
      return
    }
    try {
      const r = normalizeFlow(JSON.parse(jsonText) as unknown)
      if (!r.ok) {
        showToast('Corrige el JSON antes de formatearlo')
        return
      }
      applyModel(r.modelo, { key: 'fmt' })
      syncJson(r.modelo, true)
      okStatus(r.modelo, r.warn)
    } catch {
      showToast('Corrige el JSON antes de formatearlo')
    }
  }, [applyModel, jsonText, okStatus, readOnly, showToast, syncJson])

  useEffect(() => {
    okStatus(model)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'dirty' || saveStatus === 'saving') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [saveStatus])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (jsonTimer.current) clearTimeout(jsonTimer.current)
      if (kbdMoveTimer.current) clearTimeout(kbdMoveTimer.current)
      if (vpTimer.current) clearTimeout(vpTimer.current)
    }
  }, [])

  return {
    model,
    nodes,
    edges,
    sel,
    headerSel,
    readOnly,
    lint,
    issuesByNode,
    dropLaneId,
    highlight,
    saveStatus,
    toast,
    canUndo,
    canRedo,
    jsonText,
    jsonStatus,
    defaultViewport,
    wrapperRef,
    onNodesChange,
    onEdgesChange,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    onConnect,
    onConnectEnd,
    onReconnect,
    onBeforeDelete,
    onDelete,
    onSelectionChange,
    onMoveEnd,
    mutate,
    undo,
    redo,
    setTitle: (title: string) => mutate((m) => ({ ...m, title }), { key: 'title' }),
    setReadOnly,
    selectHeader,
    addNodeAt: (type: string, pos: { x: number; y: number }) => {
      mutate((m) => {
        const sz = nodeSize({ type, label: '', lane: '', id: '' } as FlowNode)
        const placed = placeFromAbsolute(m, { x: pos.x - sz.w / 2, y: pos.y - sz.h / 2 }, sz)
        return addNode(m, { type, lane: placed.lane, x: placed.x, dy: placed.dy })
      })
    },
    addNodeAfter: (fromId: string, type?: string) => {
      mutate((m) => addNodeAfter(m, fromId, type).m)
    },
    updateNode: (id: string, patch: Parameters<typeof updateNode>[2]) => {
      const keys = Object.keys(patch || {})
      const key =
        keys.length === 1 && keys[0] === 'label'
          ? 'label:' + id
          : keys.length === 1
            ? `${keys[0]}:${id}`
            : undefined
      mutate((m) => updateNode(m, id, patch), key ? { key } : undefined)
    },
    resizeNode: (id: string, box: { x: number; y: number; width: number; height: number }) => {
      mutate((m) => {
        let nm = resizeNode(m, id, { w: box.width, h: box.height })
        const placed = placeFromAbsolute(nm, { x: box.x, y: box.y }, { w: box.width, h: box.height })
        return moveNodes(nm, [{ id, ...placed }])
      })
    },
    updateEdge: (id: string, patch: Parameters<typeof updateEdge>[2]) => {
      mutate((m) => updateEdge(m, id, patch), { key: 'elabel:' + id })
    },
    reverseEdge: (id: string) => mutate((m) => reverseEdge(m, id)),
    addLane: (index?: number) => mutate((m) => addLane(m, { index })),
    updateLane: (id: string, patch: Parameters<typeof updateLane>[2]) =>
      mutate((m) => updateLane(m, id, patch)),
    moveLane: (id: string, dir: -1 | 1) =>
      mutate((m) => {
        const i = m.lanes.findIndex((l) => l.id === id)
        if (i < 0) return m
        return moveLane(m, id, i + dir)
      }),
    deleteLane: (id: string) => mutate((m) => deleteLane(m, id)),
    confirmDeleteLane: (id: string) => {
      const lane = modelRef.current.lanes.find((l) => l.id === id)
      if (!lane) return false
      const n = modelRef.current.nodes.filter((x) => x.lane === id).length
      const msg =
        n > 0
          ? `Vas a eliminar el carril «${lane.name}» con ${n} paso${n === 1 ? '' : 's'} y sus conexiones. Pulsa de nuevo para confirmar.`
          : `Vas a eliminar el carril «${lane.name}». Pulsa de nuevo para confirmar.`
      if (!window.confirm(msg)) return false
      if (!window.confirm(`Confirma: eliminar «${lane.name}» de forma permanente.`)) return false
      mutate((m) => deleteLane(m, id))
      setHeaderSel(null)
      return true
    },
    addPhase: (index?: number) => mutate((m) => addPhase(m, { index })),
    updatePhase: (id: string, patch: Parameters<typeof updatePhase>[2]) =>
      mutate((m) => updatePhase(m, id, patch)),
    movePhase: (id: string, dir: -1 | 1) =>
      mutate((m) => {
        const phases = m.phases || []
        const i = phases.findIndex((p) => p.id === id)
        if (i < 0) return m
        return movePhase(m, id, i + dir)
      }),
    deletePhase: (id: string) => mutate((m) => deletePhase(m, id)),
    alignNodes: (ids: string[], mode: Parameters<typeof alignNodes>[2]) =>
      mutate((m) => alignNodes(m, ids, mode)),
    distributeNodes: (ids: string[]) => mutate((m) => distributeNodes(m, ids, 'h')),
    copy: copySelection,
    cut,
    paste,
    duplicate,
    selectAll,
    fitWithHeaders,
    searchNodes,
    focusNode,
    togglePath,
    onJsonChange,
    formatJson,
    setJsonFocused: (v: boolean) => {
      jsonFocused.current = v
    },
    loadExample,
    persistNow: persist,
    showToast,
    setHighlight,
  }
}
