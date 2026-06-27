import { useState, useEffect } from 'react'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import {
  FolderOpen,
  FilePlus,
  Save,
  ImageDown,
  Folder,
  FileText,
  PanelLeft,
  Minus,
  Square,
  X,
  Keyboard,
  Info,
  Check,
  Loader2,
  Settings,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
  MenubarRadioItem,
  MenubarRadioGroup,
} from '@/components/ui/menubar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

import { useStore } from '../store/useStore'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useI18n } from '../hooks/useI18n'
import { PreferencesDialog } from './PreferencesDialog'

const SHORTCUTS_EN = [
  {
    category: 'File',
    shortcuts: [
      { keys: 'Ctrl+O', action: 'Open Workspace' },
      { keys: 'Ctrl+N', action: 'New File' },
      { keys: 'Ctrl+S', action: 'Save' },
      { keys: 'Ctrl+Shift+E', action: 'Export Image' },
      { keys: 'Ctrl+,', action: 'Preferences' },
      { keys: 'Ctrl+Q', action: 'Quit' },
    ],
  },
  {
    category: 'View',
    shortcuts: [
      { keys: 'Ctrl+B', action: 'Toggle Sidebar' },
      { keys: 'F11', action: 'Toggle Fullscreen' },
    ],
  },
  {
    category: 'File Tree',
    shortcuts: [
      { keys: 'F2', action: 'Rename' },
      { keys: 'Delete', action: 'Delete' },
    ],
  },
]

const SHORTCUTS_ZH = [
  {
    category: '文件',
    shortcuts: [
      { keys: 'Ctrl+O', action: '打开工作空间' },
      { keys: 'Ctrl+N', action: '新建文件' },
      { keys: 'Ctrl+S', action: '保存' },
      { keys: 'Ctrl+Shift+E', action: '导出图片' },
      { keys: 'Ctrl+,', action: '偏好设置' },
      { keys: 'Ctrl+Q', action: '退出' },
    ],
  },
  {
    category: '视图',
    shortcuts: [
      { keys: 'Ctrl+B', action: '切换侧边栏' },
      { keys: 'F11', action: '切换全屏' },
    ],
  },
  {
    category: '文件树',
    shortcuts: [
      { keys: 'F2', action: '重命名' },
      { keys: 'Delete', action: '删除' },
    ],
  },
]

