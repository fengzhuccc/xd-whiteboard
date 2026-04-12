import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useStore } from '../store/useStore'

export function useKeyboardShortcuts() {
  const {
    toggleSidebar,
    saveCurrentFile,
    files,
    activeFile,
    loadFile,
    createNewFile,
  } = useStore()

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? e.metaKey : e.ctrlKey

      // Don't handle any events if clipboard operations are being used
      // Let Excalidraw handle all clipboard operations natively
      if (modKey && (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'a')) {
        return
      }

      // Cmd/Ctrl + B: Toggle sidebar
      if (modKey && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }

      // Cmd/Ctrl + S: Save current file
      if (modKey && e.key === 's') {
        e.preventDefault()
        await saveCurrentFile()
      }

      // Cmd/Ctrl + O: Open directory
      if (modKey && e.key === 'o') {
        e.preventDefault()
        const dir = await invoke<string | null>('select_directory')
        if (dir) {
          await useStore.getState().loadDirectory(dir)
        }
      }

      // Cmd/Ctrl + N: New file
      if (modKey && e.key === 'n') {
        e.preventDefault()
        
        const state = useStore.getState()
        
        // If no directory is selected, select one first
        if (!state.currentDirectory) {
          const dir = await invoke<string | null>('select_directory')
          if (dir) {
            await state.loadDirectory(dir)
          }
          return
        }
        
        // Create with timestamp filename
        const fileName = `Untitled-${Date.now()}.excalidraw`
        await createNewFile(fileName)
      }

      // Cmd/Ctrl + Tab: Switch to next file
      if (modKey && e.key === 'Tab') {
        e.preventDefault()
        if (files.length > 1 && activeFile) {
          const currentIndex = files.findIndex((f: any) => f.path === activeFile.path)
          const nextIndex = (currentIndex + 1) % files.length
          await loadFile(files[nextIndex])
        }
      }

      // Cmd/Ctrl + Shift + Tab: Switch to previous file
      if (modKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault()
        if (files.length > 1 && activeFile) {
          const currentIndex = files.findIndex((f: any) => f.path === activeFile.path)
          const prevIndex = currentIndex === 0 ? files.length - 1 : currentIndex - 1
          await loadFile(files[prevIndex])
        }
      }
    }

    // Use non-capturing phase to let Excalidraw handle events first
    window.addEventListener('keydown', handleKeyDown, false)
    return () => window.removeEventListener('keydown', handleKeyDown, false)
  }, [toggleSidebar, saveCurrentFile, files, activeFile, loadFile, createNewFile])
}