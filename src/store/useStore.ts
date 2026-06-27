import { create } from 'zustand'
import type { AppStore } from './types'
import { createUISlice } from './slices/createUISlice'
import { createPreferenceSlice } from './slices/createPreferenceSlice'
import { createFileSlice } from './slices/createFileSlice'

export const useStore = create<AppStore>((set, get, api) => ({
  ...createUISlice(set, get, api),
  ...createPreferenceSlice(set, get, api),
  ...createFileSlice(set, get, api),
}))
