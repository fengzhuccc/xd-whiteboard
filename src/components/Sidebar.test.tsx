import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar } from '../components/Sidebar'
import { I18nProvider } from '../hooks/useI18n'

const mockLoadDirectory = vi.fn()
const mockClearFileSelection = vi.fn()
const mockBatchDeleteFiles = vi.fn()

vi.mock('../store/useStore', () => ({
  useStore: vi.fn((selector) => {
    const state = {
      currentDirectory: '/test/directory',
      fileTree: [],
      selectedFiles: [],
      clearFileSelection: mockClearFileSelection,
      batchDeleteFiles: mockBatchDeleteFiles,
      loadDirectory: mockLoadDirectory,
      preferences: {
        lastDirectory: null,
        recentDirectories: [],
        recentFiles: [],
        theme: 'warm-white',
        sidebarVisible: true,
        autoSaveEnabled: true,
        autoSaveInterval: 30,
        language: 'zh',
      },
    }
    if (typeof selector === 'function') {
      return selector(state)
    }
    return state
  }),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}))

vi.mock('../hooks/useConfirmDialog', () => ({
  confirm: vi.fn(),
}))

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render file tree header', () => {
    render(
      <I18nProvider>
        <Sidebar />
      </I18nProvider>
    )
    expect(screen.getByText('0 个文件')).toBeInTheDocument()
  })

  it('should display current directory name', () => {
    render(
      <I18nProvider>
        <Sidebar />
      </I18nProvider>
    )
    expect(screen.getByText('directory')).toBeInTheDocument()
  })

  it('should show empty state when no files', () => {
    render(
      <I18nProvider>
        <Sidebar />
      </I18nProvider>
    )
    expect(screen.getByText('未找到 .excalidraw 文件')).toBeInTheDocument()
  })
})
