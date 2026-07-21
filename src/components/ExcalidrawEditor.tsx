import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawElement, ExcalidrawAppState, ExcalidrawAPI } from '../types/excalidraw'
import { useStore } from '../store/useStore'
import type { AppStore } from '../store/types'
import { useSetExcalidrawAPI } from '../context/ExcalidrawAPIContext'
import { useI18n } from '../hooks/useI18n'
import { TIMING, THEMES } from '../constants'
import { Button } from '@/components/ui/button'

export function ExcalidrawEditor() {
  const { t, language } = useI18n()
  const activeFile = useStore((state: AppStore) => state.activeFile)
  const fileContent = useStore((state: AppStore) => state.fileContent)
  const setZoom = useStore((state: AppStore) => state.setZoom)
  const themePreference = useStore((state: AppStore) => state.preferences.theme)
  const fileViewStates = useStore((state: AppStore) => state.preferences.fileViewStates)
  const updateFileViewState = useStore((state: AppStore) => state.updateFileViewState)
  const libraryItems = useStore((state: AppStore) => state.libraryItems)
  const setLibraryItems = useStore((state: AppStore) => state.setLibraryItems)
  const setExcalidrawAPI = useSetExcalidrawAPI()
  const excalidrawAPIRef = useRef<ExcalidrawAPI | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const lastSavedElementsRef = useRef<string>('')
  const lastGridModeRef = useRef<boolean>(false)
  const lastSnapModeRef = useRef<boolean>(false)
  // 缓存当前文件的最新视图状态，切换/保存/关闭时直接从这里读取，
  // 避免在组件卸载或 API 失效时再访问 Excalidraw API。
  const lastViewStateRef = useRef<{ zoom: number; scrollX: number; scrollY: number } | null>(null)
  const isUserChangeRef = useRef(true)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 暂存最近一次 onChange 计算出的 newContent，文件切换/卸载时 flush，避免丢失最后一次编辑。
  const pendingContentRef = useRef<{ path: string; content: string } | null>(null)
  const previousFilePathRef = useRef<string | null>(null)
  const initialLoadCompleteRef = useRef(false)
  // 自动保存专用 timer，独立于 fileContent 的 debounce，避免持续编辑时保存被无限推迟。
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 记录当前文件要恢复的视图状态，等 Excalidraw API 就绪后通过 updateScene 显式应用。
  const pendingViewStateRef = useRef<{ zoom: { value: number }; scrollX: number; scrollY: number } | null>(null)
  // 标记是否正在等待 updateScene 触发的第一次 onChange，作为 loading 隐藏信号。
  const waitingViewStateOnChangeRef = useRef(false)
  // 窗口最大化/还原后，延迟触发 scrollToContent 的 timer。
  const windowStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushPendingContent = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    const pending = pendingContentRef.current
    if (pending) {
      const freshStore = useStore.getState()
      if (freshStore.activeFile?.path === pending.path) {
        freshStore.setFileContent(pending.content)
      }
      pendingContentRef.current = null
    }
  }

  const effectiveTheme = useMemo(() => {
    // Excalidraw only supports light/dark; both app themes render as light
    return 'light'
  }, [])

  const canvasBackgroundColor = useMemo(() => {
    const preset = THEMES.find((theme) => theme.id === themePreference)
    return preset?.canvasColor || '#FAF8F5'
  }, [themePreference])

  // Parse initial data from fileContent
  const initialData = useMemo(() => {
    if (!fileContent || !activeFile) return null

    try {
      const data = JSON.parse(fileContent)
      const appState = data.appState || {}
      const isEmptyFile = (data.elements || []).length === 0
      // 空白文件未设置画布背景时，使用偏好设置中的默认值
      const viewBackgroundColor = appState.viewBackgroundColor || (isEmptyFile ? canvasBackgroundColor : undefined)
      // 优先从应用级状态恢复上次视图（切换/保存/关闭时记录），
      // 没有记录时才使用文件自身保存的视图状态作为兜底。
      const savedViewState = activeFile ? fileViewStates[activeFile.path] : null
      const viewState = savedViewState ?? {
        zoom: appState.zoom ?? { value: 1 },
        scrollX: appState.scrollX ?? 0,
        scrollY: appState.scrollY ?? 0,
      }

      // 记录要恢复的视图状态，等 API 就绪后通过 updateScene 显式应用，
      // 避免 Excalidraw 在 initialData 处理时忽略/重置 zoom/scroll。
      pendingViewStateRef.current = viewState

      return {
        elements: data.elements || [],
        appState: {
          ...appState,
          ...(viewBackgroundColor ? { viewBackgroundColor } : {}),
          ...viewState,
        },
        files: data.files,
        libraryItems: libraryItems.length > 0 ? (libraryItems as any[]) : undefined,
      }
    } catch (error) {
      return null
    }
  }, [fileContent, canvasBackgroundColor, libraryItems]) // Re-parse when file content or preference changes

  // Sync grid/snap baseline when initial data is parsed
  useEffect(() => {
    if (!initialData) return
    const appState = initialData.appState || {}
    lastGridModeRef.current = Boolean(appState.gridModeEnabled)
    lastSnapModeRef.current = Boolean(appState.objectsSnapModeEnabled)
  }, [initialData])


  // Track file switches and loading state via effect
  useEffect(() => {
    if (!activeFile) return

    if (activeFile.path !== previousFilePathRef.current) {
      previousFilePathRef.current = activeFile.path
      setIsLoading(true)
      isUserChangeRef.current = false
      initialLoadCompleteRef.current = false

      try {
        const data = JSON.parse(fileContent || '{}')
        lastSavedElementsRef.current = JSON.stringify(data.elements || [])
      } catch {
        setIsLoading(false)
      }

    }
  }, [activeFile?.path, fileContent])

  // Center content and hide loading as soon as the Excalidraw API is ready.
  // 旧实现靠三层固定 setTimeout（300+200+300ms）保守等待 initialData 处理完成，
  // 现改为 API 就绪后下一帧立即居中并隐藏 loading，省掉 ~500ms 固定延迟。
  // 通过两个入口触发：effect（文件切换时）+ excalidrawAPI 回调（首次挂载时），
  // 用 isLoading 守卫保证只执行一次。
  const finishInitialLoad = useCallback(() => {
    const api = excalidrawAPIRef.current
    if (!api || !initialData || !activeFile || !isLoading) return

    const currentFilePath = activeFile.path

    requestAnimationFrame(() => {
      // 切换文件期间可能已离开当前文件，二次校验
      if (useStore.getState().activeFile?.path !== currentFilePath) return

      // initialData.scrollToContent = true 已让 Excalidraw 自动缩放并居中，
      // 需要给它极短的时间完成内部计算/动画，避免 loading 过早消失导致
      // 用户看到"先 100% 显示再缩放"的一闪。
      setTimeout(() => {
        if (useStore.getState().activeFile?.path !== currentFilePath) return

        setIsLoading(false)
        initialLoadCompleteRef.current = true

        const store = useStore.getState()
        if (store.activeFile?.path === currentFilePath) {
          store.setIsDirty(false)
          store.markFileAsModified(currentFilePath, false)
          store.markTreeNodeAsModified(currentFilePath, false)
        }

        // 延迟启用用户变更检测，跳过 initialData 触发的 onChange。
        setTimeout(() => {
          isUserChangeRef.current = true
        }, TIMING.USER_CHANGE_ENABLE_DELAY)
      }, 100)
    })
  }, [initialData, activeFile, isLoading])

  useEffect(() => {
    if (excalidrawAPIRef.current && initialData && isLoading && activeFile) {
      finishInitialLoad()
    }
  }, [initialData, isLoading, activeFile?.path, finishInitialLoad])

  // 将当前 Excalidraw 视图状态保存到应用级偏好。
  // 只在切换/保存/关闭等关键时机调用，避免每次滚动都写盘。
  // 数据从 lastViewStateRef 读取，避免在组件卸载或 API 失效时访问 API。
  const saveCurrentViewState = useCallback((filePath: string | null, force = false) => {
    const viewState = lastViewStateRef.current
    if (!filePath || !viewState) return

    updateFileViewState(filePath, {
      zoom: { value: viewState.zoom },
      scrollX: viewState.scrollX,
      scrollY: viewState.scrollY,
    }, force)
  }, [updateFileViewState])

  // 把待写内容同步到 store 并保存当前视图状态。
  // 关闭应用前由 App.tsx 的 check-unsaved-before-close 监听器调用，
  // 确保最后一次编辑和滚动/缩放状态不丢失。
  const flushEditorChanges = useCallback(() => {
    flushPendingContent()
    const currentPath = useStore.getState().activeFile?.path
    if (currentPath) {
      saveCurrentViewState(currentPath, true)
    }
  }, [saveCurrentViewState])

  // 注册 flush 函数到 store，供 App.tsx 在关闭前调用。
  const setFlushEditorChanges = useStore((state: AppStore) => state.setFlushEditorChanges)
  useEffect(() => {
    setFlushEditorChanges(flushEditorChanges)
    return () => {
      if (useStore.getState().flushEditorChanges === flushEditorChanges) {
        setFlushEditorChanges(null)
      }
    }
  }, [flushEditorChanges, setFlushEditorChanges])

  // Handle changes with debouncing
  const handleChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: ExcalidrawAppState,
    files: Record<string, unknown>
  ) => {
    // 如果正在等待 updateScene 触发的第一次 onChange，说明视图状态已生效，
    // 可以隐藏 loading 并进入正常流程。
    if (waitingViewStateOnChangeRef.current) {
      waitingViewStateOnChangeRef.current = false
      setIsLoading(false)
      initialLoadCompleteRef.current = true
      isUserChangeRef.current = false

      const store = useStore.getState()
      if (activeFile && store.activeFile?.path === activeFile.path) {
        store.setIsDirty(false)
        store.markFileAsModified(activeFile.path, false)
        store.markTreeNodeAsModified(activeFile.path, false)
      }

      // 仍更新 baseline，避免把 updateScene 产生的状态当作未保存变更。
      lastSavedElementsRef.current = JSON.stringify(elements || [])
      lastGridModeRef.current = Boolean(appState.gridModeEnabled)
      lastSnapModeRef.current = Boolean(appState.objectsSnapModeEnabled)

      // 延迟启用用户变更检测。
      setTimeout(() => {
        isUserChangeRef.current = true
      }, TIMING.USER_CHANGE_ENABLE_DELAY)

      return
    }

    // 持续缓存最新视图状态，不触发持久化，供切换/保存/关闭时读取。
    lastViewStateRef.current = {
      zoom: appState?.zoom?.value ?? 1,
      scrollX: appState?.scrollX ?? 0,
      scrollY: appState?.scrollY ?? 0,
    }

    // Keep the menu bar zoom display in sync
    if (appState?.zoom?.value) {
      const store = useStore.getState()
      if (store.zoom !== appState.zoom.value) {
        setZoom(appState.zoom.value)
      }
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

    // Compare elements and grid/snap state to detect actual changes
    const currentElements = JSON.stringify(elements || [])
    const gridModeEnabled = Boolean(appState.gridModeEnabled)
    const objectsSnapModeEnabled = Boolean(appState.objectsSnapModeEnabled)
    const elementsChanged = currentElements !== lastSavedElementsRef.current
    const gridChanged = gridModeEnabled !== lastGridModeRef.current
    const snapChanged = objectsSnapModeEnabled !== lastSnapModeRef.current

    // If nothing relevant changed, skip
    if (!elementsChanged && !gridChanged && !snapChanged) {
      return
    }

    // Update our baselines
    if (elementsChanged) {
      lastSavedElementsRef.current = currentElements
    }
    if (gridChanged) {
      lastGridModeRef.current = gridModeEnabled
    }
    if (snapChanged) {
      lastSnapModeRef.current = objectsSnapModeEnabled
    }

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
          gridModeEnabled,
          objectsSnapModeEnabled,
          viewBackgroundColor: appState.viewBackgroundColor,
          // 保存当前视图状态，下次打开时恢复
          zoom: appState.zoom,
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
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

    // 暂存待写入的 newContent，文件切换/卸载时 flush，避免丢失最后一次编辑。
    pendingContentRef.current = { path: activeFile.path, content: newContent }

    // Debounce only the content update to avoid rapid re-renders
    debounceTimerRef.current = setTimeout(() => {
      const freshStore = useStore.getState()

      // Only update content if we're still on the same file
      if (freshStore.activeFile?.path === activeFile.path) {
        freshStore.setFileContent(newContent)
        pendingContentRef.current = null
      }
    }, TIMING.DEBOUNCE_SAVE) // Debounce save operations

    // 自动保存：使用独立 timer，用户每次编辑都会重置，停手后触发保存。
    const { preferences } = useStore.getState()
    if (preferences.autoSaveEnabled) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveTimerRef.current = null
        flushPendingContent()
        const freshStore = useStore.getState()
        if (
          freshStore.isDirty &&
          freshStore.activeFile &&
          freshStore.activeFile.path === activeFile.path
        ) {
          freshStore.saveCurrentFile()
        }
      }, preferences.autoSaveInterval * 1000)
    }
  }, [activeFile])

  // Handle save - update our reference and save view state on save
  useEffect(() => {
    const unsubscribe = useStore.subscribe((state: AppStore, prevState: AppStore) => {
      // When file is saved (isDirty becomes false)
      if (prevState.isDirty && !state.isDirty && state.fileContent) {
        try {
          const data = JSON.parse(state.fileContent)
          lastSavedElementsRef.current = JSON.stringify(data.elements || [])
        } catch (e) {
          // Ignore parse errors
        }

        // 文件保存时记录当前视图状态到偏好。
        const currentPath = state.activeFile?.path
        if (currentPath) {
          saveCurrentViewState(currentPath)
        }
      }

      // When switching files (activeFile changes)
      if (state.activeFile?.path !== prevState.activeFile?.path) {
        // Disable user change detection for file switch
        isUserChangeRef.current = false
      }
    })

    return unsubscribe
  }, [saveCurrentViewState])

  // 关闭应用或组件卸载时，保存当前激活文件的视图状态。
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentPath = useStore.getState().activeFile?.path
      if (currentPath) {
        // 应用关闭时同步保存，不等防抖 timer，避免窗口关闭前来不及写盘。
        saveCurrentViewState(currentPath, true)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      const currentPath = useStore.getState().activeFile?.path
      if (currentPath) {
        saveCurrentViewState(currentPath)
      }
    }
  }, [saveCurrentViewState])

  // 只在窗口最大化或还原时重新调整画布内容，其他 resize 不处理。
  // 用 fitToContent: true 让内容完整 fit 到新的可视区域，避免从大变小时
  // 只滚动不缩放导致只能看到一部分的问题。
  useEffect(() => {
    const handleWindowStateChange = () => {
      if (windowStateTimerRef.current) {
        clearTimeout(windowStateTimerRef.current)
      }

      windowStateTimerRef.current = setTimeout(() => {
        windowStateTimerRef.current = null

        const api = excalidrawAPIRef.current
        const currentFile = useStore.getState().activeFile
        if (!api || !currentFile || isLoading || !initialLoadCompleteRef.current) return

        try {
          api.scrollToContent(undefined, { fitToContent: true })
        } catch (error) {
          console.error('scrollToContent after window state change failed:', error)
        }
      }, 250)
    }

    let unlistenMaximized: (() => void) | null = null
    let unlistenUnmaximized: (() => void) | null = null

    const setupListeners = async () => {
      unlistenMaximized = await listen('window-maximized', handleWindowStateChange)
      unlistenUnmaximized = await listen('window-unmaximized', handleWindowStateChange)
    }

    setupListeners()

    return () => {
      if (windowStateTimerRef.current) {
        clearTimeout(windowStateTimerRef.current)
        windowStateTimerRef.current = null
      }
      unlistenMaximized?.()
      unlistenUnmaximized?.()
    }
  }, [isLoading])

  // Cleanup debounce timer on unmount or file change.
  // 关键：切换文件前必须把 pending 的 newContent 同步 flush 到 store，
  // 否则紧随其后的 promptSaveIfDirty 会保存到旧的 fileContent，丢失最后一次编辑。
  useEffect(() => {
    return () => {
      // 组件卸载或文件切换时，保存当前所属文件的视图状态。
      const currentPath = activeFile?.path ?? null
      if (currentPath) {
        saveCurrentViewState(currentPath)
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
      const pending = pendingContentRef.current
      if (pending) {
        const freshStore = useStore.getState()
        if (freshStore.activeFile?.path === pending.path) {
          freshStore.setFileContent(pending.content)
        }
        pendingContentRef.current = null
      }
    }
  }, [activeFile?.path, saveCurrentViewState])


  const handleSelectWorkspace = async () => {
    await useStore.getState().selectDirectory()
  }

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-2">
        <div className="text-center max-w-sm px-6">
          {/* Sketchbook with pencil illustration */}
          <div className="mx-auto mb-8" style={{ width: '120px', height: '120px' }}>
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
              {/* Notebook */}
              <rect
                x="20"
                y="15"
                width="65"
                height="85"
                rx="6"
                fill="var(--card)"
                stroke="var(--foreground)"
                strokeWidth="1.5"
                opacity="0.8"
                style={{ transform: 'rotate(-2deg)' }}
              />
              {/* Notebook lines */}
              <line x1="30" y1="35" x2="75" y2="35" stroke="var(--border)" strokeWidth="1" strokeLinecap="round" />
              <line x1="30" y1="47" x2="65" y2="47" stroke="var(--border)" strokeWidth="1" strokeLinecap="round" />
              <line x1="30" y1="59" x2="70" y2="59" stroke="var(--border)" strokeWidth="1" strokeLinecap="round" />
              <line x1="30" y1="71" x2="55" y2="71" stroke="var(--border)" strokeWidth="1" strokeLinecap="round" />
              {/* Pencil */}
              <g style={{ transform: 'rotate(25deg) translate(55px, -30px)' }}>
                <rect x="0" y="0" width="6" height="45" rx="1" fill="var(--primary)" opacity="0.8" />
                <polygon points="0,45 6,45 3,52" fill="var(--foreground)" opacity="0.6" />
                <rect x="0" y="0" width="6" height="8" rx="1" fill="var(--foreground)" opacity="0.3" />
              </g>
              {/* Sparkles */}
              <circle cx="92" cy="28" r="2" fill="var(--primary)" opacity="0.4" />
              <circle cx="100" cy="45" r="1.5" fill="var(--primary)" opacity="0.3" />
              <circle cx="88" cy="55" r="1" fill="var(--primary)" opacity="0.25" />
            </svg>
          </div>

          <h1
            className="text-2xl font-semibold mb-2"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--foreground)',
              fontSize: '2rem',
            }}
          >
            {t.welcomeTitle}
          </h1>
          <p className="text-sm mb-8 text-muted-foreground" style={{ lineHeight: 1.6 }}>
            {t.welcomeDescription}
          </p>

          <Button
            onClick={handleSelectWorkspace}
            size="sm"
            className="inline-flex items-center gap-2 px-6 py-2.5 h-auto rounded-lg text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            {t.selectWorkspace}
          </Button>

          <div className="mt-10 pt-6 border-t border-border">
            <p className="text-[10px] uppercase tracking-wider font-medium mb-3 text-muted-foreground">
              {t.shortcuts}
            </p>
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border">
                  Ctrl+N
                </kbd>
                <span>{t.shortcutNew}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border">
                  Ctrl+S
                </kbd>
                <span>{t.shortcutSave}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border">
                  Ctrl+Z
                </kbd>
                <span>{t.shortcutUndo}</span>
              </div>
            </div>
          </div>
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
            <p className="text-xs text-muted-foreground">{t.loading}</p>
          </div>
        </div>
      )}
      <div className={`h-full ${isLoading ? 'invisible' : 'visible'}`}>
        <Excalidraw
          initialData={initialData}
          theme={effectiveTheme as 'light' | 'dark'}
          langCode={language === 'zh' ? 'zh-CN' : 'en'}
          excalidrawAPI={(api) => {
            const typedApi = api as unknown as ExcalidrawAPI
            excalidrawAPIRef.current = typedApi
            setExcalidrawAPI(typedApi)

            // 显式应用文件保存的视图状态。initialData 传入 zoom/scroll 不可靠，
            // 在 API 就绪后用 updateScene 强制设置更稳。
            const viewState = pendingViewStateRef.current
            if (viewState) {
              waitingViewStateOnChangeRef.current = true
              typedApi.updateScene({ appState: viewState })
              // loading 隐藏交给 updateScene 触发的第一次 onChange 处理，
              // 确保视图状态生效后再展示画布。
              return
            }

            // 没有待恢复的视图状态时，直接走原来的加载完成流程。
            finishInitialLoad()
          }}
          onChange={handleChange}
          onLibraryChange={(items) => {
            // Excalidraw 的 library items 是 readonly 的，转成普通数组持久化。
            const plainItems = JSON.parse(JSON.stringify(items || []))
            if (JSON.stringify(plainItems) !== JSON.stringify(libraryItems)) {
              setLibraryItems(plainItems)
            }
          }}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              saveAsImage: true,
              export: false,
              toggleTheme: false,
              clearCanvas: false,
            },
          }}
        />
      </div>
    </div>
  )
}