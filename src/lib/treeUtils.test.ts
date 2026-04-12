import { describe, it, expect } from 'vitest'
import { getFileCount, flattenTree, findNodeByPath, isDescendant, getParentPath } from './treeUtils'
import { FileTreeNode } from '../types'

describe('treeUtils', () => {
  describe('getFileCount', () => {
    it('should return 0 for undefined children', () => {
      expect(getFileCount(undefined)).toBe(0)
    })

    it('should return 0 for empty children', () => {
      expect(getFileCount([])).toBe(0)
    })

    it('should count files only', () => {
      const children: FileTreeNode[] = [
        { path: '/file1.excalidraw', name: 'file1', is_directory: false, modified: false, children: [] },
        { path: '/folder', name: 'folder', is_directory: true, modified: false, children: [] },
        { path: '/file2.excalidraw', name: 'file2', is_directory: false, modified: false, children: [] },
      ]
      expect(getFileCount(children)).toBe(2)
    })

    it('should count files recursively', () => {
      const children: FileTreeNode[] = [
        { path: '/file1.excalidraw', name: 'file1', is_directory: false, modified: false, children: [] },
        {
          path: '/folder',
          name: 'folder',
          is_directory: true,
          modified: false,
          children: [
            { path: '/folder/file2.excalidraw', name: 'file2', is_directory: false, modified: false, children: [] },
            {
              path: '/folder/subfolder',
              name: 'subfolder',
              is_directory: true,
              modified: false,
              children: [
                { path: '/folder/subfolder/file3.excalidraw', name: 'file3', is_directory: false, modified: false, children: [] },
              ],
            },
          ],
        },
      ]
      expect(getFileCount(children)).toBe(3)
    })
  })

  describe('flattenTree', () => {
    it('should return empty array for empty nodes', () => {
      expect(flattenTree([], 0, new Set())).toEqual([])
    })

    it('should flatten single level tree', () => {
      const nodes: FileTreeNode[] = [
        { path: '/file1', name: 'file1', is_directory: false, modified: false, children: [] },
        { path: '/file2', name: 'file2', is_directory: false, modified: false, children: [] },
      ]
      const result = flattenTree(nodes, 0, new Set())
      expect(result.length).toBe(2)
      expect(result[0].depth).toBe(0)
      expect(result[1].depth).toBe(0)
    })

    it('should not include children of closed folders', () => {
      const nodes: FileTreeNode[] = [
        {
          path: '/folder',
          name: 'folder',
          is_directory: true,
          modified: false,
          children: [
            { path: '/folder/file1', name: 'file1', is_directory: false, modified: false, children: [] },
          ],
        },
      ]
      const result = flattenTree(nodes, 0, new Set())
      expect(result.length).toBe(1)
      expect(result[0].node.path).toBe('/folder')
    })

    it('should include children of open folders', () => {
      const nodes: FileTreeNode[] = [
        {
          path: '/folder',
          name: 'folder',
          is_directory: true,
          modified: false,
          children: [
            { path: '/folder/file1', name: 'file1', is_directory: false, modified: false, children: [] },
          ],
        },
      ]
      const result = flattenTree(nodes, 0, new Set(['/folder']))
      expect(result.length).toBe(2)
      expect(result[0].depth).toBe(0)
      expect(result[1].depth).toBe(1)
    })

    it('should handle nested open folders', () => {
      const nodes: FileTreeNode[] = [
        {
          path: '/folder',
          name: 'folder',
          is_directory: true,
          modified: false,
          children: [
            {
              path: '/folder/subfolder',
              name: 'subfolder',
              is_directory: true,
              modified: false,
              children: [
                { path: '/folder/subfolder/file1', name: 'file1', is_directory: false, modified: false, children: [] },
              ],
            },
          ],
        },
      ]
      const result = flattenTree(nodes, 0, new Set(['/folder', '/folder/subfolder']))
      expect(result.length).toBe(3)
      expect(result[0].depth).toBe(0)
      expect(result[1].depth).toBe(1)
      expect(result[2].depth).toBe(2)
    })
  })

  describe('findNodeByPath', () => {
    it('should return null for empty nodes', () => {
      expect(findNodeByPath([], '/path')).toBeNull()
    })

    it('should find node at root level', () => {
      const nodes: FileTreeNode[] = [
        { path: '/file1', name: 'file1', is_directory: false, modified: false, children: [] },
        { path: '/file2', name: 'file2', is_directory: false, modified: false, children: [] },
      ]
      const result = findNodeByPath(nodes, '/file2')
      expect(result?.name).toBe('file2')
    })

    it('should find nested node', () => {
      const nodes: FileTreeNode[] = [
        {
          path: '/folder',
          name: 'folder',
          is_directory: true,
          modified: false,
          children: [
            { path: '/folder/file1', name: 'file1', is_directory: false, modified: false, children: [] },
          ],
        },
      ]
      const result = findNodeByPath(nodes, '/folder/file1')
      expect(result?.name).toBe('file1')
    })

    it('should return null for non-existent path', () => {
      const nodes: FileTreeNode[] = [
        { path: '/file1', name: 'file1', is_directory: false, modified: false, children: [] },
      ]
      expect(findNodeByPath(nodes, '/nonexistent')).toBeNull()
    })
  })

  describe('isDescendant', () => {
    it('should return true for direct child (Windows path)', () => {
      expect(isDescendant('/parent', '/parent\\child')).toBe(true)
    })

    it('should return true for direct child (Unix path)', () => {
      expect(isDescendant('/parent', '/parent/child')).toBe(true)
    })

    it('should return true for nested descendant', () => {
      expect(isDescendant('/parent', '/parent/child/grandchild')).toBe(true)
    })

    it('should return false for unrelated paths', () => {
      expect(isDescendant('/parent', '/other/child')).toBe(false)
    })

    it('should return false for same path', () => {
      expect(isDescendant('/path', '/path')).toBe(false)
    })

    it('should return false for sibling paths', () => {
      expect(isDescendant('/parent1', '/parent2/child')).toBe(false)
    })
  })

  describe('getParentPath', () => {
    it('should return parent path for Windows path', () => {
      expect(getParentPath('C:\\Users\\test\\file.excalidraw')).toBe('C:\\Users\\test')
    })

    it('should return parent path for Unix path', () => {
      expect(getParentPath('/home/user/file.excalidraw')).toBe('/home/user')
    })

    it('should return empty string for root path', () => {
      expect(getParentPath('/file.excalidraw')).toBe('')
    })

    it('should handle nested paths', () => {
      expect(getParentPath('/folder/subfolder/file.excalidraw')).toBe('/folder/subfolder')
    })
  })
})
