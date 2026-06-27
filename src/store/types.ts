import type { UISlice } from './slices/createUISlice'
import type { PreferenceSlice } from './slices/createPreferenceSlice'
import type { FileSlice } from './slices/createFileSlice'

export type AppStore = UISlice & PreferenceSlice & FileSlice
