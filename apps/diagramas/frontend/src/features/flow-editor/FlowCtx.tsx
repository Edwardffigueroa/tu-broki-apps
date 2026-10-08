import { createContext, useContext } from 'react'
import type { useFlowController } from './useFlowController'

export type FlowController = ReturnType<typeof useFlowController>

const FlowCtx = createContext<FlowController | null>(null)

export function FlowProvider({
  value,
  children,
}: {
  value: FlowController
  children: React.ReactNode
}) {
  return <FlowCtx.Provider value={value}>{children}</FlowCtx.Provider>
}

export function useFlowCtx(): FlowController {
  const ctx = useContext(FlowCtx)
  if (!ctx) throw new Error('useFlowCtx fuera de FlowProvider')
  return ctx
}
