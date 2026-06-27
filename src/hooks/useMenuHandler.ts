import { useEffect } from 'react'
import { listen, UnlistenFn, emit } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useStore } from '../store/useStore'
import { convertPreferencesToRust } from '../lib/preferences'

interface MenuCommand {
  command: string
  data?: unknown
}

export function useMenuHandler() {
  const loadDirectory = useStore((s) => s.loadDirectory)
  const createNewFile = useStore((s) => s.createNewFile)
  const saveCurrentFile = useStore((s) => s.saveCurrentFile)
  const toggleSidebar = useStore((s) => s.toggleSidebar)

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

          case 'export_image':
            await handleExportImage()
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
                (data as { file_path: string }).file_path
                  .split(/[\\/]/)
                  .pop()
                  ?.replace('.excalidraw', '') || 'Unknown'
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

          case 'fullscreen':
            await handleToggleFullscreen()
            break

          case 'keyboard_shortcuts':
            await emit('show-shortcuts-dialog')
            break

          case 'preferences':
            await emit('show-preferences-dialog')
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
  }, [loadDirectory, createNewFile, saveCurrentFile, toggleSidebar])

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

  const handleExportImage = async () => {
    const state = useStore.getState()
    if (!state.activeFile || !state.fileContent) return
    await state.exportFile(state.fileContent, 'png')
  }

  const handleClearRecent = async () => {
    const newPrefs = {
      ...useStore.getState().preferences,
      recentDirectories: [],
    }
    const prefsToSave = convertPreferencesToRust(newPrefs)
    await invoke('save_preferences', { preferences: prefsToSave })
    useStore.getState().setPreferences(newPrefs)
  }

  const handleClearRecentFiles = async () => {
    const newPrefs = {
      ...useStore.getState().preferences,
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
  }

  return {}
}