export function AppMenuBar() {
  const { t, language } = useI18n()
  const currentDirectory = useStore((s) => s.currentDirectory)
  const activeFile = useStore((s) => s.activeFile)
  const isDirty = useStore((s) => s.isDirty)
  const fileContent = useStore((s) => s.fileContent)
  const saveCurrentFile = useStore((s) => s.saveCurrentFile)
  const createNewFile = useStore((s) => s.createNewFile)
  const selectDirectory = useStore((s) => s.selectDirectory)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const recentDirectories = useStore((s) => s.preferences.recentDirectories)
  const recentFiles = useStore((s) => s.preferences.recentFiles)
  const theme = useStore((s) => s.preferences.theme)
  const setPreferences = useStore((s) => s.setPreferences)
  const savePreferences = useStore((s) => s.savePreferences)
  const zoom = useStore((s) => s.zoom)
  const saveStatus = useStore((s) => s.saveStatus)

  const [showAbout, setShowAbout] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  const SHORTCUTS = language === 'zh' ? SHORTCUTS_ZH : SHORTCUTS_EN

  // 同步窗口标题：显示当前文件名与未保存标记。
  useEffect(() => {
    const title = activeFile
      ? `${isDirty ? '* ' : ''}${activeFile.name.replace('.excalidraw', '')} - ${t.appName}`
      : t.appName
    getCurrentWindow().setTitle(title).catch(() => {})
  }, [activeFile, isDirty, t.appName])

  useEffect(() => {
    const checkMaximized = async () => {
      const window = getCurrentWindow()
      const maximized = await window.isMaximized()
      setIsMaximized(maximized)
    }
    checkMaximized()

    const unlisten = getCurrentWindow().onResized(async () => {
      const window = getCurrentWindow()
      const maximized = await window.isMaximized()
      setIsMaximized(maximized)
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  // 监听来自 Rust 原生菜单的事件，打开对应对话框。
  useEffect(() => {
    const unlisteners: UnlistenFn[] = []

    listen('show-preferences-dialog', () => setShowPreferences(true)).then((fn) =>
      unlisteners.push(fn)
    )
    listen('show-shortcuts-dialog', () => setShowShortcuts(true)).then((fn) =>
      unlisteners.push(fn)
    )

    return () => {
      unlisteners.forEach((fn) => fn())
    }
  }, [])

  const handleOpenDirectory = async () => {
    await selectDirectory()
  }

  const handleNewFile = async () => {
    const state = useStore.getState()
    if (!state.currentDirectory) {
      const dir = await invoke<string | null>('select_directory')
      if (!dir) return
      await state.loadDirectory(dir)
    }
    if (useStore.getState().currentDirectory) {
      await createNewFile()
    }
  }

  const handleSave = async () => {
    if (!activeFile) return
    await saveCurrentFile()
  }

  const handleExportImage = async () => {
    if (!activeFile || !fileContent) return
    const state = useStore.getState()
    const path = await state.exportFile(fileContent, 'png')
    if (path) {
      // 导出成功后可考虑显示 toast；当前仅依赖状态栏反馈。
    }
  }

  const handleToggleSidebar = () => {
    toggleSidebar()
  }

  const handleFullscreen = async () => {
    const window = getCurrentWindow()
    const isFullscreen = await window.isFullscreen()
    await window.setFullscreen(!isFullscreen)
  }

  const handleMinimize = async () => {
    const window = getCurrentWindow()
    await window.minimize()
  }

  const handleMaximize = async () => {
    const window = getCurrentWindow()
    const maximized = await window.isMaximized()
    if (maximized) {
      await window.unmaximize()
    } else {
      await window.maximize()
    }
    setIsMaximized(!maximized)
  }

  const handleClose = async () => {
    if (isDirty) {
      const shouldProceed = await useStore
        .getState()
        .promptSaveIfDirty(t.unsavedChangesCloseDescription)
      if (!shouldProceed) return
    }
    await invoke('force_close_app')
  }

  const handleQuit = async () => {
    await handleClose()
  }

  const promptToSaveIfDirty = async (): Promise<boolean> => {
    return useStore.getState().promptSaveIfDirty()
  }

  const handleOpenRecentDir = async (dir: string) => {
    const shouldProceed = await promptToSaveIfDirty()
    if (!shouldProceed) return
    await useStore.getState().loadDirectory(dir)
  }

  const handleOpenRecentFile = async (path: string, name: string) => {
    const shouldProceed = await promptToSaveIfDirty()
    if (!shouldProceed) return
    await useStore.getState().loadFile({
      path,
      name,
      modified: false,
    })
  }

  const handleThemeChange = (nextTheme: 'system' | 'light' | 'dark') => {
    const next = { ...useStore.getState().preferences, theme: nextTheme }
    setPreferences(next)
    savePreferences()

    const root = document.documentElement
    if (nextTheme === 'dark') {
      root.classList.add('dark')
    } else if (nextTheme === 'light') {
      root.classList.remove('dark')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }

  const hasRecentItems = recentDirectories.length > 0 || recentFiles.length > 0

  return (
    <>
      <div className="h-10 bg-background border-b border-border flex items-center drag-region">
        <div className="flex items-center px-3 h-full cursor-default">
          <img src="/icon.png" alt={t.appName} className="w-5 h-5" />
        </div>
        <Menubar className="h-full border-0 bg-transparent rounded-none px-0 no-drag">
          <MenubarMenu>
            <MenubarTrigger>{t.file}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={handleOpenDirectory}>
                <FolderOpen className="w-4 h-4 mr-2" />
                {t.openWorkspace}
                <MenubarShortcut>Ctrl+O</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={handleNewFile}>
                <FilePlus className="w-4 h-4 mr-2" />
                {t.newFile}
                <MenubarShortcut>Ctrl+N</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={handleSave}
                disabled={!activeFile || !isDirty}
              >
                <Save className="w-4 h-4 mr-2" />
                {t.save}
                <MenubarShortcut>Ctrl+S</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={handleExportImage}
                disabled={!activeFile || !fileContent}
              >
                <ImageDown className="w-4 h-4 mr-2" />
                {t.exportImage}
                <MenubarShortcut>Ctrl+Shift+E</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              {hasRecentItems && (
                <MenubarSub>
                  <MenubarSubTrigger>
                    <Folder className="w-4 h-4 mr-2" />
                    {t.recentDirectories}
                  </MenubarSubTrigger>
                  <MenubarSubContent>
                    {recentDirectories.slice(0, 5).map((dir) => (
                      <MenubarItem
                        key={dir}
                        onClick={() => handleOpenRecentDir(dir)}
                      >
                        <span className="truncate max-w-[200px]">
                          {dir.split(/[\\/]/).pop()}
                        </span>
                      </MenubarItem>
                    ))}
                  </MenubarSubContent>
                </MenubarSub>
              )}
              {hasRecentItems && recentFiles.length > 0 && (
                <MenubarSub>
                  <MenubarSubTrigger>
                    <FileText className="w-4 h-4 mr-2" />
                    {t.recentFiles}
                  </MenubarSubTrigger>
                  <MenubarSubContent>
                    {recentFiles.slice(0, 5).map((file) => (
                      <MenubarItem
                        key={file.path}
                        onClick={() => handleOpenRecentFile(file.path, file.name)}
                      >
                        <span className="truncate max-w-[200px]">
                          {file.name}
                        </span>
                      </MenubarItem>
                    ))}
                  </MenubarSubContent>
                </MenubarSub>
              )}
              {hasRecentItems && <MenubarSeparator />}
              <MenubarItem onClick={() => setShowPreferences(true)}>
                <Settings className="w-4 h-4 mr-2" />
                {t.preferences}
                <MenubarShortcut>Ctrl+,</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={handleQuit}>
                <X className="w-4 h-4 mr-2" />
                {t.quit}
                <MenubarShortcut>Ctrl+Q</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>{t.view}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={handleToggleSidebar}>
                <PanelLeft className="w-4 h-4 mr-2" />
                {t.toggleSidebar}
                <MenubarShortcut>Ctrl+B</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarSub>
                <MenubarSubTrigger>
                  <Sun className="w-4 h-4 mr-2" />
                  {t.theme}
                </MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarRadioGroup value={theme}>
                    <MenubarRadioItem
                      value="system"
                      onClick={() => handleThemeChange('system')}
                    >
                      <Monitor className="w-3.5 h-3.5 mr-2" />
                      {t.themeSystem}
                    </MenubarRadioItem>
                    <MenubarRadioItem
                      value="light"
                      onClick={() => handleThemeChange('light')}
                    >
                      <Sun className="w-3.5 h-3.5 mr-2" />
                      {t.themeLight}
                    </MenubarRadioItem>
                    <MenubarRadioItem
                      value="dark"
                      onClick={() => handleThemeChange('dark')}
                    >
                      <Moon className="w-3.5 h-3.5 mr-2" />
                      {t.themeDark}
                    </MenubarRadioItem>
                  </MenubarRadioGroup>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSeparator />
              <MenubarItem onClick={handleFullscreen}>
                <Square className="w-4 h-4 mr-2" />
                {t.toggleFullscreen}
                <MenubarShortcut>F11</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => setShowShortcuts(true)}>
                <Keyboard className="w-4 h-4 mr-2" />
                {t.keyboardShortcuts}
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>{t.help}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setShowAbout(true)}>
                <Info className="w-4 h-4 mr-2" />
                {t.about}
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        <div className="flex-1" />

        <div className="flex items-center h-full px-2 gap-3 no-drag text-xs text-muted-foreground">
          {activeFile && (
            <span className="hidden sm:inline">{Math.round(zoom * 100)}%</span>
          )}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t.saving}
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-green-600">
              <Check className="w-3 h-3" />
              {t.saved}
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-destructive">{t.error}</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md hover:bg-muted"
            onClick={() => setShowPreferences(true)}
            title={t.preferences}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center h-full px-1 no-drag">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none hover:bg-muted"
            onClick={handleMinimize}
          >
            <Minus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none hover:bg-muted"
            onClick={handleMaximize}
          >
            {isMaximized ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none hover:bg-muted hover:bg-destructive/20"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.aboutTitle}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center overflow-hidden">
                <img
                  src="/icon.png"
                  alt={t.appName}
                  className="w-14 h-14 object-contain"
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{t.appName}</h3>
                <p className="text-sm text-muted-foreground">{t.version} 0.1.0</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{t.aboutDescription}</p>
            <div className="text-xs text-muted-foreground">
              <p>{t.authors}</p>
              <p>{t.license}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.keyboardShortcuts}</DialogTitle>
            <DialogDescription>{t.shortcutsDescription}</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {SHORTCUTS.map((group) => (
              <div key={group.category} className="mb-4 last:mb-0">
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                  {group.category}
                </h4>
                <div className="space-y-1">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.keys}
                      className="flex items-center justify-between py-1.5 px-2 rounded-sm hover:bg-muted"
                    >
                      <span className="text-sm">{shortcut.action}</span>
                      <kbd className="px-2 py-0.5 text-xs font-mono bg-muted rounded">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <PreferencesDialog open={showPreferences} onOpenChange={setShowPreferences} />
    </>
  )
}
