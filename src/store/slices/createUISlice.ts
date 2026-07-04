import type { StateCreator } from 'zustand'
import type { AppStore } from '../types'

export interface UISlice {
  sidebarVisible: boolean
  isDirty: boolean
  selectedFiles: string[]
  expandedFolders: Set<string>
  zoom: number
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  preferencesOpen: boolean
  shortcutsDialogOpen: boolean
  gridModeEnabled: boolean
  objectsSnapModeEnabled: boolean
  renamingNodePath: string | null
  // 由 ExcalidrawEditor 注册的 flush 函数：把待写内容同步到 store，
  // 并保存当前视图状态。关闭/切换文件前由 App.tsx 调用，避免丢失最后一次编辑。
  flushEditorChanges: (() => void) | null

  setSidebarVisible: (visible: boolean) => void
  setIsDirty: (dirty: boolean) => void
  setSelectedFiles: (files: string[]) => void
  setZoom: (zoom: number) => void
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void
  setPreferencesOpen: (open: boolean) => void
  setShortcutsDialogOpen: (open: boolean) => void
  setGridModeEnabled: (enabled: boolean) => void
  setObjectsSnapModeEnabled: (enabled: boolean) => void
  setRenamingNodePath: (path: string | null) => void
  setFlushEditorChanges: (fn: (() => void) | null) => void
  toggleFileSelection: (filePath: string) => void
  clearFileSelection: () => void
  toggleFolderExpand: (folderPath: string) => void
  expandFolder: (filePath: string) => void
  toggleSidebar: () => void
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set, get) => ({
  sidebarVisible: true,
  isDirty: false,
  selectedFiles: [],
  expandedFolders: new Set<string>(),
  zoom: 1,
  saveStatus: 'idle',
  preferencesOpen: false,
  shortcutsDialogOpen: false,
  gridModeEnabled: false,
  objectsSnapModeEnabled: false,
  renamingNodePath: null,
  flushEditorChanges: null,

  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  setSelectedFiles: (files) => set({ selectedFiles: files }),
  setZoom: (zoom) => set({ zoom }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setPreferencesOpen: (open) => set({ preferencesOpen: open }),
  setShortcutsDialogOpen: (open) => set({ shortcutsDialogOpen: open }),
  setGridModeEnabled: (enabled) => set({ gridModeEnabled: enabled }),
  setObjectsSnapModeEnabled: (enabled) => set({ objectsSnapModeEnabled: enabled }),
  setRenamingNodePath: (path) => set({ renamingNodePath: path }),
  setFlushEditorChanges: (fn) => set({ flushEditorChanges: fn }),

  toggleFileSelection: (filePath) =>
    set((state) => {
      const isSelected = state.selectedFiles.includes(filePath)
      if (isSelected) {
        return { selectedFiles: state.selectedFiles.filter((f) => f !== filePath) }
      }
      return { selectedFiles: [...state.selectedFiles, filePath] }
    }),

  clearFileSelection: () => set({ selectedFiles: [] }),

  toggleFolderExpand: (folderPath) =>
    set((state) => {
      const next = new Set(state.expandedFolders)
      if (next.has(folderPath)) {
        next.delete(folderPath)
      } else {
        next.add(folderPath)
      }
      return { expandedFolders: next }
    }),

  expandFolder: (folderPath) =>
    set((state) => {
      const next = new Set(state.expandedFolders)
      next.add(folderPath)
      return { expandedFolders: next }
    }),

  toggleSidebar: () => {
    const state = get()
    const nextVisible = !state.sidebarVisible
    set({ sidebarVisible: nextVisible })
    const newPrefs = { ...state.preferences, sidebarVisible: nextVisible }
    set({ preferences: newPrefs })
    state.savePreferences()
  },
})
