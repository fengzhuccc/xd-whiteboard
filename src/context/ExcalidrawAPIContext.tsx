import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { ExcalidrawAPI } from '../types/excalidraw'

interface ExcalidrawAPIContextValue {
  api: ExcalidrawAPI | null
  setApi: (api: ExcalidrawAPI | null) => void
}

const ExcalidrawAPIContext = createContext<ExcalidrawAPIContextValue | null>(null)

export function ExcalidrawAPIProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<ExcalidrawAPI | null>(null)
  const setApiStable = useCallback((next: ExcalidrawAPI | null) => {
    setApi(next)
  }, [])
  return (
    <ExcalidrawAPIContext.Provider value={{ api, setApi: setApiStable }}>
      {children}
    </ExcalidrawAPIContext.Provider>
  )
}

export function useExcalidrawAPI(): ExcalidrawAPI | null {
  const ctx = useContext(ExcalidrawAPIContext)
  if (!ctx) {
    throw new Error('useExcalidrawAPI must be used within ExcalidrawAPIProvider')
  }
  return ctx.api
}

export function useSetExcalidrawAPI(): (api: ExcalidrawAPI | null) => void {
  const ctx = useContext(ExcalidrawAPIContext)
  if (!ctx) {
    throw new Error('useSetExcalidrawAPI must be used within ExcalidrawAPIProvider')
  }
  return ctx.setApi
}
