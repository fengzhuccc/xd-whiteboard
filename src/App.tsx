import { useEffect, lazy, Suspense } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { Sidebar } from './components/Sidebar'
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
import { PreferencesDialog } from './components/PreferencesDialog'
import { ExcalidrawAPIProvider } from './context/ExcalidrawAPIContext'
import { translations } from './lib/i18n'
import { findNodeByPath } from './lib/treeUtils'
import { confirm, resetConfirmState, type ConfirmOptions } from './hooks/useConfirmDialog'
import './index.css'

// 懒加载 ExcalidrawEditor（内部含 Excalidraw 重型依赖），
// 让 exe 启动时不阻塞首屏，点开文件时才加载该 chunk。
const ExcalidrawEditor = lazy(() =>
  import('./components/ExcalidrawEditor').then((m) => ({ default: m.ExcalidrawEditor }))
)


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
    let closing = false
    const unlistenPromise = listen('check-unsaved-before-close', async () => {
      if (closing) return
      closing = true

      try {
        const store = useStore.getState()
        const language = store.preferences.language || 'zh'
        const t = translations[language]

        // 先把待写内容（最后一次编辑）和视图状态同步到 store，
        // 否则下面的 isDirty 检查和 saveCurrentFile 可能读到旧 fileContent。
        try {
          store.flushEditorChanges?.()
        } catch (flushError) {
          console.error('flushEditorChanges failed:', flushError)
        }

        // flush 后重新读取 isDirty，确保拿到最新状态。
        const isDirty = useStore.getState().isDirty

        if (isDirty) {
          // 清理可能残留的旧对话框状态（globalCurrent.open 卡在 true 等），
          // 否则 confirm() 会把新请求入队且 Promise 永不 resolve。
          resetConfirmState()

          // 带超时的 confirm：若对话框因某种原因未弹出/未响应，
          // 10 秒后自动放行关闭，避免用户被永久卡住。
          const confirmWithTimeout = (options: ConfirmOptions) =>
            Promise.race([
              confirm(options),
              new Promise<boolean>((resolve) =>
                setTimeout(() => {
                  console.warn('[close] confirm timeout, force closing')
                  resolve(false)
                }, 10000)
              ),
            ])

          const shouldSave = await confirmWithTimeout({
            title: t.unsavedChanges,
            description: t.unsavedChangesCloseDescription,
            confirmLabel: t.saveAndClose,
            cancelLabel: t.cancel,
          })

          if (shouldSave) {
            await useStore.getState().saveCurrentFile()
            await invoke('force_close_app')
          } else {
            const reallyClose = await confirmWithTimeout({
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
      } catch (error) {
        console.error('check-unsaved-before-close handler failed:', error)
        // 出错时不阻断关闭，直接退出，避免用户被卡住关不了应用。
        await invoke('force_close_app')
      } finally {
        closing = false
      }
    })

    return () => {
      unlistenPromise.then((fn) => fn())
    }
  }, [])

  useKeyboardShortcuts()
  useMenuHandler()

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <AppMenuBar />
      <div className="flex-1 flex overflow-hidden">
        {sidebarVisible && <Sidebar />}
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center bg-background">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-solid border-primary border-r-transparent"></div>
              </div>
            </div>
          }
        >
          <ExcalidrawEditor />
        </Suspense>
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
      <PreferencesDialog />
    </div>
  )
}

export default App
