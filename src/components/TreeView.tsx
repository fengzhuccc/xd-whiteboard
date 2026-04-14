import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { File, Folder, FolderOpen, ChevronRight, Edit2, Trash2, Plus, FolderPlus, Image } from 'lucide-react'
import { useStore } from '../store/useStore'
import { FileTreeNode } from '../types'
import { invoke } from '@tauri-apps/api/core'
import { confirm } from '../hooks/useConfirmDialog'
import { cn } from '@/lib/utils'
import { getFileCount, flattenTree, findNodeByPath, isDescendant, getParentPath, FlatNode } from '@/lib/treeUtils'
import { useI18n } from '../hooks/useI18n'

interface TreeViewProps {
  nodes: FileTreeNode[]
}

interface TreeNodeRowProps {
  flatNode: FlatNode
  activeFilePath: string | null
  onToggle: (path: string) => void
  expandedFolders: Set<string>
  overFolderId: string | null
  onRename: (path: string, newName: string) => Promise<void>
  onDelete: (node: FileTreeNode) => Promise<void>
  onCreateFile: (directoryPath: string) => Promise<void>
  onCreateFolder: (directoryPath: string) => Promise<void>
  t: ReturnType<typeof useI18n>['t']
}

function TreeNodeRow({ 
  flatNode, 
  activeFilePath, 
  onToggle, 
  expandedFolders, 
  overFolderId,
  onRename,
  onDelete,
  onCreateFile,
  onCreateFolder,
  t,
}: TreeNodeRowProps) {
  const { node, depth } = flatNode
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(
    node.is_directory ? node.name : node.name.replace('.excalidraw', '')
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const renameInputRef = useRef<HTMLInputElement>(null)

  const isDirectory = node.is_directory
  const isModified = node.modified
  const isOpen = expandedFolders.has(node.path)
  const isActive = activeFilePath === node.path
  const isOverFolder = overFolderId === node.path

  const fileCount = isDirectory ? getFileCount(node.children) : 0

  const getFileIcon = () => {
    if (isDirectory) return isOpen ? FolderOpen : Folder
    const name = node.name.toLowerCase()
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.svg')) {
      return Image
    }
    return File
  }

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.path,
    data: {
      node,
      type: isDirectory ? 'folder' : 'file',
    },
  })

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: node.path + '-drop',
    data: {
      node,
      type: isDirectory ? 'folder' : 'file',
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const showDropHighlight = isDirectory && isOverFolder && !isDragging

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  const handleRename = async () => {
    if (!newName.trim()) {
      setNewName(node.is_directory ? node.name : node.name.replace('.excalidraw', ''))
      setIsRenaming(false)
      return
    }

    const finalName = newName.trim()
    const originalName = node.is_directory ? node.name : node.name.replace('.excalidraw', '')
    if (finalName !== originalName) {
      await onRename(node.path, finalName)
    }
    setIsRenaming(false)
  }

  const handleClick = () => {
    if (isDirectory) {
      onToggle(node.path)
    } else {
      useStore.getState().loadFileFromTree(node)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'F2' && !isRenaming) {
      e.preventDefault()
      setIsRenaming(true)
    }
    if (e.key === 'Delete' && !isRenaming) {
      e.preventDefault()
      onDelete(node)
    }
  }

  const Icon = getFileIcon()

  const nodeRef = isDirectory ? (ref: HTMLDivElement) => {
    setSortableRef(ref)
    setDroppableRef(ref)
  } : setSortableRef

  return (
    <div ref={nodeRef} style={style} className={cn(isDragging && 'opacity-0')}>
      <div
        className={cn(
          'group flex items-center gap-2 pr-2 py-1.5 cursor-pointer rounded-lg select-none transition-colors duration-150',
          'hover:bg-accent',
          isActive && 'bg-accent/80',
          isDragging && 'bg-primary/10 ring-1 ring-primary',
          showDropHighlight && 'bg-primary/20 ring-2 ring-primary',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setMenuPosition({ x: e.clientX, y: e.clientY })
          setMenuOpen(true)
        }}
        onKeyDown={handleKeyDown}
        {...attributes}
        {...listeners}
      >
        {isDirectory && (
          <ChevronRight
            className={cn(
              'w-4 h-4 flex-shrink-0 transition-transform',
              !isActive && 'text-muted-foreground',
              isOpen && 'rotate-90',
            )}
          />
        )}
        {!isDirectory && <div className="w-4 flex-shrink-0" />}

        <Icon
          className={cn(
            'w-4 h-4 flex-shrink-0 transition-colors',
            isDirectory && !isActive ? 'text-amber-500' : '',
            !isDirectory && !isActive ? 'text-muted-foreground' : '',
          )}
        />

        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') {
                setNewName(node.is_directory ? node.name : node.name.replace('.excalidraw', ''))
                setIsRenaming(false)
              }
              e.stopPropagation()
            }}
            className="flex-1 px-1 text-sm bg-background border border-ring rounded outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="flex items-center flex-1">
            <span
              className={cn(
                'text-sm truncate',
                isActive && 'font-semibold',
                isModified && 'text-primary',
              )}
            >
              {isDirectory ? node.name : node.name.replace('.excalidraw', '')}
            </span>
            {isModified && !isDirectory && (
              <span className="ml-1 flex-shrink-0 w-2 h-2 bg-red-500 rounded-full animate-pulse" title={t.unsavedChanges} />
            )}
          </div>
        )}

        {isDirectory && fileCount > 0 && (
          <span className="text-xs text-muted-foreground">{fileCount}</span>
        )}
      </div>

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
            <>
              <button
                className="flex items-center w-full px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => { setMenuOpen(false); onCreateFile(isDirectory ? node.path : getParentPath(node.path) || '') }}
              >
                <Plus className="w-3.5 h-3.5 mr-2" />
                {t.newFileContext}
              </button>
              <button
                className="flex items-center w-full px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => { setMenuOpen(false); onCreateFolder(isDirectory ? node.path : getParentPath(node.path) || '') }}
              >
                <FolderPlus className="w-3.5 h-3.5 mr-2" />
                {t.newFolderContext}
              </button>
              <div className="my-1 h-px bg-border" />
            </>
            <button
              className="flex items-center w-full px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => { setMenuOpen(false); setIsRenaming(true) }}
            >
              <Edit2 className="w-3.5 h-3.5 mr-2" />
              {t.renameContext}
              <span className="ml-auto text-xs text-muted-foreground">F2</span>
            </button>
            <button
              className="flex items-center w-full px-3 py-1.5 text-sm text-destructive hover:bg-accent hover:text-destructive"
              onClick={() => { setMenuOpen(false); onDelete(node) }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              {t.deleteContext}
              <span className="ml-auto text-xs text-muted-foreground">Del</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function DragOverlayContent({ node }: { node: FileTreeNode | null }) {
  if (!node) return null
  const isDirectory = node.is_directory
  const Icon = isDirectory ? Folder : File

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-popover border rounded-md shadow-lg">
      <Icon className={cn('w-4 h-4', isDirectory ? 'text-amber-500' : 'text-muted-foreground')} />
      <span className="text-sm">
        {isDirectory ? node.name : node.name.replace('.excalidraw', '')}
      </span>
    </div>
  )
}

