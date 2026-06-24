import type { StateCreator } from 'zustand'
import type { AppStore } from '../types'

export interface UISlice {
  sidebarVisible: boolean
  isDirty: boolean
  selectedFiles: string[]
  autoSaveTimer: ReturnType<typeof setTimeout> | null
  expandedFolders: Set<string>
  zoom: number
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'

  setSidebarVisible: (visible: boolean) => void
  setIsDirty: (dirty: boolean) => void
  setSelectedFiles: (files: string[]) => void
  setAutoSaveTimer: (timer: ReturnType<typeof setTimeout> | null) => void
  setZoom: (zoom: number) => void
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void
  toggleFileSelection: (filePath: string) => void
  clearFileSelection: () => void
  toggleFolderExpand: (folderPath: string) => void
  expandFolder: (folderPath: string) => void
  toggleSidebar: () => void
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set, get) => ({
  sidebarVisible: true,
  isDirty: false,
  selectedFiles: [],
  autoSaveTimer: null,
  expandedFolders: new Set<string>(),
  zoom: 1,
  saveStatus: 'idle',

  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  setSelectedFiles: (files) => set({ selectedFiles: files }),
  setAutoSaveTimer: (timer) => set({ autoSaveTimer: timer }),
  setZoom: (zoom) => set({ zoom }),
  setSaveStatus: (status) => set({ saveStatus: status }),

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
