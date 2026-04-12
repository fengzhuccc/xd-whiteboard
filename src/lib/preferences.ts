import { Preferences } from '../types'

/**
 * Convert preferences from Rust snake_case to TypeScript camelCase
 */
export function convertPreferencesFromRust(rustPrefs: any): Preferences {
  return {
    lastDirectory: rustPrefs?.last_directory || rustPrefs?.lastDirectory || null,
    recentDirectories: rustPrefs?.recent_directories || rustPrefs?.recentDirectories || [],
    recentFiles: rustPrefs?.recent_files || rustPrefs?.recentFiles || [],
    theme: rustPrefs?.theme || 'system',
    sidebarVisible: rustPrefs?.sidebar_visible !== undefined 
      ? rustPrefs.sidebar_visible 
      : (rustPrefs?.sidebarVisible !== undefined ? rustPrefs.sidebarVisible : true),
    autoSaveEnabled: rustPrefs?.auto_save_enabled !== undefined 
      ? rustPrefs.auto_save_enabled 
      : (rustPrefs?.autoSaveEnabled !== undefined ? rustPrefs.autoSaveEnabled : true),
    autoSaveInterval: rustPrefs?.auto_save_interval || rustPrefs?.autoSaveInterval || 30,
    language: rustPrefs?.language || 'zh',
  }
}

/**
 * Convert preferences from TypeScript camelCase to Rust snake_case
 */
export function convertPreferencesToRust(tsPrefs: Preferences): any {
  return {
    last_directory: tsPrefs.lastDirectory || null,
    recent_directories: tsPrefs.recentDirectories || [],
    recent_files: tsPrefs.recentFiles || [],
    theme: tsPrefs.theme || 'system',
    sidebar_visible: tsPrefs.sidebarVisible !== undefined ? tsPrefs.sidebarVisible : true,
    auto_save_enabled: tsPrefs.autoSaveEnabled !== undefined ? tsPrefs.autoSaveEnabled : true,
    auto_save_interval: tsPrefs.autoSaveInterval || 30,
    language: tsPrefs.language || 'zh',
  }
}