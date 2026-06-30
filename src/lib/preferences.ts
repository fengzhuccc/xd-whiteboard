import { Preferences } from '../types'

export interface RustPreferences {
  last_directory: string | null
  recent_directories: string[]
  recent_files: Array<{ name: string; path: string }>
  theme: string
  sidebar_visible: boolean
  auto_save_enabled: boolean
  auto_save_interval: number
  language: string
}

/**
 * Convert preferences from Rust snake_case to TypeScript camelCase
 */
export function convertPreferencesFromRust(rustPrefs: unknown): Preferences {
  const prefs = rustPrefs as Partial<RustPreferences>
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
  }
}

/**
 * Convert preferences from TypeScript camelCase to Rust snake_case
 */
export function convertPreferencesToRust(tsPrefs: Preferences): RustPreferences {
  return {
    last_directory: tsPrefs.lastDirectory || null,
    recent_directories: tsPrefs.recentDirectories || [],
    recent_files: tsPrefs.recentFiles || [],
    theme: tsPrefs.theme || 'warm-white',
    sidebar_visible: tsPrefs.sidebarVisible ?? true,
    auto_save_enabled: tsPrefs.autoSaveEnabled ?? true,
    auto_save_interval: tsPrefs.autoSaveInterval || 30,
    language: tsPrefs.language || 'zh',
  }
}
