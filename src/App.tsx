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
import { useConfirmDialog } from './hooks/useConfirmDialog'
import { I18nProvider } from './hooks/useI18n'
import { translations } from './lib/i18n'
import { FileTreeNode } from './types'
import './index.css'

function App() {
  const { loadPreferences, currentDirectory, sidebarVisible, isDirty, saveCurrentFile } = useStore()
  const { confirm, confirmState, handleConfirm, handleCancel, handleOpenChange } = useConfirmDialog()

  useEffect(() => {
    loadPreferences()

    const unsubscribeAutoSave = useStore.getState().__internal_setupAutoSaveListener()

    return () => {
      unsubscribeAutoSave()
    }
  }, [])

  useEffect(() => {
    if (!currentDirectory) return

    // Add debounce to handle rapid file system changes
    let debounceTimer: number | null = null

    const handleFileSystemChange = async () => {
      try {
        const state = useStore.getState()
        await state.loadFileTree(currentDirectory)

        if (state.activeFile) {
          const fileStillExists = state.fileTree.some((node: FileTreeNode) =>
            node.path === state.activeFile?.path ||
            (node.children && node.children.some((child: FileTreeNode) => child.path === state.activeFile?.path))
          )

          if (!fileStillExists) {
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
      // Clear existing debounce timer
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      // Set new debounce timer
      debounceTimer = setTimeout(handleFileSystemChange, 300)
    })

    return () => {
      // Clear debounce timer on cleanup
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      unlisten.then((fn) => fn())
    }
  }, [currentDirectory])

  useEffect(() => {
    const unlisten = listen('check-unsaved-before-close', async () => {
      const language = useStore.getState().preferences.language || 'zh'
      const t = translations[language]
      
      if (isDirty) {
        const shouldSave = await confirm({
          title: t.unsavedChanges,
          description: t.unsavedChangesCloseDescription,
          confirmLabel: t.saveAndClose,
          cancelLabel: t.cancel,
        })

        if (shouldSave) {
          await saveCurrentFile()
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
  }, [isDirty, saveCurrentFile, confirm])

  useKeyboardShortcuts()

  return (
    <I18nProvider>
      <TooltipProvider>
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
        </div>
      </TooltipProvider>
    </I18nProvider>
  )
}

export default App
