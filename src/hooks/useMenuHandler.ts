import { useEffect } from 'react'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useStore } from '../store/useStore'
import { convertPreferencesToRust } from '../lib/preferences'
import { useExcalidrawActions } from './useExcalidrawActions'

interface MenuCommand {
  command: string
  data?: unknown
}

export function useMenuHandler() {
  const {
    loadDirectory,
    createNewFile,
    saveCurrentFile,
    toggleSidebar,
    preferences,
    savePreferences,
  } = useStore()

  const { zoomIn, zoomOut, resetZoom, refresh } = useExcalidrawActions()

  useEffect(() => {
    let unlisten: UnlistenFn | null = null

    const setupListener = async () => {
      unlisten = await listen<MenuCommand>('menu-command', async (event) => {
        const { command, data } = event.payload

        switch (command) {
          case 'open_directory':
            handleOpenDirectory()
            break

          case 'new_file':
            handleNewFile()
            break

          case 'save':
            await saveCurrentFile()
            break

          case 'save_as':
            handleSaveAs()
            break

          case 'quit':
            await getCurrentWindow().close()
            break

          case command.match(/^recent_dir_\d+$/)?.input:
            if (data && typeof data === 'object' && 'directory' in data) {
              await loadDirectory((data as { directory: string }).directory)
            }
            break

          case command.match(/^recent_file_\d+$/)?.input:
            if (data && typeof data === 'object' && 'file_path' in data) {
              const state = useStore.getState()
              const fileName =
                (data as { file_path: string }).file_path.split(/[\\/]/).pop()?.replace('.excalidraw', '') ||
                'Unknown'
              await state.loadFile({
                path: (data as { file_path: string }).file_path,
                name: fileName,
                modified: false,
              })
            }
            break

          case 'clear_recent':
            handleClearRecent()
            break

          case 'clear_recent_files':
            handleClearRecentFiles()
            break

          case 'toggle_sidebar':
            toggleSidebar()
            break

          case 'zoom_in':
            zoomIn()
            break

          case 'zoom_out':
            zoomOut()
            break

          case 'reset_zoom':
            resetZoom()
            break

          case 'fullscreen':
            handleToggleFullscreen()
            break

          case 'minimize':
            await getCurrentWindow().minimize()
            break

          case 'close_window':
            await getCurrentWindow().close()
            break

          case 'keyboard_shortcuts':
            handleShowKeyboardShortcuts()
            break

          default:
            break
        }
      })
    }

    setupListener()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [
    loadDirectory,
    createNewFile,
    saveCurrentFile,
    toggleSidebar,
    preferences,
    savePreferences,
    zoomIn,
    zoomOut,
    resetZoom,
    refresh,
  ])

  const handleOpenDirectory = async () => {
    const selected = await invoke<string | null>('select_directory')
    if (selected) {
      await loadDirectory(selected)
    }
  }

  const handleNewFile = async () => {
    const state = useStore.getState()

    if (!state.currentDirectory) {
      const dir = await invoke<string | null>('select_directory')
      if (dir) {
        await state.loadDirectory(dir)
      }
    }

    if (!useStore.getState().currentDirectory) return

    await createNewFile()
  }

  const handleSaveAs = async () => {
    await useStore.getState().saveFileAs()
  }

  const handleClearRecent = async () => {
    const newPrefs = {
      ...preferences,
      recentDirectories: [],
    }
    const prefsToSave = convertPreferencesToRust(newPrefs)
    await invoke('save_preferences', { preferences: prefsToSave })
    useStore.getState().setPreferences(newPrefs)
  }

  const handleClearRecentFiles = async () => {
    const newPrefs = {
      ...preferences,
      recentFiles: [],
    }
    const prefsToSave = convertPreferencesToRust(newPrefs)
    await invoke('save_preferences', { preferences: prefsToSave })
    useStore.getState().setPreferences(newPrefs)
  }

  const handleToggleFullscreen = async () => {
    const window = getCurrentWindow()
    const isFullscreen = await window.isFullscreen()
    await window.setFullscreen(!isFullscreen)

    setTimeout(() => {
      try {
        refresh()
      } catch (err) {
        console.error('Failed to refresh view on fullscreen toggle:', err)
      }
    }, 300)
  }

  const handleShowKeyboardShortcuts = () => {
    const shortcuts = `
Keyboard Shortcuts:

File:
  Open Directory: Cmd/Ctrl+O
  New File: Cmd/Ctrl+N
  Save: Cmd/Ctrl+S
  Save As: Cmd/Ctrl+Shift+S
  Quit: Cmd/Ctrl+Q

View:
  Toggle Sidebar: Cmd/Ctrl+B
  Zoom In: Cmd/Ctrl++
  Zoom Out: Cmd/Ctrl+-
  Reset Zoom: Cmd/Ctrl+0
  Fullscreen: F11 (Ctrl+Cmd+F on Mac)

Window:
  Minimize: Cmd/Ctrl+M
  Close Window: Cmd/Ctrl+W

Note: All editing operations (copy, paste, undo, etc.) are handled natively by Excalidraw.
    `
    alert(shortcuts)
  }

  return {}
}
