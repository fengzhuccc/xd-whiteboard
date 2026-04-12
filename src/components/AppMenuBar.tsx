import { useState, useEffect } from 'react'
import {
  FolderOpen,
  FilePlus,
  Save,
  SaveAll,
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
  Clipboard,
  ClipboardCopy,
  ClipboardPaste,
  Scissors,
  Copy,
  Globe,
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
import { confirm } from '../hooks/useConfirmDialog'
import { useI18n } from '../hooks/useI18n'
import { Language } from '../lib/i18n'

const SHORTCUTS_EN = [
  { category: 'File', shortcuts: [
    { keys: 'Ctrl+O', action: 'Open Directory' },
    { keys: 'Ctrl+N', action: 'New File' },
    { keys: 'Ctrl+S', action: 'Save' },
    { keys: 'Ctrl+Shift+S', action: 'Save As' },
    { keys: 'Ctrl+Q', action: 'Quit' },
  ]},
  { category: 'Edit', shortcuts: [
    { keys: 'Ctrl+X', action: 'Cut' },
    { keys: 'Ctrl+C', action: 'Copy' },
    { keys: 'Ctrl+V', action: 'Paste' },
    { keys: 'Ctrl+A', action: 'Select All' },
  ]},
  { category: 'View', shortcuts: [
    { keys: 'Ctrl+B', action: 'Toggle Sidebar' },
    { keys: 'Ctrl++', action: 'Zoom In' },
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
    { keys: 'Ctrl+O', action: '打开目录' },
    { keys: 'Ctrl+N', action: '新建文件' },
    { keys: 'Ctrl+S', action: '保存' },
    { keys: 'Ctrl+Shift+S', action: '另存为' },
    { keys: 'Ctrl+Q', action: '退出' },
  ]},
  { category: '编辑', shortcuts: [
    { keys: 'Ctrl+X', action: '剪切' },
    { keys: 'Ctrl+C', action: '复制' },
    { keys: 'Ctrl+V', action: '粘贴' },
    { keys: 'Ctrl+A', action: '全选' },
  ]},
  { category: '视图', shortcuts: [
    { keys: 'Ctrl+B', action: '切换侧边栏' },
    { keys: 'Ctrl++', action: '放大' },
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
  const { t, language, setLanguage } = useI18n()
  const {
    currentDirectory,
    activeFile,
    isDirty,
    saveCurrentFile,
    createNewFile,
    selectDirectory,
    toggleSidebar,
    preferences,
  } = useStore()

  const [showAbout, setShowAbout] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

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
      return
    }
    await createNewFile()
  }

  const handleSave = async () => {
    if (activeFile) {
      await saveCurrentFile()
    }
  }

  const handleSaveAs = async () => {
    if (!activeFile || !isDirty) return
    await useStore.getState().saveFileAs()
  }

  const handleToggleSidebar = () => {
    toggleSidebar()
  }

  const handleZoomIn = async () => {
    const excalidrawAPI = (window as unknown as { excalidrawAPI?: { updateScene: (scene: { appState: { zoom: number } }) => void; getSceneElements: () => unknown[]; getAppState: () => { zoom: number } } }).excalidrawAPI
    if (excalidrawAPI) {
      const currentZoom = excalidrawAPI.getAppState().zoom
      excalidrawAPI.updateScene({
        appState: { zoom: currentZoom * 1.2 }
      })
    }
  }

  const handleZoomOut = async () => {
    const excalidrawAPI = (window as unknown as { excalidrawAPI?: { updateScene: (scene: { appState: { zoom: number } }) => void; getSceneElements: () => unknown[]; getAppState: () => { zoom: number } } }).excalidrawAPI
    if (excalidrawAPI) {
      const currentZoom = excalidrawAPI.getAppState().zoom
      excalidrawAPI.updateScene({
        appState: { zoom: currentZoom / 1.2 }
      })
    }
  }

  const handleResetZoom = async () => {
    const excalidrawAPI = (window as unknown as { excalidrawAPI?: { updateScene: (scene: { appState: { zoom: number } }) => void; getSceneElements: () => unknown[]; getAppState: () => { zoom: number } } }).excalidrawAPI
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({
        appState: { zoom: 1 }
      })
    }
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
      const shouldSave = await confirm({
        title: t.unsavedChanges,
        description: language === 'zh' ? '关闭前是否保存更改？' : 'Do you want to save your changes before closing?',
        confirmLabel: language === 'zh' ? '保存并关闭' : 'Save & Close',
        cancelLabel: t.dontSave,
      })

      if (shouldSave) {
        await saveCurrentFile()
      }
    }
    await invoke('force_close_app')
  }

  const handleQuit = async () => {
    await handleClose()
  }

  const handleOpenRecentDir = async (dir: string) => {
    await useStore.getState().loadDirectory(dir)
  }

  const handleOpenRecentFile = async (path: string, name: string) => {
    await useStore.getState().loadFile({
      path,
      name,
      modified: false,
    })
  }

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
  }

  return (
    <>
      <div className="h-10 bg-background border-b border-border flex items-center drag-region">
        <div className="flex items-center px-3 h-full cursor-default">
          <img 
            src="/icon.png" 
            alt={language === 'zh' ? '小呆画板' : 'XD Sketchpad'} 
            className="w-5 h-5"
          />
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
              <MenubarItem onClick={handleSaveAs} disabled={!activeFile}>
                <SaveAll className="w-4 h-4 mr-2" />
                {t.saveAs}
                <MenubarShortcut>Ctrl+Shift+S</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              {preferences.recentDirectories.length > 0 && (
                <MenubarSub>
                  <MenubarSubTrigger>
                    <Folder className="w-4 h-4 mr-2" />
                    {language === 'zh' ? '最近目录' : 'Recent Directories'}
                  </MenubarSubTrigger>
                  <MenubarSubContent>
                    {preferences.recentDirectories.slice(0, 5).map((dir) => (
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
              {preferences.recentFiles.length > 0 && (
                <MenubarSub>
                  <MenubarSubTrigger>
                    <FileText className="w-4 h-4 mr-2" />
                    {language === 'zh' ? '最近文件' : 'Recent Files'}
                  </MenubarSubTrigger>
                  <MenubarSubContent>
                    {preferences.recentFiles.slice(0, 5).map((file) => (
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
              <MenubarItem onClick={handleQuit}>
                <X className="w-4 h-4 mr-2" />
                {language === 'zh' ? '退出' : 'Quit'}
                <MenubarShortcut>Ctrl+Q</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>{t.edit}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => document.execCommand('cut')}>
                <Scissors className="w-4 h-4 mr-2" />
                {language === 'zh' ? '剪切' : 'Cut'}
                <MenubarShortcut>Ctrl+X</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={() => document.execCommand('copy')}>
                <ClipboardCopy className="w-4 h-4 mr-2" />
                {language === 'zh' ? '复制' : 'Copy'}
                <MenubarShortcut>Ctrl+C</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={() => document.execCommand('paste')}>
                <ClipboardPaste className="w-4 h-4 mr-2" />
                {language === 'zh' ? '粘贴' : 'Paste'}
                <MenubarShortcut>Ctrl+V</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => document.execCommand('selectAll')}>
                <Clipboard className="w-4 h-4 mr-2" />
                {language === 'zh' ? '全选' : 'Select All'}
                <MenubarShortcut>Ctrl+A</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>{t.view}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={handleToggleSidebar}>
                <PanelLeft className="w-4 h-4 mr-2" />
                {language === 'zh' ? '切换侧边栏' : 'Toggle Sidebar'}
                <MenubarShortcut>Ctrl+B</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={handleZoomIn}>
                <ZoomIn className="w-4 h-4 mr-2" />
                {language === 'zh' ? '放大' : 'Zoom In'}
                <MenubarShortcut>Ctrl++</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={handleZoomOut}>
                <ZoomOut className="w-4 h-4 mr-2" />
                {language === 'zh' ? '缩小' : 'Zoom Out'}
                <MenubarShortcut>Ctrl+-</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={handleResetZoom}>
                <Maximize className="w-4 h-4 mr-2" />
                {language === 'zh' ? '重置缩放' : 'Reset Zoom'}
                <MenubarShortcut>Ctrl+0</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={handleFullscreen}>
                <Square className="w-4 h-4 mr-2" />
                {language === 'zh' ? '切换全屏' : 'Toggle Fullscreen'}
                <MenubarShortcut>F11</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>{language === 'zh' ? '窗口' : 'Window'}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={handleMinimize}>
                <Minus className="w-4 h-4 mr-2" />
                {language === 'zh' ? '最小化' : 'Minimize'}
                <MenubarShortcut>Ctrl+M</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={handleClose}>
                <X className="w-4 h-4 mr-2" />
                {language === 'zh' ? '关闭' : 'Close'}
                <MenubarShortcut>Ctrl+W</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>{t.help}</MenubarTrigger>
            <MenubarContent>
              <MenubarSub>
                <MenubarSubTrigger>
                  <Globe className="w-4 h-4 mr-2" />
                  {t.language}
                </MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarRadioGroup value={language}>
                    <MenubarRadioItem
                      value="en"
                      onClick={() => handleLanguageChange('en')}
                    >
                      {t.english}
                    </MenubarRadioItem>
                    <MenubarRadioItem
                      value="zh"
                      onClick={() => handleLanguageChange('zh')}
                    >
                      {t.chinese}
                    </MenubarRadioItem>
                  </MenubarRadioGroup>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSeparator />
              <MenubarItem onClick={() => setShowShortcuts(true)}>
                <Keyboard className="w-4 h-4 mr-2" />
                {t.keyboardShortcuts}
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => setShowAbout(true)}>
                <Info className="w-4 h-4 mr-2" />
                {t.about}
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        <div className="flex-1" />

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
              <Copy className="w-3.5 h-3.5" />
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
                  alt={language === 'zh' ? '小呆画板' : 'XD Sketchpad'} 
                  className="w-14 h-14 object-contain"
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{language === 'zh' ? '小呆画板' : 'XD Sketchpad'}</h3>
                <p className="text-sm text-muted-foreground">{t.version} 1.0.0</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t.aboutDescription}
            </p>
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
            <DialogDescription>
              {language === 'zh' ? '使用这些快捷键提高效率' : 'Use these shortcuts to work faster'}
            </DialogDescription>
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
    </>
  )
}
