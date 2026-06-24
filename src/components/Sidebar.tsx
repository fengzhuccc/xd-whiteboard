import {
  FolderOpen,
  X,
  Trash2,
  ChevronDown,
  FileText,
  Plus,
  Folder,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useStore } from '../store/useStore'
import { TreeView } from './TreeView'
import { invoke } from '@tauri-apps/api/core'
import { confirm } from '../hooks/useConfirmDialog'
import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../hooks/useI18n'

export function Sidebar() {
  const { t } = useI18n()
  const {
    currentDirectory,
    fileTree,
    selectedFiles,
    clearFileSelection,
    batchDeleteFiles,
    createNewFile,
    createFolder,
  } = useStore()

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })

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
    <div className="w-[280px] h-full flex flex-col border-r border-border bg-background">
      <div
        className="p-3 space-y-3 border-b border-border bg-card"
      >
        <div>
          <h1
            className="mb-1"
            style={{
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: '#666',
            }}
          >
            {t.currentWorkspace}
          </h1>
          <div
            className="flex items-center justify-between cursor-pointer p-2 rounded-md hover:bg-accent transition-colors"
            onClick={handleSelectDirectory}
            title={currentDirectory || t.openWorkspace}
          >
            <div className="flex items-center">
              <FolderOpen className="w-4 h-4 mr-2 text-amber-500" />
              <span className="font-medium truncate max-w-[180px]">
                {currentDirectory ? currentDirectory.split(/[\\/]/).pop() : t.myDesignProject}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <>
            <Separator />
            <div className="text-xs text-muted-foreground px-1">
              {t.language === 'zh' ? `已选择: ${selectedFiles.length}` : `Selected: ${selectedFiles.length}`}
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
                {t.language === 'zh' ? '清除' : 'Clear'}
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {fileTree.length === 0 ? (
          <div 
            className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground gap-2"
            onContextMenu={(e) => {
              if (currentDirectory) {
                e.preventDefault()
                e.stopPropagation()
                setMenuPosition({ x: e.clientX, y: e.clientY })
                setMenuOpen(true)
              }
            }}
          >
            <FileText className="w-6 h-6 text-muted-foreground/50" />
            <span>
              {currentDirectory
                ? t.noExcalidrawFilesFound
                : t.noDirectorySelected}
            </span>
          </div>
        ) : (
          <TreeView nodes={fileTree} />
        )}

        {menuOpen && createPortal(
          <div 
            className="fixed inset-0 z-50" 
            onClick={() => setMenuOpen(false)}
            onContextMenu={(e) => { e.preventDefault(); setMenuOpen(false) }}
          >
            <div
              className="fixed z-50 min-w-[160px] bg-popover border border-border rounded-md shadow-md py-1"
              style={{ left: menuPosition.x, top: menuPosition.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="flex items-center w-full px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => { setMenuOpen(false); handleCreateFile() }}
              >
                <Plus className="w-3.5 h-3.5 mr-2" />
                {t.newFile}
              </button>
              <button
                className="flex items-center w-full px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => { setMenuOpen(false); handleCreateFolder() }}
              >
                <Folder className="w-3.5 h-3.5 mr-2" />
                {t.newFolder}
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  )
}
