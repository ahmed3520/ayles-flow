import { createContext, useContext } from 'react'

type CanvasActions = {
  onGenerate: (nodeId: string) => void
  onAgentSend: (message: string) => void
  onOpenTextWorkspace: (nodeId: string) => void
}

export const CanvasActionsContext = createContext<CanvasActions>({
  onGenerate: () => {},
  onAgentSend: () => {},
  onOpenTextWorkspace: () => {},
})

export const useCanvasActions = () => useContext(CanvasActionsContext)
