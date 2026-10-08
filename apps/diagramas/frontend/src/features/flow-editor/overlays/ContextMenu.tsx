import { useEffect, useRef } from 'react'
import { deleteElements } from '@flow'
import { useFlowCtx } from '../FlowCtx'

export type CtxTarget =
  | { kind: 'pane'; x: number; y: number }
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'lane'; id: string }
  | { kind: 'phase'; id: string }
  | null

export function ContextMenu({
  target,
  screen,
  onClose,
}: {
  target: CtxTarget
  screen: { x: number; y: number }
  onClose: () => void
}) {
  const ctrl = useFlowCtx()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!target) return null

  const items: Array<{ label: string; action: () => void; danger?: boolean }> = []

  if (target.kind === 'pane') {
    items.push(
      { label: 'Agregar tarea aquí', action: () => ctrl.addNodeAt('task', { x: target.x, y: target.y }) },
      { label: 'Agregar decisión aquí', action: () => ctrl.addNodeAt('decision', { x: target.x, y: target.y }) },
      { label: 'Agregar evento aquí', action: () => ctrl.addNodeAt('event', { x: target.x, y: target.y }) },
      { label: 'Pegar', action: () => ctrl.paste() },
      { label: 'Ajustar vista', action: () => ctrl.fitWithHeaders() },
    )
  } else if (target.kind === 'node') {
    items.push(
      { label: 'Duplicar', action: () => { ctrl.focusNode(target.id); ctrl.duplicate() } },
      { label: 'Copiar', action: () => ctrl.copy() },
      { label: 'Ver camino', action: () => ctrl.togglePath(target.id) },
      { label: 'Eliminar', action: () => ctrl.mutate((m) => deleteElements(m, { nodeIds: [target.id] })), danger: true },
    )
  } else if (target.kind === 'edge') {
    items.push(
      { label: 'Invertir dirección', action: () => ctrl.reverseEdge(target.id) },
      { label: 'Restablecer recorrido', action: () => ctrl.updateEdge(target.id, { center: undefined }) },
      { label: 'Eliminar', action: () => ctrl.mutate((m) => deleteElements(m, { edgeIds: [target.id] })), danger: true },
    )
  }

  return (
    <div
      ref={ref}
      className="fs-context-menu"
      role="menu"
      style={{ left: screen.x, top: screen.y }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          className={it.danger ? 'danger' : undefined}
          onClick={() => {
            it.action()
            onClose()
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
