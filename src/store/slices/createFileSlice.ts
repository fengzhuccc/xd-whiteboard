import type { StateCreator } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type { AppStore } from '../types'
import type { ExcalidrawFile, FileTreeNode, Preferences } from '../../types'
import { isDescendant } from '../../lib/treeUtils'
import { confirm } from '../../hooks/useConfirmDialog'
import { promptUnsavedChanges } from '../../hooks/useUnsavedDialog'
import { translations } from '../../lib/i18n'
import { FILE_SYSTEM } from '../../constants'

export interface FileSlice {
  currentDirectory: string | null
  files: ExcalidrawFile[]
  fileTree: FileTreeNode[]
  activeFile: ExcalidrawFile | null
  fileContent: string | null

  setCurrentDirectory: (dir: string | null) => void
  setFiles: (files: ExcalidrawFile[]) => void
  setFileTree: (tree: FileTreeNode[]) => void
  setActiveFile: (file: ExcalidrawFile | null) => void
  setFileContent: (content: string | null) => void

  selectDirectory: () => Promise<void>
  loadDirectory: (dir: string) => Promise<void>
  loadFileTree: (dir: string) => Promise<void>
  loadFile: (file: ExcalidrawFile) => Promise<void>
  loadFileFromTree: (node: FileTreeNode) => Promise<void>
  _loadFileInternal: (file: ExcalidrawFile) => Promise<void>
  _handleFileError: (error: unknown, operation: string, fileName?: string) => Promise<void>
  promptSaveIfDirty: (description?: string) => Promise<boolean>
  getNextUntitledName: (directory: string) => Promise<string>
  saveFile: () => Promise<boolean>
  saveCurrentFile: (content?: string) => Promise<void>
  saveFileAs: () => Promise<void>
  createNewFile: (fileName?: string) => Promise<void>
  createNewFileInDirectory: (directory: string, fileName?: string) => Promise<void>
  createFolder: (folderName?: string) => Promise<void>
  createFolderInDirectory: (directory: string, folderName?: string) => Promise<void>
  renameFile: (oldPath: string, newName: string) => Promise<void>
  renameFolder: (oldPath: string, newName: string) => Promise<void>
  deleteFile: (filePath: string) => Promise<boolean>
  deleteFolder: (folderPath: string) => Promise<void>
  moveFile: (sourcePath: string, targetDirectory: string) => Promise<string>
  moveFolder: (sourcePath: string, targetDirectory: string) => Promise<string>
  batchDeleteFiles: (filePaths: string[]) => Promise<boolean>
  markFileAsModified: (filePath: string, modified: boolean) => void
  markTreeNodeAsModified: (filePath: string, modified: boolean) => void
  importImage: () => Promise<string | null>
  exportFile: (content: string, format: string) => Promise<string | null>
  refreshFileTree: () => void
}

let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null

