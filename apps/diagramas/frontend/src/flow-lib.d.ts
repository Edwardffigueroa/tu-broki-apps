declare module '@flow' {
  export const FLOW_KIND: string
  export const FLOW_VERSION: number
  export const COL_W: number
  export const SLOT_H: number
  export const LANE_PAD: number
  export const LANE_DEFAULT_H: number
  export const LANE_MIN_H: number
  export const LANE_MAX_H: number
  export const PHASE_DEFAULT_W: number
  export const PHASE_MIN_W: number
  export const PHASE_MAX_W: number
  export const HEADER_W: number
  export const PHASE_H: number
  export const GRID: number

  export const TYPE_DEFAULTS: Record<
    string,
    { name: string; w: number; h: number; def: string; minW: number; minH: number }
  >
  export const TYPE_ORDER: string[]
  export const EDGE_KIND_NAMES: Record<string, string>
  export const SIDES: string[]

  export interface FlowLane {
    id: string
    name: string
    height?: number
    color?: string
  }

  export interface FlowPhase {
    id: string
    name: string
    width?: number
  }

  export interface FlowNode {
    id: string
    lane: string
    type: string
    label: string
    x?: number
    dy?: number
    w?: number
    h?: number
    col?: number
    slot?: number
    /** Relleno opcional `#RGB` / `#RRGGBB`. Sin color = paleta del tipo. */
    color?: string
    /** Color de letra del paso (`#RGB` / `#RRGGBB`). */
    textColor?: string
    note?: string
    event?: string
    meta?: {
      owner?: string
      sla?: string
      system?: string
      status?: string
      tags?: string[]
    }
  }

  export interface FlowEdge {
    id: string
    from: string
    to: string
    kind?: string
    label?: string
    fromHandle?: string
    toHandle?: string
    center?: { x: number; y: number }
  }

  export interface FlowDoc {
    id: string
    title?: string
    body: string
  }

  export interface FlowModel {
    kind?: string
    version?: number
    title: string
    lanes: FlowLane[]
    phases?: FlowPhase[]
    nodes: FlowNode[]
    edges: FlowEdge[]
    docs?: FlowDoc[]
  }

  export interface LintIssue {
    level: 'error' | 'aviso'
    code: string
    msg: string
    nodeId?: string
    edgeId?: string
  }

  export function normalizeFlow(
    raw: unknown,
  ): { ok: true; modelo: FlowModel; warn: string[] } | { ok: false; error: string }

  export function modeloVacioFlow(title?: string): FlowModel

  export function laneGeometry(m: FlowModel): {
    tops: number[]
    heights: number[]
    total: number
    byId: Record<string, { i: number; top: number; h: number }>
  }

  export function phaseGeometry(m: FlowModel): {
    lefts: number[]
    widths: number[]
    total: number
  }

  export function contentWidth(m: FlowModel): number
  export function absolutePosition(m: FlowModel, n: FlowNode): { x: number; y: number }
  export function placeFromAbsolute(
    m: FlowModel,
    abs: { x: number; y: number },
    size: { w: number; h: number },
  ): { lane: string; x: number; dy: number }

  export function minLaneHeight(m: FlowModel, laneId: string): number
  export function lintFlow(m: FlowModel): LintIssue[]

  export function fromCarriles(classic: unknown): { modelo: FlowModel; warn: string[] }
  export function toCarriles(m: FlowModel): { modelo: unknown; warn: string[] }

  export function addNode(
    m: FlowModel,
    opts: { type: string; lane: string; x?: number; dy?: number; label?: string },
  ): FlowModel

  export function addNodeAfter(
    m: FlowModel,
    fromId: string,
    type?: string,
  ): { m: FlowModel; id: string | null }

  export function moveNodes(
    m: FlowModel,
    moves: Array<{ id: string; lane?: string; x?: number; dy?: number }>,
  ): FlowModel

  export function resizeNode(m: FlowModel, id: string, size: { w: number; h: number }): FlowModel

  export function updateNode(
    m: FlowModel,
    id: string,
    patch: {
      label?: string
      type?: string
      event?: string
      note?: string | null
      meta?: FlowNode['meta'] | null
      lane?: string
      /** `null` o vacío quita el color personalizado */
      color?: string | null
      /** `null` o vacío quita el color de letra */
      textColor?: string | null
    },
  ): FlowModel

  export function deleteElements(
    m: FlowModel,
    opts: { nodeIds?: string[]; edgeIds?: string[] },
  ): FlowModel

  export function addEdge(
    m: FlowModel,
    opts: {
      from: string
      to: string
      fromHandle?: string
      toHandle?: string
      kind?: string
    },
  ): FlowModel

  export function reconnectEdge(
    m: FlowModel,
    edgeId: string,
    conn: { from: string; to: string; fromHandle?: string; toHandle?: string },
  ): FlowModel

  export function updateEdge(
    m: FlowModel,
    edgeId: string,
    patch: Partial<FlowEdge> & { center?: { x: number; y: number } | null },
  ): FlowModel

  export function reverseEdge(m: FlowModel, edgeId: string): FlowModel

  export function addLane(m: FlowModel, opts?: { name?: string; index?: number }): FlowModel
  export function updateLane(
    m: FlowModel,
    laneId: string,
    patch: { name?: string; color?: string | null; height?: number },
  ): FlowModel
  export function moveLane(m: FlowModel, laneId: string, toIndex: number): FlowModel
  export function deleteLane(m: FlowModel, laneId: string): FlowModel

  export function addPhase(m: FlowModel, opts?: { name?: string; index?: number }): FlowModel
  export function updatePhase(
    m: FlowModel,
    phaseId: string,
    patch: { name?: string; width?: number },
  ): FlowModel
  export function movePhase(m: FlowModel, phaseId: string, toIndex: number): FlowModel
  export function deletePhase(m: FlowModel, phaseId: string): FlowModel

  export function pasteNodes(
    m: FlowModel,
    clip: { nodes: FlowNode[]; edges: FlowEdge[] },
    offset?: { x?: number; y?: number },
  ): { m: FlowModel; ids: string[] }

  export function duplicateNodes(m: FlowModel, ids: string[]): { m: FlowModel; ids: string[] }

  export function alignNodes(
    m: FlowModel,
    ids: string[],
    mode: 'left' | 'hcenter' | 'top' | 'vcenter',
  ): FlowModel

  export function distributeNodes(m: FlowModel, ids: string[], axis: 'h'): FlowModel

  export function toText(m: FlowModel): string
  export function toNarrative(m: FlowModel): string
  export function buildFlowAiPrompt(m: FlowModel): string

  export function nodeSize(n: FlowNode): { w: number; h: number }

  export const EXAMPLE_MINI: unknown
  export const EXAMPLE_ARRIENDO: unknown
}
