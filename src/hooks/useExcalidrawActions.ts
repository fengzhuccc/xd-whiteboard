import { useCallback } from 'react'
import { useExcalidrawAPI } from '../context/ExcalidrawAPIContext'
import { useStore } from '../store/useStore'
import { UI, THEMES } from '../constants'

export function useExcalidrawActions() {
  const api = useExcalidrawAPI()
  const theme = useStore((s) => s.preferences.theme)
  const gridModeEnabled = useStore((s) => s.gridModeEnabled)
  const objectsSnapModeEnabled = useStore((s) => s.objectsSnapModeEnabled)

  const zoomIn = useCallback(() => {
    if (!api) return
    const appState = api.getAppState()
    api.updateScene({
      appState: {
        ...appState,
        zoom: {
          value: Math.min(appState.zoom.value * UI.ZOOM_INCREMENT, UI.MAX_ZOOM),
        },
      },
    })
  }, [api])

  const zoomOut = useCallback(() => {
    if (!api) return
    const appState = api.getAppState()
    api.updateScene({
      appState: {
        ...appState,
        zoom: {
          value: Math.max(appState.zoom.value / UI.ZOOM_INCREMENT, UI.MIN_ZOOM),
        },
      },
    })
  }, [api])

  const resetZoom = useCallback(() => {
    if (!api) return
    const elements = api.getSceneElements()
    if (elements && elements.length > 0) {
      api.scrollToContent(elements, { fitToContent: true })
    } else {
      api.updateScene({
        appState: {
          zoom: { value: 1 },
          scrollX: 0,
          scrollY: 0,
        },
      })
    }
  }, [api])

  const refresh = useCallback(() => {
    api?.refresh()
  }, [api])

  const resetCanvasBackground = useCallback(() => {
    if (!api) return
    const preset = THEMES.find((t) => t.id === theme)
    const backgroundColor = preset?.canvasColor || '#FAF8F5'
    const appState = api.getAppState()
    api.updateScene({
      appState: {
        ...appState,
        viewBackgroundColor: backgroundColor,
      },
    })
  }, [api, theme])

  const toggleGrid = useCallback(() => {
    if (!api) return
    const appState = api.getAppState()
    api.updateScene({
      appState: {
        ...appState,
        gridModeEnabled: !gridModeEnabled,
      },
    })
  }, [api, gridModeEnabled])

  const toggleSnapToGrid = useCallback(() => {
    if (!api) return
    const appState = api.getAppState()
    api.updateScene({
      appState: {
        ...appState,
        objectsSnapModeEnabled: !objectsSnapModeEnabled,
      },
    })
  }, [api, objectsSnapModeEnabled])

  return { api, zoomIn, zoomOut, resetZoom, refresh, resetCanvasBackground, toggleGrid, toggleSnapToGrid }
}
