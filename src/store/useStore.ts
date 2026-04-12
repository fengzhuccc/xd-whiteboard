import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { ExcalidrawFile, FileTreeNode, Preferences } from '../types'
import { convertPreferencesFromRust, convertPreferencesToRust } from '../lib/preferences'
import { confirm } from '../hooks/useConfirmDialog'
import { translations } from '../lib/i18n'

interface AppStore {
  // State
  currentDirectory: string | null
  files: ExcalidrawFile[]
  fileTree: FileTreeNode[]
  activeFile: ExcalidrawFile | null
  fileContent: string | null
  preferences: Preferences
  sidebarVisible: boolean
  isDirty: boolean
  selectedFiles: string[]
  autoSaveTimer: ReturnType<typeof setTimeout> | null
  expandedFolders: Set<string>

  // Actions
  setCurrentDirectory: (dir: string | null) => void
  setFiles: (files: ExcalidrawFile[]) => void
  setFileTree: (tree: FileTreeNode[]) => void
  setActiveFile: (file: ExcalidrawFile | null) => void
  setFileContent: (content: string | null) => void
  setPreferences: (prefs: Preferences) => void
  setSidebarVisible: (visible: boolean) => void
  setIsDirty: (dirty: boolean) => void
  setSelectedFiles: (files: string[]) => void
  setAutoSaveTimer: (timer: ReturnType<typeof setTimeout> | null) => void
  toggleFileSelection: (filePath: string) => void
  clearFileSelection: () => void
  markFileAsModified: (filePath: string, modified: boolean) => void
  markTreeNodeAsModified: (filePath: string, modified: boolean) => void
  toggleFolderExpand: (folderPath: string) => void
  expandFolder: (folderPath: string) => void
  
  // Async actions
  selectDirectory: () => Promise<void>
  loadDirectory: (dir: string) => Promise<void>
  loadFileTree: (dir: string) => Promise<void>
  loadFile: (file: ExcalidrawFile) => Promise<void>
  loadFileFromTree: (node: FileTreeNode) => Promise<void>
  _loadFileInternal: (file: ExcalidrawFile) => Promise<void>
  _handleFileError: (error: unknown, operation: string, fileName?: string) => Promise<void>
  saveFile: () => Promise<boolean>
  saveCurrentFile: (content?: string) => Promise<void>
  saveFileAs: () => Promise<void>
  createNewFile: (fileName?: string) => Promise<void>
  createFolder: (folderName?: string) => Promise<void>
  renameFile: (oldPath: string, newName: string) => Promise<void>
  renameFolder: (oldPath: string, newName: string) => Promise<void>
  deleteFile: (filePath: string) => Promise<boolean>
  deleteFolder: (folderPath: string) => Promise<void>
  moveFile: (sourcePath: string, targetDirectory: string) => Promise<string>
  moveFolder: (sourcePath: string, targetDirectory: string) => Promise<string>
  batchDeleteFiles: (filePaths: string[]) => Promise<boolean>
  loadPreferences: () => Promise<void>
  savePreferences: () => Promise<void>
  toggleSidebar: () => void
  updateRecentFiles: (file: ExcalidrawFile) => void
  importImage: () => Promise<string | null>
  exportFile: (content: string, format: string) => Promise<string | null>
  updateAutoSaveSettings: (enabled: boolean, interval: number) => void
  setupAutoSave: () => void
  __internal_setupAutoSaveListener: () => () => void
}

