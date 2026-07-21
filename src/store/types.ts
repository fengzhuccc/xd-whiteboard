import type { UISlice } from './slices/createUISlice'
import type { PreferenceSlice } from './slices/createPreferenceSlice'
import type { FileSlice } from './slices/createFileSlice'
import type { LibrarySlice } from './slices/createLibrarySlice'

export type AppStore = UISlice & PreferenceSlice & FileSlice & LibrarySlice
