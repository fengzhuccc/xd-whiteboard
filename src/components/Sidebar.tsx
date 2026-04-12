import {
  FolderOpen,
  X,
  Trash2,
  ChevronDown,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useStore } from '../store/useStore'
import { TreeView } from './TreeView'
import { invoke } from '@tauri-apps/api/core'
import { confirm } from '../hooks/useConfirmDialog'
import { useI18n } from '../hooks/useI18n'

export function Sidebar() {
  const { t } = useI18n()
  const {
    currentDirectory,
    fileTree,
    selectedFiles,
    clearFileSelection,
    batchDeleteFiles,
  } = useStore()

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
          <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground gap-2">
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
      </div>
    </div>
  )
}
