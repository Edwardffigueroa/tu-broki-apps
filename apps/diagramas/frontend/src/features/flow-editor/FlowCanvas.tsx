import { useCallback, useEffect, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  SelectionMode,
  useReactFlow,
} from '@xyflow/react'
import { contentWidth, GRID, HEADER_W, laneGeometry, PHASE_H } from '@flow'
import { StepNode } from './nodes/StepNode'
import { FlowEdge } from './edges/FlowEdge'
import { EdgeMarkers } from './edges/markers'
import { LanesBackground } from './overlays/LanesBackground'
import { LaneHeaders } from './overlays/LaneHeaders'
import { PhaseHeaders } from './overlays/PhaseHeaders'
import { ContextMenu, type CtxTarget } from './overlays/ContextMenu'
import { SearchBox } from './panels/SearchBox'
import type { FlowController } from './FlowCtx'

const nodeTypes = { step: StepNode }
const edgeTypes = { flowEdge: FlowEdge }

function laneColorOf(node: { data?: { laneColor?: string } }): string {
  return node.data?.laneColor || 'var(--accent-soft)'
}

function resolvedColorMode(): 'light' | 'dark' {
  const t = document.documentElement.getAttribute('data-theme')
  if (t === 'dark') return 'dark'
  if (t === 'light') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function FlowCanvas({ ctrl }: { ctrl: FlowController }) {
  const rf = useReactFlow()
  const [ctx, setCtx] = useState<{ target: CtxTarget; screen: { x: number; y: number } } | null>(
    null,
  )
  const [colorMode, setColorMode] = useState<'light' | 'dark'>(() =>
    typeof window === 'undefined' ? 'light' : resolvedColorMode(),
  )
  useEffect(() => {
    const sync = () => setColorMode(resolvedColorMode())
    sync()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', sync)
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      mq.removeEventListener('change', sync)
      obs.disconnect()
    }
  }, [])
  const lg = laneGeometry(ctrl.model)
  const cw = contentWidth(ctrl.model)

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData('application/x-flow-type')
      if (!type || ctrl.readOnly) return
      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      ctrl.addNodeAt(type, pos)
    },
    [ctrl, rf],
  )

  return (
    <div className="fs-canvas-wrap" ref={ctrl.wrapperRef}>
      <ReactFlow
        nodes={ctrl.nodes}
        edges={ctrl.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={ctrl.onNodesChange}
        onEdgesChange={ctrl.onEdgesChange}
        onNodeDragStart={ctrl.onNodeDragStart}
        onNodeDrag={ctrl.onNodeDrag}
        onNodeDragStop={ctrl.onNodeDragStop}
        onConnect={ctrl.onConnect}
        onConnectEnd={ctrl.onConnectEnd}
        onReconnect={ctrl.onReconnect}
        onBeforeDelete={ctrl.onBeforeDelete}
        onDelete={ctrl.onDelete}
        onSelectionChange={ctrl.onSelectionChange}
        onMoveEnd={ctrl.onMoveEnd}
        onPaneContextMenu={(e) => {
          e.preventDefault()
          setCtx({
            target: { kind: 'pane', x: e.clientX, y: e.clientY },
            screen: { x: e.clientX, y: e.clientY },
          })
        }}
        onNodeContextMenu={(e, node) => {
          e.preventDefault()
          setCtx({ target: { kind: 'node', id: node.id }, screen: { x: e.clientX, y: e.clientY } })
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault()
          setCtx({ target: { kind: 'edge', id: edge.id }, screen: { x: e.clientX, y: e.clientY } })
        }}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={28}
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultEdgeOptions={{ type: 'flowEdge' }}
        snapToGrid
        snapGrid={[GRID, GRID]}
        selectionOnDrag
        panOnDrag={[1, 2]}
        panActivationKeyCode="Space"
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomActivationKeyCode={['Meta', 'Control']}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
        deleteKeyCode={ctrl.readOnly ? null : ['Delete', 'Backspace']}
        nodesDraggable={!ctrl.readOnly}
        nodesConnectable={!ctrl.readOnly}
        edgesReconnectable={!ctrl.readOnly}
        elementsSelectable
        minZoom={0.15}
        maxZoom={2}
        defaultViewport={ctrl.defaultViewport}
        translateExtent={[
          [-HEADER_W - 400, -PHASE_H - 400],
          [cw + 1200, lg.total + 1200],
        ]}
        onlyRenderVisibleElements
        colorMode={colorMode}
        proOptions={{ hideAttribution: false }}
      >
        <EdgeMarkers />
        <LanesBackground />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.35}
          color={
            colorMode === 'dark'
              ? 'color-mix(in srgb, var(--ink) 35%, transparent)'
              : 'color-mix(in srgb, var(--ink) 28%, transparent)'
          }
        />
        <Controls showInteractive />
        <MiniMap pannable zoomable nodeColor={laneColorOf} />
        <Panel position="top-right">
          <SearchBox />
        </Panel>
      </ReactFlow>
      <LaneHeaders />
      <PhaseHeaders />
      {ctx && (
        <ContextMenu
          target={ctx.target}
          screen={ctx.screen}
          onClose={() => setCtx(null)}
        />
      )}
      {!ctrl.model.nodes.length && (
        <div className="fs-empty-canvas">
          Arrastra una forma desde la paleta o pulsa Cargar ejemplo.
        </div>
      )}
    </div>
  )
}