export const createFileSlice: StateCreator<AppStore, [], [], FileSlice> = (set, get) => ({
  currentDirectory: null,
  files: [],
  fileTree: [],
  activeFile: null,
  fileContent: null,

  setCurrentDirectory: (dir) => set({ currentDirectory: dir }),
  setFiles: (files) => set({ files }),
  setFileTree: (tree) => set({ fileTree: tree }),
  setActiveFile: (file) => set({ activeFile: file }),
  setFileContent: (content) => set({ fileContent: content }),

  selectDirectory: async () => {
    const dir = await invoke<string | null>('select_directory')
    if (dir) {
      await get().loadDirectory(dir)
    }
  },

  saveFile: async () => {
    try {
      await get().saveCurrentFile()
      return true
    } catch (error) {
      console.error('Failed to save file:', error)
      return false
    }
  },

  saveFileAs: async () => {
    const state = get()
    const { activeFile, fileContent } = state

    if (!activeFile || !fileContent) {
      return
    }

    set({ saveStatus: 'saving' })

    try {
      const newPath = await invoke<string | null>('save_file_as', {
        content: fileContent,
      })

      if (!newPath) {
        set({ saveStatus: 'idle' })
        return
      }

      const newName = newPath.split(/[\\/]/).pop() || activeFile.name
      const newFile: ExcalidrawFile = {
        name: newName,
        path: newPath,
        modified: false,
      }

      set({
        activeFile: newFile,
        isDirty: false,
        saveStatus: 'saved',
      })

      state.markFileAsModified(activeFile.path, false)
      state.markTreeNodeAsModified(activeFile.path, false)
      state.updateRecentFiles(newFile)

      if (state.currentDirectory && newPath.startsWith(state.currentDirectory)) {
        await state.loadFileTree(state.currentDirectory)
      }

      setTimeout(() => {
        const latest = get()
        if (latest.saveStatus === 'saved') {
          set({ saveStatus: 'idle' })
        }
      }, 2000)
    } catch (error) {
      set({ saveStatus: 'error' })
      await state._handleFileError(error, 'save file as', activeFile.name)
    }
  },

  markFileAsModified: (filePath, modified) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.path === filePath ? { ...f, modified } : f
      ),
    }))
  },

  markTreeNodeAsModified: (filePath, modified) => {
    const updateNode = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.map((node) => {
        if (node.path === filePath) {
          return { ...node, modified }
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) }
        }
        return node
      })
    }

    set((state) => ({
      fileTree: updateNode(state.fileTree),
    }))
  },

  loadDirectory: async (dir) => {
    try {
      const [files, fileTree] = await Promise.all([
        invoke<ExcalidrawFile[]>('list_excalidraw_files', { directory: dir }),
        invoke<FileTreeNode[]>('get_file_tree', { directory: dir }),
      ])

      set({
        currentDirectory: dir,
        files,
        fileTree,
        activeFile: null,
        fileContent: null,
        isDirty: false,
        selectedFiles: [],
        expandedFolders: new Set<string>(),
      })

      const prefs = get().preferences
      const currentRecentDirs = prefs.recentDirectories || []
      const recentDirs = currentRecentDirs.filter((d) => d !== dir)
      recentDirs.unshift(dir)
      if (recentDirs.length > 10) {
        recentDirs.pop()
      }

      const newPrefs: Preferences = {
        ...prefs,
        lastDirectory: dir,
        recentDirectories: recentDirs,
      }

      set({ preferences: newPrefs })
      await get().savePreferences()
      await invoke('watch_directory', { directory: dir })
    } catch (error) {
      console.error('Failed to load directory:', error)
      alert(`Failed to load directory: ${error}`)
    }
  },

  loadFileTree: async (dir) => {
    try {
      const [files, fileTree] = await Promise.all([
        invoke<ExcalidrawFile[]>('list_excalidraw_files', { directory: dir }),
        invoke<FileTreeNode[]>('get_file_tree', { directory: dir }),
      ])
      set({ files, fileTree })
    } catch (error) {
      console.error('Failed to load file tree:', error)
    }
  },

  refreshFileTree: () => {
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer)
    }
    refreshDebounceTimer = setTimeout(() => {
      const dir = get().currentDirectory
      if (dir) {
        get().loadFileTree(dir)
      }
      refreshDebounceTimer = null
    }, 100)
  },

  _handleFileError: async (error, operation, fileName) => {
    console.error(`${operation} failed:`, error)

    const language = get().preferences.language || 'zh'
    const t = translations[language]
    const errorStr = String(error)

    if (errorStr.includes('No such file') || errorStr.includes('not found') || errorStr.includes('does not exist')) {
      await confirm({
        title: t.fileNotFound,
        description: t.fileNotFoundDescription.replace('{name}', fileName || ''),
        confirmLabel: t.ok,
        hideCancel: true,
      })
      const state = get()
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
    } else if (errorStr.includes('file with that name already exists')) {
      await confirm({
        title: t.fileAlreadyExists,
        description: t.fileAlreadyExistsDescription,
        confirmLabel: t.ok,
        hideCancel: true,
      })
    } else if (errorStr.includes('folder with that name already exists')) {
      await confirm({
        title: t.folderAlreadyExists,
        description: t.folderAlreadyExistsDescription,
        confirmLabel: t.ok,
        hideCancel: true,
      })
    } else {
      await confirm({
        title: t.error,
        description: errorStr,
        confirmLabel: t.ok,
        hideCancel: true,
      })
    }
  },

  getNextUntitledName: async (directory) => {
    try {
      const files = await invoke<ExcalidrawFile[]>('list_excalidraw_files', { directory })
      const existingNumbers = new Set<number>()

      for (const file of files) {
        const match = file.name.match(
          new RegExp(`^${FILE_SYSTEM.DEFAULT_FILE_PREFIX}-(\\d+)\\.${FILE_SYSTEM.EXTENSION}$`)
        )
        if (match) {
          existingNumbers.add(parseInt(match[1], 10))
        }
      }

      let nextNumber = 1
      while (existingNumbers.has(nextNumber)) {
        nextNumber++
      }

      return `${FILE_SYSTEM.DEFAULT_FILE_PREFIX}-${nextNumber}.${FILE_SYSTEM.EXTENSION}`
    } catch (error) {
      console.error('Failed to generate next untitled name:', error)
      return `${FILE_SYSTEM.DEFAULT_FILE_PREFIX}-${Date.now()}.${FILE_SYSTEM.EXTENSION}`
    }
  },

  promptSaveIfDirty: async (description) => {
    const state = get()
    if (!state.isDirty || !state.activeFile) return true

    const language = state.preferences.language || 'zh'
    const t = translations[language]

    const result = await promptUnsavedChanges({
      title: t.unsavedChanges,
      description:
        description || t.unsavedChangesDescription.replace('{name}', state.activeFile.name),
      saveLabel: t.save,
      discardLabel: t.dontSave,
      cancelLabel: t.cancel,
    })

    if (result === 'save') {
      await state.saveCurrentFile()
      return true
    }

    if (result === 'discard') {
      state.markFileAsModified(state.activeFile.path, false)
      state.markTreeNodeAsModified(state.activeFile.path, false)
      set({ isDirty: false })
      return true
    }

    return false
  },

  _loadFileInternal: async (file) => {
    const state = get()

    if (state.activeFile?.path === file.path) {
      return
    }

    const previousActiveFile = state.activeFile

    if (state.isDirty && previousActiveFile) {
      const language = get().preferences.language || 'zh'
      const t = translations[language]
      const shouldProceed = await get().promptSaveIfDirty(
        t.unsavedChangesSwitchDescription.replace('{name}', previousActiveFile.name)
      )
      if (!shouldProceed) {
        return
      }
    }

    try {
      const content = await invoke<string>('read_file', {
        filePath: file.path,
      })

      set({
        activeFile: file,
        fileContent: content,
        isDirty: false,
      })

      state.markFileAsModified(file.path, false)
      state.markTreeNodeAsModified(file.path, false)
      state.updateRecentFiles(file)
    } catch (error) {
      await state._handleFileError(error, 'load file', file.name)

      if (state.activeFile?.path === file.path) {
        set({
          activeFile: null,
          fileContent: null,
          isDirty: false,
        })
      }
    }
  },

  loadFile: async (file) => {
    await get()._loadFileInternal(file)
  },

  loadFileFromTree: async (node) => {
    if (node.is_directory) return

    const file: ExcalidrawFile = {
      name: node.name,
      path: node.path,
      modified: node.modified,
    }

    await get()._loadFileInternal(file)
  },

  saveCurrentFile: async (content) => {
    const state = get()
    const { activeFile, fileContent, isDirty } = state

    if (!activeFile) {
      return
    }

    if (!isDirty && !content) {
      return
    }

    const contentToSave = content || fileContent
    if (!contentToSave) {
      return
    }

    try {
      const parsed = JSON.parse(contentToSave)
      if (!parsed || typeof parsed !== 'object') {
        return
      }
      // 注意：清空画布（elements 为空数组）是有效状态，必须允许保存。
      // 旧代码用 `!content && elements.length === 0` 跳过保存，会导致清空后 Ctrl+S 无效。
    } catch (jsonError) {
      return
    }

    set({ saveStatus: 'saving' })

    try {
      await invoke('save_file', {
        filePath: activeFile.path,
        content: contentToSave,
      })

      state.markFileAsModified(activeFile.path, false)
      state.markTreeNodeAsModified(activeFile.path, false)
      set({ isDirty: false, saveStatus: 'saved' })

      setTimeout(() => {
        const latest = get()
        if (latest.saveStatus === 'saved') {
          set({ saveStatus: 'idle' })
        }
      }, 2000)
    } catch (error) {
      set({ saveStatus: 'error' })
      await state._handleFileError(error, 'save file', activeFile.name)
    }
  },

  createNewFile: async (fileName) => {
    let state = get()

    if (state.isDirty && state.activeFile) {
      const language = get().preferences.language || 'zh'
      const t = translations[language]
      const shouldProceed = await state.promptSaveIfDirty(
        t.unsavedChangesNewFileDescription.replace('{name}', state.activeFile.name)
      )
      if (!shouldProceed) {
        return
      }
    }

    state = get()
    let { currentDirectory } = state

    if (!currentDirectory) {
      try {
        const dir = await invoke<string | null>('select_directory')
        if (!dir) {
          return
        }
        await state.loadDirectory(dir)
        currentDirectory = dir
      } catch (error) {
        await state._handleFileError(error, 'select directory')
        return
      }
    }

    const finalFileName = fileName || (await state.getNextUntitledName(currentDirectory))

    try {
      const theme = state.preferences.theme || 'warm-white'
      const filePath = await invoke<string>('create_new_file', {
        directory: currentDirectory,
        fileName: finalFileName,
        theme,
      })

      await state.loadFileTree(currentDirectory)

      const file: ExcalidrawFile = {
        name: finalFileName,
        path: filePath,
        modified: false,
      }

      await state.loadFile(file)
      get().setRenamingNodePath(filePath)
    } catch (error) {
      await state._handleFileError(error, 'create file', finalFileName)
    }
  },

  createNewFileInDirectory: async (directory, fileName) => {
    const state = get()

    if (state.isDirty && state.activeFile) {
      const language = get().preferences.language || 'zh'
      const t = translations[language]
      const shouldProceed = await state.promptSaveIfDirty(
        t.unsavedChangesNewFileDescription.replace('{name}', state.activeFile.name)
      )
      if (!shouldProceed) {
        return
      }
    }

    const finalFileName = fileName || (await state.getNextUntitledName(directory))

    try {
      const theme = state.preferences.theme || 'warm-white'
      const filePath = await invoke<string>('create_new_file', {
        directory,
        fileName: finalFileName,
        theme,
      })

      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }

      // 如果父文件夹处于折叠状态，展开它以便新文件可见并进入重命名。
      state.expandFolder(directory)

      const file: ExcalidrawFile = {
        name: finalFileName,
        path: filePath,
        modified: false,
      }

      await state.loadFile(file)
      get().setRenamingNodePath(filePath)
    } catch (error) {
      await state._handleFileError(error, 'create file', finalFileName)
    }
  },

  createFolder: async (folderName) => {
    const state = get()
    let { currentDirectory } = state

    if (!currentDirectory) {
      try {
        const dir = await invoke<string | null>('select_directory')
        if (!dir) {
          return
        }
        await state.loadDirectory(dir)
        currentDirectory = dir
      } catch (error) {
        await state._handleFileError(error, 'select directory')
        return
      }
    }

    const finalFolderName = folderName || 'New Folder'

    try {
      const newPath = await invoke<string>('create_folder', {
        directory: currentDirectory,
        folderName: finalFolderName,
      })

      await state.loadFileTree(currentDirectory)
      state.expandFolder(newPath)
      get().setRenamingNodePath(newPath)
    } catch (error) {
      await state._handleFileError(error, 'create folder', finalFolderName)
    }
  },

  createFolderInDirectory: async (directory, folderName) => {
    const state = get()
    const finalFolderName = folderName || 'New Folder'

    try {
      const newPath = await invoke<string>('create_folder', {
        directory,
        folderName: finalFolderName,
      })

      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
      // 如果父文件夹处于折叠状态，展开它以便新文件夹可见；
      // 同时展开新文件夹本身，进入重命名编辑状态。
      state.expandFolder(directory)
      state.expandFolder(newPath)
      get().setRenamingNodePath(newPath)
    } catch (error) {
      await state._handleFileError(error, 'create folder', finalFolderName)
    }
  },

  renameFile: async (oldPath, newName) => {
    try {
      const finalName = newName.endsWith('.excalidraw') ? newName : `${newName}.excalidraw`

      const newPath = await invoke<string>('rename_file', {
        oldPath,
        newName: finalName,
      })

      const state = get()

      if (state.activeFile?.path === oldPath) {
        set({
          activeFile: {
            ...state.activeFile,
            name: finalName,
            path: newPath,
          },
        })
      }

      // 延迟迁移视图状态，等 ExcalidrawEditor 卸载 cleanup 把当前状态落到旧路径后再迁移。
      setTimeout(() => {
        state.renameFileViewState(oldPath, newPath)
      }, 0)
      state.refreshFileTree()
    } catch (error) {
      await get()._handleFileError(error, 'rename file')
    }
  },

  renameFolder: async (oldPath, newName) => {
    try {
      const newPath = await invoke<string>('rename_folder', {
        oldPath,
        newName,
      })

      const state = get()
      // 延迟迁移视图状态，等 ExcalidrawEditor 卸载 cleanup 把当前状态落到旧路径后再迁移。
      setTimeout(() => {
        state.renameFolderViewStates(oldPath, newPath)
      }, 0)
      state.refreshFileTree()
    } catch (error) {
      await get()._handleFileError(error, 'rename folder')
    }
  },

  deleteFile: async (filePath) => {
    try {
      await invoke('delete_file', { filePath })

      const state = get()

      if (state.activeFile?.path === filePath) {
        set({
          activeFile: null,
          fileContent: null,
          isDirty: false,
        })
      }

      if (state.selectedFiles.includes(filePath)) {
        set({
          selectedFiles: state.selectedFiles.filter((f) => f !== filePath),
        })
      }

      state.deleteFileViewState(filePath)
      state.refreshFileTree()
      return true
    } catch (error) {
      await get()._handleFileError(error, 'delete file')
      throw error
    }
  },

  batchDeleteFiles: async (filePaths) => {
    if (filePaths.length === 0) return false

    try {
      for (const filePath of filePaths) {
        await invoke('delete_file', { filePath })

        const state = get()
        if (state.activeFile?.path === filePath) {
          set({
            activeFile: null,
            fileContent: null,
            isDirty: false,
          })
        }
        state.deleteFileViewState(filePath)
      }

      set({ selectedFiles: [] })
      get().refreshFileTree()
      return true
    } catch (error) {
      await get()._handleFileError(error, 'delete files')
      return false
    }
  },

  deleteFolder: async (folderPath) => {
    try {
      await invoke('delete_folder', { folderPath })

      const state = get()

      if (state.activeFile && isDescendant(folderPath, state.activeFile.path)) {
        set({
          activeFile: null,
          fileContent: null,
          isDirty: false,
        })
      }

      state.deleteFolderViewStates(folderPath)
      state.refreshFileTree()
    } catch (error) {
      await get()._handleFileError(error, 'delete folder')
    }
  },

  moveFile: async (sourcePath, targetDirectory) => {
    try {
      const newPath = await invoke<string>('move_file', {
        sourcePath,
        targetDirectory,
      })

      const state = get()

      if (state.activeFile?.path === sourcePath) {
        set({
          activeFile: {
            ...state.activeFile,
            path: newPath,
          },
        })
        get().expandFolder(targetDirectory)
      }

      // 延迟迁移视图状态，等 ExcalidrawEditor 卸载 cleanup 把当前状态落到旧路径后再迁移。
      setTimeout(() => {
        state.renameFileViewState(sourcePath, newPath)
      }, 0)
      state.refreshFileTree()
      return newPath
    } catch (error) {
      await get()._handleFileError(error, 'move file')
      throw error
    }
  },

  moveFolder: async (sourcePath, targetDirectory) => {
    try {
      const newPath = await invoke<string>('move_folder', {
        sourcePath,
        targetDirectory,
      })

      const state = get()

      // 用 isDescendant 做带分隔符边界的判断，避免 "/foo" 误匹配 "/foobar"。
      if (state.activeFile && isDescendant(sourcePath, state.activeFile.path)) {
        const relativePath = state.activeFile.path.slice(sourcePath.length).replace(/^[\\/]/, '')
        const sep = newPath.includes('\\') ? '\\' : '/'
        const newActivePath = relativePath ? newPath + sep + relativePath : newPath
        // 仅更新路径，保持 key 变化时不丢失 undo/redo 由 ExcalidrawEditor 内部处理；
        // 这里不主动重挂载。
        set({
          activeFile: {
            ...state.activeFile,
            path: newActivePath,
          },
        })
      }

      // 延迟迁移视图状态，等 ExcalidrawEditor 卸载 cleanup 把当前状态落到旧路径后再迁移。
      setTimeout(() => {
        state.renameFolderViewStates(sourcePath, newPath)
      }, 0)
      state.refreshFileTree()
      return newPath
    } catch (error) {
      await get()._handleFileError(error, 'move folder')
      throw error
    }
  },

  importImage: async () => {
    try {
      const imagePath = await invoke<string | null>('import_image')
      return imagePath
    } catch (error) {
      console.error('Failed to import image:', error)
      alert(`Failed to import image: ${error}`)
      return null
    }
  },

  exportFile: async (content, format) => {
    try {
      const exportPath = await invoke<string | null>('export_file', { content, format })
      return exportPath
    } catch (error) {
      console.error(`Failed to export as ${format}:`, error)
      alert(`Failed to export file: ${error}`)
      return null
    }
  },

})
