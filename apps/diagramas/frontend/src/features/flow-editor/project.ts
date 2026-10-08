import type { Edge, Node } from '@xyflow/react'
import {
  absolutePosition,
  nodeSize,
  type FlowEdge,
  type FlowModel,
  type FlowNode,
  type LintIssue,
} from '@flow'

export type Side = 'top' | 'right' | 'bottom' | 'left'

export type StepData = {
  node: FlowNode
  laneColor?: string
  issues: LintIssue[]
  dim: boolean
  readOnly: boolean
}

export type RFStepNode = Node<StepData, 'step'>

export type FlowEdgeData = {
  edge: FlowEdge
  dim: boolean
  readOnly: boolean
}

export type RFFlowEdge = Edge<FlowEdgeData, 'flowEdge'>

export function autoSides(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): { from: Side; to: Side } {
  const ax = a.x + a.w / 2
  const ay = a.y + a.h / 2
  const bx = b.x + b.w / 2
  const by = b.y + b.h / 2
  const dx = bx - ax
  const dy = by - ay
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' }
  }
  return dy >= 0 ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' }
}

function nodeRect(m: FlowModel, n: FlowNode) {
  const pos = absolutePosition(m, n)
  const { w, h } = nodeSize(n)
  return { x: pos.x, y: pos.y, w, h }
}

function selectedIds(nodes: RFStepNode[]): Set<string> {
  return new Set(nodes.filter((n) => n.selected).map((n) => n.id))
}

export function toRfNodes(
  m: FlowModel,
  opts: {
    selected: Set<string>
    issuesByNode: Map<string, LintIssue[]>
    highlight: Set<string> | null
    readOnly: boolean
  },
): RFStepNode[] {
  return m.nodes.map((n) => {
    const pos = absolutePosition(m, n)
    const { w, h } = nodeSize(n)
    const lane = m.lanes.find((l) => l.id === n.lane)
    return {
      id: n.id,
      type: 'step' as const,
      position: pos,
      width: w,
      height: h,
      data: {
        node: n,
        laneColor: lane?.color,
        issues: opts.issuesByNode.get(n.id) || [],
        dim: opts.highlight ? !opts.highlight.has(n.id) : false,
        readOnly: opts.readOnly,
      },
      selected: opts.selected.has(n.id),
      draggable: !opts.readOnly,
      connectable: !opts.readOnly,
      zIndex: n.type === 'annotation' ? 0 : 1,
    }
  })
}

export function toRfEdges(
  m: FlowModel,
  opts: {
    selected: Set<string>
    highlight: Set<string> | null
    readOnly: boolean
  },
): RFFlowEdge[] {
  const byId = new Map(m.nodes.map((n) => [n.id, n]))
  return m.edges.map((e) => {
    const a = byId.get(e.from)
    const b = byId.get(e.to)
    let sourceHandle = e.fromHandle as Side | undefined
    let targetHandle = e.toHandle as Side | undefined
    if (a && b && (!sourceHandle || !targetHandle)) {
      const sides = autoSides(nodeRect(m, a), nodeRect(m, b))
      sourceHandle = sourceHandle || sides.from
      targetHandle = targetHandle || sides.to
    }
    const dim =
      opts.highlight != null &&
      (!opts.highlight.has(e.from) || !opts.highlight.has(e.to))
    return {
      id: e.id,
      source: e.from,
      target: e.to,
      sourceHandle,
      targetHandle,
      type: 'flowEdge' as const,
      data: { edge: e, dim, readOnly: opts.readOnly },
      selected: opts.selected.has(e.id),
      reconnectable: !opts.readOnly,
    }
  })
}

export { selectedIds }

export function nearestSide(
  m: FlowModel,
  nodeId: string,
  point: { x: number; y: number },
): Side {
  const n = m.nodes.find((x) => x.id === nodeId)
  if (!n) return 'top'
  const r = nodeRect(m, n)
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  const dx = point.x - cx
  const dy = point.y - cy
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}
