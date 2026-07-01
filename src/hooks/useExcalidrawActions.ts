import { useCallback } from 'react'
import { useExcalidrawAPI } from '../context/ExcalidrawAPIContext'
import { UI } from '../constants'

export function useExcalidrawActions() {
  const api = useExcalidrawAPI()

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

  return { api, zoomIn, zoomOut, resetZoom, refresh }
}
