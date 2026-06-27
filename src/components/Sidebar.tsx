import {
  X,
  Trash2,
  ChevronDown,
  Plus,
  Folder,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useStore } from '../store/useStore'
import { TreeView } from './TreeView'
import { invoke } from '@tauri-apps/api/core'
import { confirm } from '../hooks/useConfirmDialog'
import { useCallback } from 'react'
import { useI18n } from '../hooks/useI18n'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

export function Sidebar() {
  const { t } = useI18n()
  const currentDirectory = useStore((s) => s.currentDirectory)
  const fileTree = useStore((s) => s.fileTree)
  const selectedFiles = useStore((s) => s.selectedFiles)
  const clearFileSelection = useStore((s) => s.clearFileSelection)
  const batchDeleteFiles = useStore((s) => s.batchDeleteFiles)
  const createNewFile = useStore((s) => s.createNewFile)
  const createFolder = useStore((s) => s.createFolder)

  const handleSelectDirectory = async () => {
    const dir = await invoke<string | null>('select_directory', { currentDir: currentDirectory })
    if (dir) {
      await useStore.getState().loadDirectory(dir)
    }
  }

  const handleBatchDelete = async () => {
    if (selectedFiles.length === 0) return
    try {
      const confirmed = await confirm({
        title: t.confirmDelete,
        description: t.confirmDeleteDescription.replace('{name}', `${selectedFiles.length} ${t.files}`),
        confirmLabel: t.deleteConfirm,
        cancelLabel: t.cancel,
        variant: 'destructive',
      })
      if (confirmed) {
        await batchDeleteFiles(selectedFiles)
      }
    } catch (error) {
      console.error('Failed to delete files:', error)
    }
  }

  const handleCreateFile = useCallback(async () => {
    try {
      await createNewFile()
    } catch (error) {
      console.error('Failed to create file:', error)
    }
  }, [createNewFile])

  const handleCreateFolder = useCallback(async () => {
    try {
      await createFolder()
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }, [createFolder])

  return (
    <div className="w-[280px] h-full flex flex-col shrink-0 bg-surface-1 border-r border-border relative">
      {/* Hand-drawn left border decoration */}
      <div
        className="pointer-events-none absolute z-10"
        style={{ left: '280px', top: '40px', bottom: 0, width: '3px' }}
      >
        <svg
          width="3"
          height="100%"
          viewBox="0 0 3 600"
          preserveAspectRatio="none"
          style={{ opacity: 0.12 }}
        >
          <path
            d="M1.5,0 C0.5,50 2.5,100 1,150 C0,200 2.5,250 1.5,300 C0.5,350 2,400 1,450 C2,500 0.5,550 1.5,600"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Workspace selector */}
      <div
        className="px-3 py-2.5 flex items-center gap-2 border-b border-border cursor-pointer hover:bg-surface-2 transition-colors"
        onClick={handleSelectDirectory}
        title={currentDirectory || t.openWorkspace}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={currentDirectory ? 'var(--primary)' : 'var(--muted-foreground)'}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: 'rotate(-2deg)', flexShrink: 0 }}
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-xs truncate flex-1 text-muted-foreground">
          {currentDirectory
            ? currentDirectory.split(/[\\/]/).pop()
            : t.noDirectorySelected}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      </div>

      {/* File tree header */}
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {t.files}
        </span>
        <div className="flex items-center gap-1">
          <button
            className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:bg-surface-2 transition-colors"
            aria-label={t.newFile}
            title={t.newFile}
            onClick={handleCreateFile}
            disabled={!currentDirectory}
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:bg-surface-2 transition-colors"
            aria-label={t.newFolder}
            title={t.newFolder}
            onClick={handleCreateFolder}
            disabled={!currentDirectory}
          >
            <Folder className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Selection bar */}
      {selectedFiles.length > 0 && (
        <div className="mx-3 mb-2 p-2 space-y-2 rounded-lg bg-surface-2 border border-border">
          <div className="text-[11px] text-muted-foreground px-1">
            {`${t.selected}: ${selectedFiles.length}`}
          </div>
          <div className="flex gap-1">
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={handleBatchDelete}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {t.delete}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={clearFileSelection}
            >
              <X className="w-3 h-3 mr-1" />
              {t.clear}
            </Button>
          </div>
        </div>
      )}

      <Separator className="bg-border" />

      <div className="flex-1 overflow-y-auto custom-scrollbar px-1.5 pb-3">
        {fileTree.length === 0 ? (
          currentDirectory ? (
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="flex flex-col items-center justify-center h-40 text-xs text-muted-foreground gap-2 cursor-context-menu px-6 text-center">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: 'rotate(-2deg)' }}
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{t.noExcalidrawFilesFound}</span>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={handleCreateFile}>
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  {t.newFile}
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCreateFolder}>
                  <Folder className="w-3.5 h-3.5 mr-2" />
                  {t.newFolder}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-xs text-muted-foreground gap-2 px-6 text-center">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--border)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: 'rotate(-2deg)' }}
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>{t.selectWorkspaceHint}</span>
            </div>
          )
        ) : (
          <TreeView nodes={fileTree} />
        )}
      </div>
    </div>
  )
}
