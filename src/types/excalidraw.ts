export interface ExcalidrawElement {
  id: string
  type: string
  version: number
  versionNonce: number
  isDeleted: boolean
  [key: string]: unknown
}

export interface ExcalidrawAppState {
  zoom: { value: number }
  scrollX: number
  scrollY: number
  gridSize: number | null
  gridModeEnabled: boolean
  objectsSnapModeEnabled: boolean
  viewBackgroundColor: string
  currentItemFontFamily: number | null
  currentItemFontSize: number | null
  currentItemStrokeColor: string | null
  currentItemBackgroundColor: string | null
  currentItemFillStyle: string | null
  currentItemStrokeWidth: number | null
  currentItemRoughness: number | null
  currentItemOpacity: number | null
  currentItemTextAlign: string | null
}

export interface ExcalidrawScene {
  elements?: ExcalidrawElement[]
  appState?: Partial<ExcalidrawAppState>
  files?: Record<string, unknown>
  libraryItems?: unknown[]
}

export interface ExcalidrawAPI {
  getAppState: () => ExcalidrawAppState
  updateScene: (scene: ExcalidrawScene) => void
  getSceneElements: () => ExcalidrawElement[]
  scrollToContent: (elements?: ExcalidrawElement[], opts?: { fitToContent?: boolean }) => void
  refresh: () => void
}
