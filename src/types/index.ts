export interface ExcalidrawFile {
  name: string
  path: string
  modified: boolean
}

export interface FileTreeNode {
  name: string
  path: string
  is_directory: boolean
  modified: boolean
  children?: FileTreeNode[]
}

export interface AppState {
  currentDirectory: string | null
  files: ExcalidrawFile[]
  activeFile: ExcalidrawFile | null
  recentDirectories: string[]
}

export interface RecentFile {
  name: string
  path: string
  lastOpened: number
}

export interface Preferences {
  lastDirectory: string | null
  recentDirectories: string[]
  recentFiles: RecentFile[]
  theme: 'warm-white' | 'white'
  sidebarVisible: boolean
  autoSaveEnabled: boolean
  autoSaveInterval: number // in seconds
  language: 'en' | 'zh'
}