import { useState, useRef, useCallback, useEffect, useMemo, useLayoutEffect } from 'react'
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
  useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronRight,
  Edit2,
  Trash2,
  Plus,
  FolderPlus,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useStore } from '../store/useStore'
import { FileTreeNode } from '../types'
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
  renamingNodePath: string | null
  onRenameFinish: () => void
  t: ReturnType<typeof useI18n>['t']
}

function SketchyFolderIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      className={className}
      style={style}
    >
      <path d="M3 7V17C3 17.5523 3.44772 18 4 18H20C20.5523 18 21 17.5523 21 17V9C21 8.44772 20.5523 8 20 8H12L10 6H4C3.44772 6 3 6.44772 3 7Z" />
    </svg>
  )
}

function SketchyFileIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function SketchyImageIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
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
  renamingNodePath,
  onRenameFinish,
  t,
}: TreeNodeRowProps) {
  const { node, depth } = flatNode
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(
    node.is_directory ? node.name : node.name.replace('.excalidraw', '')
  )
  const renameInputRef = useRef<HTMLInputElement>(null)

  const isDirectory = node.is_directory
  const isModified = node.modified
  const isOpen = expandedFolders.has(node.path)
  const isActive = activeFilePath === node.path
  const isOverFolder = overFolderId === node.path

  const fileCount = isDirectory ? getFileCount(node.children) : 0

  const focusAndSelectInput = useCallback(() => {
    const input = renameInputRef.current
    if (!input) return
    input.focus()
    // 延迟 select 确保 focus 已经生效
    requestAnimationFrame(() => {
      input.select()
    })
  }, [])

  const setRenameInputRef = useCallback(
    (el: HTMLInputElement | null) => {
      renameInputRef.current = el
      if (el && isRenaming) {
        focusAndSelectInput()
      }
    },
    [isRenaming, focusAndSelectInput]
  )

  const getFileIcon = () => {
    if (isDirectory) return null
    const name = node.name.toLowerCase()
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.svg')) {
      return 'image'
    }
    return 'file'
  }

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: node.path,
    data: {
      node,
      type: isDirectory ? 'folder' : 'file',
    },
    disabled: isRenaming,
  })

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: node.path + '-drop',
    data: {
      node,
      type: isDirectory ? 'folder' : 'file',
    },
    disabled: isRenaming,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
  }

  const showDropHighlight = isDirectory && isOverFolder && !isDragging

  useLayoutEffect(() => {
    if (isRenaming) {
      focusAndSelectInput()
    }
  }, [isRenaming, focusAndSelectInput])

  // 新建节点时自动进入重命名编辑状态。
  useEffect(() => {
    if (renamingNodePath === node.path) {
      setIsRenaming(true)
      setNewName(node.is_directory ? node.name : node.name.replace('.excalidraw', ''))
      // 如果 input 已经挂载则立即聚焦（否则由 callback ref 处理）。
      focusAndSelectInput()
    }
  }, [renamingNodePath, node.path, node.is_directory, node.name, focusAndSelectInput])

  const handleRename = async () => {
    if (!newName.trim()) {
      setNewName(node.is_directory ? node.name : node.name.replace('.excalidraw', ''))
      setIsRenaming(false)
      onRenameFinish()
      return
    }

    const finalName = newName.trim()
    const originalName = node.is_directory ? node.name : node.name.replace('.excalidraw', '')
    if (finalName !== originalName) {
      await onRename(node.path, finalName)
    }
    setIsRenaming(false)
    onRenameFinish()
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

  const fileIconType = getFileIcon()

  const nodeRef = isDirectory ? (ref: HTMLDivElement) => {
    setDraggableRef(ref)
    setDroppableRef(ref)
  } : setDraggableRef

  const menuTargetDirectory = isDirectory ? node.path : getParentPath(node.path) || ''

  return (
    <div ref={nodeRef} style={style} className={cn(isDragging && 'opacity-0')}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'group flex items-center gap-2 pr-2 py-1 cursor-pointer rounded-md select-none transition-colors duration-150',
              'hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              isActive && 'bg-muted',
              isDragging && 'bg-primary/10 ring-1 ring-primary',
              showDropHighlight && 'bg-primary/20 ring-2 ring-primary',
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            {...attributes}
            {...listeners}
          >
            {isDirectory && (
              <ChevronRight
                className={cn(
                  'w-3 h-3 flex-shrink-0 transition-transform text-muted-foreground',
                  isOpen && 'rotate-90',
                )}
              />
            )}
            {!isDirectory && <div className="w-3 flex-shrink-0" />}

            {isDirectory ? (
              <SketchyFolderIcon
                className="w-3.5 h-3.5 flex-shrink-0 text-primary"
                style={{ opacity: 0.7, transform: `rotate(${isOpen ? -1 : 0.5}deg)` }}
              />
            ) : fileIconType === 'image' ? (
              <SketchyImageIcon
                className={cn(
                  'w-3.5 h-3.5 flex-shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                style={{ transform: 'rotate(-0.5deg)' }}
              />
            ) : (
              <SketchyFileIcon
                className={cn(
                  'w-3.5 h-3.5 flex-shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                style={{ transform: 'rotate(-0.5deg)' }}
              />
            )}

            {isRenaming ? (
              <input
                ref={setRenameInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') {
                    setNewName(node.is_directory ? node.name : node.name.replace('.excalidraw', ''))
                    setIsRenaming(false)
                    onRenameFinish()
                  }
                  e.stopPropagation()
                }}
                className="flex-1 px-1 text-sm bg-surface-1 border border-ring rounded outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="flex items-center flex-1 min-w-0">
                <span
                  className={cn(
                    'text-sm truncate',
                    isActive && 'font-medium',
                    isModified && 'text-primary',
                  )}
                >
                  {isDirectory ? node.name : node.name.replace('.excalidraw', '')}
                </span>
                {isModified && !isDirectory && (
                  <span
                    className="ml-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-state-error"
                    title={t.unsavedChanges}
                  />
                )}
              </div>
            )}

            {isDirectory && fileCount > 0 && (
              <span className="text-xs text-muted-foreground">{fileCount}</span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <ContextMenuItem onClick={() => onCreateFile(menuTargetDirectory)}>
            <Plus className="w-3.5 h-3.5 mr-2" />
            {t.newFileContext}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCreateFolder(menuTargetDirectory)}>
            <FolderPlus className="w-3.5 h-3.5 mr-2" />
            {t.newFolderContext}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setIsRenaming(true)}>
            <Edit2 className="w-3.5 h-3.5 mr-2" />
            {t.renameContext}
            <span className="ml-auto text-xs text-muted-foreground">F2</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onDelete(node)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            {t.deleteContext}
            <span className="ml-auto text-xs text-muted-foreground">Del</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}

function DragOverlayContent({ node }: { node: FileTreeNode | null }) {
  if (!node) return null
  const isDirectory = node.is_directory

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-card border border-border rounded-md shadow-float">
      {isDirectory ? (
        <SketchyFolderIcon
          className="w-3.5 h-3.5 text-primary"
          style={{ opacity: 0.7, transform: 'rotate(-1deg)' }}
        />
      ) : (
        <SketchyFileIcon
          className="w-3.5 h-3.5 text-muted-foreground"
          style={{ transform: 'rotate(-0.5deg)' }}
        />
      )}
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
  const moveFile = useStore((s) => s.moveFile)
  const moveFolder = useStore((s) => s.moveFolder)
  const activeFile = useStore((s) => s.activeFile)
  const renameFile = useStore((s) => s.renameFile)
  const renameFolder = useStore((s) => s.renameFolder)
  const deleteFile = useStore((s) => s.deleteFile)
  const deleteFolder = useStore((s) => s.deleteFolder)
  const createNewFileInDirectory = useStore((s) => s.createNewFileInDirectory)
  const createFolderInDirectory = useStore((s) => s.createFolderInDirectory)
  const expandedFolders = useStore((s) => s.expandedFolders)
  const toggleFolderExpand = useStore((s) => s.toggleFolderExpand)
  const renamingNodePath = useStore((s) => s.renamingNodePath)
  const setRenamingNodePath = useStore((s) => s.setRenamingNodePath)

  const flatNodes = useMemo(() => flattenTree(nodes, 0, expandedFolders), [nodes, expandedFolders])

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
        const shouldProceed = await state.promptSaveIfDirty(
          t.unsavedChangesDescription.replace('{name}', state.activeFile!.name)
        )
        if (!shouldProceed) {
          return
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
      await createNewFileInDirectory(directoryPath)
    } catch (error) {
      console.error('Failed to create file:', error)
    }
  }, [createNewFileInDirectory])

  const handleCreateFolder = useCallback(async (directoryPath: string) => {
    try {
      await createFolderInDirectory(directoryPath)
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }, [createFolderInDirectory])

  const handleRenameFinish = useCallback(() => {
    setRenamingNodePath(null)
  }, [setRenamingNodePath])

  const activeNode = useMemo(() => {
    if (!activeId) return null
    return findNodeByPath(nodes, activeId)
  }, [activeId, nodes])

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
      {t.noExcalidrawFilesFound}
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
      <div className="space-y-px">
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
            renamingNodePath={renamingNodePath}
            onRenameFinish={handleRenameFinish}
            t={t}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeId ? <DragOverlayContent node={activeNode} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
