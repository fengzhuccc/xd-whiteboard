import type { StateCreator } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type { AppStore } from '../types'
import type { ExcalidrawFile, Preferences } from '../../types'
import { convertPreferencesFromRust, convertPreferencesToRust } from '../../lib/preferences'

export interface PreferenceSlice {
  preferences: Preferences

  setPreferences: (prefs: Preferences) => void
  loadPreferences: () => Promise<void>
  savePreferences: () => Promise<void>
  updateRecentFiles: (file: ExcalidrawFile) => void
  updateTheme: (theme: Preferences['theme']) => Promise<void>
  updateLanguage: (language: Preferences['language']) => Promise<void>
}

export const createPreferenceSlice: StateCreator<AppStore, [], [], PreferenceSlice> = (
  set,
  get,
) => ({
  preferences: {
    lastDirectory: null,
    recentDirectories: [],
    recentFiles: [],
    theme: 'warm-white',
    sidebarVisible: true,
    autoSaveEnabled: true,
    autoSaveInterval: 30,
    language: 'zh',
  },

  setPreferences: (prefs) => set({ preferences: prefs }),

  loadPreferences: async () => {
    try {
      const prefs = await invoke<unknown>('get_preferences')
      const safePrefs = convertPreferencesFromRust(prefs)

      set({
        preferences: safePrefs,
        sidebarVisible: safePrefs.sidebarVisible,
      })

      const root = document.documentElement
      if (safePrefs.theme === 'white') {
        root.classList.add('theme-white')
      } else {
        root.classList.remove('theme-white')
      }

      if (safePrefs.lastDirectory) {
        try {
          await get().loadDirectory(safePrefs.lastDirectory)
        } catch (dirError) {
          console.error('Failed to auto-load last directory:', dirError)
          const newPrefs = { ...safePrefs, lastDirectory: null }
          set({ preferences: newPrefs })
          await get().savePreferences()
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
      const defaultPrefs: Preferences = {
        lastDirectory: null,
        recentDirectories: [],
        recentFiles: [],
        theme: 'warm-white',
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

  savePreferences: async () => {
    const { preferences } = get()
    try {
      const prefsToSave = convertPreferencesToRust(preferences)
      await invoke('save_preferences', { preferences: prefsToSave })
    } catch (error) {
      console.error('Failed to save preferences:', error)
    }
  },

  updateRecentFiles: (file) => {
    const state = get()
    const currentRecentFiles = state.preferences.recentFiles || []
    const filtered = currentRecentFiles.filter((f) => f.path !== file.path)
    const newRecentFile = {
      name: file.name,
      path: file.path,
      lastOpened: Date.now(),
    }
    const updated = [newRecentFile, ...filtered].slice(0, 10)
    const newPrefs = { ...state.preferences, recentFiles: updated }
    set({ preferences: newPrefs })
    state.savePreferences()
  },

  updateTheme: async (theme) => {
    const state = get()
    const newPrefs = { ...state.preferences, theme }
    set({ preferences: newPrefs })

    const root = document.documentElement
    if (theme === 'white') {
      root.classList.add('theme-white')
    } else {
      root.classList.remove('theme-white')
    }

    await state.savePreferences()
  },

  updateLanguage: async (language) => {
    const state = get()
    const newPrefs = { ...state.preferences, language }
    set({ preferences: newPrefs })
    await state.savePreferences()
  },
})
