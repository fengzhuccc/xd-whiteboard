import {
  createContext,
  useContext,
  useRef,
  useCallback,
  type ReactNode,
  type MutableRefObject,
} from 'react'
import type { ExcalidrawAPI } from '../types/excalidraw'

interface ExcalidrawAPIContextValue {
  apiRef: MutableRefObject<ExcalidrawAPI | null>
}

const ExcalidrawAPIContext = createContext<ExcalidrawAPIContextValue | null>(null)

export function ExcalidrawAPIProvider({ children }: { children: ReactNode }) {
  const apiRef = useRef<ExcalidrawAPI | null>(null)
  return (
    <ExcalidrawAPIContext.Provider value={{ apiRef }}>
      {children}
    </ExcalidrawAPIContext.Provider>
  )
}

export function useExcalidrawAPI(): ExcalidrawAPI | null {
  const ctx = useContext(ExcalidrawAPIContext)
  if (!ctx) {
    throw new Error('useExcalidrawAPI must be used within ExcalidrawAPIProvider')
  }
  return ctx.apiRef.current
}

export function useSetExcalidrawAPI(): (api: ExcalidrawAPI | null) => void {
  const ctx = useContext(ExcalidrawAPIContext)
  if (!ctx) {
    throw new Error('useSetExcalidrawAPI must be used within ExcalidrawAPIProvider')
  }
  return useCallback(
    (api: ExcalidrawAPI | null) => {
      ctx.apiRef.current = api
    },
    [ctx]
  )
}
