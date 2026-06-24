import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawElement, ExcalidrawAppState, ExcalidrawAPI } from '../types/excalidraw'
import { useStore } from '../store/useStore'
import type { AppStore } from '../store/types'
import { useSetExcalidrawAPI } from '../context/ExcalidrawAPIContext'
import { useI18n } from '../hooks/useI18n'
import { TIMING } from '../constants'
import { Button } from '@/components/ui/button'

export function ExcalidrawEditor() {
  const { t } = useI18n()
  const activeFile = useStore((state: AppStore) => state.activeFile)
  const fileContent = useStore((state: AppStore) => state.fileContent)
  const createNewFile = useStore((state: AppStore) => state.createNewFile)
  const setZoom = useStore((state: AppStore) => state.setZoom)
  const setExcalidrawAPI = useSetExcalidrawAPI()
  const excalidrawAPIRef = useRef<ExcalidrawAPI | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const lastSavedContentRef = useRef<string>('')
  const lastSavedElementsRef = useRef<string>('')
  const isUserChangeRef = useRef(true)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousFilePathRef = useRef<string | null>(null)
  const initialLoadCompleteRef = useRef(false)


  // Parse initial data from fileContent
  const initialData = useMemo(() => {
    if (!fileContent || !activeFile) return null
    
    // Check if we're switching files
    if (activeFile.path !== previousFilePathRef.current) {
      previousFilePathRef.current = activeFile.path
      setIsLoading(true)
      // Disable user change detection during initial load
      isUserChangeRef.current = false
      initialLoadCompleteRef.current = false
    }
    
    try {
      const data = JSON.parse(fileContent)
      // Store this as our baseline for change detection
      lastSavedContentRef.current = fileContent
      lastSavedElementsRef.current = JSON.stringify(data.elements || [])
      
      
      return {
        elements: data.elements || [],
        appState: {
          ...data.appState,
          zoom: { value: 1 },
          scrollX: 0,
          scrollY: 0,
        },
        files: data.files,
      }
    } catch (error) {
      setIsLoading(false)
      return null
    }
  }, [activeFile?.path]) // Only re-parse when switching files, not on content changes

  // Center content and re-enable user change detection after initial load
  useEffect(() => {
    if (excalidrawAPIRef.current && initialData && isLoading && activeFile) {
      // Store the current file path to check later
      const currentFilePath = activeFile.path
      const api = excalidrawAPIRef.current

      // Give Excalidraw time to process the initial data
      const timer = setTimeout(() => {
        // Center the content if there are elements
        if (initialData.elements && initialData.elements.length > 0) {
          api.scrollToContent(initialData.elements, {
            fitToContent: true,
          })
        }

        // Hide loading and enable user change detection
        setTimeout(() => {
          setIsLoading(false)
          initialLoadCompleteRef.current = true

          // Wait a bit more before enabling user change detection
          // to ensure all initial onChange events have fired
          setTimeout(() => {
            isUserChangeRef.current = true
          }, TIMING.USER_CHANGE_ENABLE_DELAY)

          // Only mark file as clean if we're still on the same file
          const store = useStore.getState()
          if (store.activeFile?.path === currentFilePath) {
            store.setIsDirty(false)
            store.markFileAsModified(currentFilePath, false)
            store.markTreeNodeAsModified(currentFilePath, false)
          }
        }, TIMING.LOADING_HIDE_DELAY)
      }, TIMING.FILE_LOAD_DELAY)

      return () => clearTimeout(timer)
    }
  }, [initialData, isLoading, activeFile?.path])


  // Handle changes with debouncing
  const handleChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: ExcalidrawAppState,
    files: Record<string, unknown>
  ) => {
    // Keep the menu bar zoom display in sync
    if (appState?.zoom?.value) {
      setZoom(appState.zoom.value)
    }

    // Skip if no active file
    if (!activeFile) {
      return
    }

    // Skip if this is not a user change (initial load or programmatic update)
    if (!isUserChangeRef.current || !initialLoadCompleteRef.current) {
      // Still update our baseline during initial load
      const currentElements = JSON.stringify(elements || [])
      lastSavedElementsRef.current = currentElements
      return
    }

    // Compare only elements to detect actual changes
    const currentElements = JSON.stringify(elements || [])
    
    // If elements haven't changed from our saved baseline, skip
    if (currentElements === lastSavedElementsRef.current) {
      return
    }

    // Update our baseline
    lastSavedElementsRef.current = currentElements

    // Immediately mark as dirty so file switch detection works
    const store = useStore.getState()
    if (!store.isDirty) {
      store.setIsDirty(true)
    }
    store.markFileAsModified(activeFile.path, true)
    store.markTreeNodeAsModified(activeFile.path, true)

    // Build the new content
    const newContent = JSON.stringify(
      {
        type: 'excalidraw',
        version: 2,
        source: '小呆画板',
        elements,
        appState: {
          gridSize: appState.gridSize,
          viewBackgroundColor: appState.viewBackgroundColor,
          currentItemFontFamily: appState.currentItemFontFamily,
          currentItemFontSize: appState.currentItemFontSize,
          currentItemStrokeColor: appState.currentItemStrokeColor,
          currentItemBackgroundColor: appState.currentItemBackgroundColor,
          currentItemFillStyle: appState.currentItemFillStyle,
          currentItemStrokeWidth: appState.currentItemStrokeWidth,
          currentItemRoughness: appState.currentItemRoughness,
          currentItemOpacity: appState.currentItemOpacity,
          currentItemTextAlign: appState.currentItemTextAlign,
        },
        files,
      },
      null,
      2
    )

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce only the content update to avoid rapid re-renders
    debounceTimerRef.current = setTimeout(() => {
      const freshStore = useStore.getState()
      
      // Only update content if we're still on the same file
      if (freshStore.activeFile?.path === activeFile.path) {
        freshStore.setFileContent(newContent)
      }
    }, TIMING.DEBOUNCE_SAVE) // Debounce save operations
  }, [activeFile])

  // Handle save - update our reference
  useEffect(() => {
    const unsubscribe = useStore.subscribe((state: AppStore, prevState: AppStore) => {
      // When file is saved (isDirty becomes false)
      if (prevState.isDirty && !state.isDirty && state.fileContent) {
        lastSavedContentRef.current = state.fileContent
        try {
          const data = JSON.parse(state.fileContent)
          lastSavedElementsRef.current = JSON.stringify(data.elements || [])
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // When switching files (activeFile changes)
      if (state.activeFile?.path !== prevState.activeFile?.path) {
        // Disable user change detection for file switch
        isUserChangeRef.current = false
      }
    })

    return unsubscribe
  }, [])

  // Cleanup debounce timer on unmount or file change
  useEffect(() => {
    return () => {
      // If there's a pending content update, flush it immediately before cleanup
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [activeFile?.path])


  const handleNewFile = () => {
    createNewFile()
  }

  if (!activeFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">{t.noFileSelected}</p>
          <p className="text-xs text-muted-foreground/60 mb-4">
            {t.selectFileToEdit}
          </p>
          <Button onClick={handleNewFile} size="sm">{t.newFile}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 h-full relative" key={activeFile.path}>
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-solid border-primary border-r-transparent mb-2"></div>
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        </div>
      )}
      <div className={`h-full ${isLoading ? 'invisible' : 'visible'}`}>
        <Excalidraw
          initialData={initialData}
          excalidrawAPI={(api) => {
            const typedApi = api as unknown as ExcalidrawAPI
            excalidrawAPIRef.current = typedApi
            setExcalidrawAPI(typedApi)
          }}
          onChange={handleChange}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              saveAsImage: true,
              export: {
                saveFileToDisk: true,
              },
            },
          }}
        />
      </div>
    </div>
  )
}