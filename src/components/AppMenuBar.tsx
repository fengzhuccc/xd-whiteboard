import { useState, useEffect } from 'react'
import {
  FolderOpen,
  FilePlus,
  Save,
  Folder,
  FileText,
  PanelLeft,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minus,
  Square,
  X,
  Keyboard,
  Info,
  Copy,
  Check,
  Loader2,
  Settings,
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
} from '@/components/ui/menubar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useStore } from '../store/useStore'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useExcalidrawActions } from '../hooks/useExcalidrawActions'
import { useI18n } from '../hooks/useI18n'

const SHORTCUTS_EN = [
  { category: 'File', shortcuts: [
    { keys: 'Ctrl+O', action: 'Open Workspace' },
    { keys: 'Ctrl+N', action: 'New File' },
    { keys: 'Ctrl+S', action: 'Save' },
    { keys: 'Ctrl+Q', action: 'Quit' },
  ]},
  { category: 'View', shortcuts: [
    { keys: 'Ctrl+B', action: 'Toggle Sidebar' },
    { keys: 'Ctrl+=', action: 'Zoom In' },
    { keys: 'Ctrl+-', action: 'Zoom Out' },
    { keys: 'Ctrl+0', action: 'Reset Zoom' },
    { keys: 'F11', action: 'Toggle Fullscreen' },
  ]},
  { category: 'File Tree', shortcuts: [
    { keys: 'F2', action: 'Rename' },
    { keys: 'Delete', action: 'Delete' },
  ]},
]

const SHORTCUTS_ZH = [
  { category: '文件', shortcuts: [
    { keys: 'Ctrl+O', action: '打开工作空间' },
    { keys: 'Ctrl+N', action: '新建文件' },
    { keys: 'Ctrl+S', action: '保存' },
    { keys: 'Ctrl+Q', action: '退出' },
  ]},
  { category: '视图', shortcuts: [
    { keys: 'Ctrl+B', action: '切换侧边栏' },
    { keys: 'Ctrl+=', action: '放大' },
    { keys: 'Ctrl+-', action: '缩小' },
    { keys: 'Ctrl+0', action: '重置缩放' },
    { keys: 'F11', action: '切换全屏' },
  ]},
  { category: '文件树', shortcuts: [
    { keys: 'F2', action: '重命名' },
    { keys: 'Delete', action: '删除' },
  ]},
]

