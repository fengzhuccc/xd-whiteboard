import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useStore } from '../store/useStore'

function isEditableTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null
  if (!target) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  // contenteditable 元素（Excalidraw 文本编辑、重命名 input 等）
  if (target.isContentEditable) return true
  return false
}

export function useKeyboardShortcuts() {
  // 只订阅所需的 store 字段，避免 fileContent 每 100ms 更新触发本 hook 重建监听器。
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const saveCurrentFile = useStore((s) => s.saveCurrentFile)
  const files = useStore((s) => s.files)
  const activeFile = useStore((s) => s.activeFile)
  const loadFile = useStore((s) => s.loadFile)
  const createNewFile = useStore((s) => s.createNewFile)

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // 输入框/文本域聚焦时不拦截快捷键，避免重命名时按 Ctrl+O 触发打开目录。
      if (isEditableTarget(e)) {
        return
      }

      const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
      const isMac = (nav.userAgentData?.platform || navigator.platform || '')
        .toUpperCase()
        .includes('MAC')
      const modKey = isMac ? e.metaKey : e.ctrlKey

      if (!modKey) return

      // 大小写不敏感，兼容 CapsLock 开启场景。
      const key = e.key.toLowerCase()

      // Let Excalidraw handle clipboard natively.
      if (key === 'c' || key === 'v' || key === 'x' || key === 'a') {
        return
      }

      // Cmd/Ctrl + S: Save current file
      if (key === 's') {
        e.preventDefault()
        await saveCurrentFile()
        return
      }

      // Cmd/Ctrl + B: Toggle sidebar
      if (key === 'b') {
        e.preventDefault()
        toggleSidebar()
        return
      }

      // Cmd/Ctrl + O: Open directory
      if (key === 'o') {
        e.preventDefault()
        const dir = await invoke<string | null>('select_directory')
        if (dir) {
          await useStore.getState().loadDirectory(dir)
        }
        return
      }

      // Cmd/Ctrl + N: New file
      if (key === 'n') {
        e.preventDefault()

        const state = useStore.getState()

        if (!state.currentDirectory) {
          const dir = await invoke<string | null>('select_directory')
          if (dir) {
            await state.loadDirectory(dir)
          }
        }

        if (!useStore.getState().currentDirectory) return

        await createNewFile()
        return
      }

      // Cmd/Ctrl + Tab: Switch files
      if (key === 'tab') {
        if (files.length > 1 && activeFile) {
          e.preventDefault()
          const currentIndex = files.findIndex((f) => f.path === activeFile.path)
          if (e.shiftKey) {
            const prevIndex = currentIndex <= 0 ? files.length - 1 : currentIndex - 1
            await loadFile(files[prevIndex])
          } else {
            const nextIndex = (currentIndex + 1) % files.length
            await loadFile(files[nextIndex])
          }
        }
      }
    }

    // Use non-capturing phase to let Excalidraw handle events first
    window.addEventListener('keydown', handleKeyDown, false)
    return () => window.removeEventListener('keydown', handleKeyDown, false)
  }, [toggleSidebar, saveCurrentFile, files, activeFile, loadFile, createNewFile])
}