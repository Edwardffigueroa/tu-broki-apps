import '@xyflow/react/dist/style.css'
import './flow-editor.css'
import { ReactFlowProvider } from '@xyflow/react'
import type { FlowModel } from '@flow'
import { FlowProvider } from './FlowCtx'
import { useFlowController } from './useFlowController'
import { FlowEditorShell } from './FlowEditorShell'

function FlowEditorInner({
  diagramId,
  initialModel,
  initialRevision,
  onBack,
  onOpenDiagram,
}: {
  diagramId: string
  initialModel: FlowModel
  initialRevision: number
  onBack: () => void
  onOpenDiagram: (id: string) => void
}) {
  const ctrl = useFlowController(diagramId, initialModel, initialRevision)
  return (
    <FlowProvider value={ctrl}>
      <FlowEditorShell ctrl={ctrl} onBack={onBack} onOpenDiagram={onOpenDiagram} />
    </FlowProvider>
  )
}

export default function FlowEditorPage({
  diagramId,
  initialModel,
  initialRevision,
  onBack,
  onOpenDiagram,
}: {
  diagramId: string
  initialModel: FlowModel
  initialRevision: number
  onBack: () => void
  onOpenDiagram: (id: string) => void
}) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner
        diagramId={diagramId}
        initialModel={initialModel}
        initialRevision={initialRevision}
        onBack={onBack}
        onOpenDiagram={onOpenDiagram}
      />
    </ReactFlowProvider>
  )
}