export function TreeView({ nodes }: TreeViewProps) {
  const { t } = useI18n()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overFolderId, setOverFolderId] = useState<string | null>(null)
  const { moveFile, moveFolder, loadFileTree, activeFile, renameFile, renameFolder, deleteFile, deleteFolder, setActiveFile, expandedFolders, toggleFolderExpand } = useStore()

  const flatNodes = useMemo(() => flattenTree(nodes, 0, expandedFolders), [nodes, expandedFolders])
  const allPaths = useMemo(() => flatNodes.map((n) => n.node.path), [flatNodes])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
      mouseButton: 0,
    }),
  )

  const handleToggle = useCallback((path: string) => {
    toggleFolderExpand(path)
  }, [toggleFolderExpand])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overIdRaw = event.over?.id as string | undefined
    if (!overIdRaw) {
      setOverFolderId(null)
      return
    }

    const allNodes = flattenTree(nodes, 0, expandedFolders)
    const activeNode = allNodes.find((n) => n.node.path === event.active.id)?.node
    if (!activeNode) return

    let targetFolderId: string | null = null

    const isValidTarget = (targetPath: string): boolean => {
      if (targetPath === activeNode.path) return false
      if (activeNode.is_directory && isDescendant(targetPath, activeNode.path)) return false
      return true
    }

    if (overIdRaw.endsWith('-drop')) {
      const folderPath = overIdRaw.replace('-drop', '')
      const overNode = allNodes.find((n) => n.node.path === folderPath)?.node
      if (overNode?.is_directory && isValidTarget(folderPath)) {
        targetFolderId = folderPath
      }
    } else {
      const overNode = allNodes.find((n) => n.node.path === overIdRaw)?.node
      if (overNode) {
        if (overNode.is_directory) {
          if (isValidTarget(overNode.path)) {
            targetFolderId = overNode.path
          }
        } else {
          const parentPath = getParentPath(overNode.path)
          if (parentPath && isValidTarget(parentPath)) {
            targetFolderId = parentPath
          }
        }
      }
    }

    setOverFolderId(targetFolderId)
  }, [nodes, expandedFolders])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      setOverFolderId(null)

      if (!over || active.id === over.id) return

      const allNodes = flattenTree(nodes, 0, expandedFolders)
      const activeNode = allNodes.find((n) => n.node.path === active.id)?.node
      if (!activeNode) return

      let targetDir: string | null = null
      const overIdRaw = over.id as string

      const isValidTarget = (targetPath: string): boolean => {
        if (targetPath === activeNode.path) return false
        if (activeNode.is_directory && isDescendant(targetPath, activeNode.path)) return false
        return true
      }

      if (overIdRaw.endsWith('-drop')) {
        const folderPath = overIdRaw.replace('-drop', '')
        if (isValidTarget(folderPath)) {
          targetDir = folderPath
        }
      } else {
        const overNode = allNodes.find((n) => n.node.path === overIdRaw)?.node
        if (overNode) {
          if (overNode.is_directory) {
            if (isValidTarget(overNode.path)) {
              targetDir = overNode.path
            }
          } else {
            const parentPath = getParentPath(overNode.path)
            if (parentPath && isValidTarget(parentPath)) {
              targetDir = parentPath
            }
          }
        }
      }

      if (!targetDir) return

      const sourceParentPath = getParentPath(activeNode.path)
      if (sourceParentPath === targetDir) return

      const state = useStore.getState()
      const hasUnsavedChanges = state.activeFile && state.isDirty
      const isMovingActiveFile = !activeNode.is_directory && state.activeFile?.path === activeNode.path
      const isMovingFolderWithActiveFile = activeNode.is_directory && state.activeFile?.path.startsWith(activeNode.path)

      if (hasUnsavedChanges && (isMovingActiveFile || isMovingFolderWithActiveFile)) {
        const fileName = state.activeFile!.name
        const response = await confirm({
          title: t.unsavedChanges,
          description: t.unsavedChangesDescription.replace('{name}', fileName),
          confirmLabel: t.saveAndMove,
          cancelLabel: t.dontSave,
        })

        if (response) {
          await state.saveCurrentFile()
        } else {
          state.markFileAsModified(state.activeFile!.path, false)
          state.markTreeNodeAsModified(state.activeFile!.path, false)
          useStore.setState({ isDirty: false })
        }
      }

      try {
        if (activeNode.is_directory) {
          await moveFolder(activeNode.path, targetDir)
        } else {
          await moveFile(activeNode.path, targetDir)
        }
      } catch (error) {
        console.error('Failed to move:', error)
      }
    },
    [nodes, expandedFolders, moveFile, moveFolder, t],
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setOverFolderId(null)
  }, [])

  const handleRename = useCallback(async (path: string, newName: string) => {
    const node = findNodeByPath(nodes, path)
    if (!node) return
    
    if (node.is_directory) {
      await renameFolder(path, newName)
    } else {
      await renameFile(path, newName + '.excalidraw')
    }
  }, [nodes, renameFile, renameFolder])

  const handleDelete = useCallback(async (node: FileTreeNode) => {
    const fileName = node.is_directory ? node.name : node.name.replace('.excalidraw', '')
    const confirmed = await confirm({
      title: t.confirmDelete,
      description: t.confirmDeleteDescription.replace('{name}', fileName),
      confirmLabel: t.deleteConfirm,
      cancelLabel: t.cancel,
      variant: 'destructive',
    })
    if (confirmed) {
      if (node.is_directory) {
        await deleteFolder(node.path)
      } else {
        await deleteFile(node.path)
      }
    }
  }, [t, deleteFile, deleteFolder])

  const handleCreateFile = useCallback(async (directoryPath: string) => {
    try {
      const currentDir = useStore.getState().currentDirectory
      if (!currentDir) return

      const newFileName = `Untitled-${Date.now()}.excalidraw`
      const createdPath = await invoke<string>('create_new_file', {
        directory: directoryPath,
        fileName: newFileName,
      })

      if (loadFileTree && currentDir) {
        await loadFileTree(currentDir)
      }

      setActiveFile({
        path: createdPath,
        name: newFileName.replace('.excalidraw', ''),
        modified: true,
      })
    } catch (error) {
      console.error('Failed to create file:', error)
    }
  }, [loadFileTree, setActiveFile])

  const handleCreateFolder = useCallback(async (directoryPath: string) => {
    try {
      const currentDir = useStore.getState().currentDirectory
      if (!currentDir) return

      const folderName = `New Folder`
      await invoke('create_folder', {
        directory: directoryPath,
        folderName,
      })

      if (loadFileTree && currentDir) {
        await loadFileTree(currentDir)
      }
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }, [loadFileTree])

  const activeNode = useMemo(() => {
    if (!activeId) return null
    return findNodeByPath(nodes, activeId)
  }, [activeId, nodes])

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        No .excalidraw files found
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={allPaths} strategy={verticalListSortingStrategy}>
        <div className="py-1">
          {flatNodes.map((flatNode) => (
            <TreeNodeRow
              key={flatNode.node.path}
              flatNode={flatNode}
              activeFilePath={activeFile?.path || null}
              onToggle={handleToggle}
              expandedFolders={expandedFolders}
              overFolderId={overFolderId}
              onRename={handleRename}
              onDelete={handleDelete}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              t={t}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeId ? <DragOverlayContent node={activeNode} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
