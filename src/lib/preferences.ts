import { Preferences } from '../types'

export interface RustFileViewState {
  zoom: { value: number }
  scroll_x: number
  scroll_y: number
}

export interface RustPreferences {
  last_directory: string | null
  recent_directories: string[]
  recent_files: Array<{ name: string; path: string }>
  theme: string
  sidebar_visible: boolean
  auto_save_enabled: boolean
  auto_save_interval: number
  language: string
  file_view_states: Record<string, RustFileViewState>
}

/**
 * Convert preferences from Rust snake_case to TypeScript camelCase
 */
export function convertPreferencesFromRust(rustPrefs: unknown): Preferences {
  const prefs = rustPrefs as Partial<RustPreferences>
  const rustFileViewStates = prefs?.file_view_states ?? {}
  return {
    lastDirectory: prefs?.last_directory ?? null,
    recentDirectories: prefs?.recent_directories ?? [],
    recentFiles: (prefs?.recent_files ?? []).map((f) => ({
      name: f.name,
      path: f.path,
      lastOpened: Date.now(),
    })),
    theme: (prefs?.theme as Preferences['theme']) || 'warm-white',
    sidebarVisible: prefs?.sidebar_visible ?? true,
    autoSaveEnabled: prefs?.auto_save_enabled ?? true,
    autoSaveInterval: prefs?.auto_save_interval ?? 30,
    language: (prefs?.language as Preferences['language']) || 'zh',
    fileViewStates: Object.fromEntries(
      Object.entries(rustFileViewStates).map(([path, state]) => [
        path,
        {
          zoom: state.zoom,
          scrollX: state.scroll_x,
          scrollY: state.scroll_y,
        },
      ]),
    ),
  }
}

/**
 * Convert preferences from TypeScript camelCase to Rust snake_case
 */
export function convertPreferencesToRust(tsPrefs: Preferences): RustPreferences {
  const fileViewStates = tsPrefs.fileViewStates ?? {}
  return {
    last_directory: tsPrefs.lastDirectory || null,
    recent_directories: tsPrefs.recentDirectories || [],
    recent_files: tsPrefs.recentFiles || [],
    theme: tsPrefs.theme || 'warm-white',
    sidebar_visible: tsPrefs.sidebarVisible ?? true,
    auto_save_enabled: tsPrefs.autoSaveEnabled ?? true,
    auto_save_interval: tsPrefs.autoSaveInterval || 30,
    language: tsPrefs.language || 'zh',
    file_view_states: Object.fromEntries(
      Object.entries(fileViewStates).map(([path, state]) => [
        path,
        {
          zoom: state.zoom,
          scroll_x: state.scrollX,
          scroll_y: state.scrollY,
        },
      ]),
    ),
  }
}
