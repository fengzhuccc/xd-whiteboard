import type { StateCreator } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type { AppStore } from '../types'
import type { LibraryItem } from '../../types'

export interface LibrarySlice {
  libraryItems: LibraryItem[]
  libraryLoading: boolean
  libraryError: string | null

  loadLibrary: () => Promise<void>
  saveLibrary: () => Promise<void>
  addLibraryItems: (items: LibraryItem[]) => void
  removeLibraryItem: (id: string) => void
  setLibraryItems: (items: LibraryItem[]) => void
}

export const createLibrarySlice: StateCreator<AppStore, [], [], LibrarySlice> = (
  set,
  get,
) => ({
  libraryItems: [],
  libraryLoading: false,
  libraryError: null,

  loadLibrary: async () => {
    try {
      const data = await invoke<{ items: LibraryItem[] }>('load_library')
      set({ libraryItems: data.items || [] })
    } catch (error) {
      console.error('Failed to load library:', error)
      set({ libraryItems: [] })
    }
  },

  saveLibrary: async () => {
    try {
      const { libraryItems } = get()
      await invoke('save_library', { data: { items: libraryItems } })
    } catch (error) {
      console.error('Failed to save library:', error)
    }
  },

  addLibraryItems: (items) => {
    const state = get()
    const existingIds = new Set(state.libraryItems.map((item) => item.id))
    const newItems = items.filter((item) => !existingIds.has(item.id))
    if (newItems.length === 0) return

    const updated = [...state.libraryItems, ...newItems]
    set({ libraryItems: updated })
    state.saveLibrary()
  },

  removeLibraryItem: (id) => {
    const state = get()
    const updated = state.libraryItems.filter((item) => item.id !== id)
    if (updated.length === state.libraryItems.length) return

    set({ libraryItems: updated })
    state.saveLibrary()
  },

  setLibraryItems: (items) => {
    set({ libraryItems: items })
    get().saveLibrary()
  },
})
