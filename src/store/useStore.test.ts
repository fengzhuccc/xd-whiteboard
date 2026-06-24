import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../store/useStore'
import { mockInvoke } from '../test/setup'

vi.mock('../hooks/useConfirmDialog', () => ({
  confirm: vi.fn(),
}))

describe('useStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStore.setState({
      currentDirectory: null,
      files: [],
      fileTree: [],
      activeFile: null,
      fileContent: null,
      isDirty: false,
      selectedFiles: [],
      sidebarVisible: true,
      expandedFolders: new Set(),
      preferences: {
        lastDirectory: null,
        recentDirectories: [],
        recentFiles: [],
        theme: 'system',
        sidebarVisible: true,
        autoSaveEnabled: true,
        autoSaveInterval: 30,
        language: 'zh',
      },
    })
  })

  describe('basic setters', () => {
    it('should set current directory', () => {
      useStore.getState().setCurrentDirectory('/test/path')
      expect(useStore.getState().currentDirectory).toBe('/test/path')
    })

    it('should set files', () => {
      const files = [{ path: '/test.excalidraw', name: 'test', modified: false }]
      useStore.getState().setFiles(files)
      expect(useStore.getState().files).toEqual(files)
    })

    it('should set file tree', () => {
      const tree = [{ path: '/folder', name: 'folder', is_directory: true, modified: false, children: [] }]
      useStore.getState().setFileTree(tree)
      expect(useStore.getState().fileTree).toEqual(tree)
    })

    it('should set active file', () => {
      const file = { path: '/test.excalidraw', name: 'test', modified: false }
      useStore.getState().setActiveFile(file)
      expect(useStore.getState().activeFile).toEqual(file)
    })

    it('should set file content', () => {
      const content = '{"elements": []}'
      useStore.getState().setFileContent(content)
      expect(useStore.getState().fileContent).toBe(content)
    })

    it('should set isDirty', () => {
      useStore.getState().setIsDirty(true)
      expect(useStore.getState().isDirty).toBe(true)
    })

    it('should toggle sidebar visibility', () => {
      const initial = useStore.getState().sidebarVisible
      useStore.getState().toggleSidebar()
      expect(useStore.getState().sidebarVisible).toBe(!initial)
    })
  })

  describe('file selection', () => {
    it('should toggle file selection', () => {
      useStore.getState().toggleFileSelection('/test.excalidraw')
      expect(useStore.getState().selectedFiles).toContain('/test.excalidraw')

      useStore.getState().toggleFileSelection('/test.excalidraw')
      expect(useStore.getState().selectedFiles).not.toContain('/test.excalidraw')
    })

    it('should clear file selection', () => {
      useStore.getState().setSelectedFiles(['/file1', '/file2'])
      useStore.getState().clearFileSelection()
      expect(useStore.getState().selectedFiles).toEqual([])
    })
  })

  describe('markFileAsModified', () => {
    it('should mark file as modified in files array', () => {
      useStore.getState().setFiles([
        { path: '/test.excalidraw', name: 'test', modified: false },
      ])

      useStore.getState().markFileAsModified('/test.excalidraw', true)

      expect(useStore.getState().files[0].modified).toBe(true)
    })

    it('should not modify non-existent file', () => {
      useStore.getState().setFiles([
        { path: '/test.excalidraw', name: 'test', modified: false },
      ])

      useStore.getState().markFileAsModified('/nonexistent.excalidraw', true)

      expect(useStore.getState().files[0].modified).toBe(false)
    })
  })

  describe('markTreeNodeAsModified', () => {
    it('should mark tree node as modified', () => {
      useStore.getState().setFileTree([
        {
          path: '/folder',
          name: 'folder',
          is_directory: true,
          modified: false,
          children: [
            { path: '/folder/test.excalidraw', name: 'test', is_directory: false, modified: false, children: [] },
          ],
        },
      ])

      useStore.getState().markTreeNodeAsModified('/folder/test.excalidraw', true)

      const tree = useStore.getState().fileTree
      expect(tree[0].children![0].modified).toBe(true)
    })
  })

  describe('updateRecentFiles', () => {
    it('should add file to recent files', () => {
      const file = { path: '/test.excalidraw', name: 'test', modified: false }

      useStore.getState().updateRecentFiles(file)

      const recent = useStore.getState().preferences.recentFiles
      expect(recent[0].path).toBe('/test.excalidraw')
      expect(recent[0].name).toBe('test')
      expect(recent[0].lastOpened).toBeDefined()
    })

    it('should move existing file to front', () => {
      useStore.getState().setPreferences({
        ...useStore.getState().preferences,
        recentFiles: [
          { path: '/test1.excalidraw', name: 'test1', lastOpened: Date.now() },
          { path: '/test2.excalidraw', name: 'test2', lastOpened: Date.now() },
        ],
      })

      const file = { path: '/test2.excalidraw', name: 'test2', modified: false }
      useStore.getState().updateRecentFiles(file)

      const recent = useStore.getState().preferences.recentFiles
      expect(recent[0].path).toBe('/test2.excalidraw')
      expect(recent.length).toBe(2)
    })

    it('should limit recent files to 10', () => {
      const prefs = useStore.getState().preferences
      prefs.recentFiles = Array.from({ length: 10 }, (_, i) => ({
        path: `/test${i}.excalidraw`,
        name: `test${i}`,
        lastOpened: Date.now(),
      }))
      useStore.getState().setPreferences(prefs)

      const newFile = { path: '/new.excalidraw', name: 'new', modified: false }
      useStore.getState().updateRecentFiles(newFile)

      expect(useStore.getState().preferences.recentFiles.length).toBe(10)
      expect(useStore.getState().preferences.recentFiles[0].path).toBe('/new.excalidraw')
    })
  })

  describe('loadFileTree', () => {
    it('should load file tree and files from backend', async () => {
      const mockFiles = [
        { path: '/test.excalidraw', name: 'test', modified: false }
      ]
      const mockTree = [
        { path: '/folder', name: 'folder', is_directory: true, modified: false, children: [] },
      ]
      mockInvoke.mockResolvedValueOnce(mockFiles)
      mockInvoke.mockResolvedValueOnce(mockTree)

      await useStore.getState().loadFileTree('/test/dir')

      expect(mockInvoke).toHaveBeenCalledWith('list_excalidraw_files', { directory: '/test/dir' })
      expect(mockInvoke).toHaveBeenCalledWith('get_file_tree', { directory: '/test/dir' })
      expect(useStore.getState().files).toEqual(mockFiles)
      expect(useStore.getState().fileTree).toEqual(mockTree)
    })
  })

  describe('loadDirectory', () => {
    it('should load directory and update state', async () => {
      const mockFiles = [
        { path: '/test.excalidraw', name: 'test', modified: false }
      ]
      const mockTree = [
        { path: '/folder', name: 'folder', is_directory: true, modified: false, children: [] },
      ]
      mockInvoke.mockResolvedValueOnce(mockFiles)
      mockInvoke.mockResolvedValueOnce(mockTree)

      await useStore.getState().loadDirectory('/test/dir')

      expect(useStore.getState().currentDirectory).toBe('/test/dir')
      expect(useStore.getState().files).toEqual(mockFiles)
      expect(useStore.getState().fileTree).toEqual(mockTree)
      expect(useStore.getState().activeFile).toBeNull()
    })
  })
})