export function AppMenuBar() {
  const { t, language } = useI18n()
  const currentDirectory = useStore((s) => s.currentDirectory)
  const activeFile = useStore((s) => s.activeFile)
  const saveCurrentFile = useStore((s) => s.saveCurrentFile)
  const createNewFile = useStore((s) => s.createNewFile)
  const selectDirectory = useStore((s) => s.selectDirectory)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const setPreferencesOpen = useStore((s) => s.setPreferencesOpen)
  const shortcutsDialogOpen = useStore((s) => s.shortcutsDialogOpen)
  const setShortcutsDialogOpen = useStore((s) => s.setShortcutsDialogOpen)
  const recentDirectories = useStore((s) => s.preferences.recentDirectories)
  const recentFiles = useStore((s) => s.preferences.recentFiles)
  const saveStatus = useStore((s) => s.saveStatus)

  const [showAbout, setShowAbout] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [isMaximized, setIsMaximized] = useState(false)
  const { zoomIn, zoomOut, resetZoom } = useExcalidrawActions()

  const SHORTCUTS = language === 'zh' ? SHORTCUTS_ZH : SHORTCUTS_EN

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

    const fetchVersion = async () => {
      try {
        const version = await invoke<string>('get_app_version')
        setAppVersion(version)
      } catch {
        setAppVersion('0.1.0')
      }
    }
    fetchVersion()

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  const handleOpenDirectory = async () => {
    await selectDirectory()
  }

  const handleNewFile = async () => {
    if (!currentDirectory) {
      await selectDirectory()
    }
    if (useStore.getState().currentDirectory) {
      await createNewFile()
    }
  }

  const handleSave = async () => {
    if (activeFile) {
      await saveCurrentFile()
    }
  }

  const handleToggleSidebar = () => {
    toggleSidebar()
  }

  const handleZoomIn = () => zoomIn()

  const handleZoomOut = () => zoomOut()

  const handleResetZoom = () => resetZoom()

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
    await invoke('force_close_app')
  }

  const handleQuit = async () => {
    await invoke('force_close_app')
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

  const handlePreferences = () => {
    setPreferencesOpen(true)
  }

  return (
    <>
      <header className="h-10 flex items-center justify-between px-3 shrink-0 select-none relative z-40 bg-surface-2 border-b border-border drag-region">
        <div className="flex items-center gap-1 h-full no-drag">
          <img
            src="/icon.png"
            alt={t.appName}
            className="w-6 h-6 mr-1 rounded object-contain"
          />
          <span
            className="text-sm font-semibold mr-3"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--primary)',
              fontSize: '1.1rem',
            }}
          >
            {t.appName}
          </span>

          <Menubar className="h-full border-0 bg-transparent rounded-none px-0">
            <MenubarMenu>
              <MenubarTrigger className="px-2.5 py-1 rounded-md text-sm transition-colors data-[state=open]:bg-surface-3 data-[state=open]:text-foreground text-muted-foreground">
                {t.file}
              </MenubarTrigger>
              <MenubarContent>
                <MenubarItem onClick={handleOpenDirectory}>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  {t.openWorkspace}
                  <MenubarShortcut>Ctrl+O</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={handleNewFile} disabled={!currentDirectory}>
                  <FilePlus className="w-4 h-4 mr-2" />
                  {t.newFile}
                  <MenubarShortcut>Ctrl+N</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={handleSave} disabled={!activeFile}>
                  <Save className="w-4 h-4 mr-2" />
                  {t.save}
                  <MenubarShortcut>Ctrl+S</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                {recentDirectories.length > 0 && (
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
                          <span className="truncate max-w-[200px]">{dir.split(/[\\/]/).pop()}</span>
                        </MenubarItem>
                      ))}
                    </MenubarSubContent>
                  </MenubarSub>
                )}
                {recentFiles.length > 0 && (
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
                          <span className="truncate max-w-[200px]">{file.name}</span>
                        </MenubarItem>
                      ))}
                    </MenubarSubContent>
                  </MenubarSub>
                )}
                <MenubarSeparator />
                <MenubarItem onClick={handlePreferences}>
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
              <MenubarTrigger className="px-2.5 py-1 rounded-md text-sm transition-colors data-[state=open]:bg-surface-3 data-[state=open]:text-foreground text-muted-foreground">
                {t.view}
              </MenubarTrigger>
              <MenubarContent>
                <MenubarItem onClick={handleToggleSidebar}>
                  <PanelLeft className="w-4 h-4 mr-2" />
                  {t.toggleSidebar}
                  <MenubarShortcut>Ctrl+B</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={handleZoomIn}>
                  <ZoomIn className="w-4 h-4 mr-2" />
                  {t.zoomIn}
                  <MenubarShortcut>Ctrl+=</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={handleZoomOut}>
                  <ZoomOut className="w-4 h-4 mr-2" />
                  {t.zoomOut}
                  <MenubarShortcut>Ctrl+-</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={handleResetZoom}>
                  <Maximize className="w-4 h-4 mr-2" />
                  {t.resetZoom}
                  <MenubarShortcut>Ctrl+0</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={handleFullscreen}>
                  <Square className="w-4 h-4 mr-2" />
                  {t.toggleFullscreen}
                  <MenubarShortcut>F11</MenubarShortcut>
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger className="px-2.5 py-1 rounded-md text-sm transition-colors data-[state=open]:bg-surface-3 data-[state=open]:text-foreground text-muted-foreground">
                {t.help}
              </MenubarTrigger>
              <MenubarContent>
                <MenubarItem onClick={() => setShortcutsDialogOpen(true)}>
                  <Keyboard className="w-4 h-4 mr-2" />
                  {t.keyboardShortcuts}
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={() => setShowAbout(true)}>
                  <Info className="w-4 h-4 mr-2" />
                  {t.aboutApp}
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        </div>

        <div className="flex items-center gap-2 h-full no-drag">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-state-warning">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t.saving}
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-state-success">
              <Check className="w-3 h-3" />
              {t.saved}
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-state-error">{t.error}</span>
          )}

          <div className="flex items-center ml-2 gap-0.5">
            <button
              className="w-7 h-7 flex items-center justify-center rounded-md transition-colors duration-150 text-muted-foreground hover:bg-surface-3"
              aria-label={t.minimize}
              onClick={handleMinimize}
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center rounded-md transition-colors duration-150 text-muted-foreground hover:bg-surface-3"
              aria-label={isMaximized ? t.restore : t.maximize}
              onClick={handleMaximize}
            >
              {isMaximized ? (
                <Copy className="w-3.5 h-3.5" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center rounded-md transition-colors duration-150 text-muted-foreground hover:bg-state-error/20 hover:text-state-error"
              aria-label={t.close}
              onClick={handleClose}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="sm:max-w-[320px] p-0 gap-0 overflow-hidden border-border bg-card shadow-float">
          <div className="relative px-5 pt-5 pb-5">
            {/* Hand-drawn frame decoration top */}
            <svg
              className="absolute top-2 left-2 right-2 h-5 pointer-events-none"
              style={{ opacity: 0.15 }}
              viewBox="0 0 320 20"
              fill="none"
              preserveAspectRatio="none"
            >
              <path
                d="M2,8 C40,4 80,14 160,6 C240,2 280,12 318,7"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            <div className="flex justify-center mb-3">
              <img
                src="/icon.png"
                alt={t.appName}
                className="w-12 h-12 rounded-lg object-contain"
              />
            </div>

            <h2
              className="text-center mb-1"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.75rem',
                color: 'var(--primary)',
              }}
            >
              {t.appName}
            </h2>

            <div className="flex justify-center mb-3">
              <svg width="100" height="8" viewBox="0 0 100 8" fill="none" style={{ opacity: 0.3 }}>
                <path
                  d="M2,5 C20,2 40,7 60,4 C75,2 85,6 98,4"
                  stroke="var(--primary)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">
                {t.version} <span className="font-mono text-foreground">{appVersion ? `v${appVersion}` : ''}</span>
              </p>
              <p className="text-sm leading-relaxed text-foreground">{t.aboutDescription}</p>
              <div className="my-3 border-t border-border" />
              <p className="text-sm text-muted-foreground">
                {t.license}
              </p>
            </div>

            {/* Hand-drawn frame decoration bottom */}
            <div
              className="absolute -bottom-px -right-px pointer-events-none"
              style={{ opacity: 0.15 }}
            >
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                <path
                  d="M58,10 C55,20 48,40 50,50 C52,55 55,57 58,58"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M10,58 C20,55 40,48 50,50 C55,52 57,55 58,58"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shortcutsDialogOpen} onOpenChange={setShortcutsDialogOpen}>
        <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden border-border bg-card shadow-float">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle className="text-base font-semibold">{t.keyboardShortcuts}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t.shortcutsDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              {SHORTCUTS.map((group) => (
                <div key={group.category}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-primary">
                    {group.category}
                  </h4>
                  <div className="space-y-1">
                    {group.shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.keys}
                        className="flex items-center justify-between py-1"
                      >
                        <span className="text-sm text-foreground">{shortcut.action}</span>
                        <kbd className="inline-flex items-center px-1.5 py-0.5 text-xs font-mono bg-surface-2 border border-border rounded text-muted-foreground">
                          {shortcut.keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
