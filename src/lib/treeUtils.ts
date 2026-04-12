import { FileTreeNode } from '../types'

export function getFileCount(children: FileTreeNode[] | undefined): number {
  let count = 0
  if (children) {
    for (const child of children) {
      if (!child.is_directory) count++
      if (child.children) count += getFileCount(child.children)
    }
  }
  return count
}

export interface FlatNode {
  node: FileTreeNode
  depth: number
}

export function flattenTree(
  nodes: FileTreeNode[],
  depth: number = 0,
  openFolders: Set<string>
): FlatNode[] {
  const result: FlatNode[] = []
  for (const node of nodes) {
    result.push({ node, depth })
    if (node.is_directory && node.children && openFolders.has(node.path)) {
      result.push(...flattenTree(node.children, depth + 1, openFolders))
    }
  }
  return result
}

export function findNodeByPath(nodes: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNodeByPath(node.children, path)
      if (found) return found
    }
  }
  return null
}

export function isDescendant(parentPath: string, childPath: string): boolean {
  return childPath.startsWith(parentPath + '\\') || childPath.startsWith(parentPath + '/')
}

export function getParentPath(path: string): string {
  return path.substring(0, path.lastIndexOf('\\')) || path.substring(0, path.lastIndexOf('/'))
}