export const useStore = create<AppStore>((set, get) => ({
  // Initial state
  currentDirectory: null,
  files: [],
  fileTree: [],
  activeFile: null,
  fileContent: null,
  preferences: {
    lastDirectory: null,
    recentDirectories: [],
    recentFiles: [],
    theme: 'system',
    sidebarVisible: true,
    autoSaveEnabled: true,
    autoSaveInterval: 30, // 30 seconds
    language: 'zh',
  },
  sidebarVisible: true,
  isDirty: false,
  selectedFiles: [],
  autoSaveTimer: null,
  expandedFolders: new Set<string>(),

  // Basic setters
  setCurrentDirectory: (dir) => set({ currentDirectory: dir }),
  setFiles: (files) => set({ files }),
  setFileTree: (tree) => set({ fileTree: tree }),
  setActiveFile: (file) => set({ activeFile: file }),
  setFileContent: (content) => set({ fileContent: content }),
  setPreferences: (prefs) => set({ preferences: prefs }),
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  setSelectedFiles: (files) => set({ selectedFiles: files }),
  setAutoSaveTimer: (timer: ReturnType<typeof setTimeout> | null) => set({ autoSaveTimer: timer }),
  toggleFileSelection: (filePath) => set((state) => {
    const isSelected = state.selectedFiles.includes(filePath)
    if (isSelected) {
      return {
        selectedFiles: state.selectedFiles.filter(f => f !== filePath)
      }
    } else {
      return {
        selectedFiles: [...state.selectedFiles, filePath]
      }
    }
  }),
  clearFileSelection: () => set({ selectedFiles: [] }),
  
  // Update auto save settings
  updateAutoSaveSettings: (enabled: boolean, interval: number) => {
    const state = get()
    const newPrefs = {
      ...state.preferences,
      autoSaveEnabled: enabled,
      autoSaveInterval: interval
    }
    set({ preferences: newPrefs })
    state.savePreferences()
    state.setupAutoSave()
  },
  
  // Setup auto save timer
  setupAutoSave: () => {
    const state = get()
    
    // Clear existing timer
    if (state.autoSaveTimer) {
      clearTimeout(state.autoSaveTimer)
      state.setAutoSaveTimer(null)
    }
    
    // Set new timer if auto save is enabled
    if (state.preferences.autoSaveEnabled && state.isDirty && state.activeFile && state.fileContent) {
      // Use a function to handle the auto save to avoid closure issues
      const handleAutoSave = async () => {
        try {
          const currentState = get()
          // Double-check conditions before saving
          if (currentState.isDirty && currentState.activeFile && currentState.fileContent) {
            await currentState.saveCurrentFile()
          }
        } catch (error) {
          console.error('Auto save failed:', error)
        }
      }
      
      const timer = setTimeout(handleAutoSave, state.preferences.autoSaveInterval * 1000)
      
      state.setAutoSaveTimer(timer)
    }
  },
  
  // Select directory
  selectDirectory: async () => {
    const dir = await invoke<string | null>('select_directory')
    if (dir) {
      await get().loadDirectory(dir)
    }
  },
  
  // Save file
  saveFile: async () => {
    try {
      await get().saveCurrentFile()
      return true
    } catch (error) {
      console.error('Failed to save file:', error)
      return false
    }
  },
  
  // Save file as
  saveFileAs: async () => {
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
      return nodes.map(node => {
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
      fileTree: updateNode(state.fileTree)
    }))
  },

  toggleFolderExpand: (folderPath) => {
    set((state) => {
      const newExpanded = new Set(state.expandedFolders)
      if (newExpanded.has(folderPath)) {
        newExpanded.delete(folderPath)
      } else {
        newExpanded.add(folderPath)
      }
      return { expandedFolders: newExpanded }
    })
  },

  expandFolder: (folderPath) => {
    set((state) => {
      const newExpanded = new Set(state.expandedFolders)
      newExpanded.add(folderPath)
      return { expandedFolders: newExpanded }
    })
  },

  // Load directory and list files
  loadDirectory: async (dir) => {
    try {
      const [files, fileTree] = await Promise.all([
        invoke<ExcalidrawFile[]>('list_excalidraw_files', { directory: dir }),
        invoke<FileTreeNode[]>('get_file_tree', { directory: dir })
      ])
      
      set({
        currentDirectory: dir,
        files,
        fileTree,
        activeFile: null,
        fileContent: null,
      })
      
      // Update preferences with recent directory
      const prefs = get().preferences
      // Ensure recentDirectories is always an array
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
      
      // Start watching directory
      await invoke('watch_directory', { directory: dir })
    } catch (error) {
      console.error('Failed to load directory:', error)
      // Show user-friendly error message
      alert(`Failed to load directory: ${error}`)
    }
  },

  // Load file tree only
  loadFileTree: async (dir) => {
    try {
      const fileTree = await invoke<FileTreeNode[]>('get_file_tree', {
        directory: dir,
      })
      
      set({ fileTree })
    } catch (error) {
      console.error('Failed to load file tree:', error)
    }
  },

  // Common error handling function for file operations
  _handleFileError: async (error: unknown, operation: string, fileName?: string) => {
    console.error(`${operation} failed:`, error)
    
    const language = get().preferences.language || 'zh'
    const t = translations[language]
    const errorStr = String(error)
    
    // Check for specific error types
    if (errorStr.includes('No such file') || errorStr.includes('not found') || errorStr.includes('does not exist')) {
      await confirm({
        title: t.fileNotFound,
        description: t.fileNotFoundDescription.replace('{name}', fileName || ''),
        confirmLabel: t.ok,
        hideCancel: true,
      })
      
      const state = get()
      // Refresh the file tree
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
      // Other errors
      await confirm({
        title: t.error,
        description: errorStr,
        confirmLabel: t.ok,
        hideCancel: true,
      })
    }
  },

  // Common file loading function
  _loadFileInternal: async (file: ExcalidrawFile) => {
    const state = get()
    
    // If clicking the same file that's already active, do nothing
    if (state.activeFile?.path === file.path) {
      return
    }
    
    // Store the previous active file path before switching
    const previousActiveFile = state.activeFile
    
    // Check if current file has unsaved changes
    if (state.isDirty && previousActiveFile) {
      const language = get().preferences.language || 'zh'
      const t = translations[language]
      const response = await confirm({
        title: t.unsavedChanges,
        description: t.unsavedChangesSwitchDescription.replace('{name}', previousActiveFile.name),
        confirmLabel: t.save,
        cancelLabel: t.dontSave
      })
      
      if (response) {
        // User chose to save
        await state.saveCurrentFile()
      } else {
        // User chose "Don't Save" - clear the modified state for the previous file
        state.markFileAsModified(previousActiveFile.path, false)
        state.markTreeNodeAsModified(previousActiveFile.path, false)
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
      
      // Clear modified state for this file
      state.markFileAsModified(file.path, false)
      state.markTreeNodeAsModified(file.path, false)
      
      // Update recent files
      state.updateRecentFiles(file)
    } catch (error) {
      await state._handleFileError(error, 'load file', file.name)
      
      // Clear active file if it's the one that failed
      if (state.activeFile?.path === file.path) {
        set({
          activeFile: null,
          fileContent: null,
          isDirty: false,
        })
      }
    }
  },

  // Load file content
  loadFile: async (file: ExcalidrawFile) => {
    await get()._loadFileInternal(file)
  },

  // Load file from tree node
  loadFileFromTree: async (node: FileTreeNode) => {
    if (node.is_directory) return
    
    // Convert tree node to ExcalidrawFile
    const file: ExcalidrawFile = {
      name: node.name,
      path: node.path,
      modified: node.modified,
    }
    
    await get()._loadFileInternal(file)
  },

  // Save current file
  saveCurrentFile: async (content?: string) => {
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
      
      if (Array.isArray(parsed.elements) && parsed.elements.length === 0 && !content) {
        return
      }
    } catch (jsonError) {
      return
    }
    
    try {
      await invoke('save_file', {
        filePath: activeFile.path,
        content: contentToSave,
      })
      
      state.markFileAsModified(activeFile.path, false)
      state.markTreeNodeAsModified(activeFile.path, false)
      set({ isDirty: false })
      
      if (state.autoSaveTimer) {
        clearTimeout(state.autoSaveTimer)
        state.setAutoSaveTimer(null)
      }
    } catch (error) {
      await state._handleFileError(error, 'save file', activeFile.name)
    }
  },

  // Create new file
  createNewFile: async (fileName?: string) => {
    const state = get()
    let { currentDirectory } = state
    
    // Check if current file has unsaved changes
    if (state.isDirty && state.activeFile) {
      const language = get().preferences.language || 'zh'
      const t = translations[language]
      const response = await confirm({
        title: t.unsavedChanges,
        description: t.unsavedChangesNewFileDescription.replace('{name}', state.activeFile.name),
        confirmLabel: t.save,
        cancelLabel: t.dontSave
      })
      
      if (response) {
        // User chose to save
        await state.saveCurrentFile()
      }
      // If response is false, user chose "Don't Save" - continue without saving
    }
    
    // Check if a directory is selected
    if (!currentDirectory) {
      // Prompt to select a directory if none is selected
      try {
        const dir = await invoke<string | null>('select_directory')
        if (!dir) {
          return
        }
        // Load the selected directory
        await state.loadDirectory(dir)
        currentDirectory = dir
      } catch (error) {
        await state._handleFileError(error, 'select directory')
        return
      }
    }
    
    // Generate default filename if not provided
    const finalFileName = fileName || `Untitled-${Date.now()}.excalidraw`
    
    try {
      // Create the new file
      const filePath = await invoke<string>('create_new_file', {
        directory: currentDirectory,
        fileName: finalFileName,
      })
      
      // Reload the file tree to show the new file
      await state.loadFileTree(currentDirectory)
      
      // Create an ExcalidrawFile object for the new file
      const file: ExcalidrawFile = {
        name: finalFileName,
        path: filePath,
        modified: false,
      }
      
      // Load the new file immediately
      await state.loadFile(file)
    } catch (error) {
      await state._handleFileError(error, 'create file', finalFileName)
    }
  },

  // Create new folder
  createFolder: async (folderName?: string) => {
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
    
    const finalFolderName = folderName || `New Folder`
    
    try {
      await invoke<string>('create_folder', {
        directory: currentDirectory,
        folderName: finalFolderName,
      })
      
      await state.loadFileTree(currentDirectory)
    } catch (error) {
      await state._handleFileError(error, 'create folder', finalFolderName)
    }
  },
  
  // Rename file
  renameFile: async (oldPath: string, newName: string) => {
    try {
      // Ensure the new name has .excalidraw extension
      const finalName = newName.endsWith('.excalidraw') 
        ? newName 
        : `${newName}.excalidraw`
      
      const newPath = await invoke<string>('rename_file', {
        oldPath,
        newName: finalName,
      })
      
      const state = get()
      
      // Update the active file if it was renamed
      if (state.activeFile?.path === oldPath) {
        set({
          activeFile: {
            ...state.activeFile,
            name: finalName,
            path: newPath,
          },
        })
      }
      
      // Reload the file tree
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
    } catch (error) {
      await get()._handleFileError(error, 'rename file')
    }
  },
  
  // Rename folder
  renameFolder: async (oldPath: string, newName: string) => {
    try {
      await invoke<string>('rename_folder', {
        oldPath,
        newName,
      })
      
      const state = get()
      
      // Reload the file tree
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
    } catch (error) {
      await get()._handleFileError(error, 'rename folder')
    }
  },
  
  deleteFile: async (filePath: string) => {
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
          selectedFiles: state.selectedFiles.filter(f => f !== filePath)
        })
      }
      
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
      
      return true
    } catch (error) {
      await get()._handleFileError(error, 'delete file')
      throw error
    }
  },
  
  batchDeleteFiles: async (filePaths: string[]) => {
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
      }
      
      set({ selectedFiles: [] })
      
      const state = get()
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
      
      return true
    } catch (error) {
      await get()._handleFileError(error, 'delete files')
      return false
    }
  },

  // Delete folder
  deleteFolder: async (folderPath: string) => {
    try {
      await invoke('delete_folder', { folderPath })
      
      const state = get()
      
      // If the deleted folder contained the active file, clear it
      if (state.activeFile?.path.startsWith(folderPath)) {
        set({
          activeFile: null,
          fileContent: null,
          isDirty: false,
        })
      }
      
      // Reload the file tree
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
    } catch (error) {
      await get()._handleFileError(error, 'delete folder')
    }
  },

  // Move file to another directory
  moveFile: async (sourcePath: string, targetDirectory: string) => {
    try {
      const newPath = await invoke<string>('move_file', {
        sourcePath,
        targetDirectory
      })
      
      const state = get()
      
      // If the moved file was the active file, update its path and expand target folder
      if (state.activeFile?.path === sourcePath) {
        set({
          activeFile: {
            ...state.activeFile,
            path: newPath
          }
        })
        // Expand the target folder to show the moved file
        get().expandFolder(targetDirectory)
      }
      
      // Reload the file tree
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
      
      return newPath
    } catch (error) {
      await get()._handleFileError(error, 'move file')
      throw error
    }
  },

  // Move folder to another directory
  moveFolder: async (sourcePath: string, targetDirectory: string) => {
    try {
      const newPath = await invoke<string>('move_folder', {
        sourcePath,
        targetDirectory
      })
      
      const state = get()
      
      // If the moved folder contained the active file, update its path
      if (state.activeFile?.path.startsWith(sourcePath)) {
        const newActivePath = state.activeFile.path.replace(sourcePath, newPath)
        set({
          activeFile: {
            ...state.activeFile,
            path: newActivePath
          }
        })
      }
      
      // Reload the file tree
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
      
      return newPath
    } catch (error) {
      await get()._handleFileError(error, 'move folder')
      throw error
    }
  },

  // Load preferences
  loadPreferences: async () => {
    try {
      // The Rust backend returns snake_case fields
      const prefs = await invoke<any>('get_preferences')
      
      const safePrefs = convertPreferencesFromRust(prefs)
      
      set({
        preferences: safePrefs,
        sidebarVisible: safePrefs.sidebarVisible,
      })
      
      // Apply theme
      const root = document.documentElement
      if (safePrefs.theme === 'dark') {
        root.classList.add('dark')
      } else if (safePrefs.theme === 'light') {
        root.classList.remove('dark')
      } else {
        // System theme
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        if (prefersDark) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      }
      
      // Auto-load last directory if it exists
      if (safePrefs.lastDirectory) {
        try {
          await get().loadDirectory(safePrefs.lastDirectory)
        } catch (dirError) {
          console.error('Failed to auto-load last directory:', dirError)
          // Clear the invalid lastDirectory from preferences
          const newPrefs = { ...safePrefs, lastDirectory: null }
          set({ preferences: newPrefs })
          await get().savePreferences()
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
      // Set default preferences if loading fails
      const defaultPrefs: Preferences = {
        lastDirectory: null,
        recentDirectories: [],
        recentFiles: [],
        theme: 'system',
        sidebarVisible: true,
        autoSaveEnabled: true,
        autoSaveInterval: 30,
        language: 'zh',
      }
      set({
        preferences: defaultPrefs,
        sidebarVisible: true,
      })
    }
  },

  // Save preferences
  savePreferences: async () => {
    const { preferences } = get()
    try {
      // Convert camelCase to snake_case for Rust backend
      const prefsToSave = convertPreferencesToRust(preferences)
      await invoke('save_preferences', { preferences: prefsToSave })
    } catch (error) {
      console.error('Failed to save preferences:', error)
    }
  },

  // Toggle sidebar
  toggleSidebar: () => {
    const state = get()
    const newVisible = !state.sidebarVisible
    set({ sidebarVisible: newVisible })
    
    // Update preferences
    const newPrefs = { ...state.preferences, sidebarVisible: newVisible }
    set({ preferences: newPrefs })
    state.savePreferences()
  },
  
  // Update recent files
  updateRecentFiles: (file: ExcalidrawFile) => {
    const state = get()
    const currentRecentFiles = state.preferences.recentFiles || []
    
    // Remove if already exists
    const filteredRecentFiles = currentRecentFiles.filter(f => f.path !== file.path)
    
    // Add to beginning
    const newRecentFile = {
      name: file.name,
      path: file.path,
      lastOpened: Date.now()
    }
    
    const updatedRecentFiles = [newRecentFile, ...filteredRecentFiles].slice(0, 10) // Keep only last 10 files
    
    const newPrefs = { ...state.preferences, recentFiles: updatedRecentFiles }
    set({ preferences: newPrefs })
    state.savePreferences()
  },
  
  // Import/Export actions
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
  
  exportFile: async (content: string, format: string) => {
    try {
      const exportPath = await invoke<string | null>('export_file', { 
        content, 
        format 
      })
      return exportPath
    } catch (error) {
      console.error(`Failed to export as ${format}:`, error)
      alert(`Failed to export file: ${error}`)
      return null
    }
  },
  
  // Listen for changes to setup auto save
  __internal_setupAutoSaveListener: (): () => void => {
    // This function will be called from the component that uses the store
    // to set up the auto save listener
    const unsubscribe = useStore.subscribe((state: AppStore, prevState: AppStore) => {
      // Check if any relevant state has changed
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
    
    return unsubscribe
  },

}))