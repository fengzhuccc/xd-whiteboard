import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { Sidebar } from './components/Sidebar'
import { ExcalidrawEditor } from './components/ExcalidrawEditor'
import { AppMenuBar } from './components/AppMenuBar'
import { ConfirmDialog } from './components/ConfirmDialog'
import { TooltipProvider } from './components/ui/tooltip'
import { useStore } from './store/useStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useMenuHandler } from './hooks/useMenuHandler'
import { useConfirmDialog } from './hooks/useConfirmDialog'
import { useUnsavedDialog } from './hooks/useUnsavedDialog'
import { I18nProvider } from './hooks/useI18n'
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog'
import { ExcalidrawAPIProvider } from './context/ExcalidrawAPIContext'
import { translations } from './lib/i18n'
import { findNodeByPath } from './lib/treeUtils'
import { confirm } from './hooks/useConfirmDialog'
import './index.css'


function App() {
  // App 只负责挂载顶层 Provider。
  // 关键：useMenuHandler 内部会调用 useExcalidrawActions → useExcalidrawAPI，
  // 必须在 ExcalidrawAPIProvider 内部执行，否则 context 为 null 会抛
  // "useExcalidrawAPI must be used within ExcalidrawAPIProvider"。
  // 因此所有需要 context 的逻辑都放进被 Provider 包裹的 AppShell。
  return (
    <I18nProvider>
      <TooltipProvider>
        <ExcalidrawAPIProvider>
          <AppShell />
        </ExcalidrawAPIProvider>
      </TooltipProvider>
    </I18nProvider>
  )
}

function AppShell() {
  // 用 selector 订阅，避免 fileContent 每 100ms 更新触发 App 全量重渲染。
  const loadPreferences = useStore((s) => s.loadPreferences)
  const currentDirectory = useStore((s) => s.currentDirectory)
  const sidebarVisible = useStore((s) => s.sidebarVisible)
  const { confirmState, handleConfirm, handleCancel, handleOpenChange } = useConfirmDialog()
  const { state: unsavedState, closeDialog: closeUnsavedDialog, handleOpenChange: handleUnsavedOpenChange } = useUnsavedDialog()

  useEffect(() => {
    loadPreferences()

    const unsubscribeAutoSave = useStore.subscribe((state, prevState) => {
      if (
        state.isDirty !== prevState.isDirty ||
        state.activeFile !== prevState.activeFile ||
        state.fileContent !== prevState.fileContent ||
        state.preferences.autoSaveEnabled !== prevState.preferences.autoSaveEnabled ||
        state.preferences.autoSaveInterval !== prevState.preferences.autoSaveInterval
      ) {
        state.setupAutoSave()
      }
    })

    return () => {
      unsubscribeAutoSave()
    }
  }, [loadPreferences])

  useEffect(() => {
    if (!currentDirectory) return

    // Add debounce to handle rapid file system changes
    let debounceTimer: number | null = null

    const handleFileSystemChange = async () => {
      try {
        const state = useStore.getState()
        await state.loadFileTree(currentDirectory)

        if (state.activeFile) {
          const fileStillExists = !!findNodeByPath(state.fileTree, state.activeFile.path)

          if (!fileStillExists) {
            // 外部删除/移动了当前文件：若有未保存改动，先提示用户。
            if (state.isDirty) {
              const language = state.preferences.language || 'zh'
              const t = translations[language]
              const shouldKeep = await confirm({
                title: t.fileNotFound,
                description: t.fileNotFoundDescription.replace('{name}', state.activeFile.name),
                confirmLabel: t.ok,
                hideCancel: true,
              })
              if (!shouldKeep) return
            }
            state.setActiveFile(null)
            state.setFileContent(null)
            state.setIsDirty(false)
          }
        }
      } catch (error) {
        console.error('Error handling file system change:', error)
      }
    }

    const unlisten = listen('file-system-change', () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(handleFileSystemChange, 300)
    })

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      unlisten.then((fn) => fn())
    }
  }, [currentDirectory])

  // 关闭前未保存提示：监听只订阅一次，内部用 useStore.getState() 读最新 isDirty，
  // 避免每次 isDirty 翻转都重新 unlisten/re-listen。
  useEffect(() => {
    const unlisten = listen('check-unsaved-before-close', async () => {
      const store = useStore.getState()
      const language = store.preferences.language || 'zh'
      const t = translations[language]

      if (store.isDirty) {
        const shouldSave = await confirm({
          title: t.unsavedChanges,
          description: t.unsavedChangesCloseDescription,
          confirmLabel: t.saveAndClose,
          cancelLabel: t.cancel,
        })

        if (shouldSave) {
          await store.saveCurrentFile()
          await invoke('force_close_app')
        } else {
          const reallyClose = await confirm({
            title: t.confirmClose,
            description: t.confirmCloseDescription,
            confirmLabel: t.closeWithoutSaving,
            cancelLabel: t.cancel,
            variant: 'destructive',
          })

          if (reallyClose) {
            await invoke('force_close_app')
          }
        }
      } else {
        await invoke('force_close_app')
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  useKeyboardShortcuts()
  useMenuHandler()

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <AppMenuBar />
      <div className="flex-1 flex overflow-hidden">
        {sidebarVisible && <Sidebar />}
        <ExcalidrawEditor />
      </div>
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={handleOpenChange}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        variant={confirmState.variant}
        hideCancel={confirmState.hideCancel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
      <UnsavedChangesDialog
        state={unsavedState}
        onOpenChange={handleUnsavedOpenChange}
        onSave={() => closeUnsavedDialog('save')}
        onDiscard={() => closeUnsavedDialog('discard')}
        onCancel={() => closeUnsavedDialog('cancel')}
      />
    </div>
  )
}

export default App
